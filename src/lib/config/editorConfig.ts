import { ImageUpload } from '../extensions/image-upload'
import type { ImageUploadHandler, ImagePicker, EditorImage, LegacyImageUploadResult } from '../../types'
import { createEditorText, type EditorMessages } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import type { ImageActions } from '../nodeviews/image'
import Placeholder from '@tiptap/extension-placeholder'
import { tableView } from '../nodeviews/table'
import { componentView } from '../nodeviews/component'
import { codeView } from '../nodeviews/code'
import { imageView } from '../nodeviews/image'
import { createDocumentExtensions } from './documentConfig'
import type { AssetProvider, JsonRecord } from '../../types'
import type { AuthoringKit } from '../../authoring'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { MarkdownClipboard } from '../extensions'
import { ComponentBoundary } from '../extensions/component-boundary'

export interface CreateEditorExtensionsOptions {
  overlay?: EditorOverlayController
  getMessages?: () => EditorMessages | undefined
  getImagePicker?: () => ImagePicker | undefined
  getImageDropTarget?: () => HTMLElement | undefined
  getImageUpload?: () => ImageUploadHandler | undefined
  /** The largest accepted image upload, in bytes. */
  getImageMaxBytes?: () => number
  canUploadImage?: () => boolean
  insertUploadedImage?: (asset: EditorImage | LegacyImageUploadResult, pos: number, replaceSize?: number) => boolean
  onImageUploadPending?: (count: number) => void
  imageActions?: ImageActions
  assetProvider?: AssetProvider
  /** Initial value of the code block extension storage. */
  codeBlockTheme?: string
  getAuthoringKit?: () => AuthoringKit | undefined
  getOutputOptions?: () => TiptapToMDCOptions
  canPaste?: () => boolean
  onCopyError?: (message: string | undefined) => void
  onPasteError?: (message: string | undefined) => void
  /** Read on each placeholder render, so the text can change without a new editor. */
  getPlaceholder?: () => string | undefined
  /** Initial value of the heading extension storage. */
  showMarkdownMarkers?: boolean
}

export function createEditorExtensions(options: CreateEditorExtensionsOptions = {}) {
  const resolveAsset = (props: JsonRecord) => {
    const src = typeof props.src === 'string' ? props.src : undefined
    const id = typeof props.id === 'string' ? props.id : undefined
    return options.assetProvider?.buildUrl({ id: id ?? src, url: src })
  }
  const text = options.overlay?.text ?? createEditorText(options.getMessages)

  return [
    ...createDocumentExtensions({
      getAuthoringKit: options.getAuthoringKit,
      getOutputOptions: options.getOutputOptions,
      showMarkdownMarkers: options.showMarkdownMarkers,
      codeBlockTheme: options.codeBlockTheme,
      resolveAsset,
      nodeViews: {
        table: props => tableView(props, options.overlay),
        element: props => componentView(
          props,
          () => options.getAuthoringKit?.(),
          () => options.getOutputOptions?.() ?? {},
          options.overlay,
        ),
        codeBlock: props => codeView(props, options.overlay),
        image: props => imageView(props, options.imageActions, options.overlay),
      },
    }),
    Placeholder.configure({
      emptyEditorClass: 'mdc-editor-empty',
      placeholder: () => options.getPlaceholder?.() || text('startWriting'),
    }),
    MarkdownClipboard.configure({
      enabled: true,
      text,
      getAuthoringKit: options.getAuthoringKit,
      getOutputOptions: options.getOutputOptions,
      canPaste: options.canPaste,
      onPasteError: options.onPasteError,
      onCopyError: options.onCopyError,
    }),
    ImageUpload.configure({
      overlay: options.overlay,
      getMessages: options.getMessages,
      dropTarget: options.getImageDropTarget,
      upload: options.getImageUpload,
      picker: options.getImagePicker,
      maxBytes: options.getImageMaxBytes,
      enabled: options.canUploadImage,
      insert: options.insertUploadedImage,
      onPendingChange: options.onImageUploadPending,
    }),
    ComponentBoundary,
  ]
}
