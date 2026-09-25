/** Increment when a wire step or the shared document schema changes. */
export const editorSchemaRevision = 'ginko-editor-2' as const

export interface CollaborationFence {
  /** A new value fences clients after import, restore, or source replacement. */
  epoch: string
  schemaRevision: string
  /** The host changes this when the allowed content policy changes. */
  policyRevision: string
}

export interface CollaborationHead extends CollaborationFence {
  version: number
}

export interface CollaborationSnapshot extends CollaborationHead {
  /** ProseMirror JSON encoded as a string, including MDC's reserved `$` key. */
  document: string
}

export interface CollaborationSteps extends CollaborationHead {
  clientId: string
  steps: string[]
}

export interface CollaborationUpdate extends CollaborationHead {
  /** Version immediately before the first returned step. */
  fromVersion: number
  steps: string[]
  clientIds: string[]
}

export type CollaborationReply =
  | { status: 'ok'; update: CollaborationUpdate }
  | { status: 'stale'; head: CollaborationHead; reason: 'epoch' | 'schema' | 'policy' | 'history' }

/** The host closes over the document ID and supplies its authenticated client. */
export interface CollaborationTransport {
  subscribe(onHead: (head: CollaborationHead) => void, onError: (error: unknown) => void): () => void
  pull(head: CollaborationHead): Promise<CollaborationReply>
  push(batch: CollaborationSteps): Promise<CollaborationReply>
}

export const collaborationLimits = Object.freeze({
  documentBytes: 512 * 1024,
  batchBytes: 256 * 1024,
  stepsPerBatch: 128,
  jsonDepth: 64,
})

export type CollaborationErrorCode = 'invalid' | 'limit' | 'version' | 'epoch' | 'schema' | 'policy' | 'content'

export class CollaborationError extends Error {
  constructor(readonly code: CollaborationErrorCode, message: string) {
    super(message)
    this.name = 'CollaborationError'
  }
}

export function assertCollaborationHead(head: CollaborationHead) {
  if (!Number.isSafeInteger(head.version) || head.version < 0
    || typeof head.epoch !== 'string' || !head.epoch || head.epoch.length > 200
    || typeof head.policyRevision !== 'string' || !head.policyRevision || head.policyRevision.length > 200) {
    throw new CollaborationError('invalid', 'Invalid collaborative document version.')
  }
  if (head.schemaRevision !== editorSchemaRevision) {
    throw new CollaborationError('schema', 'The editor schema has changed. Reopen this document.')
  }
}

export function fenceMismatch(left: CollaborationFence, right: CollaborationFence): 'epoch' | 'schema' | 'policy' | undefined {
  if (left.epoch !== right.epoch) return 'epoch'
  if (left.schemaRevision !== right.schemaRevision) return 'schema'
  if (left.policyRevision !== right.policyRevision) return 'policy'
}
