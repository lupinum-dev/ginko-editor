/**
 * Increment when a wire step or the shared document schema changes.
 * `test/collaboration-schema.test.ts` fails when the schema fingerprint changes
 * without a new revision.
 * @experimental
 */
export const editorSchemaRevision = 'ginko-editor-2' as const

/**
 * Version of the message envelope: heads, batches, replies and presence.
 * The schema revision identifies document content; this value identifies the
 * shape of the messages around it.
 * @experimental
 */
export const collaborationProtocolVersion = 1 as const

/** @experimental */
export interface CollaborationFence {
  /** A new value fences clients after import, restore, or source replacement. */
  epoch: string
  schemaRevision: string
  /** The host changes this when the allowed content policy changes. */
  policyRevision: string
}

/** @experimental */
export interface CollaborationHead extends CollaborationFence {
  version: number
  /**
   * Message envelope version. Clients send `1` with pull and push requests.
   * A missing value is read as version `1`; any other value is rejected.
   */
  protocolVersion?: typeof collaborationProtocolVersion
}

/** @experimental */
export interface CollaborationSnapshot extends CollaborationHead {
  /** ProseMirror JSON encoded as a string, including MDC's reserved `$` key. */
  document: string
}

/** @experimental */
export interface CollaborationSteps extends CollaborationHead {
  clientId: string
  steps: string[]
}

/** @experimental */
export interface CollaborationUpdate extends CollaborationHead {
  /** Version immediately before the first returned step. */
  fromVersion: number
  steps: string[]
  clientIds: string[]
}

/** @experimental */
export type CollaborationReply =
  | { status: 'ok'; update: CollaborationUpdate }
  | { status: 'stale'; head: CollaborationHead; reason: 'epoch' | 'schema' | 'policy' | 'history' }

/** A collaborator's display identity. The host supplies it from its own accounts. */
export interface CollaborationUser {
  /** Stable host account identifier. Do not use a secret or an email address. */
  id?: string
  name: string
  /** A CSS color: `#rgb`, `#rrggbb`, `rgb(...)` or `hsl(...)`. Derived from the client ID when omitted. */
  color?: string
}

/**
 * Positions refer to the confirmed document at `version` in `epoch`.
 * @experimental
 */
export interface CollaborationPresenceSelection {
  anchor: number
  head: number
}

/** One client's ephemeral presence record. The host must not store it with the document. */
export interface CollaborationPresenceUpdate {
  protocolVersion: typeof collaborationProtocolVersion
  clientId: string
  user: CollaborationUser
  epoch: string
  /** Confirmed document version for the selection positions. */
  version: number
  selection: CollaborationPresenceSelection | null
  /** Milliseconds since the Unix epoch. Hosts should replace it with the server time. */
  updatedAt: number
}

/**
 * Optional awareness channel. Presence is best effort: it never changes the
 * document and a failure never stops editing. The host must apply the same
 * document authorization and expire records it has not seen recently.
 * @experimental
 */
export interface CollaborationPresenceChannel {
  publish(update: CollaborationPresenceUpdate): Promise<void> | void
  /** Deliver all current records for the document, including this client's own record. */
  subscribe(onPeers: (updates: readonly CollaborationPresenceUpdate[]) => void): () => void
  /** Remove this client's record when the session closes. */
  leave?(clientId: string): Promise<void> | void
}

/**
 * The host closes over the document ID and supplies its authenticated client.
 * @experimental
 */
export interface CollaborationTransport {
  subscribe(onHead: (head: CollaborationHead) => void, onError: (error: unknown) => void): () => void
  pull(head: CollaborationHead): Promise<CollaborationReply>
  push(batch: CollaborationSteps): Promise<CollaborationReply>
  presence?: CollaborationPresenceChannel
}

/** @experimental */
export const collaborationLimits = Object.freeze({
  documentBytes: 512 * 1024,
  batchBytes: 256 * 1024,
  stepsPerBatch: 128,
  jsonDepth: 64,
})

/**
 * Validation and transport failure codes. Servers use the first eight codes.
 * A host transport can throw `forbidden` for revoked access and `unavailable`
 * for a temporary server failure that the session should retry.
 * @experimental
 */
export type CollaborationErrorCode = 'invalid' | 'limit' | 'version' | 'epoch' | 'schema' | 'policy' | 'content' | 'protocol'
  | 'forbidden' | 'unavailable'

/** @experimental */
export class CollaborationError extends Error {
  constructor(readonly code: CollaborationErrorCode, message: string) {
    super(message)
    this.name = 'CollaborationError'
  }
}

export function assertProtocolVersion(value: { protocolVersion?: unknown }) {
  if (value.protocolVersion !== undefined && value.protocolVersion !== collaborationProtocolVersion) {
    throw new CollaborationError('protocol', 'This editor uses a different collaboration protocol. Update the editor.')
  }
}

export function assertCollaborationHead(head: CollaborationHead) {
  if (!head || typeof head !== 'object' || !Number.isSafeInteger(head.version) || head.version < 0
    || typeof head.epoch !== 'string' || !head.epoch || head.epoch.length > 200
    || typeof head.policyRevision !== 'string' || !head.policyRevision || head.policyRevision.length > 200) {
    throw new CollaborationError('invalid', 'Invalid collaborative document version.')
  }
  assertProtocolVersion(head)
  if (head.schemaRevision !== editorSchemaRevision) {
    throw new CollaborationError('schema', 'The editor schema has changed. Reopen this document.')
  }
}

/** @experimental */
export function fenceMismatch(left: CollaborationFence, right: CollaborationFence): 'epoch' | 'schema' | 'policy' | undefined {
  if (left.epoch !== right.epoch) return 'epoch'
  if (left.schemaRevision !== right.schemaRevision) return 'schema'
  if (left.policyRevision !== right.policyRevision) return 'policy'
}
