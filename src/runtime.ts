/** Runtime-neutral conversion boundary. No Vue views, styles, or host persistence. */
export { createEditorSchema } from './lib/config/documentConfig'
export { SetNodePropertyStep, SetComponentVariantStep, SetNodeAttributeStep } from './lib/property-step'
// Collaboration protocol and server validation. Each export below is experimental.
export { applyCollaborationSteps, createCollaborationSnapshot, decodeCollaborationDocument, decodeCollaborationSteps } from './lib/collaboration/validation'
export type { CollaborationContentOptions, CollaborationCheckpoint } from './lib/collaboration/validation'
export { readCollaborationPresence } from './lib/collaboration/presence-record'
export {
  editorSchemaRevision, collaborationProtocolVersion, collaborationLimits, CollaborationError, fenceMismatch,
} from './lib/collaboration/protocol'
export type {
  CollaborationErrorCode, CollaborationFence, CollaborationHead, CollaborationSnapshot, CollaborationSteps,
  CollaborationUpdate, CollaborationReply, CollaborationTransport,
  CollaborationPresenceChannel, CollaborationPresenceSelection, CollaborationPresenceUpdate,
} from './lib/collaboration/protocol'
export {
  convertMarkdownToTiptapDoc,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
  validateMarkdownForAuthoring,
} from './lib/conversionPipeline'
export type { TiptapToMDCOptions } from './lib/tiptapToMdc'
export type {
  ConversionIssue,
  ConversionResult,
  ConversionPhase,
} from './lib/conversionTypes'
