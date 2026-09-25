import type { Editor } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/core'
import {
  parseMdcDocument,
  projectMdcDocument,
  validateStoredPortableMarkdownAst,
  type PortableComponentPolicy,
} from '@lupinum/ginko-content/cms-contract'

import type { AuthoringKit } from '../authoring'
import { validateTiptapDocShape } from './conversionInvariants'
import { finishTrace, logIssue, logPhase, startTrace } from './conversionLogger'
import type {
  ConversionIssue,
  ConversionIssueCode,
  ConversionPhase,
  ConversionResult,
  ConversionSeverity,
} from './conversionTypes'
import { adaptMdcDocument, stringifyMdc } from './markdown'
import { mdcToTiptap } from './mdcToTiptap'
import type { TiptapToMDCOptions } from './tiptapToMdc'
import { tiptapToMDC } from './tiptapToMdc'

export type {
  ConversionErrorPayload,
  ConversionHealthState,
  ConversionIssue,
  ConversionIssueCode,
  ConversionPhase,
  ConversionRecoveredPayload,
  ConversionResult,
  ConversionSeverity,
  ConversionTraceEvent,
} from './conversionTypes'

function buildIssue(
  phase: ConversionPhase,
  code: ConversionIssueCode,
  message: string,
  detail?: unknown,
  context?: Record<string, unknown>,
  severity: ConversionSeverity = 'error',
): ConversionIssue {
  return {
    code,
    context,
    detail,
    message,
    phase,
    severity,
  }
}

function success<T>(
  traceId: string,
  issues: ConversionIssue[],
  timeline: ReturnType<typeof finishTrace>,
  value: T,
  fallbackUsed = false,
): ConversionResult<T> {
  return {
    fallbackUsed,
    issues,
    ok: true,
    timeline,
    traceId,
    value,
  }
}

function failure<T>(
  traceId: string,
  issues: ConversionIssue[],
  timeline: ReturnType<typeof finishTrace>,
  fallbackUsed = false,
): ConversionResult<T> {
  return {
    fallbackUsed,
    issues,
    ok: false,
    timeline,
    traceId,
  }
}

function splitIssues(issues: ConversionIssue[]) {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warn')
  return { errors, warnings }
}

export async function validateMarkdownForAuthoring(
  markdown: string,
  authoringKit: Pick<AuthoringKit, 'policy'>,
): Promise<ConversionIssue | undefined> {
  try {
    const sourceDocument = await parseMdcDocument(markdown, { autoClose: false })
    return validateParsedDocumentForAuthoring(sourceDocument, authoringKit)
  } catch (error) {
    return buildIssue(
      'validate',
      'authoring_kit_rejected',
      'This document violates the editor authoring kit.',
      error,
    )
  }
}

function validateParsedDocumentForAuthoring(
  sourceDocument: Awaited<ReturnType<typeof parseMdcDocument>>,
  authoringKit: Pick<AuthoringKit, 'policy'>,
): ConversionIssue | undefined {
  const validation = validateStoredPortableMarkdownAst(
    projectMdcDocument(sourceDocument).body,
    authoringKit.policy,
  )
  if (validation.ok) return undefined
  const firstIssue = validation.issues[0]
  return buildIssue(
    'validate',
    'authoring_kit_rejected',
    'This document violates the editor authoring kit.',
    new TypeError(
      `Invalid authoring kit: source is outside policy (${firstIssue?.code} at ${firstIssue?.path.join('.')}).`,
    ),
  )
}

export async function convertMarkdownToTiptapDoc(
  markdown: string,
): Promise<ConversionResult<JSONContent>> {
  let sourceDocument: Awaited<ReturnType<typeof parseMdcDocument>>
  try {
    sourceDocument = await parseMdcDocument(markdown, { autoClose: false })
  } catch (error) {
    return markdownParseFailure(markdown, error)
  }
  return convertParsedMdcDocumentToTiptap(markdown, sourceDocument)
}

function markdownParseFailure(
  markdown: string,
  error: unknown,
): ConversionResult<JSONContent> {
  const trace = startTrace({
    direction: 'markdown_to_tiptap',
  })
  const issues: ConversionIssue[] = []
  logPhase(trace, 'parse_mdc', { inputLength: markdown.length })
  const issue = buildIssue(
    'parse_mdc',
    'parse_mdc_failed',
    'Failed to parse MDC markdown',
    error,
    {
      inputLength: markdown.length,
      preview: markdown.slice(0, 200),
    },
  )
  issues.push(issue)
  logIssue(trace, issue)
  return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
}

function convertParsedMdcDocumentToTiptap(
  markdown: string,
  sourceDocument: Awaited<ReturnType<typeof parseMdcDocument>>,
  policy?: PortableComponentPolicy,
): ConversionResult<JSONContent> {
  const trace = startTrace({ direction: 'markdown_to_tiptap' })
  const issues: ConversionIssue[] = []
  logPhase(trace, 'parse_mdc', { inputLength: markdown.length })

  let ast: ReturnType<typeof adaptMdcDocument>
  try {
    ast = adaptMdcDocument(sourceDocument)
  } catch (error) {
    return markdownParseFailure(markdown, error)
  }

  logPhase(trace, 'mdc_to_tiptap')

  let doc: JSONContent
  try {
    doc = mdcToTiptap(ast, policy)
  } catch (error) {
    const issue = buildIssue(
      'mdc_to_tiptap',
      'mdc_to_tiptap_failed',
      'Failed to convert MDC AST to TipTap JSON',
      error,
    )
    issues.push(issue)
    logIssue(trace, issue)
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  logPhase(trace, 'validate')
  const invariantIssues = validateTiptapDocShape(doc)
  for (const invariantIssue of invariantIssues) {
    issues.push(invariantIssue)
    logIssue(trace, invariantIssue)
  }

  const { errors } = splitIssues(issues)
  if (errors.length > 0) {
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  return success(trace.traceId, issues, finishTrace(trace, { status: 'ok' }), doc)
}

/**
 * Checks that visual editing can represent a document before TipTap owns it.
 * Raw markdown remains canonical: a document that would lose meaning stays in
 * source mode instead of being silently normalized into a smaller document.
 */
export async function prepareMarkdownForVisualEditing(
  markdown: string,
  options?: TiptapToMDCOptions,
  schema?: Schema,
  authoringKit?: Pick<AuthoringKit, 'policy'>,
  context: 'document' | 'fragment' = 'document',
): Promise<ConversionResult<JSONContent>> {
  let sourceDocument: Awaited<ReturnType<typeof parseMdcDocument>>
  try {
    sourceDocument = await parseMdcDocument(markdown, { autoClose: false })
  } catch (error) {
    return markdownParseFailure(markdown, error)
  }

  const converted = convertParsedMdcDocumentToTiptap(
    markdown,
    sourceDocument,
    authoringKit?.policy,
  )
  if (!converted.ok || !converted.value) return converted

  if (authoringKit && context === 'document') {
    const issue = validateParsedDocumentForAuthoring(sourceDocument, authoringKit)
    if (issue) {
      return { ...converted, issues: [...converted.issues, issue], ok: false }
    }
  }

  let visualDocument = converted.value
  if (schema) {
    try {
      const document = schema.nodeFromJSON(converted.value)
      document.check()
      // ProseMirror drops unknown attributes without throwing. Verify the
      // document the editor will actually keep, not only the converter output.
      visualDocument = document.toJSON()
    } catch (error) {
      const issue = buildIssue(
        'validate',
        'visual_schema_unsupported',
        'This document contains nodes that the visual editor does not support.',
        error,
      )
      return {
        ...converted,
        issues: [...converted.issues, issue],
        ok: false,
      }
    }
  }

  const roundTrip = await convertTiptapDocToMarkdown(visualDocument, options)
  if (!roundTrip.ok || roundTrip.value === undefined) {
    return {
      ...converted,
      issues: [...converted.issues, ...roundTrip.issues],
      ok: false,
    }
  }

  try {
    const roundTripTree = await parseMdcDocument(roundTrip.value, { autoClose: false })
    if (stableJson(normalizeVisualSemantics(sourceDocument)) !== stableJson(normalizeVisualSemantics(roundTripTree))) {
      const issue = buildIssue(
        'validate',
        'source_only_required',
        'This document contains content that visual editing cannot preserve.',
        undefined,
        { inputLength: markdown.length },
      )
      return {
        ...converted,
        issues: [...converted.issues, issue],
        ok: false,
      }
    }
  } catch (error) {
    const issue = buildIssue(
      'validate',
      'visual_compatibility_failed',
      'Could not verify that visual editing preserves this document.',
      error,
    )
    return {
      ...converted,
      issues: [...converted.issues, issue],
      ok: false,
    }
  }

  return { ...converted, value: visualDocument }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function normalizeVisualSemantics(document: {
  frontmatter?: unknown
  meta?: unknown
  nodes?: unknown[]
}) {
  return {
    frontmatter: document.frontmatter ?? {},
    meta: document.meta ?? {},
    nodes: normalizeComarkNodes(document.nodes ?? []),
  }
}

function normalizeComarkNodes(nodes: unknown[]): unknown[] {
  return nodes.flatMap((node) => {
    if (!Array.isArray(node) || typeof node[0] !== 'string') return [node]
    const [tag, rawProps, ...children] = node
    const props = { ...((rawProps && typeof rawProps === 'object' ? rawProps : {}) as Record<string, unknown>) }
    const metadata = props.$
    if (
      metadata
      && typeof metadata === 'object'
      && 'syntax' in metadata
      && (metadata.syntax === 'angle' || metadata.syntax === 'colon')
      && 'block' in metadata
    ) {
      // Content may change delimiters to preserve edited property values.
      // Component identity and inline/block placement carry the meaning.
      props.$ = { component: 1, block: metadata.block }
    }
    if (tag === 'a' && props.target === '_blank' && props.rel === 'noopener noreferrer nofollow') {
      delete props.target
      delete props.rel
    }
    const normalizedChildren = normalizeComarkNodes(children)
    if (
      tag === 'p' &&
      normalizedChildren.length > 0 &&
      normalizedChildren.every(
        (child) => Array.isArray(child) && (child[0] === 'a' || child[0] === 'img'),
      )
    ) {
      return normalizedChildren
    }
    return [[tag, props, ...normalizedChildren]]
  })
}

export async function convertTiptapDocToMarkdown(
  doc: JSONContent,
  options?: TiptapToMDCOptions,
): Promise<ConversionResult<string>> {
  const trace = startTrace({
    direction: 'tiptap_to_markdown',
  })
  const issues: ConversionIssue[] = []

  logPhase(trace, 'validate')
  const invariantIssues = validateTiptapDocShape(doc)
  for (const invariantIssue of invariantIssues) {
    issues.push(invariantIssue)
    logIssue(trace, invariantIssue)
  }

  const invariantErrors = invariantIssues.filter((issue) => issue.severity === 'error')
  if (invariantErrors.length > 0) {
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  logPhase(trace, 'tiptap_to_mdc')
  let ast: Awaited<ReturnType<typeof tiptapToMDC>>
  try {
    ast = await tiptapToMDC(doc, options)
  } catch (error) {
    const issue = buildIssue(
      'tiptap_to_mdc',
      'tiptap_to_mdc_failed',
      'Failed to convert TipTap JSON to MDC AST',
      error,
    )
    issues.push(issue)
    logIssue(trace, issue)
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  logPhase(trace, 'stringify_mdc')
  let markdown: string
  try {
    markdown = await stringifyMdc(ast, { videoOutput: options?.videoOutput })
  } catch (error) {
    const issue = buildIssue(
      'stringify_mdc',
      'stringify_mdc_failed',
      'Failed to stringify MDC AST to markdown',
      error,
    )
    issues.push(issue)
    logIssue(trace, issue)
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  return success(trace.traceId, issues, finishTrace(trace, { status: 'ok' }), markdown)
}

export function applyTiptapDocToEditor(
  editor: Editor,
  doc: JSONContent,
): ConversionResult<JSONContent> {
  const trace = startTrace({
    direction: 'tiptap_to_editor',
  })
  const issues: ConversionIssue[] = []

  logPhase(trace, 'validate')
  const invariantIssues = validateTiptapDocShape(doc)
  for (const invariantIssue of invariantIssues) {
    issues.push(invariantIssue)
    logIssue(trace, invariantIssue)
  }

  const invariantErrors = invariantIssues.filter((issue) => issue.severity === 'error')
  if (invariantErrors.length > 0) {
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  logPhase(trace, 'set_content')
  try {
    // Schema.nodeFromJSON is strict. TipTap's createDocument helper can catch an
    // unknown-node error and return an empty fallback document, which would
    // make unsupported source look successfully applied.
    const nextDoc = editor.schema.nodeFromJSON(doc)
    nextDoc.check()

    // Echo guard: applying content that matches the current document (e.g. the
    // autosave round-trip writing our own value back) must not touch the doc,
    // undo history, selection, or focus.
    if (nextDoc.eq(editor.state.doc)) {
      return success(trace.traceId, issues, finishTrace(trace, { status: 'ok' }), doc)
    }

    // External content replaces the document outside the undo history, so a
    // single undo never jumps past the reset to an empty editor. Selection and
    // focus are preserved for a writer who is mid-edit.
    const { from, to } = editor.state.selection
    const wasFocused = editor.isFocused
    const tr = editor.state.tr
      .replaceWith(0, editor.state.doc.content.size, nextDoc.content)
      .setMeta('addToHistory', false)
    tr.setSelection(
      TextSelection.between(
        tr.doc.resolve(Math.min(from, tr.doc.content.size)),
        tr.doc.resolve(Math.min(to, tr.doc.content.size)),
      ),
    )
    editor.view.dispatch(tr)
    if (wasFocused && !editor.isFocused) {
      editor.view.focus()
    }
  } catch (error) {
    const issue = buildIssue(
      'set_content',
      'set_content_failed',
      'Failed to apply TipTap JSON to editor',
      error,
    )
    issues.push(issue)
    logIssue(trace, issue)
    return failure(trace.traceId, issues, finishTrace(trace, { status: 'failed' }))
  }

  return success(trace.traceId, issues, finishTrace(trace, { status: 'ok' }), doc)
}
