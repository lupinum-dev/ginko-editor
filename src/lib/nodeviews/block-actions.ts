import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { NodeSelection } from '@tiptap/pm/state'

export type BlockAction = 'up' | 'down' | 'duplicate' | 'delete'
export function canActOnBlock(editor: Editor, pos: number, action: BlockAction) {
  if (!editor.isEditable) return false
  const resolved = editor.state.doc.resolve(pos)
  return action === 'up' ? resolved.index() > 0 : action === 'down' ? resolved.index() + 1 < resolved.parent.childCount : true
}
export function actOnBlock(editor: Editor, node: Node, pos: number, action: BlockAction) {
  if (!canActOnBlock(editor, pos, action)) return
  const tr = closeHistory(editor.state.tr), resolved = editor.state.doc.resolve(pos)
  if (action === 'delete') tr.delete(pos, pos + node.nodeSize)
  else {
    const target = action === 'duplicate' ? pos + node.nodeSize : action === 'up' ? pos - resolved.parent.child(resolved.index() - 1).nodeSize : pos + resolved.parent.child(resolved.index() + 1).nodeSize
    if (action !== 'duplicate') tr.delete(pos, pos + node.nodeSize)
    tr.insert(target, node.copy(node.content)); tr.setSelection(NodeSelection.create(tr.doc, target))
  }
  editor.view.dispatch(tr); editor.view.focus()
}
