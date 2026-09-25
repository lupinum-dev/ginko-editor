import type { Node } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { Mapping, type StepMap } from '@tiptap/pm/transform'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { getVersion, sendableSteps } from 'prosemirror-collab'
import {
  collaborationProtocolVersion,
  type CollaborationPresenceChannel, type CollaborationPresenceSelection, type CollaborationPresenceUpdate, type CollaborationUser,
} from './protocol'
import { readCollaborationPresence, sanitizeCollaborationUser } from './presence-record'

/**
 * A remote collaborator, with its selection mapped into this editor's current document.
 * @experimental
 */
export interface CollaborationPeer {
  clientId: string
  user: { id?: string; name: string; color: string }
  /** Null when the peer has no selection or its document version cannot be mapped yet. */
  selection: CollaborationPresenceSelection | null
  /** Confirmed document version that the peer reported. */
  version: number
  updatedAt: number
}

/** @experimental */
export interface CollaborationPresenceOptions {
  /** Minimum time between two published updates. Default: 100 ms. */
  throttleMs?: number
  /** Republish an unchanged state after this time. Default: 10 s. */
  heartbeatMs?: number
  /** Remove peers that sent no new state for this time. Default: 30 s. */
  expiryMs?: number
  /** Hide a peer's selection when it is more confirmed steps behind this editor. Default: 256. */
  maxVersionLag?: number
}

/** Recent confirmed step maps, so a peer's older positions can be mapped forward. */
export class ConfirmedHistory {
  private maps: StepMap[] = []
  constructor(private start: number, private readonly limit = 512) {}

  get end() { return this.start + this.maps.length }

  append(fromVersion: number, maps: readonly StepMap[]) {
    if (fromVersion !== this.end) { this.start = fromVersion; this.maps = [] }
    this.maps.push(...maps)
    if (this.maps.length > this.limit) {
      const removed = this.maps.length - this.limit
      this.maps.splice(0, removed)
      this.start += removed
    }
  }

  reset(version: number) { this.start = version; this.maps = [] }

  /** Mapping from `from` to `to`, or null when the history no longer covers it. */
  mapping(from: number, to: number) {
    if (from < this.start || to > this.end || from > to) return null
    return new Mapping(this.maps.slice(from - this.start, to - this.start))
  }
}

/** Map a local selection back to the confirmed document, before unconfirmed steps. */
export function toConfirmedSelection(state: EditorState, confirmedSize: number): CollaborationPresenceSelection {
  let { anchor, head } = state.selection
  const pending = sendableSteps(state)
  if (pending) {
    const inverse = new Mapping(pending.steps.map(step => step.getMap())).invert()
    anchor = inverse.map(anchor, -1)
    head = inverse.map(head, -1)
  }
  return { anchor: clamp(anchor, confirmedSize), head: clamp(head, confirmedSize) }
}

function clamp(value: number, size: number) {
  return Math.max(0, Math.min(size, value))
}

/**
 * Map a remote selection from its confirmed version into the local document:
 * first through accepted steps this editor has received since that version,
 * then through this editor's unconfirmed steps.
 */
export function toLocalSelection(state: EditorState, history: ConfirmedHistory, selection: CollaborationPresenceSelection,
  version: number, maxVersionLag: number): CollaborationPresenceSelection | null {
  const local = getVersion(state)
  if (version > local || local - version > maxVersionLag) return null
  const mapping = new Mapping()
  if (version < local) {
    const confirmed = history.mapping(version, local)
    if (!confirmed) return null
    mapping.appendMapping(confirmed)
  }
  const pending = sendableSteps(state)
  if (pending) for (const step of pending.steps) mapping.appendMap(step.getMap())
  const size = state.doc.content.size
  return { anchor: clamp(mapping.map(selection.anchor), size), head: clamp(mapping.map(selection.head), size) }
}

function caretWidget(peer: CollaborationPeer) {
  return () => {
    const caret = document.createElement('span')
    caret.className = 'ginko-collab-caret'
    caret.setAttribute('aria-hidden', 'true')
    caret.setAttribute('contenteditable', 'false')
    caret.style.setProperty('--ginko-collab-color', peer.user.color)
    if (peer.user.name) {
      const label = document.createElement('span')
      label.className = 'ginko-collab-caret__label'
      label.textContent = peer.user.name
      caret.append(label)
    }
    return caret
  }
}

/** Build remote carets and selection highlights. Labels are hidden from assistive technology. */
export function peerDecorations(doc: Node, peers: readonly CollaborationPeer[]) {
  const decorations: Decoration[] = []
  for (const peer of peers) {
    if (!peer.selection) continue
    const { anchor, head } = peer.selection
    const from = Math.min(anchor, head), to = Math.max(anchor, head)
    if (from !== to) {
      decorations.push(Decoration.inline(from, to, { class: 'ginko-collab-selection',
        style: `--ginko-collab-color: ${peer.user.color}` }, { peer: peer.clientId }))
    }
    decorations.push(Decoration.widget(head, caretWidget(peer), { side: 10, ignoreSelection: true,
      key: `ginko-collab:${peer.clientId}:${peer.user.color}:${peer.user.name}` }))
  }
  return DecorationSet.create(doc, decorations)
}

interface TrackedPeer { update: CollaborationPresenceUpdate; receivedAt: number }

interface PresenceTrackerOptions extends CollaborationPresenceOptions {
  clientId: string
  epoch: string
  channel: CollaborationPresenceChannel
  user?: CollaborationUser
  history: ConfirmedHistory
  getState: () => EditorState | undefined
  getConfirmedSize: () => number
  /** Ask the editor to redraw decorations. */
  redraw: () => void
}

/** Publishes local presence and tracks remote peers. Presence failures never affect editing. */
export class PresenceTracker {
  private readonly peersById = new Map<string, TrackedPeer>()
  private readonly listeners = new Set<(peers: readonly CollaborationPeer[]) => void>()
  private readonly user?: CollaborationPeer['user']
  private mapped: readonly CollaborationPeer[] = Object.freeze([])
  private cache?: { doc: Node; version: number; revision: number; peers: readonly CollaborationPeer[]; set: DecorationSet }
  private revision = 0
  private unsubscribe?: () => void
  private publishTimer?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private expiry?: ReturnType<typeof setInterval>
  private dirty = false
  private lastPublishedAt = -Infinity
  private lastSent?: string
  private stopped = false

  constructor(private readonly options: PresenceTrackerOptions) {
    if (options.user) this.user = sanitizeCollaborationUser(options.user, options.clientId)
  }

  private get throttleMs() { return this.options.throttleMs ?? 100 }
  private get heartbeatMs() { return this.options.heartbeatMs ?? 10_000 }
  private get expiryMs() { return this.options.expiryMs ?? 30_000 }
  private get maxVersionLag() { return this.options.maxVersionLag ?? 256 }

  start() {
    try {
      this.unsubscribe = this.options.channel.subscribe(updates => { this.receive(updates) })
    } catch { /* Presence is optional. */ }
    if (this.user) {
      this.heartbeat = setInterval(() => { this.publish(true) }, this.heartbeatMs)
      this.changed()
    }
    this.expiry = setInterval(() => { this.expire() }, Math.max(250, Math.min(5000, this.expiryMs / 3)))
  }

  /** Stop presence. `redraw` removes remote carets from a live editor. */
  stop(redraw = false) {
    if (this.stopped) return
    this.stopped = true
    clearTimeout(this.publishTimer)
    clearInterval(this.heartbeat)
    clearInterval(this.expiry)
    try { this.unsubscribe?.() } catch { /* Presence is optional. */ }
    if (this.user) {
      try { void Promise.resolve(this.options.channel.leave?.(this.options.clientId)).catch(() => {}) } catch { /* Presence is optional. */ }
    }
    this.peersById.clear()
    this.update()
    this.listeners.clear()
    if (redraw) this.options.redraw()
  }

  get peers() { return this.mapped }

  onPeersChange(listener: (peers: readonly CollaborationPeer[]) => void) {
    this.listeners.add(listener)
    listener(this.mapped)
    return () => { this.listeners.delete(listener) }
  }

  /** Call after any local selection, document or version change. */
  changed() {
    if (!this.user || this.stopped) return
    this.dirty = true
    if (this.publishTimer) return
    const wait = Math.max(0, this.lastPublishedAt + this.throttleMs - Date.now())
    this.publishTimer = setTimeout(() => {
      this.publishTimer = undefined
      if (this.dirty) this.publish(false)
    }, wait)
  }

  private publish(force: boolean) {
    const state = this.options.getState()
    if (!this.user || this.stopped || !state) return
    this.dirty = false
    const selection = toConfirmedSelection(state, this.options.getConfirmedSize())
    const update: CollaborationPresenceUpdate = { protocolVersion: collaborationProtocolVersion, clientId: this.options.clientId,
      user: this.user, epoch: this.options.epoch, version: getVersion(state), selection, updatedAt: Date.now() }
    const key = JSON.stringify([update.version, selection, this.user])
    if (!force && key === this.lastSent) return
    this.lastSent = key
    this.lastPublishedAt = update.updatedAt
    try { void Promise.resolve(this.options.channel.publish(update)).catch(() => {}) } catch { /* Presence is optional. */ }
  }

  receive(updates: readonly unknown[]) {
    if (this.stopped || !Array.isArray(updates)) return
    const now = Date.now()
    const seen = new Set<string>()
    for (const raw of updates.slice(0, 256)) {
      const update = readCollaborationPresence(raw)
      if (!update || update.clientId === this.options.clientId || update.epoch !== this.options.epoch || seen.has(update.clientId)) continue
      seen.add(update.clientId)
      const previous = this.peersById.get(update.clientId)
      const changed = !previous || previous.update.updatedAt !== update.updatedAt
        || JSON.stringify(previous.update) !== JSON.stringify(update)
      this.peersById.set(update.clientId, { update, receivedAt: changed ? now : previous.receivedAt })
    }
    for (const id of [...this.peersById.keys()]) if (!seen.has(id)) this.peersById.delete(id)
    this.expire(now, true)
  }

  private expire(now = Date.now(), force = false) {
    let removed = false
    for (const [id, peer] of this.peersById) {
      if (now - peer.receivedAt > this.expiryMs) { this.peersById.delete(id); removed = true }
    }
    if (removed || force) this.update()
  }

  private update() {
    this.revision += 1
    this.mapped = this.map(this.options.getState())
    for (const listener of this.listeners) listener(this.mapped)
    if (!this.stopped) this.options.redraw()
  }

  private map(state: EditorState | undefined): readonly CollaborationPeer[] {
    return Object.freeze([...this.peersById.values()].map(({ update }) => Object.freeze({
      clientId: update.clientId, user: update.user as CollaborationPeer['user'], version: update.version, updatedAt: update.updatedAt,
      selection: state && update.selection ? toLocalSelection(state, this.options.history, update.selection, update.version, this.maxVersionLag) : null,
    })))
  }

  decorations(state: EditorState) {
    const version = getVersion(state)
    const cache = this.cache
    if (cache && cache.doc === state.doc && cache.version === version && cache.revision === this.revision) return cache.set
    const peers = this.map(state)
    const set = peerDecorations(state.doc, peers)
    this.cache = { doc: state.doc, version, revision: this.revision, peers, set }
    return set
  }
}
