import type { JSONContent } from '@tiptap/core'

export type ConversionPhase =
  | 'parse_mdc'
  | 'mdc_to_tiptap'
  | 'tiptap_to_mdc'
  | 'stringify_mdc'
  | 'set_content'
  | 'validate'

export type ConversionSeverity = 'error' | 'warn'

/** Every issue code that the conversion pipeline and editor validation can report. */
export type ConversionIssueCode =
  | 'authoring_kit_rejected'
  | 'block_inside_paragraph'
  | 'conversion_failed'
  | 'empty_doc'
  | 'inline_node_at_root'
  | 'invalid_doc_root_type'
  | 'invalid_doc_shape'
  | 'invalid_node_shape'
  | 'invalid_text_node'
  | 'list_item_empty'
  | 'list_item_first_child_not_paragraph'
  | 'mdc_to_tiptap_failed'
  | 'missing_doc_content'
  | 'missing_node_type'
  | 'parse_mdc_failed'
  | 'set_content_failed'
  | 'source_only_required'
  | 'stringify_mdc_failed'
  | 'text_node_has_children'
  | 'tiptap_to_mdc_failed'
  | 'unknown_mark_type'
  | 'unknown_node_type'
  | 'visual_compatibility_failed'
  | 'visual_schema_unsupported'

export interface ConversionIssue {
  code: ConversionIssueCode
  severity: ConversionSeverity
  phase: ConversionPhase
  message: string
  detail?: unknown
  context?: Record<string, unknown>
}

export interface ConversionTraceEvent {
  at: string
  kind: 'finish' | 'issue' | 'phase' | 'start'
  phase?: ConversionPhase
  data?: Record<string, unknown>
  issueCode?: ConversionIssueCode
  message?: string
  severity?: ConversionSeverity
}

export interface ConversionResult<T> {
  ok: boolean
  value?: T
  issues: ConversionIssue[]
  traceId: string
  timeline: ConversionTraceEvent[]
  fallbackUsed: boolean
}

export interface ConversionHealthState {
  status: 'degraded' | 'failed' | 'ok'
  lastGoodMarkdown: string
  lastGoodDoc: JSONContent | null
  lastError?: ConversionIssue
}

export interface ConversionErrorPayload {
  traceId: string
  phase: ConversionPhase
  code: ConversionIssueCode
  message: string
  recoverable: boolean
  issues: ConversionIssue[]
  timeline: ConversionTraceEvent[]
}

export interface ConversionRecoveredPayload {
  traceId: string
  fromStatus: ConversionHealthState['status']
  toStatus: ConversionHealthState['status']
}
