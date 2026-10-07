import { createEditorSchema } from '../config/documentConfig'
import { convertTiptapDocToMarkdown } from '../conversionPipeline'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { CollaborationError, editorSchemaRevision } from './protocol'
import { parseCollaborationRecovery, type CollaborationRecovery } from './session'

/** @experimental */
export type CollaborationRecoveryMarkdown =
  | { ok: true; markdown: string }
  | { ok: false; message: string }

/** @experimental */
export type CollaborationRecoveryReadResult =
  /** Same schema revision. Pass `recovery` to a new session; construction still checks its document fence. */
  | { status: 'current'; recovery: CollaborationRecovery }
  /** Older or newer schema revision. The pending document was converted to Markdown for manual reuse. */
  | { status: 'converted'; schemaRevision: string; recovery: CollaborationRecovery; markdown: string }
  /** The copy cannot be read or converted. Offer the stored text as a download. */
  | { status: 'unreadable'; reason: 'format' | 'content'; message: string }

/**
 * Convert the pending document in a recovery copy to Markdown with the current
 * schema. This does not check a Content policy; validate the result before use.
 * @experimental
 */
export async function collaborationRecoveryToMarkdown(recovery: CollaborationRecovery,
  output?: TiptapToMDCOptions): Promise<CollaborationRecoveryMarkdown> {
  const failure = { ok: false as const, message: 'This recovery copy cannot be converted to Markdown by this editor version. Keep the file.' }
  try {
    const schema = createEditorSchema()
    const doc = schema.nodeFromJSON(JSON.parse(recovery.document))
    doc.check()
    const result = await convertTiptapDocToMarkdown(doc.toJSON(), output)
    return result.ok && result.value !== undefined ? { ok: true, markdown: result.value } : failure
  } catch {
    return failure
  }
}

/**
 * Read host-stored recovery text. A copy from the current schema revision is
 * returned for a new session. A copy from another schema revision cannot be
 * rebased, so its pending document is converted to Markdown when possible.
 * @experimental
 */
export async function readCollaborationRecovery(source: string,
  options: { output?: TiptapToMDCOptions } = {}): Promise<CollaborationRecoveryReadResult> {
  let recovery: CollaborationRecovery
  try {
    recovery = parseCollaborationRecovery(source)
  } catch (error) {
    return { status: 'unreadable', reason: 'format',
      message: error instanceof CollaborationError ? error.message : 'Invalid editor recovery copy.' }
  }
  if (recovery.base.schemaRevision === editorSchemaRevision) return { status: 'current', recovery }
  const converted = await collaborationRecoveryToMarkdown(recovery, options.output)
  if (!converted.ok) return { status: 'unreadable', reason: 'content', message: converted.message }
  return { status: 'converted', schemaRevision: recovery.base.schemaRevision, recovery, markdown: converted.markdown }
}
