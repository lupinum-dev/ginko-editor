import type { Editor } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { NodeSelection, Selection, type Transaction } from '@tiptap/pm/state'
import type { AuthoringKit } from '../authoring'
import { convertTiptapDocToMarkdown, validateMarkdownForAuthoring } from './conversionPipeline'
import type { TiptapToMDCOptions } from './tiptapToMdc'
import { columnChildren } from './nodeviews/columns'

/** A position belongs to this exact document, never to a later document at the same offset. */
export interface BlockReference {
  readonly doc: ProseMirrorNode
  readonly node: ProseMirrorNode
  readonly pos: number
}
export interface EditorOperationContext {
  getAuthoringKit?: () => AuthoringKit | undefined
  getOutputOptions?: () => TiptapToMDCOptions
  canMutate?: () => boolean
}
export type BlockAction = 'duplicate' | 'delete'
export type BlockOperationResult = { ok: true } | { ok: false; reason: 'unavailable' | 'stale' | 'invalid-content' }

const structuralNodes = new Set(['doc', 'slot', 'tableRow', 'tableCell', 'tableHeader'])
const isActionableBlock = (node: ProseMirrorNode) =>
  node.isBlock && !structuralNodes.has(node.type.name) && NodeSelection.isSelectable(node)

export function captureBlock(editor: Editor, pos: number): BlockReference | undefined {
  if (editor.isDestroyed || !Number.isInteger(pos) || pos < 0 || pos >= editor.state.doc.content.size) return undefined
  const doc = editor.state.doc, resolved = doc.resolve(pos), node = resolved.nodeAfter
  if (!node || !isActionableBlock(node)) return undefined
  return Object.freeze({ doc, node, pos })
}

function isCurrentBlock(editor: Editor, block: BlockReference) {
  return !editor.isDestroyed && editor.state.doc === block.doc && captureBlock(editor, block.pos)?.node === block.node
}

/** Resolve a paragraph or whole selected block, skipping schema-only wrappers. */
export function selectedBlock(editor: Editor): BlockReference | undefined {
  if (editor.isDestroyed) return undefined
  const selection = editor.state.selection
  if (selection instanceof NodeSelection) {
    const block = captureBlock(editor, selection.from)
    if (block) return block
  }
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    const block = captureBlock(editor, selection.$from.before(depth))
    if (block) return block
  }
  return undefined
}

export function parentBlock(editor: Editor, block: BlockReference): BlockReference | undefined {
  if (!isCurrentBlock(editor, block)) return undefined
  const resolved = block.doc.resolve(block.pos)
  for (let depth = resolved.depth; depth > 0; depth--) {
    const parent = captureBlock(editor, resolved.before(depth))
    if (parent) return parent
  }
  return undefined
}

export function selectParentBlock(editor: Editor, block = selectedBlock(editor)): boolean {
  const parent = block && parentBlock(editor, block)
  if (!parent) return false
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, parent.pos)))
  editor.view.focus()
  return true
}

function contextFor(editor: Editor, context?: EditorOperationContext): EditorOperationContext {
  // TipTap exposes extension options without a specific type. Element owns
  // these existing callbacks; no second authoring-kit state is introduced here.
  const elementExtension = editor.extensionManager.extensions.find(
    extension => extension.name === 'element',
  )
  const options: EditorOperationContext = elementExtension?.options ?? {}
  return { getAuthoringKit: options.getAuthoringKit, getOutputOptions: options.getOutputOptions, ...context }
}

function pairedColumns(editor: Editor, block: BlockReference, kit: AuthoringKit | undefined) {
  const resolved = block.doc.resolve(block.pos)
  for (let depth = resolved.depth; depth > 0; depth--) {
    const parent = resolved.node(depth), config = kit?.authoring[parent.attrs.tag]?.canvas?.columns
    if (!config) continue
    const children = columnChildren(parent, config.childTag)
    if (children.length !== 2) continue
    const parentPos = resolved.before(depth)
    const refs = children.map(child => captureBlock(editor, parentPos + child.offset))
    const first = refs[0], second = refs[1]
    if (first && second && refs.some(child => child?.pos === block.pos)) return { first, second }
  }
  return undefined
}

function componentParent(doc: ProseMirrorNode, pos: number): string | undefined {
  const resolved = doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth--) {
    const node = resolved.node(depth)
    if (
      (node.type.name === 'element' || node.type.name === 'inline-element')
      && typeof node.attrs.tag === 'string'
    ) {
      return node.attrs.tag
    }
  }
  return undefined
}

/** Cheap placement feedback uses the same policy facts as Content's final check. */
function acceptsPlacement(
  node: ProseMirrorNode,
  parentTag: string | undefined,
  kit: AuthoringKit | undefined,
): boolean {
  if (!kit) return true
  const isComponent = node.type.name === 'element' || node.type.name === 'inline-element'
  const tag = isComponent && typeof node.attrs.tag === 'string' ? node.attrs.tag : undefined
  const policy = tag ? kit.policy.components[tag] : undefined
  const parentPolicy = parentTag ? kit.policy.components[parentTag] : undefined
  if (
    tag
    && (!policy
      || (policy.allowedParents && (!parentTag || !policy.allowedParents.includes(parentTag)))
      || (parentPolicy?.allowedChildren && !parentPolicy.allowedChildren.includes(tag)))
  ) {
    return false
  }
  let accepted = true
  node.forEach(child => { if (!acceptsPlacement(child, tag ?? parentTag, kit)) accepted = false })
  return accepted
}

function selectInsertedBlock(tr: Transaction, pos: number) {
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  return tr
}

function buildAction(
  editor: Editor,
  block: BlockReference,
  action: BlockAction,
  kit: AuthoringKit | undefined,
): Transaction | undefined {
  if (!isCurrentBlock(editor, block)) return undefined
  if (pairedColumns(editor, block, kit)) return undefined
  const resolved = block.doc.resolve(block.pos), index = resolved.index(), tr = editor.state.tr
  if (action === 'duplicate') {
    if (
      !resolved.parent.canReplace(index + 1, index + 1, Fragment.from(block.node))
      || !acceptsPlacement(block.node, componentParent(block.doc, block.pos), kit)
    ) {
      return undefined
    }
    return selectInsertedBlock(tr.insert(block.pos + block.node.nodeSize, block.node), block.pos + block.node.nodeSize)
  }
  if (!resolved.parent.canReplace(index, index + 1)) {
    // Clearing the only document block keeps the required empty paragraph.
    // Nested schema-required children must stay attached to their container.
    if (resolved.depth !== 0 || resolved.parent.childCount !== 1) return undefined
    const empty = editor.schema.nodes.paragraph?.createAndFill()
    if (
      !empty
      || !resolved.parent.canReplace(index, index + 1, Fragment.from(empty))
      || block.node.eq(empty)
    ) {
      return undefined
    }
    tr.replaceWith(block.pos, block.pos + block.node.nodeSize, empty)
  } else tr.delete(block.pos, block.pos + block.node.nodeSize)
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(block.pos, tr.doc.content.size))))
  return tr
}

/** Synchronous structural availability. Execution additionally validates Content policy. */
export function canPerformBlockAction(
  editor: Editor,
  block: BlockReference,
  action: BlockAction,
  context?: EditorOperationContext,
): boolean {
  const options = contextFor(editor, context)
  if (editor.isDestroyed || !editor.isEditable || options.canMutate?.() === false) return false
  try { return Boolean(buildAction(editor, block, action, options.getAuthoringKit?.())) } catch { return false }
}

const pendingOperations = new WeakMap<
  Editor,
  { operations: Set<Promise<unknown>>; observers: Set<(count: number) => void> }
>()
function editorOperations(editor: Editor) {
  let pending = pendingOperations.get(editor)
  if (!pending) { pending = { operations: new Set(), observers: new Set() }; pendingOperations.set(editor, pending) }
  return pending
}

/** Observe every accepted editor operation, including node-view and recipe edits. */
export function observeEditorOperations(editor: Editor, observer: (count: number) => void): () => void {
  const pending = editorOperations(editor)
  pending.observers.add(observer)
  observer(pending.operations.size)
  return () => {
    pending.observers.delete(observer)
    if (!pending.operations.size && !pending.observers.size) pendingOperations.delete(editor)
  }
}

/** Hosts flush accepted edits before saving, even when validation is asynchronous. */
export async function waitForEditorOperations(editor: Editor): Promise<void> {
  let pending = pendingOperations.get(editor)
  while (pending?.operations.size) {
    await Promise.allSettled(pending.operations)
    pending = pendingOperations.get(editor)
  }
}

/** Register before preparation begins, so an immediate save includes the whole edit. */
export function trackEditorOperation<T>(editor: Editor, run: () => Promise<T>): Promise<T> {
  const pending = editorOperations(editor)
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason: unknown) => void
  const operation = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  pending.operations.add(operation)
  pending.observers.forEach(observer => observer(pending.operations.size))
  const finish = () => {
    pending.operations.delete(operation)
    pending.observers.forEach(observer => observer(pending.operations.size))
    if (!pending.operations.size && !pending.observers.size) pendingOperations.delete(editor)
  }
  void operation.then(finish, finish)
  try { void run().then(resolve, reject) } catch (error) { reject(error) }
  return operation
}

function execute(
  editor: Editor,
  context: EditorOperationContext | undefined,
  build: (kit: AuthoringKit | undefined) => Transaction | undefined,
): Promise<BlockOperationResult> {
  return trackEditorOperation(editor, () => executeValidated(editor, context, build))
}

async function executeValidated(
  editor: Editor,
  context: EditorOperationContext | undefined,
  build: (kit: AuthoringKit | undefined) => Transaction | undefined,
): Promise<BlockOperationResult> {
  const options = contextFor(editor, context)
  if (editor.isDestroyed || !editor.isEditable || options.canMutate?.() === false) {
    return { ok: false, reason: 'unavailable' }
  }
  const before = editor.state
  const kit = options.getAuthoringKit?.()
  const output = options.getOutputOptions?.() ?? {}
  const outputKey = JSON.stringify(output)
  let stale = false
  const invalidate = () => { stale = true }
  const current = () =>
    !stale
    && !editor.isDestroyed
    && editor.isEditable
    && editor.state === before
    && options.canMutate?.() !== false
    && options.getAuthoringKit?.() === kit
    && JSON.stringify(options.getOutputOptions?.() ?? {}) === outputKey
  editor.on('transaction', invalidate)
  editor.on('update', invalidate)
  try {
    const tr = build(kit)
    if (!tr) return { ok: false, reason: 'unavailable' }
    tr.doc.check()
    if (!acceptsPlacement(tr.doc, undefined, kit)) return { ok: false, reason: 'invalid-content' }
    const converted = await convertTiptapDocToMarkdown(tr.doc.toJSON(), output)
    if (!current()) return { ok: false, reason: 'stale' }
    if (!converted.ok || converted.value === undefined) return { ok: false, reason: 'invalid-content' }
    if (kit) {
      const issue = await validateMarkdownForAuthoring(converted.value, kit)
      if (!current()) return { ok: false, reason: 'stale' }
      if (issue) return { ok: false, reason: 'invalid-content' }
    }
    // Close both sides of the history group: an operation is one Undo step, separate
    // from typing before it and typing immediately after it.
    editor.view.dispatch(closeHistory(tr).scrollIntoView())
    editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false))
    editor.view.focus()
    return { ok: true }
  } catch {
    return { ok: false, reason: current() ? 'invalid-content' : 'stale' }
  } finally {
    editor.off('transaction', invalidate)
    editor.off('update', invalidate)
  }
}

export function performBlockAction(
  editor: Editor,
  block: BlockReference,
  action: BlockAction,
  context?: EditorOperationContext,
): Promise<BlockOperationResult> {
  if (!isCurrentBlock(editor, block)) return Promise.resolve({ ok: false, reason: 'stale' })
  return execute(editor, context, kit => buildAction(editor, block, action, kit))
}

/** Commit an already-built structural transaction through the same policy and history boundary. */
export function commitEditorTransaction(
  editor: Editor,
  transaction: Transaction,
  context?: EditorOperationContext,
): Promise<BlockOperationResult> {
  if (editor.isDestroyed || transaction.before !== editor.state.doc) {
    return Promise.resolve({ ok: false, reason: 'stale' })
  }
  if (!transaction.docChanged || transaction.doc.eq(editor.state.doc)) {
    return Promise.resolve({ ok: false, reason: 'unavailable' })
  }
  return execute(editor, context, () => transaction)
}
