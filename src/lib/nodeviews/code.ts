import { createEditorText } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import { TextSelection } from '@tiptap/pm/state'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeView } from '@tiptap/pm/view'
import { createPropertyInput } from '../property-input'
import { handleHistoryKeydown, observeNodeViewRefresh } from './lifecycle'

export function codeView(
  { node: initial, editor, getPos }: NodeViewRendererProps,
  overlay?: EditorOverlayController,
): NodeView {
  const text = overlay?.text ?? createEditorText()
  let node = initial
  const propertyInput = createPropertyInput(editor, 'attrs')
  const dom = document.createElement('div')
  dom.className = 'ginko-code'
  const toolbar = document.createElement('div')
  toolbar.className = 'ginko-code__tools'
  toolbar.contentEditable = 'false'
  const language = document.createElement('select')
  for (const [value, label] of [
    ['', 'Plain text'],
    ['js', 'JavaScript'],
    ['ts', 'TypeScript'],
    ['vue', 'Vue'],
    ['html', 'HTML'],
    ['css', 'CSS'],
    ['json', 'JSON'],
    ['bash', 'Shell'],
    ['python', 'Python'],
    ['sql', 'SQL'],
    ['md', 'Markdown'],
  ]) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    language.append(option)
  }
  const filename = document.createElement('input')
  filename.type = 'text'
  const pre = document.createElement('pre'), contentDOM = document.createElement('code')
  pre.append(contentDOM)
  toolbar.append(language, filename)
  dom.append(toolbar, pre)
  function updateAttr(key: 'language' | 'filename', value: string) {
    const pos = getPos()
    if (pos === undefined || !editor.isEditable) return
    editor.view.dispatch(propertyInput.transaction(pos, key, value || null))
  }
  language.addEventListener('change', () => updateAttr('language', language.value))
  filename.addEventListener('input', () => updateAttr('filename', filename.value))
  toolbar.addEventListener('focusout', propertyInput.reset)
  toolbar.addEventListener('focusin', () => {
    propertyInput.reset()
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))))
    }
  })
  toolbar.addEventListener('keydown', event => {
    if (event.isComposing) return
    handleHistoryKeydown(editor, event, propertyInput.reset)
    if (event.key === 'Escape' || (event.key === 'Enter' && event.target === filename)) {
      event.preventDefault()
      editor.view.focus()
    }
  })
  function relabel() {
    language.setAttribute('aria-label', text('codeLanguage'))
    language.options[0].textContent = text('plainText')
    const shell = Array.from(language.options).find(option => option.value === 'bash')
    if (shell) shell.textContent = text('shellLanguage')
    filename.placeholder = text('optionalFileName')
    filename.setAttribute('aria-label', text('codeFileName'))
  }
  function render() {
    language.disabled = filename.disabled = !editor.isEditable
    if (node.attrs.language && !Array.from(language.options).some(option => option.value === node.attrs.language)) {
      const option = document.createElement('option')
      option.value = option.textContent = node.attrs.language
      language.append(option)
    }
    language.value = node.attrs.language ?? ''
    if (filename.value !== (node.attrs.filename ?? '')) filename.value = node.attrs.filename ?? ''
  }
  // The node, editability, and messages are the only inputs.
  const refresh = observeNodeViewRefresh({ editor, overlay, render, relabel })
  refresh.refresh(true)
  return { dom, contentDOM,
    update(next) {
      if (next.type !== node.type) return false
      node = next
      refresh.refresh(true)
      return true
    },
    stopEvent(event) {
      return event.target instanceof globalThis.Node && toolbar.contains(event.target)
    },
    ignoreMutation(mutation) {
      return mutation.type !== 'selection' && !contentDOM.contains(mutation.target)
    },
    destroy() {
      refresh.destroy()
    },
  }
}
