import { defaultMessages } from '../src/index'
import type {
  AuthoringKit, AuthoringKitV1, ConversionIssueCode, EditorActions, EditorCommand, EditorFile,
  EditorFlushError, EditorImage, EditorImagePickerItem, EditorMessageKey, EditorMessages,
  EditorShortcuts, EditorToolbarGroup, EditorVideo, GinkoEditorHandle, ImagePicker,
} from '../src/index'

export const storedImage = { id: 'asset-1', alt: 'A forest', cropWidth: 0.5 } satisfies EditorImage
export const hostedImage = { url: '/images/forest.jpg', width: 640 } satisfies EditorImage
export const pickerItem = {
  key: 'asset-1',
  label: 'Forest.jpg',
  image: storedImage,
  thumbnailUrl: '/thumbnails/forest.jpg',
} satisfies EditorImagePickerItem
export const picker: ImagePicker = async ({ signal, current }) => {
  signal.throwIfAborted()
  return current ?? storedImage
}
export const cancelPicker: ImagePicker = async () => null
export const toolbar = [
  [{ kind: 'heading', level: 6 }, { kind: 'mark', mark: 'bold' }],
  [{ kind: 'menu', label: 'Insert', items: [{ kind: 'image' }, { kind: 'table', rows: 3, columns: 3 }] }],
] as const satisfies readonly EditorToolbarGroup[]
export const messages = { image: 'Add picture', columnSize: '{label} ({size})' } satisfies EditorMessages
export const shortcuts = { bold: 'Mod-Shift-b', duplicate: false } satisfies EditorShortcuts
export function captureLink(actions: EditorActions) {
  const captured = actions.capture()
  return (href: string): Promise<boolean> => captured.get({ kind: 'link', href }).run()
}

// @ts-expect-error Every picker result needs a persisted identity.
export const missingImageIdentity: EditorImage = { alt: 'Forest' }
// @ts-expect-error Storage record fields do not widen the focused image contract.
export const storageRecord: EditorImage = { id: 'asset-1', filename: 'Forest.jpg' }
// @ts-expect-error The stable identity must be a string even when a URL exists.
export const invalidImageIdentity: EditorImage = { id: 123, url: '/forest.jpg' }
// @ts-expect-error A picker resolves an image or null, never an upload file.
export const invalidPicker: ImagePicker = async () => new File([], 'forest.jpg')
// @ts-expect-error Heading levels are restricted by the public command contract.
export const invalidHeading: EditorCommand = { kind: 'heading', level: 7 }
// @ts-expect-error Unsupported marks must not silently enter custom toolbars.
export const invalidMark: EditorCommand = { kind: 'mark', mark: 'underline' }
// @ts-expect-error Message overrides use known keys.
export const invalidMessages: EditorMessages = { imaginaryControl: 'Example' }
// @ts-expect-error Only the exposed commands have shortcut overrides.
export const invalidShortcuts: EditorShortcuts = { save: 'Mod-s' }

export const storedFile = { id: 'file-1', filename: 'Report.pdf', size: 2048 } satisfies EditorFile
export const hostedVideo = { src: 'https://example.com/video.mp4', title: 'Demo' } satisfies EditorVideo
export const notReady: EditorFlushError = { code: 'not_ready', message: 'Try again.' }
export const conversionCode: ConversionIssueCode = 'authoring_kit_rejected'
export const legacyKit = (kit: AuthoringKit): AuthoringKitV1 => kit
export const handleKeys: (keyof GinkoEditorHandle)[] = [
  'flush', 'hasPendingChanges', 'removeSelectedMedia', 'focus', 'getEditor',
]
export const translated = defaultMessages.contentLabel satisfies string
export const messageKey: EditorMessageKey = 'startWriting'
// @ts-expect-error A stored file needs an id or a durable URL.
export const missingFileIdentity: EditorFile = { filename: 'Report.pdf' }
// @ts-expect-error Flush state errors use the documented codes.
export const invalidFlushCode: EditorFlushError = { code: 'offline', message: 'Offline.' }
// @ts-expect-error Conversion issue codes are a closed set.
export const invalidIssueCode: ConversionIssueCode = 'unknown_problem'
