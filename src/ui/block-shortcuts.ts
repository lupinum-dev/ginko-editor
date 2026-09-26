import type { Editor } from '@tiptap/core'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import {
  selectedBlock,
  parentBlock,
  selectParentBlock,
  canPerformBlockAction,
  performBlockAction,
  type EditorOperationContext,
} from '../lib/editor-operations'
import { matchesShortcut, type EditorShortcuts } from './commands'

export type BlockKeyboardIntent = 'duplicate' | 'duplicate-component' | 'escape' | 'write'

export function blockKeyboardIntent(
  editor: Editor,
  event: KeyboardEvent,
  shortcuts?: EditorShortcuts,
): BlockKeyboardIntent | undefined {
  if (event.defaultPrevented || event.isComposing || !editor.isEditable || editor.isDestroyed) {
    return
  }

  const target = event.target

  if (
    target instanceof Element
    && (target.closest('input, textarea, select, [role="combobox"]') || !editor.view.dom.contains(target))
  ) {
    return
  }

  const selected = editor.state.selection instanceof NodeSelection
  const inTable = Array.from(
    { length: editor.state.selection.$from.depth },
    (_, index) => editor.state.selection.$from.node(index + 1).type.name,
  ).some(name => ['tableCell', 'tableHeader'].includes(name))

  if (inTable && !selected) return
  if (shortcuts?.duplicate === undefined && matchesShortcut(event, 'Alt-Shift-d')) {
    return 'duplicate-component'
  }
  if (selected && matchesShortcut(event, shortcuts?.duplicate ?? 'Mod-d')) return 'duplicate'

  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    if (event.key === 'Escape') return 'escape'
    if (selected && event.key === 'Enter') return 'write'
  }
}

export function handleBlockShortcut(
  editor: Editor,
  event: KeyboardEvent,
  context: EditorOperationContext,
  shortcuts?: EditorShortcuts,
): boolean {
  if (context.canMutate?.() === false) return false

  const intent = blockKeyboardIntent(editor, event, shortcuts)

  if (!intent) return false

  let block = selectedBlock(editor)

  if (intent === 'duplicate-component') {
    while (block && block.node.type.name !== 'element') block = parentBlock(editor, block)
  }

  if (!block) return false

  if (intent === 'escape') {
    if (editor.state.selection instanceof NodeSelection) {
      if (!selectParentBlock(editor, block)) return false
    }
    else {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, block.pos)))
      editor.view.focus()
    }
  }
  else if (intent === 'write') {
    const inside = Selection.findFrom(editor.state.doc.resolve(block.pos + 1), 1, true)
    if (!inside) return false
    editor.view.dispatch(editor.state.tr.setSelection(inside))
    editor.view.focus()
  }
  else {
    if (!canPerformBlockAction(editor, block, 'duplicate', context)) return false
    void performBlockAction(editor, block, 'duplicate', context)
  }

  event.preventDefault()
  event.stopPropagation()
  return true
}
