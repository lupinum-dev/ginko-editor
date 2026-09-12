import { parseMdcDocument, serializeMdcDocument } from '@lupinum/ginko-content/cms-contract'

import type { JsonRecord, JsonValue } from '../types'
import { editorDebug } from './debug'
import type { MDCElement, MDCNode, MDCRoot } from './mdcTypes'
import { stripStyleNodes } from './stripStyleNodes'

export interface ParseMdcOptions {
  strict?: boolean
  onError?: (error: unknown) => void
}

export interface StringifyMdcOptions {
  videoOutput?: 'html' | 'mdc'
  strict?: boolean
  onError?: (error: unknown) => void
}

type ComarkElementNode = [string, Record<string, unknown>, ...ComarkNode[]]
type ComarkCommentNode = [null, Record<string, unknown>, string]
type ComarkNode = string | ComarkElementNode | ComarkCommentNode

const TABLE_SECTION_TAGS = new Set(['thead', 'tbody', 'tfoot'])
const STANDARD_TAGS = new Set([
  'a',
  'binding',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'slot',
  'span',
  'strong',
  'style',
  'table',
  'td',
  'template',
  'th',
  'tr',
  'ul',
  'video',
])

/**
 * Parse MDC-compatible markdown to the Studio's current MDC object tree.
 *
 * Comark is the only markdown parser used here. The object tree is a local
 * adapter for the existing TipTap converters, not a separate parsing model.
 */
export async function parseMdc(content: string, options: ParseMdcOptions = {}): Promise<MDCRoot> {
  if (!content || !content.trim()) {
    return emptyRoot()
  }

  try {
    editorDebug.log('parseMdc input', {
      length: content.length,
      preview: content.slice(0, 200),
    })

    const tree = await parseMdcDocument(content, { autoClose: options.strict === false })
    const cleaned = adaptMdcDocument(tree)
    editorDebug.log('comark mdc', collectMdcStats(cleaned))
    return cleaned
  } catch (error) {
    options.onError?.(error)
    editorDebug.error('Failed to parse MDC with Comark:', error)
    if (options.strict !== false) {
      throw error instanceof Error ? error : new Error(String(error))
    }
    return {
      children: [
        {
          children: [{ type: 'text', value: content }],
          props: {},
          tag: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    }
  }
}

/** Adapt one canonical parse result to the editor's lossless conversion tree. */
export function adaptMdcDocument(
  tree: Awaited<ReturnType<typeof parseMdcDocument>>,
): MDCRoot {
  return stripStyleNodes({
    children: comarkNodesToMdc(tree.nodes),
    type: 'root',
  }, 'parseMdc')
}

/**
 * Stringify the Studio MDC object tree back to Comark/MDC-compatible markdown.
 */
export async function stringifyMdc(
  ast: MDCRoot,
  options: StringifyMdcOptions = {},
): Promise<string> {
  if (!ast || !ast.children?.length) {
    return ''
  }

  try {
    editorDebug.log('stringifyMdc input', collectMdcStats(ast))
    const cleaned = stripStyleNodes(ast, 'stringifyMdc')
    const tree = {
      frontmatter: {},
      meta: {},
      nodes: mdcNodesToComark(cleaned.children || [], options),
    }
    const markdown = await serializeMdcDocument(tree)
    if (!markdown.trim()) return ''
    return markdown.endsWith('\n') ? markdown : `${markdown}\n`
  } catch (error) {
    options.onError?.(error)
    editorDebug.error('Failed to stringify MDC with Comark:', error)
    if (options.strict !== false) {
      throw error instanceof Error ? error : new Error(String(error))
    }
    return ''
  }
}

function emptyRoot(): MDCRoot {
  return {
    children: [],
    type: 'root',
  }
}

function comarkNodesToMdc(nodes: ComarkNode[]): MDCNode[] {
  return nodes.flatMap((node) => comarkNodeToMdc(node))
}

function comarkNodeToMdc(node: ComarkNode): MDCNode[] {
  if (typeof node === 'string') {
    return textToMdcNodes(node)
  }

  const [tag, rawProps, ...children] = node as ComarkElementNode | ComarkCommentNode
  if (tag === null) {
    return [{ type: 'comment', value: String(children[0] ?? '') }]
  }

  if (TABLE_SECTION_TAGS.has(tag)) {
    return comarkNodesToMdc(children)
  }

  const props = cleanComarkProps(rawProps)
  const childNodes = comarkNodesToMdc(children)
  return [
    {
      children: childNodes,
      props,
      tag,
      type: 'element',
    },
  ]
}

function textToMdcNodes(value: string): MDCNode[] {
  if (!value) return []
  const nodes: MDCNode[] = []
  let cursor = 0
  while (cursor < value.length) {
    const start = value.indexOf('{{', cursor)
    if (start === -1) {
      nodes.push({ type: 'text', value: value.slice(cursor) })
      break
    }
    if (start > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, start) })
    }
    const end = value.indexOf('}}', start + 2)
    if (end === -1) {
      nodes.push({ type: 'text', value: value.slice(start) })
      break
    }
    const expression = value.slice(start + 2, end).trim()
    const separator = expression.indexOf('||')
    const bindingValue =
      separator === -1 ? expression.trim() : expression.slice(0, separator).trim()
    const defaultValue = separator === -1 ? '' : expression.slice(separator + 2).trim()
    nodes.push({
      children: [],
      props: {
        ...(bindingValue ? { value: bindingValue } : {}),
        ...(defaultValue ? { defaultValue } : {}),
      },
      tag: 'binding',
      type: 'element',
    })
    cursor = end + 2
  }
  return nodes
}

function cleanComarkProps(rawProps: Record<string, unknown> = {}): JsonRecord {
  const props: JsonRecord = {}
  for (const [key, value] of Object.entries(rawProps)) {
    if (value === undefined) {
      continue
    }
    props[key] = value as JsonValue
  }
  return props
}

function mdcNodesToComark(nodes: MDCNode[], options: StringifyMdcOptions): ComarkNode[] {
  return nodes.flatMap((node) => {
    const converted = mdcNodeToComark(node, options)
    // Markdown images and links are inline syntax. TipTap media nodes are
    // blocks, so retain that boundary at every structural depth.
    if (node.type === 'element' && node.props?.__mdc_block === true) {
      return [['p', {}, ...converted] satisfies ComarkElementNode]
    }
    return converted
  })
}

function mdcNodeToComark(node: MDCNode, options: StringifyMdcOptions): ComarkNode[] {
  if (node.type === 'text') {
    return [node.value ?? '']
  }

  if (node.type === 'comment') {
    return [[null, {}, node.value ?? '']]
  }

  const props = cleanMdcProps(node.props || {})

  if (node.tag === 'video' && options.videoOutput === 'html') {
    return [
      [
        'video',
        {
          controls: true,
          ...(props.height !== undefined ? { height: props.height } : {}),
          ...(props.src !== undefined ? { src: props.src } : {}),
          ...(props.title !== undefined ? { title: props.title } : {}),
          ...(props.width !== undefined ? { width: props.width } : {}),
          $: { html: 1 },
        },
      ],
    ]
  }

  return [[node.tag, props, ...mdcNodesToComark(node.children || [], options)]]
}

function cleanMdcProps(rawProps: JsonRecord): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rawProps)) {
    if (value === undefined) continue
    if (key.startsWith('__mdc_')) continue
    props[key] = value
  }
  return props
}

/**
 * Summarize MDC AST structure for debugging.
 */
export function summarizeMdc(root: MDCRoot) {
  const stats = {
    codeBlocks: 0,
    components: [] as string[],
    elements: 0,
    nodes: 0,
    styleNodes: 0,
  }

  const walk = (node: MDCNode | MDCRoot) => {
    stats.nodes += 1
    if (node.type === 'element') {
      stats.elements += 1
      if (node.tag === 'pre') stats.codeBlocks += 1
      if (node.tag === 'style') stats.styleNodes += 1
      if (node.tag && !STANDARD_TAGS.has(node.tag)) stats.components.push(node.tag)
    }
    const children = (node as MDCElement).children || []
    children.forEach((child) => walk(child))
  }

  walk(root)

  return {
    ...stats,
    components: [...new Set(stats.components)],
  }
}

/**
 * Summarize table structure in MDC AST for debugging.
 */
export function summarizeTableMdc(root: MDCRoot) {
  const stats = {
    cells: 0,
    headers: 0,
    rows: 0,
    tables: 0,
  }

  const walk = (node: MDCNode | MDCRoot) => {
    if (node.type === 'element') {
      if (node.tag === 'table') stats.tables += 1
      if (node.tag === 'tr') stats.rows += 1
      if (node.tag === 'th') stats.headers += 1
      if (node.tag === 'td') stats.cells += 1
    }
    const children = (node as MDCElement).children || []
    children.forEach((child) => walk(child))
  }

  walk(root)
  return stats
}

function collectMdcStats(root: MDCRoot) {
  return summarizeMdc(root)
}
