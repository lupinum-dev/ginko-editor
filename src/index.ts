export { default as GinkoEditor } from './GinkoEditor.vue'
export { composeAuthoringKits, createAuthoringKit, parseAuthoringSource } from './authoring'
export type {
  AuthoringControl,
  AuthoringKitSourceV1,
  AuthoringKitV1,
  AuthoringRecipeV1,
  ComponentAuthoringFieldV1,
  ComponentAuthoringMetadataV1,
  ComponentImplementationMetadataV1,
  ComponentImplementationPropV1,
  ImplementationPropType,
} from './authoring'
export type {
  AssetInfo,
  AssetProvider,
  EditorAssetRequest,
  EditorFlushResult,
  GinkoEditorHandle,
  VideoInfo,
} from './types'
export type { ConversionErrorPayload, ConversionRecoveredPayload } from './lib/conversionPipeline'
