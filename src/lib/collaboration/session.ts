import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Transform } from '@tiptap/pm/transform'
import { collab, getVersion, receiveTransaction, sendableSteps } from 'prosemirror-collab'
import { decodeCollaborationDocument, decodeCollaborationSteps, stableJson } from './validation'
import {
  assertCollaborationHead, collaborationLimits, CollaborationError, fenceMismatch,
  type CollaborationHead, type CollaborationReply, type CollaborationSnapshot, type CollaborationTransport,
} from './protocol'

const remoteChange = new PluginKey('ginkoCollaborationRemote')
const maxPendingSteps = 2048
const maxPendingBytes = 2 * 1024 * 1024
const maxRecoveryBytes = 4 * 1024 * 1024
// Rebasing can enlarge both document copies and escaped pending operations.
// Reserve import capacity for that accepted remote growth. Local edits still
// use the smaller budget before dispatch; no pending work is truncated.
const maxRecoveredBytes = 16 * 1024 * 1024
const encoder = new TextEncoder()

function transactionGroups(pending: NonNullable<ReturnType<typeof sendableSteps>>) {
  const groups: string[][] = []
  for (let index = 0; index < pending.steps.length; index++) {
    if (index === 0 || pending.origins[index] !== pending.origins[index - 1]) groups.push([])
    groups.at(-1)!.push(JSON.stringify(pending.steps[index]!.toJSON()))
  }
  return groups
}

export type CollaborationStatus = 'connecting' | 'syncing' | 'synced' | 'offline' | 'error' | 'stale' | 'closed'

export interface CollaborationState {
  status: CollaborationStatus
  version: number
  pendingSteps: number
  message?: string
}

/** Hosts use this for connection failures; other errors stop automatic retries. */
export class CollaborationConnectionError extends Error {
  constructor(message = 'Connection lost. Your changes are kept in this editor.') {
    super(message)
    this.name = 'CollaborationConnectionError'
  }
}

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

export interface EditorCollaborationOptions {
  clientId: string
  snapshot: CollaborationSnapshot
  transport: CollaborationTransport
  recovery?: CollaborationRecovery
  /** Persist synchronously in host-owned storage. Throw if the recovery copy cannot be saved. */
  onRecovery?: (recovery: CollaborationRecovery | null) => void
}

/** One session belongs to one mounted editor. Hosts own identity, transport and storage. */
export class EditorCollaborationSession {
  readonly extension: Extension
  readonly initialDocument: JSONContent
  private readonly initial: CollaborationSnapshot
  private readonly clientId: string
  private instance?: Editor
  private confirmed: Node
  private current: CollaborationState
  private listeners = new Set<(state: CollaborationState) => void>()
  private unsubscribe?: () => void
  private timer?: ReturnType<typeof setTimeout>
  private busy = false
  private requested = false
  private generation = 0
  private observedVersion: number
  private retryDelay = 1000
  private restored = false
  private restoring = false

  constructor(private readonly options: EditorCollaborationOptions) {
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
    this.initialDocument = this.confirmed.toJSON()
    this.observedVersion = options.snapshot.version
    this.current = { status: 'connecting', version: this.initial.version, pendingSteps: recovery?.steps.length ?? 0 }
    this.extension = Extension.create({
      name: 'ginkoCollaboration',
      priority: 1000,
      addProseMirrorPlugins: () => {
        return [collab({ version: this.initial.version, clientID: this.clientId }), new Plugin({
          filterTransaction: (transaction, state) => {
            if (!transaction.docChanged || transaction.getMeta(remoteChange)) return true
            const size = transaction.steps.reduce((sum, step) => sum + encoder.encode(JSON.stringify(step.toJSON())).byteLength, 0)
            if (transaction.steps.length > collaborationLimits.stepsPerBatch || size > collaborationLimits.batchBytes
              || encoder.encode(JSON.stringify(transaction.doc.toJSON())).byteLength > collaborationLimits.documentBytes) {
              this.setState(this.current.status, 'This change is too large. Insert a smaller part of the content.')
              return false
            }
            const pending = sendableSteps(state)
            const encoded = pending?.steps.map(step => JSON.stringify(step.toJSON())) ?? []
            const added = transaction.steps.map(step => JSON.stringify(step.toJSON()))
            const pendingBytes = encoded.reduce((sum, step) => sum + encoder.encode(step).byteLength, 0)
            // Encoded JSON strings need escaping again inside a recovery file.
            // Bound the actual file so every accepted offline edit can reopen.
            const recovery: CollaborationRecovery = { format: 1, clientId: this.clientId,
              base: { ...this.initial, version: getVersion(state), document: JSON.stringify(this.confirmed.toJSON()) },
              steps: [...encoded, ...added], groups: [...(pending ? transactionGroups(pending).map(group => group.length) : []), added.length],
              document: JSON.stringify(transaction.doc.toJSON()),
            }
            if (pendingBytes + size > maxPendingBytes || encoder.encode(JSON.stringify(recovery)).byteLength > maxRecoveryBytes) {
              this.setState(this.current.status, 'Reconnect before adding more changes. The recovery copy has reached its size limit.')
              return false
            }
            return this.canEdit && (sendableSteps(state)?.steps.length ?? 0) + transaction.steps.length <= maxPendingSteps
          },
        })]
      },
      onCreate: ({ editor }) => { this.attach(editor) },
      onTransaction: ({ transaction }) => { if (transaction.docChanged || transaction.getMeta(remoteChange)) this.changed() },
      onDestroy: () => { this.close() },
    })
  }

  get state(): Readonly<CollaborationState> { return this.current }
  get canEdit() {
    return !['error', 'stale', 'closed'].includes(this.current.status) && this.current.pendingSteps < maxPendingSteps
  }

  subscribe(listener: (state: CollaborationState) => void) {
    this.listeners.add(listener)
    listener(this.current)
    return () => { this.listeners.delete(listener) }
  }

  private setState(status: CollaborationStatus, message?: string) {
    const state: CollaborationState = { status, version: this.instance ? getVersion(this.instance.state) : this.initial.version,
      pendingSteps: this.instance ? sendableSteps(this.instance.state)?.steps.length ?? 0 : this.current.pendingSteps }
    if (state.pendingSteps >= maxPendingSteps) state.message = 'Reconnect to continue writing. This editor has reached its unsent change limit.'
    else if (message) state.message = message
    this.current = Object.freeze(state)
    for (const listener of this.listeners) listener(this.current)
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
    this.startSubscription()
    this.schedule(0)
  }

  private startSubscription() {
    this.unsubscribe?.()
    const generation = this.generation
    this.unsubscribe = this.options.transport.subscribe(head => {
      if (generation !== this.generation) return
      if (this.current.status === 'closed' || this.current.status === 'stale') return
      try {
        if (fenceMismatch(this.initial, head)) { this.setState('stale', 'This document was replaced or its policy changed. Keep your recovery copy and reopen it.'); return }
        assertCollaborationHead(head)
        this.observedVersion = Math.max(this.observedVersion, head.version)
        if (this.current.status === 'error') return
        this.schedule(0)
      } catch (error) { this.fail(error) }
    }, error => { if (generation === this.generation) this.fail(error) })
  }

  private changed() {
    if (!this.instance || this.restoring || this.current.status === 'closed') return
    try {
      this.options.onRecovery?.(this.getRecovery())
    } catch {
      this.setState('error', 'The recovery copy could not be saved. Keep this editor open and retry after freeing storage.')
      return
    }
    if (['error', 'stale'].includes(this.current.status)) { this.setState(this.current.status, this.current.message); return }
    this.setState(this.current.status === 'offline' ? 'offline' : 'syncing', this.current.message)
    this.schedule(40)
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
    if (this.busy || this.timer) return
    this.timer = setTimeout(() => { this.timer = undefined; void this.pump() }, delay)
  }

  private head(): CollaborationHead {
    return { epoch: this.initial.epoch, schemaRevision: this.initial.schemaRevision,
      policyRevision: this.initial.policyRevision, version: getVersion(this.instance!.state) }
  }

  private apply(reply: CollaborationReply) {
    if (reply.status === 'stale') {
      this.setState('stale', 'The server cannot merge this editing session. Keep your recovery copy and reopen the document.')
      return false
    }
    const editor = this.instance!
    const update = reply.update
    assertCollaborationHead(update)
    if (fenceMismatch(this.initial, update)) throw new CollaborationError('epoch', 'The server returned a different document generation.')
    if (update.fromVersion !== getVersion(editor.state) || !Array.isArray(update.steps) || !Array.isArray(update.clientIds)
      || update.version !== update.fromVersion + update.steps.length || update.steps.length !== update.clientIds.length
      || update.clientIds.some(id => typeof id !== 'string' || !id || id.length > 200)) {
      throw new CollaborationError('invalid', 'The server returned an inconsistent editor history.')
    }
    this.observedVersion = Math.max(this.observedVersion, update.version)
    if (!update.steps.length) return true
    const steps = decodeCollaborationSteps(update.steps, editor.schema)
    const pending = sendableSteps(editor.state)
    let ownPrefix = true
    for (let index = 0; index < steps.length; index++) {
      if (update.clientIds[index] !== this.clientId) { ownPrefix = false; continue }
      if (!ownPrefix || !pending?.steps[index] || stableJson(steps[index]!.toJSON()) !== stableJson(pending.steps[index]!.toJSON())) {
        throw new CollaborationError('invalid', 'Another editor is using this client ID. Keep this recovery copy and reopen with a unique session.')
      }
    }
    const confirmed = new Transform(this.confirmed)
    for (const step of steps) confirmed.step(step)
    confirmed.doc.check()
    const transaction = receiveTransaction(editor.state, steps, update.clientIds, { mapSelectionBackward: true }).setMeta(remoteChange, true)
    this.confirmed = confirmed.doc
    editor.view.dispatch(transaction)
    return true
  }

  private async pump() {
    if (!this.instance || this.busy || ['error', 'stale', 'closed'].includes(this.current.status)) return
    this.busy = true
    const generation = this.generation
    this.setState('syncing')
    try {
      do {
        this.requested = false
        const before = getVersion(this.instance.state)
        const received = await this.options.transport.pull(this.head())
        if (generation !== this.generation || ['error', 'stale', 'closed'].includes(this.current.status) || !this.apply(received)) return
        if (getVersion(this.instance.state) < this.observedVersion) {
          if (getVersion(this.instance.state) === before) throw new CollaborationError('version', 'The server did not return the missing editor history.')
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
          if (!steps.length) throw new CollaborationError('limit', 'A pending edit is too large to send. Keep a recovery copy before changing it.')
          const reply = await this.options.transport.push({ ...this.head(), clientId: this.clientId, steps })
          if (generation !== this.generation || ['error', 'stale', 'closed'].includes(this.current.status) || !this.apply(reply)) return
          if (getVersion(this.instance.state) === pending.version) throw new CollaborationError('version', 'The server did not acknowledge the submitted changes.')
          this.requested = true
        }
      } while (this.requested && !['error', 'stale', 'closed'].includes(this.current.status))
      if (!['error', 'stale', 'closed'].includes(this.current.status)) {
        this.retryDelay = 1000
        this.setState('synced')
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    } finally {
      if (generation === this.generation) {
        this.busy = false
        if (this.current.status === 'offline') this.schedule(this.retryDelay)
      }
    }
  }

  private fail(error: unknown) {
    if (['closed', 'stale'].includes(this.current.status)) return
    if (error instanceof CollaborationConnectionError) {
      this.setState('offline', error.message)
      this.retryDelay = Math.min(30_000, this.retryDelay * 2)
      this.schedule(this.retryDelay)
    } else {
      this.setState('error', error instanceof Error ? error.message : 'Synchronization failed. Keep this editor open and retry.')
    }
  }

  retry() {
    if (['closed', 'stale'].includes(this.current.status)) return
    // A disconnected transport may leave a promise pending indefinitely. The
    // old request may still complete, but cannot mutate this new attempt.
    this.generation += 1
    this.busy = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.setState('connecting')
    this.startSubscription()
    this.schedule(0)
  }

  /** Resolves only when all local steps have been accepted. The host owns publication. */
  flush(timeoutMs = 10_000): Promise<CollaborationHead> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('Flush timeout must be positive.'))
    if (this.current.status === 'synced' && !this.busy && !this.current.pendingSteps) return Promise.resolve(this.head())
    if (['error', 'stale', 'closed'].includes(this.current.status)) return Promise.reject(new Error(this.current.message ?? 'The editing session is closed.'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new CollaborationConnectionError('Changes are still waiting for the server. Keep this editor open.')) }, timeoutMs)
      const listener = (state: CollaborationState) => {
        if (state.status === 'synced' && !state.pendingSteps) { clearTimeout(timer); unsubscribe(); resolve(this.head()) }
        else if (['error', 'stale', 'closed'].includes(state.status)) { clearTimeout(timer); unsubscribe(); reject(new Error(state.message ?? 'The editing session is closed.')) }
      }
      const unsubscribe = () => { this.listeners.delete(listener) }
      this.listeners.add(listener)
      this.schedule(0)
    })
  }

  close() {
    if (this.current.status === 'closed') return
    this.generation += 1
    if (this.timer) clearTimeout(this.timer)
    this.unsubscribe?.()
    this.setState('closed', this.current.pendingSteps ? 'Unsent changes remain in the host recovery copy.' : undefined)
    this.listeners.clear()
  }
}

export function createEditorCollaboration(options: EditorCollaborationOptions) {
  return new EditorCollaborationSession(options)
}
