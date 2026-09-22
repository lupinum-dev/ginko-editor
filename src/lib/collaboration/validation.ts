import type { Node, Schema } from '@tiptap/pm/model'
import { AttrStep, Step, Transform } from '@tiptap/pm/transform'
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'
import { createEditorSchema } from '../config/documentConfig'
import { convertTiptapDocToMarkdown, prepareMarkdownForVisualEditing, validateMarkdownForAuthoring } from '../conversionPipeline'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { imageProperties } from '../image-properties'
import {
  assertCollaborationHead, collaborationLimits, CollaborationError, editorSchemaRevision, fenceMismatch,
  type CollaborationSnapshot, type CollaborationSteps,
} from './protocol'

const wireSteps = new Set(['replace', 'replaceAround', 'addMark', 'removeMark', 'addNodeMark',
  'removeNodeMark', 'attr', 'ginkoSetNodePropertyV1', 'ginkoSetComponentVariantV1', 'ginkoSetNodeAttributeV1'])
const encoder = new TextEncoder()

function validateStepPositions(json: Record<string, unknown>) {
  for (const field of ['from', 'to', 'pos', 'gapFrom', 'gapTo', 'insert']) {
    if (field in json && (!Number.isSafeInteger(json[field]) || Number(json[field]) < 0)) {
      throw new CollaborationError('invalid', 'Editor step positions must be nonnegative safe integers.')
    }
  }
  if (json.slice && typeof json.slice === 'object') {
    for (const [key, value] of Object.entries(json.slice)) {
      if (['openStart', 'openEnd'].includes(key) && (!Number.isSafeInteger(value) || Number(value) < 0)) {
        throw new CollaborationError('invalid', 'Editor slice depths must be nonnegative safe integers.')
      }
    }
  }
}

export function stableJson(value: unknown, depth = 0): string {
  if (depth > collaborationLimits.jsonDepth) throw new CollaborationError('limit', 'The document is too deeply nested.')
  if (typeof value === 'number' && !Number.isFinite(value)) throw new CollaborationError('invalid', 'JSON numbers must be finite.')
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item, depth + 1)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item, depth + 1)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function parseBounded(source: string, maxBytes: number): unknown {
  if (typeof source !== 'string') throw new CollaborationError('invalid', 'Expected encoded JSON.')
  if (encoder.encode(source).byteLength > maxBytes) throw new CollaborationError('limit', 'The change is too large.')
  try {
    const value: unknown = JSON.parse(source)
    stableJson(value)
    return value
  } catch (error) {
    if (error instanceof CollaborationError) throw error
    throw new CollaborationError('invalid', 'The change contains invalid JSON.')
  }
}

/** Reject unknown nodes, attributes and malformed shapes instead of dropping them. */
export function decodeCollaborationDocument(source: string, schema: Schema = createEditorSchema()): Node {
  const json = parseBounded(source, collaborationLimits.documentBytes)
  try {
    const doc = schema.nodeFromJSON(json)
    doc.check()
    if (doc.type !== schema.topNodeType || stableJson(doc.toJSON()) !== stableJson(json)) {
      throw new Error('Non-canonical document')
    }
    return doc
  } catch {
    throw new CollaborationError('content', 'The collaborative document does not match this editor schema.')
  }
}

/** The caller must check host authorization and the document fence first. */
export function decodeCollaborationSteps(encoded: readonly string[], schema: Schema = createEditorSchema()): Step[] {
  if (!Array.isArray(encoded) || encoded.length < 1 || encoded.length > collaborationLimits.stepsPerBatch) {
    throw new CollaborationError('limit', 'The change has an invalid number of steps.')
  }
  let bytes = 0
  return encoded.map(source => {
    const json = parseBounded(source, collaborationLimits.batchBytes)
    bytes += encoder.encode(source).byteLength
    if (bytes > collaborationLimits.batchBytes) throw new CollaborationError('limit', 'The change batch is too large.')
    if (!json || typeof json !== 'object' || !('stepType' in json) || typeof json.stepType !== 'string'
      || !wireSteps.has(json.stepType)) throw new CollaborationError('invalid', 'Unsupported editor step.')
    validateStepPositions(json)
    try {
      const step = Step.fromJSON(schema, json)
      if (stableJson(step.toJSON()) !== stableJson(json)) throw new Error('Non-canonical step')
      return step
    } catch {
      throw new CollaborationError('invalid', 'The editor step would lose data when decoded.')
    }
  })
}

export interface CollaborationContentOptions {
  policy: PortableComponentPolicyV2
  output?: TiptapToMDCOptions
}

export interface CollaborationCheckpoint {
  snapshot: CollaborationSnapshot
  /** Derived from the accepted snapshot, never taken from a client checkpoint. */
  markdown: string
}

function validateRuntimeMetadata(doc: Node) {
  doc.descendants(node => {
    const props: unknown = node.attrs.props
    if (props && (typeof props !== 'object' || Array.isArray(props))) throw new CollaborationError('content', 'Node properties must be an object.')
    if (props && typeof props === 'object') {
      for (const [key, value] of Object.entries(props)) {
        if (key === '$') {
          if (!value || typeof value !== 'object' || Array.isArray(value)
            || Object.keys(value).sort().join(',') !== 'block,sourceName,syntax'
            || !('syntax' in value) || (value.syntax !== 'angle' && value.syntax !== 'colon')
            || !('block' in value) || (value.block !== 0 && value.block !== 1)
            || !('sourceName' in value) || typeof value.sourceName !== 'string') {
            throw new CollaborationError('content', 'Invalid component source metadata.')
          }
          continue
        }
        if (key === '__tiptapWrap' && value === true && node.type.name === 'element') continue
        if (key === '__mdc_block' && value === true && ['image', 'file'].includes(node.type.name)) continue
        if (node.type.name === 'image') {
          const definition = Object.entries(imageProperties).find(([name]) => name === key)?.[1]
          if (!definition) throw new CollaborationError('content', 'An image property cannot be saved as Content.')
          if (value === null || value === undefined || value === '') continue
          if (definition === 'text' ? typeof value !== 'string'
            : !['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value))) {
            throw new CollaborationError('content', 'An image property has an unsupported value.')
          }
        }
      }
    }
    if (node.type.name === 'codeBlock' && ['language', 'filename'].some(key => node.attrs[key] !== null && typeof node.attrs[key] !== 'string')) {
      throw new CollaborationError('content', 'Code metadata must be text.')
    }
    if (node.type.name === 'table') {
      const width = node.firstChild?.childCount
      if (!width || node.content.content.some((row, index) => row.childCount !== width
        || row.content.content.some(cell => cell.type.name !== (index === 0 ? 'tableHeader' : 'tableCell')))) {
        throw new CollaborationError('content', 'Content tables need a rectangular layout and one header row.')
      }
      if (node.content.content.some(row => row.content.content.some((cell, column) =>
        (cell.attrs.align ?? 'left') !== (node.firstChild!.child(column).attrs.align ?? 'left')))) {
        throw new CollaborationError('content', 'Content tables need one alignment per column.')
      }
    }
    if (['tableCell', 'tableHeader'].includes(node.type.name)
      && (node.attrs.colspan !== 1 || node.attrs.rowspan !== 1 || node.attrs.colwidth !== null
        || ![null, 'left', 'center', 'right'].includes(node.attrs.align))) {
      throw new CollaborationError('content', 'Merged cells and custom cell widths cannot be saved as Content.')
    }
  })
}

async function checkpoint(doc: Node, head: Omit<CollaborationSnapshot, 'document'>, options: CollaborationContentOptions): Promise<CollaborationCheckpoint> {
  validateRuntimeMetadata(doc)
  const document = JSON.stringify(doc.toJSON())
  if (encoder.encode(document).byteLength > collaborationLimits.documentBytes) {
    throw new CollaborationError('limit', 'The collaborative document is too large.')
  }
  const result = await convertTiptapDocToMarkdown(doc.toJSON(), options.output)
  if (!result.ok || result.value === undefined) throw new CollaborationError('content', 'The document cannot be saved as Content.')
  const issue = await validateMarkdownForAuthoring(result.value, { policy: options.policy })
  if (issue) throw new CollaborationError('content', 'The document is outside the host content policy.')
  return { snapshot: { ...head, document }, markdown: result.value }
}

/** Seed or replace a room only inside a host-authorized transaction with a new epoch. */
export async function createCollaborationSnapshot(markdown: string, options: CollaborationContentOptions & {
  epoch: string
  policyRevision: string
}): Promise<CollaborationCheckpoint> {
  if (typeof markdown !== 'string' || encoder.encode(markdown).byteLength > collaborationLimits.documentBytes) {
    throw new CollaborationError('limit', 'The source document is too large.')
  }
  const head = { epoch: options.epoch, policyRevision: options.policyRevision, schemaRevision: editorSchemaRevision, version: 0 }
  assertCollaborationHead(head)
  const schema = createEditorSchema()
  const prepared = await prepareMarkdownForVisualEditing(markdown, options.output, schema, { policy: options.policy })
  if (!prepared.ok || !prepared.value) throw new CollaborationError('content', 'This source needs source-only editing.')
  return checkpoint(schema.nodeFromJSON(prepared.value), head, options)
}

/** Apply an exact-version batch. Persist the result and operation log atomically. */
export async function applyCollaborationSteps(snapshot: CollaborationSnapshot, batch: CollaborationSteps,
  options: CollaborationContentOptions): Promise<CollaborationCheckpoint> {
  assertCollaborationHead(snapshot)
  assertCollaborationHead(batch)
  const mismatch = fenceMismatch(snapshot, batch)
  if (mismatch) throw new CollaborationError(mismatch, 'The collaborative document has changed. Reopen it with your recovery copy.')
  if (batch.version !== snapshot.version) throw new CollaborationError('version', 'Fetch accepted steps before submitting this change.')
  if (typeof batch.clientId !== 'string' || !batch.clientId || batch.clientId.length > 200) {
    throw new CollaborationError('invalid', 'Invalid editor client ID.')
  }
  const schema = createEditorSchema()
  const steps = decodeCollaborationSteps(batch.steps, schema)
  if (!Number.isSafeInteger(snapshot.version + steps.length)) throw new CollaborationError('limit', 'The document version is too large.')
  const transform = new Transform(decodeCollaborationDocument(snapshot.document, schema))
  try {
    for (const step of steps) {
      if (step instanceof AttrStep && !Object.hasOwn(transform.doc.nodeAt(step.pos)?.type.spec.attrs ?? {}, step.attr)) {
        throw new CollaborationError('content', 'Unknown node attribute.')
      }
      transform.step(step)
    }
    transform.doc.check()
  } catch {
    throw new CollaborationError('content', 'The editor change does not apply to this document.')
  }
  return checkpoint(transform.doc, { epoch: snapshot.epoch, schemaRevision: snapshot.schemaRevision,
    policyRevision: snapshot.policyRevision, version: snapshot.version + steps.length }, options)
}
