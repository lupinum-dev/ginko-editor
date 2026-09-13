import type {
  EditorActions, EditorCommand, EditorImage, EditorImagePickerItem,
  EditorMessages, EditorShortcuts, EditorToolbarGroup, ImagePicker,
} from '../src/index'

export const storedImage = { id: 'asset-1', alt: 'A forest', cropWidth: 0.5 } satisfies EditorImage
export const hostedImage = { url: '/images/forest.jpg', width: 640 } satisfies EditorImage
export const pickerItem = { key: 'asset-1', label: 'Forest.jpg', image: storedImage, thumbnailUrl: '/thumbnails/forest.jpg' } satisfies EditorImagePickerItem
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
