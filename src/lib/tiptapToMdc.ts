import type { JSONContent } from '@tiptap/core'

import type { JsonRecord, JsonValue } from '../types'
import type { MDCComment, MDCElement, MDCNode, MDCRoot, MDCText } from './mdcTypes'
import { cleanSpanProps, normalizeProps } from './props'
import { stripStyleNodes } from './stripStyleNodes'
import { imageProperties } from './image-properties'

export interface TiptapToMDCOptions {
  fileOutput?: 'markdown' | 'mdc'
  imageOutput?: 'markdown' | 'mdc'
  videoOutput?: 'html' | 'mdc'
}

interface TiptapToMDCContext {
  options: TiptapToMDCOptions
}

type TiptapToMDCMap = Record<
  string,
  (node: JSONContent, context: TiptapToMDCContext) => MDCNode | MDCNode[] | MDCRoot
>

const RE_TEXT_LEADING_SPACE = /^\s+/
const RE_TEXT_TRAILING_SPACE = /\s+$/

const markToTag: Record<string, string> = {
  bold: 'strong',
  code: 'code',
  italic: 'em',
  strike: 'del',
}

function isMeaningfulPropValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }
  if (typeof value !== 'string') {
    return true
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  const lowered = trimmed.toLowerCase()
  return lowered !== 'undefined' && lowered !== 'null'
}

function sanitizeNumberish(value: unknown): null | number | string {
  if (!isMeaningfulPropValue(value)) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return normalized
}

function createBlockquoteElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'blockquote')
}

function createBoldElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'strong')
}

function createBrElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'br')
}

function createBulletListElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'ul')
}

function createCodeElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'code', { props: (node.attrs || {}) as JsonRecord })
}

function createCommentElement(node: JSONContent): MDCComment {
  return { type: 'comment', value: node.attrs!.text }
}

function createDocElement(node: JSONContent, context: TiptapToMDCContext): MDCRoot {
  return {
    children: (node.content || []).flatMap((child) => tiptapNodeToMDC(child, context)),
    type: 'root',
  } as MDCRoot
}

function createFileElementWrapper(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createFileElement(node, context)
}

function createHardBreakElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'br')
}

function createHeadingElementWrapper(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createHeadingElement(node, context)
}

function createHorizontalRuleElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'hr')
}

function createImageElementWrapper(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createImageElement(node, context)
}

function createItalicElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'em')
}

function createOrderedListElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'ol', { props: { start: node.attrs?.start } })
}

function createParagraphElementWrapper(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'p')
}

function createSlotElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const slotName = node.attrs?.name || 'default'
  return createElement(node, context, 'template', { props: { name: slotName } })
}

function createSpanStyleElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'span', { props: cleanSpanProps(node.attrs as JsonRecord) })
}

function createStrikeElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'del')
}

function createTableElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'table')
}

function createTableCellElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'td', { props: tableAlignmentProps(node) })
}

function createTableHeaderElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'th', { props: tableAlignmentProps(node) })
}

function tableAlignmentProps(node: JSONContent): JsonRecord {
  const align = node.attrs?.align
  return ['left', 'center', 'right'].includes(align) ? { style: `text-align:${align}` } : {}
}

function createTableRowElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createElement(node, context, 'tr')
}

function createVideoElementWrapper(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  return createVideoElement(node, context)
}

const tiptapToMDCMap: TiptapToMDCMap = {
  blockquote: createBlockquoteElement,
  bold: createBoldElement,
  br: createBrElement,
  bulletList: createBulletListElement,
  code: createCodeElement,
  codeBlock: createCodeBlockElement,
  comment: createCommentElement,
  doc: createDocElement,
  element: createElement,
  file: createFileElementWrapper,
  hardBreak: createHardBreakElement,
  heading: createHeadingElementWrapper,
  horizontalRule: createHorizontalRuleElement,
  image: createImageElementWrapper,
  'inline-element': createElement,
  italic: createItalicElement,
  link: createLinkElement,
  listItem: createListItemElement,
  orderedList: createOrderedListElement,
  paragraph: createParagraphElementWrapper,
  slot: createSlotElement,
  'span-style': createSpanStyleElement,
  strike: createStrikeElement,
  table: createTableElement,
  tableCell: createTableCellElement,
  tableHeader: createTableHeaderElement,
  tableRow: createTableRowElement,
  text: createTextElement,
  video: createVideoElementWrapper,
}

export function tiptapNodeToMDC(
  node: JSONContent,
  context: TiptapToMDCContext,
): MDCNode | MDCNode[] | MDCRoot {
  if (!node) {
    return {
      children: [],
      props: {},
      tag: 'p',
      type: 'element',
    }
  }

  if (node.type && tiptapToMDCMap[node.type]) {
    return tiptapToMDCMap[node.type]!(node, context)
  }

  throw new Error(`Cannot convert unknown editor node: ${String(node.type)}`)
}

/**
 * Convert TipTap JSON to MDC AST (without frontmatter)
 */
export async function tiptapToMDC(
  node: JSONContent,
  options?: TiptapToMDCOptions,
): Promise<MDCRoot> {
  const cleaned = createMdcBodyFromTiptap(node, options)

  return cleaned
}

function createMdcBodyFromTiptap(node: JSONContent, options?: TiptapToMDCOptions): MDCRoot {
  const context: TiptapToMDCContext = {
    options: options || {},
  }

  const nodeCopy = structuredClone(node)

  const body = tiptapNodeToMDC(nodeCopy, context) as MDCRoot

  const cleaned = stripStyleNodes(body)

  return cleaned
}

function createElement(
  node: JSONContent,
  context: TiptapToMDCContext,
  tag?: string,
  extra: JsonRecord = {},
): MDCElement {
  const { props = {}, ...rest } = extra as { props: object }
  let children = node.content || []

  // Unwrap TipTap wrapper
  if (node.attrs?.props?.__tiptapWrap) {
    if (children.length === 1 && children[0]?.type === 'slot') {
      const slot = children[0]
      slot.content = unwrapParagraph(slot.content || [])
    }
    delete node.attrs.props.__tiptapWrap
  }

  const propsArray = normalizeProps(node.attrs?.props || {}, props)

  if (node.type === 'paragraph') {
    if (!children || children.length === 0) {
      return { children: [], props: {}, tag: 'p', type: 'element' }
    }
    return createParagraphElement(node, context, propsArray, rest)
  }

  children = unwrapDefaultSlot(children)
  children = unwrapParagraph(children)

  return {
    children: node.children || children.flatMap((child) => tiptapNodeToMDC(child, context)),
    tag: tag || node.attrs?.tag,
    type: 'element',
    ...rest,
    props: Object.fromEntries(propsArray),
  }
}

export function createParagraphElement(
  node: JSONContent,
  context: TiptapToMDCContext,
  propsArray: Array<[string, JsonValue]>,
  rest: object = {},
): MDCElement {
  type MarkInfo = null | { attrs?: JsonRecord; type: string }

  interface Block {
    content: JSONContent[]
    mark: MarkInfo
  }

  const blocks: Block[] = []
  let currentBlockContent: JSONContent[] = []
  let currentBlockMark: MarkInfo = null

  function getMarkInfo(child: JSONContent): MarkInfo {
    if (child.type === 'text' && child.marks?.length === 1 && child.marks[0]?.type) {
      return child.marks[0] as { attrs?: JsonRecord; type: string }
    }

    if (
      child.type === 'link-element' &&
      child.content &&
      child.content.length === 1 &&
      child.content[0] &&
      child.content[0].type === 'text' &&
      child.content[0].marks?.length === 1 &&
      child.content[0].marks[0]?.type
    ) {
      return child.content[0].marks[0] as { attrs?: JsonRecord; type: string }
    }

    return null
  }

  function sameMark(markA: MarkInfo, markB: MarkInfo): boolean {
    if (!markA && !markB) {
      return true
    }
    if (!markA || !markB) {
      return false
    }
    return (
      markA.type === markB.type &&
      JSON.stringify(markA.attrs || {}) === JSON.stringify(markB.attrs || {})
    )
  }

  node.content!.forEach((child) => {
    const mark = getMarkInfo(child)

    if (!sameMark(mark, currentBlockMark)) {
      if (currentBlockContent.length > 0) {
        blocks.push({ content: currentBlockContent, mark: currentBlockMark })
      }
      currentBlockContent = []
      currentBlockMark = mark
    }

    currentBlockContent.push(child)
  })

  if (currentBlockContent.length > 0) {
    blocks.push({ content: currentBlockContent, mark: currentBlockMark })
  }

  const children = blocks.map((block) => {
    if (block.content.length > 1 && block.mark && markToTag[block.mark.type]) {
      block.content.forEach((child: JSONContent) => {
        if (child.type === 'text') {
          delete child.marks
        } else if (child.type === 'link-element' && child.content?.[0]) {
          delete child.content[0].marks
        }
      })

      const markTag = markToTag[block.mark.type]
      const hasAttrs = block.mark.attrs && Object.keys(block.mark.attrs).length > 0

      if (hasAttrs) {
        return {
          children: block.content.flatMap((child) => tiptapNodeToMDC(child, context)),
          tag: markTag,
          type: 'element',
          props: block.mark.attrs,
        } as MDCElement
      }

      return {
        children: block.content.flatMap((child) => tiptapNodeToMDC(child, context)),
        tag: markTag,
        type: 'element',
      } as MDCElement
    }

    return block.content.flatMap((child) => tiptapNodeToMDC(child, context))
  }) as MDCElement[]

  const mergedChildren = mergeSiblingsWithSameTag(children.flat(), Object.values(markToTag))

  return {
    tag: 'p',
    type: 'element',
    ...rest,
    children: mergedChildren,
    props: Object.fromEntries(propsArray),
  }
}

function createCodeBlockElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const mdcNode = createElement(node, context, 'pre')
  const code = node.attrs?.code || getNodeContent(node) || ''
  const language = node.attrs?.language || ''
  const filename = node.attrs?.filename

  mdcNode.props!.language = language
  if (filename) {
    mdcNode.props!.filename = filename
  }

  mdcNode.children = [
    {
      children: [{ type: 'text', value: code }],
      props: { __ignoreMap: '' },
      tag: 'code',
      type: 'element',
    },
  ]

  return mdcNode
}

function createFileElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const props = node.attrs?.props || {}
  const fileOutput = context.options.fileOutput ?? 'mdc'

  const fileProps: JsonRecord = {}
  if (props.id) fileProps.id = props.id
  if (props.filename) fileProps.filename = props.filename
  if (props.title) fileProps.title = props.title
  if (props.type) fileProps.type = props.type
  if (props.size) fileProps.size = props.size
  if (props.src) fileProps.src = props.src

  if (fileOutput === 'markdown') {
    const linkText = fileProps.title || fileProps.filename || fileProps.src || 'Download'
    return {
      children: [{ type: 'text', value: String(linkText) }],
      props: { __mdc_block: true, href: fileProps.src, title: fileProps.title },
      tag: 'a',
      type: 'element',
    }
  }

  return createElement(node, context, 'file', { props: fileProps })
}

function createHeadingElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const level = node.attrs?.level || 1
  const mdcNode = createElement(node, context, `h${level}`)
  const id = node.attrs?.id
  if (typeof id === 'string' && id) mdcNode.props!.id = id
  else delete mdcNode.props!.id
  return mdcNode
}

function createImageElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const props = node.attrs?.props || {}
  const src = props.src || node.attrs?.src
  const imageOutput = context.options.imageOutput ?? 'mdc'

  const imageProps: JsonRecord = {}
  for (const [key, kind] of Object.entries(imageProperties)) {
    const value = key === 'src' ? src : key === 'alt' ? props.alt || node.attrs?.alt : props[key]
    if (kind === 'number') {
      const number = sanitizeNumberish(value)
      if (number !== null) imageProps[key] = number
    } else if (key === 'id' || key === 'filename' ? !!value : isMeaningfulPropValue(value)) {
      imageProps[key] = value
    }
  }

  const transformKeys = [
    'fit',
    'quality',
    'format',
    'focalX',
    'focalY',
    'cropX',
    'cropY',
    'cropWidth',
    'cropHeight',
  ]
  const hasTransforms = transformKeys.some((key) => {
    const value = props[key]
    return value !== undefined && value !== null && value !== ''
  })

  const sanitizedNode: JSONContent = {
    ...node,
    attrs: {
      ...(node.attrs || {}),
      props: {},
    },
  }

  if (imageOutput === 'markdown') {
    // Markdown carries the host-owned stable identity in its destination.
    // Host metadata and transforms belong to MDC image output; emitting them
    // as attributes would force HTML-like output and violate Content's native
    // image property policy.
    const markdownProps = {
      ...(imageProps.alt !== undefined ? { alt: imageProps.alt } : {}),
      ...(imageProps.src !== undefined ? { src: imageProps.src } : {}),
      ...(imageProps.title !== undefined ? { title: imageProps.title } : {}),
    }
    return createElement(sanitizedNode, context, 'img', {
      props: { ...markdownProps, __mdc_block: true },
    })
  }

  if (props.id || hasTransforms) {
    return createElement(sanitizedNode, context, 'image', { props: imageProps })
  }

  const tag = node.attrs?.tag
  if (tag === 'nuxt-img' || tag === 'nuxt-picture') {
    return createElement(sanitizedNode, context, tag, { props: imageProps })
  }

  return createElement(sanitizedNode, context, 'img', {
    props: { ...imageProps, __mdc_block: true },
  })
}

function createLinkElement(node: JSONContent): MDCElement {
  const attrs = node.attrs || {}
  const { class: className, href, rel, target, ...otherAttrs } = attrs
  const linkProps: Record<string, string> = {}

  if (href) linkProps.href = href
  if (target) linkProps.target = target
  if (rel) linkProps.rel = rel
  if (className) linkProps.class = className

  for (const [key, value] of Object.entries(otherAttrs)) {
    // Unset attributes (e.g. a null title) must not serialize as "null".
    if (value === null || value === undefined || value === '') continue
    linkProps[key] = String(value)
  }

  return { children: node.children || [], props: linkProps, tag: 'a', type: 'element' }
}

function createListItemElement(node: JSONContent, context: TiptapToMDCContext) {
  return createElement(node, context, 'li')
}

function createTextElement(node: JSONContent, context: TiptapToMDCContext): MDCText | MDCText[] {
  const textValue = node.text || ''
  const prefix = textValue.match(RE_TEXT_LEADING_SPACE)?.[0] || ''
  const suffix = textValue.match(RE_TEXT_TRAILING_SPACE)?.[0] || ''
  const text = textValue.trim()

  if (!node.marks?.length) {
    return { type: 'text', value: textValue }
  }

  const res = node.marks.reduce(
    (acc: MDCText, mark: JsonRecord) => {
      const markType = mark.type as string
      if (markType && tiptapToMDCMap[markType]) {
        return tiptapToMDCMap[markType]!({ ...mark, children: [acc] }, context) as MDCText
      }
      return acc
    },
    { type: 'text', value: text },
  )

  const result: (MDCText | null)[] = []
  if (prefix) result.push({ type: 'text', value: prefix })
  result.push(res)
  if (suffix) result.push({ type: 'text', value: suffix })

  return result.filter(Boolean) as MDCText[]
}

function createVideoElement(node: JSONContent, context: TiptapToMDCContext): MDCElement {
  const props = node.attrs?.props || {}
  const videoProps: JsonRecord = {}

  if (node.attrs?.src) videoProps.src = node.attrs.src
  if (node.attrs?.title) videoProps.title = node.attrs.title
  if (node.attrs?.width) videoProps.width = node.attrs.width
  if (node.attrs?.height) videoProps.height = node.attrs.height
  if (props.src) videoProps.src = props.src
  if (props.title) videoProps.title = props.title
  if (props.width) videoProps.width = props.width
  if (props.height) videoProps.height = props.height

  return createElement(node, context, 'video', { props: videoProps })
}

function getNodeContent(node: JSONContent) {
  if (node.type === 'text') {
    return node.text
  }

  let content = ''
  node.content?.forEach((childNode) => {
    content += getNodeContent(childNode)
  })

  return content
}

function mergeSiblingsWithSameTag(children: MDCNode[], allowedTags: string[]): MDCNode[] {
  if (!Array.isArray(children)) {
    return children
  }

  const merged: MDCNode[] = []
  let i = 0

  while (i < children.length) {
    const current = children[i]
    const next = children[i + 1]
    const afterNext = children[i + 2]

    const canMerge =
      current &&
      afterNext &&
      current.type === 'element' &&
      afterNext.type === 'element' &&
      current.tag === afterNext.tag &&
      allowedTags.includes(current.tag) &&
      JSON.stringify(current.props || {}) === JSON.stringify(afterNext.props || {}) &&
      next &&
      next.type === 'text' &&
      next.value === ' '

    if (canMerge) {
      merged.push({
        ...current,
        children: [
          ...(current.children || []),
          { type: 'text', value: ' ' },
          ...(afterNext.children || []),
        ],
      })
      i += 3
    } else if (current) {
      merged.push(current)
      i++
    } else {
      i++
    }
  }

  return merged
}

function unwrapDefaultSlot(content: JSONContent[]): JSONContent[] {
  if (content.length === 1 && content[0]?.type === 'slot' && content[0].attrs?.name === 'default') {
    return content[0].content || []
  }
  return content
}

function unwrapParagraph(content: JSONContent[]): JSONContent[] {
  if (content.length === 1 && content[0]?.type === 'paragraph') {
    return content[0].content || []
  }
  return content
}
