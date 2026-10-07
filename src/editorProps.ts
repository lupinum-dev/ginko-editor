import type { AuthoringKit } from './authoring'
import type { EditorCollaborationSession } from './collaboration'
import { defaultImageMaxBytes } from './lib/extensions/image-upload'
import type { AssetProvider, ImagePicker, ImageUploadHandler } from './types'
import type { EditorMessages, EditorShortcuts, EditorToolbarGroup } from './ui/commands'

/** Props of the `GinkoEditor` component. All props except `collaboration` are reactive. */
export interface GinkoEditorProps {
  /** The canonical Markdown (MDC) source. Use with `v-model`. */
  modelValue: string
  /** Groups of built-in toolbar commands. */
  toolbarItems?: readonly EditorToolbarGroup[]
  /** Replacement interface text. Missing keys use the English defaults. */
  messages?: EditorMessages
  /** Replacement keyboard shortcuts. `false` turns a shortcut off. */
  shortcuts?: EditorShortcuts
  /** The element that receives menus and popovers. Defaults to the editor root. */
  overlayContainer?: globalThis.HTMLElement
  /** An outer element that also accepts dropped image files. */
  imageDropTarget?: globalThis.HTMLElement
  /** Host-owned persistence for inline image uploads. */
  imageUpload?: ImageUploadHandler
  /** Host-owned selection of an existing image. */
  imagePicker?: ImagePicker
  /** The largest accepted image upload, in bytes. Defaults to 10 MB. */
  imageMaxBytes?: number
  /** The accessible name of the writing surface. Defaults to the `contentLabel` message. */
  ariaLabel?: string
  /** Resolves stored asset ids to display URLs, and URLs back to ids. */
  assetProvider?: AssetProvider
  /** Component policy, editing metadata, and recipes. Equal new kit objects do not reload the document. */
  authoringKit?: AuthoringKit
  /** A shared editing session. Read once when the editor mounts; remount the editor to use another session. */
  collaboration?: EditorCollaborationSession
  /** Stored in the code block extension storage for host renderers. */
  codeBlockTheme?:
    | 'atom-dark'
    | 'dark'
    | 'default'
    | 'github-dark'
    | 'github-dim'
    | 'github-light'
    | 'visual-studio-dark'
  /** Makes the editor read-only. */
  disabled?: boolean
  /** Shows file insertion actions. Existing files stay readable and removable. */
  enableFiles?: boolean
  /** Shows image insertion actions. Existing images stay readable and removable. */
  enableImages?: boolean
  /** Shows the image metadata action, which emits `request-image-metadata`. */
  enableImageMetadata?: boolean
  /** Shows video insertion actions. Existing videos stay readable and removable. */
  enableVideo?: boolean
  /** File output syntax. */
  fileOutput?: 'markdown' | 'mdc'
  /** Image output syntax. */
  imageOutput?: 'markdown' | 'mdc'
  /** Text in an empty document. Defaults to the `startWriting` message. */
  placeholder?: string
  /** Stored in the heading extension storage for host renderers. */
  showMarkdownMarkers?: boolean
  /** Delay, in milliseconds, before a visual edit is converted and emitted. */
  syncDebounceMs?: number
  /** Video output syntax. */
  videoOutput?: 'html' | 'mdc'
}

export const editorPropDefaults = {
  codeBlockTheme: 'github-dark',
  toolbarItems: undefined,
  messages: undefined,
  shortcuts: undefined,
  overlayContainer: undefined,
  imagePicker: undefined,
  imageMaxBytes: defaultImageMaxBytes,
  ariaLabel: undefined,
  assetProvider: undefined,
  imageUpload: undefined,
  imageDropTarget: undefined,
  authoringKit: undefined,
  collaboration: undefined,
  disabled: false,
  enableFiles: true,
  enableImages: true,
  enableImageMetadata: false,
  enableVideo: true,
  fileOutput: 'mdc',
  imageOutput: 'mdc',
  placeholder: undefined,
  showMarkdownMarkers: false,
  syncDebounceMs: 120,
  videoOutput: 'mdc',
} as const
