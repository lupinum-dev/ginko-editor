// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createStalenessGuard,
  handleHistoryKeydown,
  observeNodeViewRefresh,
  refreshNodeViews,
} from '../src/lib/nodeviews/lifecycle'
import { createEditorOverlayController } from '../src/ui/context'

const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()) })

function setup() {
  const editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [StarterKit],
    content: '<p>Hello</p>',
  })
  editors.push(editor)
  return editor
}

describe('node view refresh', () => {
  it('renders once per relevant change and relabels only for new messages', () => {
    const editor = setup(), overlay = createEditorOverlayController()
    const render = vi.fn(), relabel = vi.fn()
    const view = observeNodeViewRefresh({ editor, overlay, render, relabel, onDocumentChange: true })
    view.refresh(true)
    expect(render).toHaveBeenCalledTimes(1)
    expect(relabel).toHaveBeenCalledTimes(1)

    editor.commands.insertContentAt(1, 'Say ')
    expect(render).toHaveBeenCalledTimes(2)
    editor.commands.setTextSelection(2)
    expect(render).toHaveBeenCalledTimes(2)
    refreshNodeViews(editor)
    expect(render).toHaveBeenCalledTimes(3)
    editor.setEditable(false)
    expect(render).toHaveBeenCalledTimes(4)
    expect(relabel).toHaveBeenCalledTimes(1)

    overlay.notifyMessagesChanged()
    refreshNodeViews(editor)
    expect(relabel).toHaveBeenCalledTimes(2)
    expect(render).toHaveBeenCalledTimes(5)
    view.destroy()
    refreshNodeViews(editor)
    expect(render).toHaveBeenCalledTimes(5)
  })

  it('routes Mod-Z in node view inputs to the editor history', () => {
    const editor = setup(), reset = vi.fn()
    editor.commands.insertContentAt(1, 'Say ')
    const event = (shiftKey: boolean) => new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey, cancelable: true })
    const first = event(false)
    expect(handleHistoryKeydown(editor, first, reset)).toBe(true)
    expect(first.defaultPrevented).toBe(true)
    expect(editor.getText()).toBe('Hello')
    expect(handleHistoryKeydown(editor, event(true), reset)).toBe(true)
    expect(editor.getText()).toBe('Say Hello')
    expect(handleHistoryKeydown(editor, new KeyboardEvent('keydown', { key: 'z' }), reset)).toBe(false)
    expect(reset).toHaveBeenCalledTimes(2)
  })

  it('keeps only the latest asynchronous request current', () => {
    const guard = createStalenessGuard()
    const first = guard.start()
    const second = guard.start()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
    guard.cancel()
    expect(second()).toBe(false)
    const third = guard.start()
    guard.dispose()
    expect(third()).toBe(false)
  })
})
