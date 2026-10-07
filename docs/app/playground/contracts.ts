import {
  composeAuthoringKits,
  createAuthoringKit,
  ginkoLayoutKitSource,
} from '@lupinum/ginko-editor/authoring'
import { hostNoteSource, learningObjectiveSource } from './authoring-sources'

/** The built-in layout kit and one host component, composed into one kit. */
export const playgroundAuthoringKit = await composeAuthoringKits(
  ginkoLayoutKitSource,
  learningObjectiveSource,
)
export const isolatedAuthoringKit = await createAuthoringKit(hostNoteSource)
