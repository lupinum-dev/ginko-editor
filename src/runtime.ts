/** Runtime-neutral conversion boundary. No Vue views, styles, or host persistence. */
export { createEditorSchema } from './lib/config/documentConfig'
export { SetNodePropertyStep, SetComponentVariantStep, SetNodeAttributeStep } from './lib/property-step'
export { applyCollaborationSteps, createCollaborationSnapshot, decodeCollaborationDocument, decodeCollaborationSteps } from './lib/collaboration/validation'
export type { CollaborationContentOptions, CollaborationCheckpoint } from './lib/collaboration/validation'
export { editorSchemaRevision, collaborationLimits, CollaborationError, fenceMismatch } from './lib/collaboration/protocol'
export type { CollaborationFence, CollaborationHead, CollaborationSnapshot, CollaborationSteps,
  CollaborationUpdate, CollaborationReply, CollaborationTransport } from './lib/collaboration/protocol'
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
