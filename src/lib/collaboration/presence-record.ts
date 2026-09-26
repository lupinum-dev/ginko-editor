import { collaborationProtocolVersion, type CollaborationPresenceSelection, type CollaborationPresenceUpdate } from './protocol'

const colorPattern = /^(?:#[\da-f]{3}(?:[\da-f]{3})?|(?:rgb|hsl)a?\([\d\s.,%/]+\))$/i

/**
 * Deterministic, readable caret color for a client ID.
 * @experimental
 */
export function collaborationColor(clientId: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < clientId.length; index++) {
    hash ^= clientId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `hsl(${(hash >>> 0) % 360} 70% 38%)`
}

function safeColor(color: unknown, clientId: string) {
  return typeof color === 'string' && color.length <= 64 && colorPattern.test(color.trim()) ? color.trim() : collaborationColor(clientId)
}

/** @internal */
export function sanitizeCollaborationUser(user: unknown, clientId: string): { id?: string; name: string; color: string } {
  const value = user && typeof user === 'object' ? user as Record<string, unknown> : {}
  const name = typeof value.name === 'string' ? value.name.replace(/\s+/g, ' ').trim().slice(0, 64) : ''
  return { ...(typeof value.id === 'string' && value.id.length <= 200 ? { id: value.id } : {}), name,
    color: safeColor(value.color, clientId) }
}

function position(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined
}

/**
 * Read an untrusted presence record, for example in a server mutation.
 * Returns a normalized copy, or null for a malformed record.
 * @experimental
 */
export function readCollaborationPresence(value: unknown): CollaborationPresenceUpdate | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.protocolVersion !== collaborationProtocolVersion || typeof record.clientId !== 'string' || !record.clientId
    || record.clientId.length > 200 || typeof record.epoch !== 'string' || record.epoch.length > 200 || position(record.version) === undefined
    || typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return null
  let selection: CollaborationPresenceSelection | null = null
  if (record.selection !== null) {
    const raw = record.selection && typeof record.selection === 'object' ? record.selection as Record<string, unknown> : {}
    const anchor = position(raw.anchor), head = position(raw.head)
    if (anchor === undefined || head === undefined) return null
    selection = { anchor, head }
  }
  return { protocolVersion: collaborationProtocolVersion, clientId: record.clientId, epoch: record.epoch,
    version: Number(record.version), updatedAt: record.updatedAt, selection, user: sanitizeCollaborationUser(record.user, record.clientId) }
}
