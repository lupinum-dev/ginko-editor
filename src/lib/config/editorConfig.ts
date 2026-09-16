import { ImageUpload } from '../extensions/image-upload'
import type { ImageUploadHandler, ImagePicker, AssetInfo } from '../../types'
import type { EditorMessages } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import type { ImageActions } from '../nodeviews/image'
import type { Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { Table as TiptapTable } from '@tiptap/extension-table'
import { TableCell as TiptapTableCell } from '@tiptap/extension-table-cell'
import { TableHeader as TiptapTableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import StarterKit from '@tiptap/starter-kit'
import { tableView } from '../nodeviews/table'

import type { AssetProvider, JsonRecord } from '../../types'
import type { AuthoringKitV1 } from '../../authoring'
import { editorDebug } from '../debug'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import {
  Binding,
  CodeBlock,
  EditorDebug,
  Element,
  File,
  Heading,
  Image,
  InlineElement,
  MarkdownClipboard,
  Slot,
  SpanStyle,
  Video,
} from '../extensions'

const TableCell = TiptapTableCell.extend({
  content: 'paragraph+',
})

const TableHeader = TiptapTableHeader.extend({
  content: 'paragraph+',
})

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
    StarterKit.configure({
      codeBlock: false,
      heading: false,
      underline: false,
      link: {
        HTMLAttributes: {
          target: null,
        },
        openOnClick: false,
      },
    }),
    Heading.configure({
      levels: [1, 2, 3, 4, 5, 6],
      showMarkers: showMarkdownMarkers,
    }),
    TiptapTable.extend({ addNodeView() { return props => tableView(props, options.overlay) } }).configure({
      renderWrapper: true,
      resizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
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
    Element.configure({
      getAuthoringKit: options.getAuthoringKit,
      getOutputOptions: options.getOutputOptions,
      overlay: options.overlay,
    }),
    Slot.configure({ getAuthoringKit: options.getAuthoringKit }),
    InlineElement,
    CodeBlock.configure({
      theme: codeBlockTheme,
      overlay: options.overlay,
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
    Image.configure({ resolveSrc: resolveAsset, actions: options.imageActions, overlay: options.overlay }),
    Video,
    File.configure({ resolveSrc: resolveAsset }),
    Binding,
    SpanStyle,
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
