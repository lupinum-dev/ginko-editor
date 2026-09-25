import type { Editor } from '@tiptap/core'

import type { EditorOperationContext } from '../lib/editor-operations'
import { handleBlockShortcut } from './block-shortcuts'
import {
  handleActionShortcut,
  hasCustomActionShortcut,
  matchesShortcut,
  type EditorActions,
  type EditorShortcuts,
} from './commands'

export interface EditorKeyboardContext {
  actions: EditorActions
  shortcuts?: EditorShortcuts
  operationContext: EditorOperationContext
  insertMenuOpen: boolean
  handleInsertKeys: (event: KeyboardEvent) => boolean
}

/**
 * Capture-phase routing for the writing surface. Custom shortcuts win over
 * defaults, then formatting actions, block shortcuts, and the open insert menu.
 */
export function routeEditorKeydown(editor: Editor, event: KeyboardEvent, context: EditorKeyboardContext) {
  if (event.isComposing) return
  const { actions, shortcuts, operationContext, insertMenuOpen } = context
  if (hasCustomActionShortcut(event, shortcuts) && handleActionShortcut(editor, event, actions, shortcuts)) return
  const customBlockShortcut = typeof shortcuts?.duplicate === 'string' && matchesShortcut(event, shortcuts.duplicate)
  if (customBlockShortcut && !insertMenuOpen && handleBlockShortcut(editor, event, operationContext, shortcuts)) return
  if (handleActionShortcut(editor, event, actions, shortcuts)) return
  if (!insertMenuOpen && handleBlockShortcut(editor, event, operationContext, shortcuts)) return
  if (insertMenuOpen) context.handleInsertKeys(event)
}
