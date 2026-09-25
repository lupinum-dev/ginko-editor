import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { ReplaceStep, Transform, type Step } from '@tiptap/pm/transform'
import { collab, getVersion, receiveTransaction, sendableSteps } from 'prosemirror-collab'
import { decodeCollaborationDocument, decodeCollaborationSteps, stableJson } from './validation'
import {
  assertCollaborationHead, collaborationLimits, collaborationProtocolVersion, CollaborationError, fenceMismatch,
  type CollaborationErrorCode, type CollaborationHead, type CollaborationReply, type CollaborationSnapshot,
  type CollaborationTransport, type CollaborationUser,
} from './protocol'
import { ConfirmedHistory, PresenceTracker, type CollaborationPeer, type CollaborationPresenceOptions } from './presence'

const remoteChange = new PluginKey('ginkoCollaborationRemote')
const presenceKey = new PluginKey('ginkoCollaborationPresence')
const maxPendingSteps = 2048
const maxPendingBytes = 2 * 1024 * 1024
const maxRecoveryBytes = 4 * 1024 * 1024
// Rebasing can enlarge both document copies and escaped pending operations.
// Reserve import capacity for that accepted remote growth. Local edits still
// use the smaller budget before dispatch; no pending work is truncated.
const maxRecoveredBytes = 16 * 1024 * 1024
// Typing uses a size estimate below this share of the document limit and
// measures the document exactly above it.
const estimatedDocumentShare = 0.5
const maxEstimatedTransactions = 64
const encoder = new TextEncoder()

function transactionGroups(pending: NonNullable<ReturnType<typeof sendableSteps>>) {
  const groups: string[][] = []
  for (let index = 0; index < pending.steps.length; index++) {
    if (index === 0 || pending.origins[index] !== pending.origins[index - 1]) groups.push([])
    groups.at(-1)!.push(JSON.stringify(pending.steps[index]!.toJSON()))
  }
  return groups
}

/** @experimental */
export type CollaborationStatus = 'connecting' | 'syncing' | 'synced' | 'offline' | 'error' | 'stale' | 'closed'

/**
 * Reason for an `offline`, `error` or `stale` state, or for a refused local change.
 * `offline`, `timeout` and `unavailable` retry automatically with backoff.
 * `rejected` means the server refused pending changes: call `discardPendingAndResync()`.
 * `schema_mismatch`, `policy_mismatch`, `replaced` and `history_expired` require a reopen.
 * @experimental
 */
export type CollaborationStateCode = 'offline' | 'timeout' | 'unavailable' | 'rejected' | 'forbidden'
  | 'schema_mismatch' | 'policy_mismatch' | 'replaced' | 'history_expired' | 'conflict' | 'storage' | 'limit' | 'internal'

/** @experimental */
export interface CollaborationState {
  status: CollaborationStatus
  version: number
  pendingSteps: number
  message?: string
  code?: CollaborationStateCode
}

/**
 * Hosts use this for connection failures. The session keeps local edits and retries.
 * @experimental
 */
export class CollaborationConnectionError extends CollaborationError {
  constructor(message = 'Connection lost. Your changes are kept in this editor.') {
    super('unavailable', message)
    this.name = 'CollaborationConnectionError'
  }
}

class CollaborationTimeoutError extends CollaborationConnectionError {
  constructor() {
    super('The server did not answer in time. Your changes are kept in this editor.')
    this.name = 'CollaborationTimeoutError'
  }
}

/** A failure raised by the session itself, with its state code. */
class SessionFailure extends CollaborationError {
  constructor(code: CollaborationErrorCode, readonly stateCode: CollaborationStateCode, message: string) {
    super(code, message)
  }
}

/** @experimental */
export interface CollaborationRecovery {
  format: 1
  clientId: string
  base: CollaborationSnapshot
  steps: string[]
  /** Step counts for the original transactions. A batch must not split one. */
  groups: number[]
  /** Derived from base + steps, retained for recovery if a future client cannot decode old steps. */
  document: string
}

/**
 * Parse host-owned recovery storage without trusting its JSON shape.
 * @experimental
 */
export function parseCollaborationRecovery(source: string): CollaborationRecovery {
  if (encoder.encode(source).byteLength > maxRecoveredBytes) throw new CollaborationError('limit', 'The editor recovery copy is too large.')
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new CollaborationError('invalid', 'Invalid editor recovery copy.')
  }
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 1
    || !('clientId' in value) || typeof value.clientId !== 'string'
    || !('document' in value) || typeof value.document !== 'string'
    || !('steps' in value) || !Array.isArray(value.steps) || !value.steps.every((step: unknown): step is string => typeof step === 'string')
    || !('groups' in value) || !Array.isArray(value.groups) || !value.groups.every((group: unknown): group is number => typeof group === 'number')
    || !('base' in value) || !value.base || typeof value.base !== 'object') {
    throw new CollaborationError('invalid', 'Invalid editor recovery copy.')
  }
  const base = value.base
  if (!('epoch' in base) || typeof base.epoch !== 'string'
    || !('schemaRevision' in base) || typeof base.schemaRevision !== 'string'
    || !('policyRevision' in base) || typeof base.policyRevision !== 'string'
    || !('version' in base) || typeof base.version !== 'number'
    || !('document' in base) || typeof base.document !== 'string') {
    throw new CollaborationError('invalid', 'Invalid editor recovery base.')
  }
  // Session construction validates fences, limits, and base + steps against
  // the stored document before attaching it to an editor.
  return { format: 1, clientId: value.clientId, document: value.document,
    steps: value.steps, groups: value.groups, base: { epoch: base.epoch,
      schemaRevision: base.schemaRevision, policyRevision: base.policyRevision,
      version: base.version, document: base.document } }
}

/** @experimental */
export interface EditorCollaborationOptions {
  clientId: string
  snapshot: CollaborationSnapshot
  transport: CollaborationTransport
  recovery?: CollaborationRecovery
  /**
   * Persist synchronously in host-owned storage. Throw if the recovery copy cannot be saved.
   * The session calls it at most once per `recoveryDelayMs`, when the page is hidden,
   * and from `flushRecovery()`, `flush()`, `discardPendingAndResync()` and `close()`.
   */
  onRecovery?: (recovery: CollaborationRecovery | null) => void
  /** Delay for `onRecovery` writes. `0` writes after every change. Default: 300 ms. */
  recoveryDelayMs?: number
  /** Receives unsent changes before `discardPendingAndResync()` removes them. Throw to keep them. */
  onDiscard?: (recovery: CollaborationRecovery) => void
  /** Time limit for one pull or push request. Default: 15 s. */
  requestTimeoutMs?: number
  /** Retry delay bounds. Each retry waits a random time up to the current bound. */
  backoff?: { initialMs?: number; maxMs?: number }
  /** Local collaborator identity for presence. Without it, the session only shows other collaborators. */
  user?: CollaborationUser
  /** Presence tuning, or `false` to turn presence off when the transport supports it. */
  presence?: false | CollaborationPresenceOptions
}

const errorCodes: Record<CollaborationStateCode, CollaborationErrorCode> = {
  offline: 'unavailable', timeout: 'unavailable', unavailable: 'unavailable', rejected: 'content', forbidden: 'forbidden',
  schema_mismatch: 'schema', policy_mismatch: 'policy', replaced: 'epoch', history_expired: 'version', conflict: 'version',
  storage: 'limit', limit: 'limit', internal: 'invalid',
}
const staleCodes = { epoch: 'replaced', schema: 'schema_mismatch', policy: 'policy_mismatch', history: 'history_expired' } as const
const transientPattern = /network|timed? ?out|timeout|temporarily|unavailable|ECONN|EPIPE|ENOTFOUND|EAI_AGAIN|socket|fetch failed|failed to fetch/i

interface Failure { status: 'offline' | 'error' | 'stale'; code: CollaborationStateCode; message: string }

function readCode(error: object): unknown {
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('data' in error && error.data && typeof error.data === 'object' && 'code' in error.data) return error.data.code
}

function readStatus(error: object): number | undefined {
  for (const key of ['status', 'statusCode']) {
    if (key in error && typeof (error as Record<string, unknown>)[key] === 'number') return (error as Record<string, number>)[key]
  }
}

/** Classify a transport or validation failure. Unknown failures while sending are rejections. */
export function classifyCollaborationFailure(error: unknown, sending = false): Failure {
  const message = error instanceof Error && error.message ? error.message : 'Synchronization failed. Keep this editor open and retry.'
  if (error instanceof SessionFailure) {
    return { status: ['schema_mismatch', 'policy_mismatch', 'replaced'].includes(error.stateCode) ? 'stale' : 'error', code: error.stateCode, message }
  }
  if (error instanceof CollaborationTimeoutError) return { status: 'offline', code: 'timeout', message }
  if (error instanceof CollaborationConnectionError) return { status: 'offline', code: 'offline', message }
  if (error && typeof error === 'object') {
    const code = readCode(error)
    const status = readStatus(error)
    if (code === 'unavailable' || (status !== undefined && (status >= 500 || [408, 425, 429].includes(status)))) {
      return { status: 'offline', code: 'unavailable', message }
    }
    if (['forbidden', 'unauthenticated', 'unauthorized'].includes(String(code)) || status === 401 || status === 403) {
      return { status: 'error', code: 'forbidden', message }
    }
    if (code === 'schema' || code === 'protocol') return { status: 'stale', code: 'schema_mismatch', message }
    if (code === 'policy') return { status: 'stale', code: 'policy_mismatch', message }
    if (code === 'epoch') return { status: 'stale', code: 'replaced', message }
    if (code === 'version') return { status: 'error', code: 'conflict', message }
    if (['content', 'invalid', 'limit'].includes(String(code))) return { status: 'error', code: sending ? 'rejected' : 'internal', message }
    if (error instanceof Error && (['AbortError', 'TimeoutError', 'NetworkError'].includes(error.name) || transientPattern.test(error.message))) {
      return { status: 'offline', code: error.name === 'TimeoutError' ? 'timeout' : 'unavailable', message }
    }
  }
  return { status: 'error', code: sending ? 'rejected' : 'internal', message }
}

interface CollabStateShape { version: number; unconfirmed: unknown[] }

/**
 * One session belongs to one mounted editor. Hosts own identity, transport and storage.
 * @experimental
 */
export class EditorCollaborationSession {
  readonly extension: Extension
  readonly initialDocument: JSONContent
  private readonly initial: CollaborationSnapshot
  private readonly clientId: string
  private readonly collabPlugin: Plugin
  private readonly history: ConfirmedHistory
  private readonly presence?: PresenceTracker
  private instance?: Editor
  private confirmed: Node
  private current: CollaborationState
  private listeners = new Set<(state: CollaborationState) => void>()
  private unsubscribe?: () => void
  private timer?: ReturnType<typeof setTimeout>
  private timerDue = Infinity
  private busy = false
  private requested = false
  private generation = 0
  private observedVersion: number
  private attempt = 0
  private restored = false
  private restoring = false
  private orphanOwnSteps = false
  private recoveryTimer?: ReturnType<typeof setTimeout>
  private recoveryDirty = false
  private recoveryStored: boolean
  private stepSizes = new WeakMap<Step, number>()
  private docSizes = new WeakMap<Node, number>()
  private estimate?: { doc: Node; bytes: number; count: number }
  private removeWindowListeners?: () => void

  constructor(private readonly options: EditorCollaborationOptions) {
    // Vue must not wrap the session or its ProseMirror values in reactive
    // proxies: node type identity is part of the schema. This is `markRaw()`.
    Object.defineProperty(this, '__v_skip', { value: true })
    assertCollaborationHead(options.snapshot)
    const recovery = options.recovery
    if (recovery) {
      if (recovery.format !== 1 || !Array.isArray(recovery.steps) || recovery.steps.length > maxPendingSteps
        || !Array.isArray(recovery.groups) || recovery.groups.some(count => !Number.isSafeInteger(count) || count <= 0 || count > collaborationLimits.stepsPerBatch)
        || recovery.groups.reduce((sum, count) => sum + count, 0) !== recovery.steps.length
        || encoder.encode(JSON.stringify(recovery)).byteLength > maxRecoveredBytes) {
        throw new CollaborationError('invalid', 'Invalid editor recovery copy.')
      }
      assertCollaborationHead(recovery.base)
      const mismatch = fenceMismatch(recovery.base, options.snapshot)
      if (mismatch) throw new CollaborationError(mismatch, 'This recovery copy belongs to an older document. Keep it before reopening.')
      if (recovery.base.version > options.snapshot.version) throw new CollaborationError('version', 'The server is older than this recovery copy.')
    }
    this.initial = { ...(recovery?.base ?? options.snapshot) }
    delete this.initial.protocolVersion
    this.clientId = recovery?.clientId ?? options.clientId
    if (typeof this.clientId !== 'string' || !this.clientId || this.clientId.length > 200) {
      throw new CollaborationError('invalid', 'Invalid editor client ID.')
    }
    this.confirmed = decodeCollaborationDocument(this.initial.document)
    if (recovery) {
      const local = new Transform(this.confirmed)
      let index = 0
      for (const count of recovery.groups) {
        for (const step of decodeCollaborationSteps(recovery.steps.slice(index, index + count), this.confirmed.type.schema)) local.step(step)
        index += count
      }
      if (JSON.stringify(local.doc.toJSON()) !== recovery.document) throw new CollaborationError('invalid', 'The recovery copy does not match its pending steps.')
    }
    this.recoveryStored = !!recovery?.steps.length
    this.initialDocument = this.confirmed.toJSON()
    this.observedVersion = options.snapshot.version
    this.history = new ConfirmedHistory(this.initial.version)
    this.current = { status: 'connecting', version: this.initial.version, pendingSteps: recovery?.steps.length ?? 0 }
    this.collabPlugin = collab({ version: this.initial.version, clientID: this.clientId })
    const channel = options.presence === false ? undefined : options.transport.presence
    if (channel) {
      this.presence = new PresenceTracker({ ...(options.presence || {}), clientId: this.clientId, epoch: this.initial.epoch,
        channel, user: options.user, history: this.history,
        getState: () => this.instance?.isDestroyed === false ? this.instance.state : undefined,
        getConfirmedSize: () => this.confirmed.content.size,
        redraw: () => {
          const editor = this.instance
          if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(presenceKey, true).setMeta('addToHistory', false))
        },
      })
    }
    const presence = this.presence
    this.extension = Extension.create({
      name: 'ginkoCollaboration',
      priority: 1000,
      addProseMirrorPlugins: () => [this.collabPlugin, new Plugin({
        filterTransaction: (transaction, state) => this.filterLocal(transaction, state),
      }), ...(presence ? [new Plugin({ key: presenceKey, props: { decorations: state => presence.decorations(state) } })] : [])],
      onCreate: ({ editor }) => { this.attach(editor) },
      onTransaction: ({ transaction }) => {
        if (transaction.docChanged || transaction.getMeta(remoteChange)) this.changed()
        if (!transaction.getMeta(presenceKey) && (transaction.docChanged || transaction.selectionSet || transaction.getMeta(remoteChange))) {
          this.presence?.changed()
        }
      },
      onDestroy: () => { this.close() },
    })
  }

  get state(): Readonly<CollaborationState> { return this.current }
  get canEdit() {
    return !['error', 'stale', 'closed'].includes(this.current.status) && this.current.pendingSteps < maxPendingSteps
  }
  /** Remote collaborators with selections mapped into this document. Empty without a presence channel. */
  get peers(): readonly CollaborationPeer[] { return this.presence?.peers ?? [] }
  /** Calls the listener now and after each collaborator change. Returns a cleanup function. */
  onPeersChange(listener: (peers: readonly CollaborationPeer[]) => void) {
    if (!this.presence) { listener([]); return () => {} }
    return this.presence.onPeersChange(listener)
  }

  subscribe(listener: (state: CollaborationState) => void) {
    this.listeners.add(listener)
    listener(this.current)
    return () => { this.listeners.delete(listener) }
  }

  private setState(status: CollaborationStatus, message?: string, code?: CollaborationStateCode) {
    const state: CollaborationState = { status, version: this.instance ? getVersion(this.instance.state) : this.initial.version,
      pendingSteps: this.instance ? sendableSteps(this.instance.state)?.steps.length ?? 0 : this.current.pendingSteps }
    if (state.pendingSteps >= maxPendingSteps) {
      state.message = 'Reconnect to continue writing. This editor has reached its unsent change limit.'
      state.code = 'limit'
    } else {
      if (message) state.message = message
      if (code) state.code = code
    }
    this.current = Object.freeze(state)
    for (const listener of this.listeners) listener(this.current)
  }

  private refuse(message: string) {
    this.setState(this.current.status, message, 'limit')
    return false
  }

  private stepSize(step: Step) {
    let size = this.stepSizes.get(step)
    if (size === undefined) {
      size = encoder.encode(JSON.stringify(step.toJSON())).byteLength
      this.stepSizes.set(step, size)
    }
    return size
  }

  private docSize(doc: Node) {
    let size = this.docSizes.get(doc)
    if (size === undefined) {
      size = encoder.encode(JSON.stringify(doc.toJSON())).byteLength
      this.docSizes.set(doc, size)
    }
    return size
  }

  /**
   * Upper estimate of the next document size. Plain replace steps grow the JSON
   * by about their own size; the estimate doubles it and measures exactly near
   * the limit, after other step types and after a bounded number of estimates.
   */
  private nextDocumentSize(before: Node, after: Node, steps: readonly Step[], added: number) {
    const known = this.docSizes.get(before) ?? (this.estimate?.doc === before ? this.estimate.bytes : undefined)
    const count = this.estimate?.doc === before ? this.estimate.count : 0
    if (known !== undefined && count < maxEstimatedTransactions && steps.every(step => step instanceof ReplaceStep)) {
      const bytes = known + 2 * added
      if (bytes < collaborationLimits.documentBytes * estimatedDocumentShare) {
        this.estimate = { doc: after, bytes, count: count + 1 }
        return bytes
      }
    }
    const bytes = this.docSize(after)
    this.estimate = { doc: after, bytes, count: 0 }
    return bytes
  }

  private filterLocal(transaction: Transaction, state: EditorState) {
    if (!transaction.docChanged || transaction.getMeta(remoteChange)) return true
    if (!this.canEdit) return false
    const size = transaction.steps.reduce((sum, step) => sum + this.stepSize(step), 0)
    if (transaction.steps.length > collaborationLimits.stepsPerBatch || size > collaborationLimits.batchBytes) {
      return this.refuse('This change is too large. Insert a smaller part of the content.')
    }
    const pending = sendableSteps(state)
    if ((pending?.steps.length ?? 0) + transaction.steps.length > maxPendingSteps) return false
    const pendingBytes = pending?.steps.reduce((sum, step) => sum + this.stepSize(step), 0) ?? 0
    const recoveryLimit = 'Reconnect before adding more changes. The recovery copy has reached its size limit.'
    if (pendingBytes + size > maxPendingBytes) return this.refuse(recoveryLimit)
    const documentBytes = this.nextDocumentSize(state.doc, transaction.doc, transaction.steps, size)
    if (documentBytes > collaborationLimits.documentBytes) return this.refuse('This change is too large. Insert a smaller part of the content.')
    // JSON escaping at most doubles an encoded string inside the recovery file.
    // Build the actual file only when this bound is too close to the budget.
    const steps = (pending?.steps.length ?? 0) + transaction.steps.length
    const bound = 2 * (this.docSize(this.confirmed) + documentBytes + pendingBytes + size) + 16 * steps + 4096
    if (bound <= maxRecoveryBytes) return true
    if (this.docSize(transaction.doc) > collaborationLimits.documentBytes) return this.refuse('This change is too large. Insert a smaller part of the content.')
    const encoded = pending?.steps.map(step => JSON.stringify(step.toJSON())) ?? []
    const added = transaction.steps.map(step => JSON.stringify(step.toJSON()))
    const recovery: CollaborationRecovery = { format: 1, clientId: this.clientId,
      base: { ...this.initial, version: getVersion(state), document: JSON.stringify(this.confirmed.toJSON()) },
      steps: [...encoded, ...added], groups: [...(pending ? transactionGroups(pending).map(group => group.length) : []), added.length],
      document: JSON.stringify(transaction.doc.toJSON()),
    }
    if (encoder.encode(JSON.stringify(recovery)).byteLength > maxRecoveryBytes) return this.refuse(recoveryLimit)
    return true
  }

  private attach(editor: Editor) {
    if (this.instance || this.current.status === 'closed') throw new Error('A collaboration session can only mount once.')
    this.instance = editor
    this.confirmed = decodeCollaborationDocument(this.initial.document, editor.schema)
    if (!editor.state.doc.eq(this.confirmed)) throw new CollaborationError('content', 'The editor must start from the session document.')
    const recovery = this.options.recovery
    if (recovery?.steps.length && !this.restored) {
      this.restored = true
      this.restoring = true
      let index = 0
      for (const count of recovery.groups) {
        const transaction = editor.state.tr.setMeta(remoteChange, true)
        for (const step of decodeCollaborationSteps(recovery.steps.slice(index, index + count), editor.schema)) transaction.step(step)
        editor.view.dispatch(transaction)
        index += count
      }
      this.restoring = false
      this.changed()
    }
    this.listenToPage()
    this.startSubscription()
    this.presence?.start()
    this.schedule(0)
  }

  private listenToPage() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const persist = () => { this.flushRecovery() }
    const hidden = () => { if (document.visibilityState === 'hidden') this.flushRecovery() }
    const online = () => { if (this.current.status === 'offline') this.schedule(0) }
    window.addEventListener('pagehide', persist)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hidden)
    this.removeWindowListeners = () => {
      window.removeEventListener('pagehide', persist)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hidden)
    }
  }

  private startSubscription() {
    this.unsubscribe?.()
    const generation = this.generation
    this.unsubscribe = this.options.transport.subscribe(head => {
      if (generation !== this.generation) return
      if (this.current.status === 'closed' || this.current.status === 'stale') return
      try {
        const mismatch = fenceMismatch(this.initial, head)
        if (mismatch) {
          this.setState('stale', 'This document was replaced or its policy changed. Keep your recovery copy and reopen it.', staleCodes[mismatch])
          this.presence?.stop(true)
          return
        }
        assertCollaborationHead(head)
        this.observedVersion = Math.max(this.observedVersion, head.version)
        if (this.current.status === 'error') return
        // A new head also ends a retry wait early.
        this.schedule(0)
      } catch (error) { this.fail(error) }
    }, error => { if (generation === this.generation) this.fail(error) })
  }

  private changed() {
    if (!this.instance || this.restoring || this.current.status === 'closed') return
    this.queueRecovery()
    if (['error', 'stale'].includes(this.current.status)) { this.setState(this.current.status, this.current.message, this.current.code); return }
    if (this.current.status === 'offline') this.setState('offline', this.current.message, this.current.code)
    else this.setState('syncing', this.current.message, this.current.code === 'limit' ? 'limit' : undefined)
    this.schedule(40)
  }

  private queueRecovery() {
    if (!this.options.onRecovery || !this.instance) return
    // Remote changes without local work do not change an empty recovery copy.
    if (!this.recoveryStored && !sendableSteps(this.instance.state)) return
    this.recoveryDirty = true
    const delay = this.options.recoveryDelayMs ?? 300
    if (delay <= 0) { this.flushRecovery(); return }
    this.recoveryTimer ??= setTimeout(() => { this.recoveryTimer = undefined; this.flushRecovery() }, delay)
  }

  /** Write the current recovery copy through `onRecovery` now. Returns false if the host could not save it. */
  flushRecovery(): boolean {
    clearTimeout(this.recoveryTimer)
    this.recoveryTimer = undefined
    if (!this.recoveryDirty || !this.options.onRecovery || !this.instance) return true
    this.recoveryDirty = false
    const recovery = this.getRecovery()
    try {
      this.options.onRecovery(recovery)
      this.recoveryStored = recovery !== null
      return true
    } catch {
      this.recoveryDirty = true
      if (this.current.status !== 'closed') {
        this.setState('error', 'The recovery copy could not be saved. Keep this editor open and retry after freeing storage.', 'storage')
      }
      return false
    }
  }

  getRecovery(): CollaborationRecovery | null {
    if (!this.instance) return this.options.recovery ? structuredClone(this.options.recovery) : null
    const pending = sendableSteps(this.instance.state)
    return pending ? { format: 1, clientId: this.clientId,
      base: { ...this.initial, version: getVersion(this.instance.state), document: JSON.stringify(this.confirmed.toJSON()) },
      steps: pending.steps.map(step => JSON.stringify(step.toJSON())), groups: transactionGroups(pending).map(group => group.length),
      document: JSON.stringify(this.instance.state.doc.toJSON()),
    } : null
  }

  private schedule(delay: number) {
    if (!this.instance || ['error', 'stale', 'closed'].includes(this.current.status)) return
    this.requested = true
    if (this.busy) return
    const due = Date.now() + delay
    if (this.timer && this.timerDue <= due) return
    clearTimeout(this.timer)
    this.timerDue = due
    this.timer = setTimeout(() => { this.timer = undefined; this.timerDue = Infinity; void this.pump() }, delay)
  }

  private backoffDelay() {
    const initial = this.options.backoff?.initialMs ?? 1000
    const max = this.options.backoff?.maxMs ?? 30_000
    const bound = Math.min(max, initial * 2 ** Math.min(this.attempt, 30))
    return Math.round(Math.random() * bound)
  }

  private head(): CollaborationHead {
    return { epoch: this.initial.epoch, schemaRevision: this.initial.schemaRevision,
      policyRevision: this.initial.policyRevision, version: getVersion(this.instance!.state), protocolVersion: collaborationProtocolVersion }
  }

  private request<T>(operation: () => Promise<T>): Promise<T> {
    const timeout = this.options.requestTimeoutMs ?? 15_000
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { reject(new CollaborationTimeoutError()) }, timeout)
      Promise.resolve().then(operation).then(
        value => { clearTimeout(timer); resolve(value) },
        (error: unknown) => { clearTimeout(timer); reject(error) })
    })
  }

  private apply(reply: CollaborationReply) {
    if (!reply || typeof reply !== 'object') throw new SessionFailure('invalid', 'internal', 'The server returned an invalid reply.')
    if (reply.status === 'stale') {
      const code = staleCodes[reply.reason] ?? 'replaced'
      this.setState('stale', 'The server cannot merge this editing session. Keep your recovery copy and reopen the document.', code)
      this.presence?.stop(true)
      return false
    }
    const editor = this.instance!
    const update = reply.update
    assertCollaborationHead(update)
    if (fenceMismatch(this.initial, update)) throw new SessionFailure('epoch', 'replaced', 'The server returned a different document generation.')
    if (update.fromVersion !== getVersion(editor.state) || !Array.isArray(update.steps) || !Array.isArray(update.clientIds)
      || update.version !== update.fromVersion + update.steps.length || update.steps.length !== update.clientIds.length
      || update.clientIds.some(id => typeof id !== 'string' || !id || id.length > 200)) {
      throw new SessionFailure('invalid', 'internal', 'The server returned an inconsistent editor history.')
    }
    this.observedVersion = Math.max(this.observedVersion, update.version)
    if (!update.steps.length) return true
    const steps = decodeCollaborationSteps(update.steps, editor.schema)
    const pending = sendableSteps(editor.state)
    const clientIds = [...update.clientIds]
    let ownPrefix = true
    for (let index = 0; index < steps.length; index++) {
      if (clientIds[index] !== this.clientId) { ownPrefix = false; continue }
      if (!ownPrefix || !pending?.steps[index] || stableJson(steps[index]!.toJSON()) !== stableJson(pending.steps[index]!.toJSON())) {
        // After a discard, the server may still accept a request sent before it.
        // Those steps are ordinary accepted history, not confirmations.
        if (this.orphanOwnSteps) { clientIds[index] = `\u0000discarded:${this.clientId}`; ownPrefix = false; continue }
        throw new SessionFailure('version', 'conflict', 'Another editor is using this client ID. Keep this recovery copy and reopen with a unique session.')
      }
    }
    const confirmed = new Transform(this.confirmed)
    for (const step of steps) confirmed.step(step)
    confirmed.doc.check()
    const transaction = receiveTransaction(editor.state, steps, clientIds, { mapSelectionBackward: true }).setMeta(remoteChange, true)
    this.history.append(update.fromVersion, confirmed.mapping.maps)
    this.confirmed = confirmed.doc
    editor.view.dispatch(transaction)
    return true
  }

  private async pump() {
    if (!this.instance || this.busy || ['error', 'stale', 'closed'].includes(this.current.status)) return
    this.busy = true
    const generation = this.generation
    let sending = false
    this.setState('syncing')
    try {
      do {
        this.requested = false
        const before = getVersion(this.instance.state)
        const received = await this.request(() => this.options.transport.pull(this.head()))
        if (generation !== this.generation || ['error', 'stale', 'closed'].includes(this.current.status) || !this.apply(received)) return
        if (getVersion(this.instance.state) < this.observedVersion) {
          if (getVersion(this.instance.state) === before) throw new SessionFailure('version', 'conflict', 'The server did not return the missing editor history.')
          this.requested = true
          continue
        }
        const pending = sendableSteps(this.instance.state)
        if (pending) {
          const steps: string[] = []
          let bytes = 0
          for (const group of transactionGroups(pending)) {
            const size = group.reduce((sum, encoded) => sum + encoder.encode(encoded).byteLength, 0)
            if (steps.length + group.length > collaborationLimits.stepsPerBatch || bytes + size > collaborationLimits.batchBytes) break
            bytes += size
            steps.push(...group)
          }
          if (!steps.length) throw new SessionFailure('limit', 'rejected', 'A pending edit is too large to send. Keep a recovery copy before changing it.')
          sending = true
          const reply = await this.request(() => this.options.transport.push({ ...this.head(), clientId: this.clientId, steps }))
          sending = false
          if (generation !== this.generation || ['error', 'stale', 'closed'].includes(this.current.status) || !this.apply(reply)) return
          if (getVersion(this.instance.state) === pending.version) throw new SessionFailure('version', 'conflict', 'The server did not acknowledge the submitted changes.')
          if ((sendableSteps(this.instance.state)?.steps.length ?? 0) < pending.steps.length) this.orphanOwnSteps = false
          this.requested = true
        }
      } while (this.requested && !['error', 'stale', 'closed'].includes(this.current.status))
      if (!['error', 'stale', 'closed'].includes(this.current.status)) {
        this.attempt = 0
        this.setState('synced')
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error, sending)
    } finally {
      if (generation === this.generation) {
        this.busy = false
        if (this.current.status === 'offline') this.schedule(this.backoffDelay())
        else if (this.requested) this.schedule(0)
      }
    }
  }

  private fail(error: unknown, sending = false) {
    if (['closed', 'stale'].includes(this.current.status)) return
    const failure = classifyCollaborationFailure(error, sending)
    this.setState(failure.status, failure.message, failure.code)
    if (failure.status === 'stale') this.presence?.stop(true)
    if (failure.status === 'offline') {
      this.attempt += 1
      this.schedule(this.backoffDelay())
    }
  }

  /** Try again now. Pending changes are sent again; after a rejection use `discardPendingAndResync()`. */
  retry() {
    if (['closed', 'stale'].includes(this.current.status)) return
    // A disconnected transport may leave a promise pending indefinitely. The
    // old request may still complete, but cannot mutate this new attempt.
    this.generation += 1
    this.busy = false
    clearTimeout(this.timer)
    this.timer = undefined
    this.timerDue = Infinity
    this.setState('connecting')
    this.startSubscription()
    this.schedule(0)
  }

  /**
   * Remove unsent local changes and continue from the last accepted document.
   * `onDiscard` receives the removed changes first; if it throws, nothing is removed.
   * Returns the removed recovery copy, or null when nothing was pending.
   */
  discardPendingAndResync(): CollaborationRecovery | null {
    const editor = this.instance
    if (!editor || editor.isDestroyed || ['closed', 'stale'].includes(this.current.status)) return null
    const discarded = this.getRecovery()
    if (discarded) this.options.onDiscard?.(structuredClone(discarded))
    this.generation += 1
    this.busy = false
    clearTimeout(this.timer)
    this.timer = undefined
    this.timerDue = Infinity
    if (discarded) {
      const collabState: CollabStateShape = { version: getVersion(editor.state), unconfirmed: [] }
      this.orphanOwnSteps = true
      editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, this.confirmed.content)
        .setMeta(remoteChange, true).setMeta('addToHistory', false).setMeta(this.collabPlugin, collabState))
    }
    this.recoveryDirty = true
    this.flushRecovery()
    this.attempt = 0
    this.setState('connecting')
    this.startSubscription()
    this.schedule(0)
    return discarded
  }

  /** Resolves only when all local steps have been accepted. The host owns publication. */
  flush(timeoutMs = 10_000): Promise<CollaborationHead> {
    this.flushRecovery()
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('Flush timeout must be positive.'))
    const settled = () => {
      this.flushRecovery()
      const head = this.head()
      delete head.protocolVersion
      return head
    }
    const failure = (state: CollaborationState) => new CollaborationError(state.code ? errorCodes[state.code] : 'invalid',
      state.message ?? 'The editing session is closed.')
    if (this.current.status === 'synced' && !this.busy && !this.current.pendingSteps) return Promise.resolve(settled())
    if (['error', 'stale', 'closed'].includes(this.current.status)) return Promise.reject(failure(this.current))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new CollaborationConnectionError('Changes are still waiting for the server. Keep this editor open.')) }, timeoutMs)
      const listener = (state: CollaborationState) => {
        if (state.status === 'synced' && !state.pendingSteps) { clearTimeout(timer); unsubscribe(); resolve(settled()) }
        else if (['error', 'stale', 'closed'].includes(state.status)) { clearTimeout(timer); unsubscribe(); reject(failure(state)) }
      }
      const unsubscribe = () => { this.listeners.delete(listener) }
      this.listeners.add(listener)
      this.schedule(0)
    })
  }

  close() {
    if (this.current.status === 'closed') return
    this.flushRecovery()
    this.generation += 1
    clearTimeout(this.timer)
    clearTimeout(this.recoveryTimer)
    this.unsubscribe?.()
    this.removeWindowListeners?.()
    this.presence?.stop()
    this.setState('closed', this.current.pendingSteps ? 'Unsent changes remain in the host recovery copy.' : undefined)
    this.listeners.clear()
  }
}

/** @experimental */
export function createEditorCollaboration(options: EditorCollaborationOptions) {
  return new EditorCollaborationSession(options)
}
