/**
 * Component converters for MDC to TipTap transformation
 *
 * Handles custom components: file, image, video, template, comment, etc.
 */

import type { JSONContent } from '@tiptap/core'

import type { JsonRecord } from '../types'
import type { MDCElement, MDCNode } from './mdcTypes'
import { normalizeBlockChildren } from './nodes'

/**
 * Creates a file node
 */
export function createFileNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'file', {
    attrs: { props: element.props || {} },
  })
}

/**
 * Creates an image node (handles Image, image, and img tags)
 */
export function createImageNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'image', {
    attrs: { props: element.props || {} },
  })
}

/**
 * Creates a video node
 */
export function createVideoNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'video', { attrs: { ...element.props } })
}

/**
 * Creates a comment node
 */
export function createCommentNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'comment', {
    attrs: { text: (node as { value?: string }).value },
  })
}

/**
 * Creates a blockquote node
 */
export function createBlockquoteNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'blockquote', {
    children: element.children?.length
      ? normalizeBlockChildren(element.children)
      : [{ type: 'element', tag: 'p', props: {}, children: [] }],
  })
}

/**
 * Creates a horizontal rule node
 */
export function createHrNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  return createTipTapNodeFn(node as MDCElement, 'horizontalRule')
}

/**
 * Creates a hard break node
 */
export function createBrNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  return createTipTapNodeFn(node as MDCElement, 'hardBreak')
}

/**
 * Creates a table node
 */
export function createTableNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  return createTipTapNodeFn(node as MDCElement, 'table')
}

/**
 * Creates a table row node
 */
export function createTrNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  return createTipTapNodeFn(node as MDCElement, 'tableRow')
}

/**
 * Creates a table header cell node
 */
export function createThNode(
  node: MDCNode,
  createTableCellNodeFn: (node: MDCElement, type: 'tableCell' | 'tableHeader') => JSONContent,
): JSONContent {
  return createTableCellNodeFn(node as MDCElement, 'tableHeader')
}

/**
 * Creates a table data cell node
 */
export function createTdNode(
  node: MDCNode,
  createTableCellNodeFn: (node: MDCElement, type: 'tableCell' | 'tableHeader') => JSONContent,
): JSONContent {
  return createTableCellNodeFn(node as MDCElement, 'tableCell')
}

/**
 * Creates an ordered list node
 */
export function createOlNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'orderedList', {
    attrs: { start: element.props?.start },
    children: element.children?.length ? element.children : [{ type: 'element', tag: 'li', props: {}, children: [] }],
  })
}

/**
 * Creates an unordered list node
 */
export function createUlNode(
  node: MDCNode,
  createTipTapNodeFn: (
    node: MDCElement,
    type: string,
    extra?: { attrs?: JsonRecord; children?: MDCNode[] },
  ) => JSONContent,
): JSONContent {
  const element = node as MDCElement
  return createTipTapNodeFn(element, 'bulletList', {
    children: element.children?.length ? element.children : [{ type: 'element', tag: 'li', props: {}, children: [] }],
  })
}

/**
 * Creates a list item node
 */
export function createLiNode(
  node: MDCNode,
  createListItemNodeFn: (node: MDCElement) => JSONContent,
): JSONContent {
  return createListItemNodeFn(node as MDCElement)
}

/**
 * Creates a paragraph node
 */
export function createPNode(
  node: MDCNode,
  createParagraphNodeFn: (
    node: MDCElement,
    options?: { allowImageLift?: boolean },
  ) => JSONContent | JSONContent[],
): JSONContent | JSONContent[] {
  return createParagraphNodeFn(node as MDCElement)
}

/**
 * Creates a pre/code block node
 */
export function createPreNodeWrapper(
  node: MDCNode,
  createPreNodeFn: (node: MDCElement) => JSONContent,
): JSONContent {
  return createPreNodeFn(node as MDCElement)
}

/**
 * Creates a span-style node
 */
export function createSpanNode(
  node: MDCNode,
  createSpanStyleNodeFn: (node: MDCElement) => JSONContent,
): JSONContent {
  return createSpanStyleNodeFn(node as MDCElement)
}

/**
 * Creates a template/slot node
 */
export function createTemplateNodeWrapper(
  node: MDCNode,
  createTemplateNodeFn: (node: MDCElement) => JSONContent,
): JSONContent {
  return createTemplateNodeFn(node as MDCElement)
}

/**
 * Creates a text node. Text is kept verbatim; MDC syntax is handled by the parser.
 */
export function createTextNodeWrapper(node: MDCNode): JSONContent {
  return { text: (node as { value: string }).value, type: 'text' }
}
