/**
 * Browser editing session for a host-owned shared document.
 * Protocol and transport types live in `@lupinum/ginko-editor/runtime`.
 * @experimental The collaboration API can change in a minor release before it is declared stable.
 * @packageDocumentation
 */

export { createEditorCollaboration, parseCollaborationRecovery, EditorCollaborationSession, CollaborationConnectionError } from './lib/collaboration/session'
export type {
  EditorCollaborationOptions, CollaborationState, CollaborationStateCode, CollaborationStatus, CollaborationRecovery,
} from './lib/collaboration/session'
export { readCollaborationRecovery, collaborationRecoveryToMarkdown } from './lib/collaboration/recovery'
export type { CollaborationRecoveryReadResult, CollaborationRecoveryMarkdown } from './lib/collaboration/recovery'
export { collaborationColor } from './lib/collaboration/presence-record'
export type { CollaborationPeer, CollaborationPresenceOptions } from './lib/collaboration/presence'
export { CollaborationError } from './lib/collaboration/protocol'
export type { CollaborationErrorCode, CollaborationUser } from './lib/collaboration/protocol'
