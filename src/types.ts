export type JsonPrimitive = boolean | null | number | string

export interface JsonRecord {
  [key: string]: JsonValue | undefined
}

export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[]

export interface AssetInfo {
  id: string
  filename: string
  url: string
  alt?: string
  title?: string
  width?: number
  height?: number
  size?: number
  mimeType?: string
  thumbnailUrl?: string | null
  thumbnailWidth?: number
  thumbnailHeight?: number
  fit?: string
  quality?: number
  focalX?: number
  focalY?: number
  cropX?: number
  cropY?: number
  cropWidth?: number
  cropHeight?: number
  scope?: 'entry' | 'collection' | 'global'
  collection?: string
  entryId?: string
  ownerName?: string | null
  tags?: string[]
  createdAt?: number
  updatedAt?: number
}

export interface AssetProvider {
  buildUrl: (asset: Partial<AssetInfo>) => string
  parseUrl: (url: string) => Partial<AssetInfo> | null
}

/** A stored asset reference: a stable `id`, a durable `url`, or both. */
export type EditorAssetReference = { id: string; url?: string } | { id?: never; url: string }

/** An image's stored identity and presentation. Storage and temporary display URLs stay with the host. */
export type EditorImage = Partial<Pick<AssetInfo,
  'alt' | 'title' | 'width' | 'height' | 'fit' | 'quality' |
  'focalX' | 'focalY' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'
>> & EditorAssetReference

/** A file's stored identity and download presentation. */
export type EditorFile = Partial<Pick<AssetInfo, 'filename' | 'title' | 'size' | 'mimeType'>> & EditorAssetReference

/** A video source and its optional title. */
export interface EditorVideo {
  src: string
  title?: string
}

/**
 * @deprecated Return `EditorImage` from an upload handler. The editor still reads
 * the image fields of this older asset shape at runtime.
 */
export type LegacyImageUploadResult = Partial<AssetInfo>

/** Host-owned persistence for an inline image upload. Reject to show a retryable error. */
export type ImageUploadHandler = (
  file: File,
  context: { signal: AbortSignal },
) => Promise<EditorImage | LegacyImageUploadResult>

/** Host-supplied library display data, separate from the image stored in the document. */
export interface EditorImagePickerItem {
  key: string
  label: string
  image: EditorImage
  thumbnailUrl?: string
}

/** Choose an existing image. Null cancels; rejection leaves the placeholder available for retry. */
export type ImagePicker = (context: { signal: AbortSignal; current?: EditorImage }) => Promise<EditorImage | null>

export interface EditorAssetRequest<T> {
  /** Complete once. Null cancels permanently; false means nothing was applied. */
  complete: (value: T | null) => boolean
}

/** A flush failure that is not a conversion result. */
export type EditorFlushStateErrorCode = 'collaboration_pending' | 'image_upload_pending' | 'not_ready'

export interface EditorFlushStateError {
  code: EditorFlushStateErrorCode
  message: string
}

/** A conversion failure, or an editor state that prevents a safe flush. Check `code` to tell them apart. */
export type EditorFlushError =
  | import('./lib/conversionTypes').ConversionErrorPayload
  | EditorFlushStateError

export type EditorFlushResult =
  | { emitted: boolean; ok: true }
  | { error: EditorFlushError; ok: false }

/** The public component instance API. Get it with a template ref. */
export interface GinkoEditorHandle {
  /** Emit pending visual edits. Await it before you close the editor or replace its document. */
  flush: () => Promise<EditorFlushResult>
  /** True while visual edits, image operations, commands, or shared steps are pending. */
  hasPendingChanges: () => boolean
  /** Remove the selected image, file, or video. Returns false when nothing was removed. */
  removeSelectedMedia: () => boolean
  /** Move keyboard focus into the visual editor, or into the Markdown source in source mode. */
  focus: (position?: 'start' | 'end') => void
  /**
   * Unstable escape hatch: the TipTap editor instance, or `undefined` before it exists.
   * Its API follows TipTap and the editor schema and can change in any release.
   * Do not dispatch changes that bypass the editor's validation.
   */
  getEditor: () => import('@tiptap/core').Editor | undefined
}

/** @deprecated Use `EditorVideo`. */
export type VideoInfo = EditorVideo

export interface PropFormItem {
  custom?: boolean
  default?: PropValue
  key: string
  label: string
  options?: readonly string[] | string[]
  type: PropType
  value: PropValue
}

export type PropType = 'array' | 'boolean' | 'number' | 'object' | 'select' | 'string'

export type PropValue = JsonValue | undefined
