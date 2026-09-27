/**
 * MDC to TipTap converter
 *
 * Main entry point that combines categorized converters:
 * - marks.ts: Text formatting (bold, italic, link, code, strike)
 * - nodes.ts: Document structure (headings, lists, tables, paragraphs)
 * - component-converters.ts: Custom components (file, image, video)
 */

import type { JSONContent } from '@tiptap/core'
import {
  classifyPortableMarkdownElement,
  type PortableComponentPolicy,
} from '@lupinum/ginko-content/cms-contract'

import type { JsonRecord, JsonValue } from '../types'
// Import categorized converters
import {
  createBlockquoteNode,
  createBrNode,
  createCommentNode,
  createFileNode,
  createHrNode,
  createImageNode,
  createLiNode,
  createOlNode,
  createPNode,
  createPreNodeWrapper,
  createSpanNode,
  createTableNode,
  createTdNode,
  createTemplateNodeWrapper,
  createTextNodeWrapper,
  createThNode,
  createTrNode,
  createUlNode,
  createVideoNode,
} from './component-converters'
import { createMark, tagToMark } from './marks'
import type { MDCElement, MDCNode, MDCRoot } from './mdcTypes'
import {
  createHeadingNode,
  createListItemNode,
  createParagraphNode,
  createPreNode,
  createSpanStyleNode,
  createTableCellNode,
  createTemplateNode,
} from './nodes'
import { isValidAttr } from './props'
import { stripStyleNodes } from './stripStyleNodes'

type MDCToTipTapMap = Record<string, (node: MDCNode | MDCRoot) => JSONContent | JSONContent[]>
type MDCToTipTapConverter = (
  node: MDCNode | MDCRoot,
  parent?: MDCNode,
) => JSONContent | JSONContent[]
type TipTapNodeFactory = (
  node: MDCElement,
  type: string,
  extra?: { attrs?: JsonRecord; children?: MDCNode[] },
) => JSONContent

/**
 * Creates the main MDC to TipTap conversion map
 * Combines entries from marks, nodes, and component categories
 */
function createMdcToTiptapMap(
  convert: MDCToTipTapConverter,
  createNode: TipTapNodeFactory,
): MDCToTipTapMap {
  // Create mark entries from tagToMark mapping
  const markMapEntries = Object.entries(tagToMark).map(([key, value]) => [
    key,
    (node: MDCNode) => createMark(node, value, [], convert),
  ])

  // Component and node converters
  return {
    // Marks (text formatting)
    ...Object.fromEntries(markMapEntries),

    // Components (custom elements)
    blockquote: (node: MDCNode) => createBlockquoteNode(node, createNode),
    br: (node: MDCNode) => createBrNode(node, createNode),
    comment: (node: MDCNode) => createCommentNode(node, createNode),
    file: (node: MDCNode) => createFileNode(node, createNode),
    Image: (node: MDCNode) => createImageNode(node, createNode),
    image: (node: MDCNode) => createImageNode(node, createNode),
    img: (node: MDCNode) => createImageNode(node, createNode),
    video: (node: MDCNode) => createVideoNode(node, createNode),

    // Structural nodes
    h1: (node: MDCNode) => createHeadingNode(node, createNode),
    h2: (node: MDCNode) => createHeadingNode(node, createNode),
    h3: (node: MDCNode) => createHeadingNode(node, createNode),
    h4: (node: MDCNode) => createHeadingNode(node, createNode),
    h5: (node: MDCNode) => createHeadingNode(node, createNode),
    h6: (node: MDCNode) => createHeadingNode(node, createNode),
    hr: (node: MDCNode) => createHrNode(node, createNode),
    li: (node: MDCNode) => createLiNode(node, (n) => createListItemNode(n, createNode)),
    ol: (node: MDCNode) => createOlNode(node, createNode),
    p: (node: MDCNode) =>
      createPNode(node, (n, opts) => createParagraphNode(n, convert, opts)),
    pre: (node: MDCNode) =>
      createPreNodeWrapper(node, (n) => createPreNode(n, getNodeText, createNode)),
    span: (node: MDCNode) =>
      createSpanNode(node, (n) => createSpanStyleNode(n, isValidAttr, createNode)),
    table: (node: MDCNode) => createTableNode(node, createNode),
    td: (node: MDCNode) =>
      createTdNode(node, (n, t) => createTableCellNode(n, t, createNode)),
    template: (node: MDCNode) =>
      createTemplateNodeWrapper(node, (n) => createTemplateNode(n, createNode)),
    text: createTextNodeWrapper,
    th: (node: MDCNode) =>
      createThNode(node, (n, t) => createTableCellNode(n, t, createNode)),
    tr: (node: MDCNode) => createTrNode(node, createNode),
    ul: (node: MDCNode) => createUlNode(node, createNode),

    // Root document
    root: (node: MDCNode | MDCRoot) => createRootNode(node, convert),
  }
}

/**
 * Creates the root document node
 */
function createRootNode(node: MDCNode | MDCRoot, convert: MDCToTipTapConverter): JSONContent {
  const element = node as MDCElement
  return {
    content: (element.children || []).flatMap((child) => convert(child, node as MDCNode)),
    type: 'doc',
  }
}

/**
 * Core TipTap node factory
 * Handles attribute cleaning and child conversion
 */
function createTipTapNode(
  node: MDCElement,
  type: string,
  extra: { attrs?: JsonRecord; children?: MDCNode[] } = {},
  convert: MDCToTipTapConverter,
): JSONContent {
  const { attrs = {}, children } = extra
  const attrsProps = (attrs as JsonRecord).props as JsonRecord | undefined
  const nodeProps = node.props || {}
  const mergedProps = { ...(attrsProps || {}), ...nodeProps }

  const cleanProps: Array<[string, JsonValue]> = []
  for (const [key, value] of Object.entries(mergedProps)) {
    if (value === undefined) {
      continue
    }
    if (key.startsWith('__mdc_')) {
      continue
    }

    const trimmedKey = key.trim()
    if (trimmedKey === 'class' || trimmedKey === 'className') {
      const classValue = typeof value === 'string' ? value : (value as Array<string>).join(' ')
      cleanProps.push(['class', classValue])
    } else {
      cleanProps.push([trimmedKey, value])
    }
  }

  const tiptapNode: JSONContent = { attrs, type }

  if (cleanProps.length > 0) {
    ;(tiptapNode.attrs as JsonRecord).props = Object.fromEntries(cleanProps)
  }

  const nodeChildren = children || node.children || []
  if (nodeChildren.length > 0) {
    tiptapNode.content = nodeChildren
      .flatMap((child) => convert(child, node))
      .filter(Boolean)
  }

  return tiptapNode
}

/**
 * Extracts text content from an element recursively
 */
function getNodeText(node: MDCElement): string {
  let content = ''
  const walk = (child: MDCNode) => {
    if (child.type === 'text') {
      content += child.value || ''
      return
    }
    if (child.type === 'element') {
      ;(child.children || []).forEach((grandChild) => walk(grandChild))
    }
  }

  ;(node.children || []).forEach((child) => walk(child))
  return content
}

/**
 * Recursively removes empty text nodes from TipTap content
 * TipTap does not allow text nodes with empty strings
 */
function removeEmptyTextNodes(content: JSONContent): JSONContent
function removeEmptyTextNodes(content: JSONContent[]): JSONContent[]
function removeEmptyTextNodes(content: JSONContent | JSONContent[]): JSONContent | JSONContent[] {
  if (Array.isArray(content)) {
    const filtered = content.filter((node) => {
      // Remove empty text nodes
      if (node?.type === 'text' && (!node.text || node.text === '')) {
        return false
      }
      return true
    })

    return filtered.map((node) => removeEmptyTextNodes(node))
  }

  if (content && typeof content === 'object') {
    const cleaned = { ...content }
    if (cleaned.content) {
      cleaned.content = removeEmptyTextNodes(cleaned.content)
    }
    return cleaned
  }

  return content
}

/**
 * Converts a single Editor node to TipTap format
 * Note: Can return JSONContent[] for text nodes with emojis, which will be flattened by caller
 */
export function mdcNodeToTiptap(
  node: MDCNode | MDCRoot,
  parent?: MDCNode,
  policy?: PortableComponentPolicy,
): JSONContent | JSONContent[] {
  return createMdcToTiptapConverter(policy)(node, parent)
}

function createMdcToTiptapConverter(
  policy?: PortableComponentPolicy,
): MDCToTipTapConverter {
  function convert(node: MDCNode | MDCRoot, parent?: MDCNode) {
    return convertMdcNode(node, parent, policy, converterMap, convert, createNode)
  }
  const createNode: TipTapNodeFactory = (node, type, extra) =>
    createTipTapNode(node, type, extra, convert)
  const converterMap = createMdcToTiptapMap(convert, createNode)
  return convert
}

// Native replacement and description controls can write each of these props.
// Restricted or richer host components must keep their own component controls.
const nativeImagePropTypes = {
  src: ['asset'], id: ['string'], filename: ['string'], alt: ['string'], title: ['string'],
  width: ['string', 'number'], height: ['string', 'number'],
} as const

function isNativePolicyImage(node: MDCNode | MDCRoot, policy?: PortableComponentPolicy): boolean {
  if (node.type !== 'element' || node.tag !== 'image' || node.children?.length
    || typeof node.props?.id !== 'string' || !node.props.id || node.props.src !== node.props.id
    || !policy || !('version' in policy) || policy.version !== 2) return false
  const definition = policy.components.image
  const media = definition?.media
  if (!definition || definition.kind !== 'block' || definition.slots.length !== 0
    || definition.allowedChildren?.length !== 0 || media?.sourceProp !== 'src'
    || media.altProp !== 'alt' || media.titleProp !== 'title' || media.filenameProp !== 'filename'
    || Object.keys(definition.props).length !== Object.keys(nativeImagePropTypes).length) return false
  return Object.entries(nativeImagePropTypes).every(([key, types]) => {
    const prop = definition.props[key]
    return prop?.required === (key === 'src') && prop.allowedValues === null
      && prop.types.length === types.length && prop.types.every((type, index) => type === types[index])
  })
}

function convertMdcNode(
  node: MDCNode | MDCRoot,
  parent: MDCNode | undefined,
  policy: PortableComponentPolicy | undefined,
  converterMap: MDCToTipTapMap,
  convert: MDCToTipTapConverter,
  createNode: TipTapNodeFactory,
): JSONContent | JSONContent[] {
  const type = node.type === 'element' ? node.tag! : node.type

  if (type === 'p' && (parent as MDCElement | undefined)?.tag === 'li') {
    return createParagraphNode(node as MDCElement, convert, { allowImageLift: false })
  }


  const classification = node.type === 'element'
    ? classifyPortableMarkdownElement(node, policy ?? { components: {} })
    : undefined
  const policyComponent = classification?.kind === 'component' && classification.registered

  // Canonical uploaded images keep the native image controls after reopening.
  // Other policy-selected collisions retain their authored component identity.
  if ((!policyComponent || isNativePolicyImage(node, policy)) && converterMap[type]) {
    return converterMap[type](node)
  }


  const authoredInline = classification?.kind === 'component' && classification.form === 'inline'
  if ((parent as MDCElement)?.tag === 'p' || authoredInline) {
    return createNode(node as MDCElement, 'inline-element', { attrs: { tag: type } })
  }

  // In tiptap side only, inside element, text must be enclosed in a paragraph
  if (node.type === 'element' && node.children?.[0]?.type === 'text') {
    node = {
      ...node,
      children: [
        {
          children: node.children,
          props: {},
          tag: 'p',
          type: 'element',
        },
      ],
      props: {
        ...node.props,
        __tiptapWrap: true,
      },
    }
  }

  return createNode(node as MDCElement, 'element', { attrs: { tag: type } })
}

/**
 * Convert MDC AST to TipTap JSON (without frontmatter)
 */
export function mdcToTiptap(
  body: MDCRoot,
  policy?: PortableComponentPolicy,
): JSONContent {
  const cleanedBody = stripStyleNodes(body)

  // Remove invalid text node which added by table syntax
  cleanedBody.children = (cleanedBody.children || []).filter((child) => child.type !== 'text')



  const tree = createMdcToTiptapConverter(policy)(cleanedBody)

  // Handle case where mdcNodeToTiptap returns an array
  let doc: JSONContent
  if (Array.isArray(tree)) {
    doc = { type: 'doc', content: tree }
  } else {
    doc = tree
  }

  // Ensure there's at least one paragraph
  if (!doc.content || doc.content.length === 0) {
    doc.content = [{ content: [], type: 'paragraph' }]
  }

  // Final cleanup: remove any empty text nodes that may have been created
  const cleanedDoc = removeEmptyTextNodes(doc)

  return cleanedDoc
}
