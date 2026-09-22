import type { NodeViewRenderer } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import StarterKit from '@tiptap/starter-kit'

import type { AuthoringKitV1 } from '../../authoring'
import type { JsonRecord } from '../../types'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { Binding } from '../extensions/binding'
import { CodeBlock } from '../extensions/code-block'
import { Element } from '../extensions/element'
import { File } from '../extensions/file'
import { Heading } from '../extensions/heading'
import { Image } from '../extensions/image'
import { InlineElement } from '../extensions/inline-element'
import { Slot } from '../extensions/slot'
import { SpanStyle } from '../extensions/span-style'
import { Video } from '../extensions/video'

interface DocumentExtensionOptions {
  getAuthoringKit?: () => AuthoringKitV1 | undefined
  getOutputOptions?: () => TiptapToMDCOptions
  nodeViews?: Partial<Record<'codeBlock' | 'element' | 'image' | 'table', NodeViewRenderer>>
  resolveAsset?: (props: JsonRecord) => string | null | undefined
  showMarkdownMarkers?: boolean
  codeBlockTheme?: string
}

/** Schema-affecting definitions are shared by the canvas and server conversion. */
export function createDocumentExtensions(options: DocumentExtensionOptions = {}) {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: false,
      underline: false,
      link: { HTMLAttributes: { target: null }, openOnClick: false },
    }),
    Heading.configure({
      levels: [1, 2, 3, 4, 5, 6],
      showMarkers: options.showMarkdownMarkers ?? false,
    }),
    Table.extend({
      addNodeView() { return options.nodeViews?.table ?? null },
    }).configure({ renderWrapper: true, resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph+' }),
    TableCell.extend({ content: 'paragraph+' }),
    Element.extend({
      addNodeView() { return options.nodeViews?.element ?? null },
    }).configure({ getAuthoringKit: options.getAuthoringKit, getOutputOptions: options.getOutputOptions }),
    Slot.configure({ getAuthoringKit: options.getAuthoringKit }),
    InlineElement,
    CodeBlock.extend({
      addNodeView() { return options.nodeViews?.codeBlock ?? null },
    }).configure({ theme: options.codeBlockTheme ?? 'github-dark' }),
    Image.extend({
      addNodeView() { return options.nodeViews?.image ?? null },
    }).configure({ resolveSrc: options.resolveAsset }),
    Video,
    File.configure({ resolveSrc: options.resolveAsset }),
    Binding,
    SpanStyle,
  ]
}

/** Build the supported document schema without creating an editor or reading the DOM. */
export function createEditorSchema() {
  return getSchema(createDocumentExtensions())
}
