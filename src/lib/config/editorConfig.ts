import { ImageUpload } from '../extensions/image-upload'
import type { ImageUploadHandler, ImagePicker, AssetInfo } from '../../types'
import type { EditorMessages } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import type { ImageActions } from '../nodeviews/image'
import type { Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { tableView } from '../nodeviews/table'
import { componentView } from '../nodeviews/component'
import { codeView } from '../nodeviews/code'
import { imageView } from '../nodeviews/image'
import { createDocumentExtensions } from './documentConfig'
import type { AssetProvider, JsonRecord } from '../../types'
import type { AuthoringKitV1 } from '../../authoring'
import { editorDebug } from '../debug'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { EditorDebug, MarkdownClipboard } from '../extensions'

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
  enableDebug: boolean
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
    enableDebug,
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
      enableDebug,
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
    ...(enableDebug ? [EditorDebug] : []),
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

const normalizingEditors = new WeakSet<Editor>()

export function isCurrentlyNormalizingTable(editor: Editor): boolean {
  return normalizingEditors.has(editor)
}

export function normalizeTableCells(editorInstance: Editor | undefined): boolean {
  if (!editorInstance) {
    return false
  }

  const { state } = editorInstance
  const { schema } = state
  const cellTypes = new Set(['tableCell', 'tableHeader'])
  let hasChanges = false

  const tr = state.tr
  state.doc.descendants((node, pos) => {
    if (!cellTypes.has(node.type.name)) {
      return
    }

    let hasInlineChild = false
    node.content.forEach((child) => {
      if (child.isInline) {
        hasInlineChild = true
      }
    })

    if (!hasInlineChild) {
      return
    }

    const paragraphType = schema.nodes.paragraph
    if (!paragraphType) {
      return
    }

    const paragraph = paragraphType.create(null, node.content)
    const updatedCell = node.type.create(node.attrs, paragraph, node.marks)
    tr.replaceWith(pos, pos + node.nodeSize, updatedCell)
    hasChanges = true
  })

  if (hasChanges) {
    normalizingEditors.add(editorInstance)
    try { editorInstance.view.dispatch(tr) } finally { normalizingEditors.delete(editorInstance) }
    editorDebug.log('Normalized table cells in editor')
  }

  return hasChanges
}
