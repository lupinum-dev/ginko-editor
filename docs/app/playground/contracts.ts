import { composeAuthoringKits, createAuthoringKit } from '@lupinum/ginko-editor/authoring'
import { ginkoDocsAuthoringKitSource } from '@lupinum/ginko-docs/authoring'
import { hostNoteSource, learningObjectiveSource } from './authoring-sources'

export const playgroundAuthoringKit = await composeAuthoringKits(
  ginkoDocsAuthoringKitSource,
  learningObjectiveSource,
)
export const isolatedAuthoringKit = await createAuthoringKit(hostNoteSource)
