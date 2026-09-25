import {
  createHeadingIdGenerator,
  headingSlugText,
  parseMdcDocument,
  serializeMdcDocument,
} from '@lupinum/ginko-content/cms-contract'

import type { JsonRecord, JsonValue } from '../types'
import type { MDCNode, MDCRoot } from './mdcTypes'
import { stripStyleNodes } from './stripStyleNodes'

export interface StringifyMdcOptions {
  videoOutput?: 'html' | 'mdc'
}

type ComarkElementNode = [string, Record<string, unknown>, ...ComarkNode[]]
type ComarkCommentNode = [null, Record<string, unknown>, string]
type ComarkNode = string | ComarkElementNode | ComarkCommentNode

const TABLE_SECTION_TAGS = new Set(['thead', 'tbody', 'tfoot'])

/** Adapt one canonical parse result to the editor's lossless conversion tree. */
export function adaptMdcDocument(
  tree: Awaited<ReturnType<typeof parseMdcDocument>>,
): MDCRoot {
  const nextHeadingId = createHeadingIdGenerator()
  return stripStyleNodes({
    children: comarkNodesToMdc(tree.nodes, nextHeadingId),
    type: 'root',
  })
}

const HEADING_TAG = /^h([1-6])$/

/** Keep a heading id only when it differs from the id the parser generates. */
function headingProps(tag: string, props: JsonRecord, children: ComarkNode[], nextHeadingId: HeadingIds): JsonRecord {
  const level = HEADING_TAG.exec(tag)?.[1]
  if (!level) return props
  const generated = nextHeadingId(headingSlugText(children), Number(level))
  if (props.id !== generated) return props
  const rest = { ...props }
  delete rest.id
  return rest
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
  // Serializer errors reach the caller. An empty document is never a fallback.
  const cleaned = stripStyleNodes(ast)
  const markdown = await serializeMdcDocument({
    frontmatter: {},
    meta: {},
    nodes: mdcNodesToComark(cleaned.children || [], options),
  })
  if (!markdown.trim()) return ''
  return markdown.endsWith('\n') ? markdown : `${markdown}\n`
}

type HeadingIds = ReturnType<typeof createHeadingIdGenerator>

function comarkNodesToMdc(nodes: ComarkNode[], nextHeadingId: HeadingIds): MDCNode[] {
  return nodes.flatMap((node) => comarkNodeToMdc(node, nextHeadingId))
}

function comarkNodeToMdc(node: ComarkNode, nextHeadingId: HeadingIds): MDCNode[] {
  if (typeof node === 'string') {
    return node ? [{ type: 'text', value: node }] : []
  }

  const [tag, rawProps, ...children] = node as ComarkElementNode | ComarkCommentNode
  if (tag === null) {
    return [{ type: 'comment', value: String(children[0] ?? '') }]
  }

  if (TABLE_SECTION_TAGS.has(tag)) {
    return comarkNodesToMdc(children, nextHeadingId)
  }

  // Heading ids are assigned in document order, before nested headings.
  const props = headingProps(tag, cleanComarkProps(rawProps), children, nextHeadingId)
  const childNodes = comarkNodesToMdc(children, nextHeadingId)
  return [
    {
      children: childNodes,
      props,
      tag,
      type: 'element',
    },
  ]
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

