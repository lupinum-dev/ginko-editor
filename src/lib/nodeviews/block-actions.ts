import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { captureBlock, canPerformBlockAction, performBlockAction, type BlockAction, type EditorOperationContext } from '../editor-operations'

export type { BlockAction } from '../editor-operations'

/** Existing node-view callers share the same checked operations as toolbar and keyboard controls. */
export function canActOnBlock(editor: Editor, pos: number, action: BlockAction, context?: EditorOperationContext) {
  const block = captureBlock(editor, pos)
  return Boolean(block && canPerformBlockAction(editor, block, action, context))
}
export async function actOnBlock(editor: Editor, node: Node, pos: number, action: BlockAction, context?: EditorOperationContext): Promise<boolean> {
  const block = captureBlock(editor, pos)
  if (!block || block.node !== node) return false
  return (await performBlockAction(editor, block, action, context)).ok
}
