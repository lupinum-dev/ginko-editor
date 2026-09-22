/** Runtime-neutral conversion boundary. No Vue views, styles, or host persistence. */
export { createEditorSchema } from './lib/config/documentConfig'
export { SetNodePropertyStep, SetComponentVariantStep } from './lib/property-step'
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
