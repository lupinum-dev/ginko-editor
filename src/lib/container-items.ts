import type { Editor } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection, type Transaction } from '@tiptap/pm/state'

import type { AuthoringKit, ComponentCanvasItems } from '../authoring'
import type { JsonValue } from '../types'
import { prepareMarkdownForVisualEditing } from './conversionPipeline'
import {
  commitEditorTransaction,
  trackEditorOperation,
  type BlockOperationResult,
  type EditorOperationContext,
} from './editor-operations'
import { SetNodeAttributeStep, SetNodePropertyStep } from './property-step'

/** One repeated item of a container. Positions are absolute in `doc`. */
export interface ContainerItem {
  index: number
  /** Position before the first node of the item. */
  from: number
  /** Position after the last node of the item. */
  to: number
  /** The first node: the child component, the code block, or the heading. */
  node: ProseMirrorNode
  /** Every top-level node of the item, with its absolute position. */
  nodes: readonly { node: ProseMirrorNode; pos: number }[]
}

export interface ContainerLayout {
  pos: number
  node: ProseMirrorNode
  config: ComponentCanvasItems
  /** Start and end of the container's editable content. */
  contentFrom: number
  contentTo: number
  items: readonly ContainerItem[]
}

export function itemsConfig(kit: AuthoringKit | undefined, tag: unknown): ComponentCanvasItems | undefined {
  return typeof tag === 'string' ? kit?.authoring[tag]?.canvas?.items : undefined
}

function headingLevel(config: ComponentCanvasItems) {
  const match = /^\s*(#{1,6})\s/.exec(config.template)
  return match ? match[1].length : 3
}

function isItemStart(node: ProseMirrorNode, config: ComponentCanvasItems, level: number) {
  if (config.childTag) return node.type.name === 'element' && node.attrs.tag === config.childTag
  if (config.childNode === 'codeBlock') return node.type.name === 'codeBlock'
  return node.type.name === 'heading' && node.attrs.level === level
}

/** Read the items of a container, including the parser's explicit default-slot form. */
export function containerLayout(
  doc: ProseMirrorNode,
  pos: number,
  kit: AuthoringKit | undefined,
): ContainerLayout | undefined {
  const node = doc.nodeAt(pos)
  if (!node || node.type.name !== 'element') return undefined
  const config = itemsConfig(kit, node.attrs.tag)
  if (!config) return undefined
  const slot = node.childCount === 1
    && node.firstChild?.type.name === 'slot'
    && node.firstChild.attrs.name === 'default'
  const content = slot ? node.firstChild! : node
  const contentFrom = pos + (slot ? 2 : 1)
  const level = headingLevel(config)
  const items: ContainerItem[] = []
  let current: { from: number; node: ProseMirrorNode; nodes: { node: ProseMirrorNode; pos: number }[] } | undefined
  const close = (to: number) => {
    if (current) items.push({ index: items.length, from: current.from, to, node: current.node, nodes: current.nodes })
    current = undefined
  }
  content.forEach((child, offset) => {
    const childPos = contentFrom + offset
    if (isItemStart(child, config, level)) {
      close(childPos)
      current = { from: childPos, node: child, nodes: [{ node: child, pos: childPos }] }
      if (config.childNode !== 'heading') close(childPos + child.nodeSize)
      return
    }
    if (current && config.childNode === 'heading') {
      // A heading of a higher level ends the step.
      if (child.type.name === 'heading' && child.attrs.level < level) close(childPos)
      else current.nodes.push({ node: child, pos: childPos })
    }
  })
  if (current) {
    const last = current.nodes[current.nodes.length - 1]
    close(last.pos + last.node.nodeSize)
  }
  return { pos, node, config, contentFrom, contentTo: contentFrom + content.content.size, items }
}

/** The nearest container whose item contains `pos`. */
export function containerAt(doc: ProseMirrorNode, pos: number, kit: AuthoringKit | undefined) {
  if (!kit) return undefined
  const resolved = doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth--) {
    const node = resolved.node(depth)
    if (node.type.name !== 'element' || !itemsConfig(kit, node.attrs.tag)) continue
    const layout = containerLayout(doc, resolved.before(depth), kit)
    const item = layout?.items.find(entry => pos > entry.from && pos < entry.to)
      ?? layout?.items.find(entry => pos >= entry.from && pos <= entry.to)
    if (layout && item) return { layout, item }
  }
  return undefined
}

/** The visible name of an item. Empty when the item has no name. */
export function itemLabel(item: ContainerItem, config: ComponentCanvasItems): string {
  if (config.childTag) {
    const value = config.labelProp ? item.node.attrs.props?.[config.labelProp] : undefined
    return typeof value === 'string' ? value : ''
  }
  if (config.childNode === 'codeBlock') return String(item.node.attrs.filename || item.node.attrs.language || '')
  return item.node.textContent
}

/** True when removing the item would discard text or embedded content. */
export function itemHasContent(item: ContainerItem): boolean {
  return item.nodes.some(({ node }, index) => {
    const body = index === 0 && item.node.type.name === 'heading' ? undefined : node
    if (!body) return false
    if (body.textContent.trim()) return true
    let embedded = false
    body.descendants(child => {
      if (child.isAtom && !child.isText) embedded = true
      return !embedded
    })
    return embedded
  })
}

async function prepareItem(editor: Editor, config: ComponentCanvasItems, context: EditorOperationContext) {
  const kit = context.getAuthoringKit?.()
  const prepared = await prepareMarkdownForVisualEditing(
    config.template,
    context.getOutputOptions?.() ?? {},
    editor.schema,
    kit,
    'fragment',
  )
  if (!prepared.ok || !prepared.value) return undefined
  return Fragment.fromArray((prepared.value.content ?? []).map(json => editor.schema.nodeFromJSON(json)))
}

function selectInside(tr: Transaction, pos: number) {
  const target = Math.min(pos + 1, tr.doc.content.size)
  tr.setSelection(TextSelection.near(tr.doc.resolve(target)))
}

function elementContext(editor: Editor, context?: EditorOperationContext): EditorOperationContext {
  const element = editor.extensionManager.extensions.find(extension => extension.name === 'element')
  const options: EditorOperationContext = element?.options ?? {}
  return { getAuthoringKit: options.getAuthoringKit, getOutputOptions: options.getOutputOptions, ...context }
}

export interface AddItemOptions {
  /** Insert after this item. Omit to add the item at the end. */
  after?: number
  /** Delete this range in the same change, for example typed slash text. */
  replaceRange?: { from: number; to: number }
}

/** Add one item from the container's template as one validated, undoable change. */
export function addContainerItem(
  editor: Editor,
  containerPos: number,
  options: AddItemOptions = {},
  operation?: EditorOperationContext,
): Promise<BlockOperationResult> {
  const context = elementContext(editor, operation)
  return trackEditorOperation(editor, async () => {
    if (editor.isDestroyed || !editor.isEditable || context.canMutate?.() === false) {
      return { ok: false, reason: 'unavailable' }
    }
    const before = editor.state
    const kit = context.getAuthoringKit?.()
    const layout = containerLayout(before.doc, containerPos, kit)
    if (!layout) return { ok: false, reason: 'unavailable' }
    let fragment: Fragment | undefined
    try {
      fragment = await prepareItem(editor, layout.config, context)
    } catch {
      fragment = undefined
    }
    if (editor.isDestroyed || editor.state !== before || context.getAuthoringKit?.() !== kit) {
      return { ok: false, reason: 'stale' }
    }
    if (!fragment || fragment.childCount === 0) return { ok: false, reason: 'invalid-content' }
    const anchor = options.after === undefined ? undefined : layout.items[options.after]
    let insertAt = anchor ? anchor.to : layout.items.at(-1)?.to ?? layout.contentTo
    const tr = before.tr
    if (options.replaceRange) {
      tr.delete(options.replaceRange.from, options.replaceRange.to)
      insertAt = tr.mapping.map(insertAt, anchor ? 1 : -1)
    }
    try {
      tr.insert(insertAt, fragment)
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    selectInside(tr, insertAt)
    return await commitEditorTransaction(editor, tr, context)
  })
}

/** Remove one item. A container always keeps at least one item. */
export function removeContainerItem(
  editor: Editor,
  containerPos: number,
  index: number,
  operation?: EditorOperationContext,
): Promise<BlockOperationResult> {
  const context = elementContext(editor, operation)
  const layout = containerLayout(editor.state.doc, containerPos, context.getAuthoringKit?.())
  const item = layout?.items[index]
  if (!layout || !item || layout.items.length < 2) return Promise.resolve({ ok: false, reason: 'unavailable' })
  const tr = editor.state.tr.delete(item.from, item.to)
  const neighbor = layout.items[index + 1] ?? layout.items[index - 1]
  selectInside(tr, tr.mapping.map(neighbor.from, index + 1 < layout.items.length ? 1 : -1))
  return commitEditorTransaction(editor, tr, context)
}

/** Change the name of one item as one validated, undoable change. */
export function renameContainerItem(
  editor: Editor,
  containerPos: number,
  index: number,
  value: string,
  operation?: EditorOperationContext,
): Promise<BlockOperationResult> {
  const context = elementContext(editor, operation)
  const layout = containerLayout(editor.state.doc, containerPos, context.getAuthoringKit?.())
  const item = layout?.items[index]
  if (!layout || !item || itemLabel(item, layout.config) === value) {
    return Promise.resolve({ ok: false, reason: 'unavailable' })
  }
  const tr = editor.state.tr
  if (layout.config.childTag && layout.config.labelProp) {
    tr.step(new SetNodePropertyStep(item.from, layout.config.labelProp, value || undefined))
  } else if (layout.config.childNode === 'codeBlock') {
    tr.step(new SetNodeAttributeStep(item.from, 'filename', (value || null) as JsonValue))
  } else if (layout.config.childNode === 'heading') {
    const heading = item.node
    if (!value.trim()) return Promise.resolve({ ok: false, reason: 'unavailable' })
    tr.replaceWith(item.from + 1, item.from + heading.nodeSize - 1, editor.schema.text(value))
  } else {
    return Promise.resolve({ ok: false, reason: 'unavailable' })
  }
  return commitEditorTransaction(editor, tr, context)
}
