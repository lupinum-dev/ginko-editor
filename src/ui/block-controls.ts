import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { captureBlock, canMoveBlock, type BlockReference, type BlockTarget, type BlockMovementContext } from '../lib/block-movement'
import { createEditorText, type EditorMessageKey, type EditorText } from './messages'
import { matchesShortcut, type EditorShortcuts } from './commands'

const nativeLabels: Partial<Record<string, EditorMessageKey>> = {
  paragraph: 'paragraph', bulletList: 'bulletList', orderedList: 'orderedList', listItem: 'listItem', codeBlock: 'codeBlock',
  blockquote: 'quoteLabel', horizontalRule: 'divider', image: 'imageLabel', table: 'tableLabel', file: 'fileLabel', video: 'videoLabel',
}

export function blockLabel(block: BlockReference, context: BlockMovementContext, text: EditorText = createEditorText()): string {
  const tag = typeof block.node.attrs.tag === 'string' ? block.node.attrs.tag : undefined
  const key = nativeLabels[block.node.type.name]
  const kind = tag ? context.getAuthoringKit?.()?.authoring[tag]?.label ?? tag : block.node.type.name === 'heading' ? text('headingLevel', { level: block.node.attrs.level ?? '' }) : key ? text(key) : block.node.type.name
  const preview = block.node.textContent.trim().replace(/\s+/g, ' ').slice(0, 64)
  return preview ? text('blockLabelPreview', { kind, text: preview }) : kind
}

export type BlockKeyboardIntent = 'up' | 'down' | 'duplicate' | 'duplicate-component' | 'menu' | 'escape' | 'write'
export function blockKeyboardIntent(editor: Editor, event: KeyboardEvent, shortcuts?: EditorShortcuts): BlockKeyboardIntent | undefined {
  if (event.defaultPrevented || event.isComposing || !editor.isEditable || editor.isDestroyed) return
  const target = event.target
  if (target instanceof Element && (target.closest('input, textarea, select, [role="combobox"]') || !editor.view.dom.contains(target))) return
  const selected = editor.state.selection instanceof NodeSelection
  const inTable = Array.from({ length: editor.state.selection.$from.depth }, (_, index) => editor.state.selection.$from.node(index + 1).type.name).some(name => ['tableCell', 'tableHeader'].includes(name))
  if (matchesShortcut(event, shortcuts?.blockMenu ?? 'Mod-/')) return 'menu'
  if (inTable && !selected) return
  if (matchesShortcut(event, shortcuts?.moveUp ?? 'Alt-ArrowUp') || (shortcuts?.moveUp === undefined && selected && matchesShortcut(event, 'Mod-Shift-ArrowUp'))) return 'up'
  if (matchesShortcut(event, shortcuts?.moveDown ?? 'Alt-ArrowDown') || (shortcuts?.moveDown === undefined && selected && matchesShortcut(event, 'Mod-Shift-ArrowDown'))) return 'down'
  if (shortcuts?.duplicate === undefined && matchesShortcut(event, 'Alt-Shift-d')) return 'duplicate-component'
  if (selected && matchesShortcut(event, shortcuts?.duplicate ?? 'Mod-d')) return 'duplicate'
  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    if (event.key === 'Escape') return 'escape'
    if (selected && event.key === 'Enter') return 'write'
  }
}

export function blockDestinations(editor: Editor, source: BlockReference, context: BlockMovementContext, text: EditorText = createEditorText()) {
  const results: { block: BlockReference; label: string; targets: BlockTarget[] }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (pos === source.pos) return false
    const block = captureBlock(editor, pos)
    if (!block) return
    const placements = node.isTextblock || node.isLeaf ? ['before', 'after'] as const : ['before', 'after', 'start', 'end'] as const
    const targets = placements.map(placement => ({ block, placement })).filter(target => canMoveBlock(editor, source, target, context))
    if (targets.length) results.push({ block, label: blockLabel(block, context, text), targets })
  })
  return results
}

export function blockDropTarget(editor: Editor, source: BlockReference, x: number, y: number, context: BlockMovementContext): { target: BlockTarget; rect: DOMRect } | undefined {
  const found = editor.view.posAtCoords({ left: x, top: y })
  if (!found) return
  function targetFor(block: BlockReference) {
    if (block.pos >= source.pos && block.pos < source.pos + source.node.nodeSize) return
    const element = editor.view.nodeDOM(block.pos)
    if (!(element instanceof Element)) return
    const rect = element.getBoundingClientRect()
    // An empty component has no child paragraph to target. Prefer its own
    // content boundary before considering a sibling position outside it.
    const content = block.node.childCount === 1 && block.node.firstChild?.type.name === 'slot' && block.node.firstChild.attrs.name === 'default' ? block.node.firstChild : block.node
    if (!block.node.isTextblock && !block.node.isLeaf && content.content.size === 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const inside: BlockTarget = { block, placement: y < rect.top + rect.height / 2 ? 'start' : 'end' }
      if (canMoveBlock(editor, source, inside, context)) return { target: inside, rect }
    }
    const target: BlockTarget = { block, placement: y < rect.top + rect.height / 2 ? 'before' : 'after' }
    if (canMoveBlock(editor, source, target, context)) return { target, rect }
  }
  const resolved = editor.state.doc.resolve(found.pos)
  for (let depth = resolved.depth; depth > 0; depth--) {
    const block = captureBlock(editor, resolved.before(depth))
    if (!block) continue
    if (block.pos >= source.pos && block.pos < source.pos + source.node.nodeSize) return
    const target = targetFor(block)
    if (target) return target
  }
  // Atom and empty blocks can resolve to their boundary instead of inside it.
  const block = captureBlock(editor, found.inside >= 0 ? found.inside : found.pos)
  return block ? targetFor(block) : undefined
}
