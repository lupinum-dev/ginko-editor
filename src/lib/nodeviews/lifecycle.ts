import type { Editor } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

import type { EditorOverlayController } from '../../ui/context'

/** Transaction metadata that asks node views to read external options again. */
export const nodeViewRefreshMeta = 'ginkoRefreshNodeViews'

/** Re-render node views after host options change without a document change. */
export function refreshNodeViews(editor: Editor | undefined) {
  if (!editor || editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(nodeViewRefreshMeta, true).setMeta('addToHistory', false))
}

export interface NodeViewRefreshOptions {
  editor: Editor
  overlay?: EditorOverlayController
  /** Update state that depends on the node, editability, selection, or host options. */
  render: () => void
  /** Update localized labels. Runs first, and again only when the messages change. */
  relabel?: () => void
  /** Also render when the document changes elsewhere. */
  onDocumentChange?: boolean
  /** Also render when the selection changes. */
  onSelectionChange?: boolean
}

/**
 * Render a node view at most once per editor state. ProseMirror calls a node
 * view's `update` before TipTap emits `transaction` and `update`, so one change
 * renders once instead of three times.
 */
export function observeNodeViewRefresh(options: NodeViewRefreshOptions) {
  const { editor } = options
  let renderedState: EditorState | undefined
  let renderedEditable: boolean | undefined
  let renderedMessages: number | undefined
  let destroyed = false

  function refresh(force = false) {
    if (destroyed) return
    const messages = options.overlay?.messagesRevision() ?? 0
    if (messages !== renderedMessages) {
      renderedMessages = messages
      options.relabel?.()
      force = true
    }
    const state = editor.isDestroyed ? undefined : editor.state
    if (!force && state === renderedState && editor.isEditable === renderedEditable) return
    renderedState = state
    renderedEditable = editor.isEditable
    options.render()
  }

  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    if (
      transaction.getMeta(nodeViewRefreshMeta)
      || (options.onDocumentChange && transaction.docChanged)
      || (options.onSelectionChange && transaction.selectionSet)
      || editor.isEditable !== renderedEditable
    ) refresh()
  }
  // TipTap reports an editability change through `update` without a transaction.
  const onUpdate = () => {
    if (editor.isEditable !== renderedEditable) refresh()
  }
  editor.on('transaction', onTransaction)
  editor.on('update', onUpdate)

  return {
    /** Render now if anything relevant changed. Pass true after the node changed. */
    refresh,
    destroy() {
      destroyed = true
      editor.off('transaction', onTransaction)
      editor.off('update', onUpdate)
    },
  }
}

/**
 * Native inputs inside node views keep the editor history. Mod-Z and
 * Mod-Shift-Z undo or redo the document instead of the input's own history.
 */
export function handleHistoryKeydown(
  editor: Editor,
  event: KeyboardEvent,
  beforeHistory?: () => void,
  stopPropagation = false,
): boolean {
  if (event.isComposing || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return false
  event.preventDefault()
  if (stopPropagation) event.stopPropagation()
  beforeHistory?.()
  if (event.shiftKey) editor.commands.redo()
  else editor.commands.undo()
  return true
}

/**
 * Guard asynchronous node view work. A request stays current until a newer
 * request starts or the guard is disposed.
 */
export function createStalenessGuard() {
  let request = 0
  let disposed = false
  return {
    /** Start a request. The returned check is false after a newer request or disposal. */
    start() {
      const current = ++request
      return () => !disposed && current === request
    },
    /** Invalidate the running request without starting another. */
    cancel() { request += 1 },
    dispose() {
      disposed = true
      request += 1
    },
    isDisposed: () => disposed,
  }
}
