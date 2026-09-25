import { ImageUpload } from '../extensions/image-upload'
import type { ImageUploadHandler, ImagePicker, AssetInfo } from '../../types'
import type { EditorMessages } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import type { ImageActions } from '../nodeviews/image'
import Placeholder from '@tiptap/extension-placeholder'
import { tableView } from '../nodeviews/table'
import { componentView } from '../nodeviews/component'
import { codeView } from '../nodeviews/code'
import { imageView } from '../nodeviews/image'
import { createDocumentExtensions } from './documentConfig'
import type { AssetProvider, JsonRecord } from '../../types'
import type { AuthoringKitV1 } from '../../authoring'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { MarkdownClipboard } from '../extensions'

export interface CreateEditorExtensionsOptions {
  overlay?: EditorOverlayController
  getMessages?: () => EditorMessages | undefined
  getImagePicker?: () => ImagePicker | undefined
  getImageDropTarget?: () => HTMLElement | undefined
  getImageUpload?: () => ImageUploadHandler | undefined
  canUploadImage?: () => boolean
  insertUploadedImage?: (asset: Partial<AssetInfo>, pos: number, replaceSize?: number) => boolean
  onImageUploadPending?: (count: number) => void
  imageActions?: ImageActions
  assetProvider?: AssetProvider
  codeBlockTheme: string
  enableFiles: boolean
  enableVideo: boolean
  fileOutput: 'markdown' | 'mdc'
  imageOutput: 'markdown' | 'mdc'
  getAuthoringKit?: () => AuthoringKitV1 | undefined
  getOutputOptions?: () => TiptapToMDCOptions
  canPaste?: () => boolean
  onCopyError?: (message: string | undefined) => void
  onPasteError?: (message: string | undefined) => void
  placeholder?: string
  showMarkdownMarkers: boolean
  videoOutput: 'html' | 'mdc'
}

export function createEditorExtensions(options: CreateEditorExtensionsOptions) {
  const resolveAsset = (props: JsonRecord) => {
    const src = typeof props.src === 'string' ? props.src : undefined
    const id = typeof props.id === 'string' ? props.id : undefined
    return options.assetProvider?.buildUrl({ id: id ?? src, url: src })
  }
  const {
    codeBlockTheme,
    placeholder,
    showMarkdownMarkers,
  } = options

  return [
    ...createDocumentExtensions({
      getAuthoringKit: options.getAuthoringKit,
      getOutputOptions: options.getOutputOptions,
      showMarkdownMarkers,
      codeBlockTheme,
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
      placeholder: placeholder || 'Start writing...',
    }),
    MarkdownClipboard.configure({
      enabled: true,
      fileOutput: options.fileOutput,
      getAuthoringKit: options.getAuthoringKit,
      getOutputOptions: options.getOutputOptions,
      canPaste: options.canPaste,
      onPasteError: options.onPasteError,
      onCopyError: options.onCopyError,
      imageOutput: options.imageOutput,
      videoOutput: options.videoOutput,
    }),
    ImageUpload.configure({
      overlay: options.overlay,
      getMessages: options.getMessages,
      dropTarget: options.getImageDropTarget,
      upload: options.getImageUpload,
      picker: options.getImagePicker,
      enabled: options.canUploadImage,
      insert: options.insertUploadedImage,
      onPendingChange: options.onImageUploadPending,
    }),
  ]
}
