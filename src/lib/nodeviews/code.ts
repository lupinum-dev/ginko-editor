import { TextSelection } from '@tiptap/pm/state'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeView } from '@tiptap/pm/view'

export function codeView({ node: initial, editor, getPos }: NodeViewRendererProps): NodeView {
  let node = initial
  const dom = document.createElement('div')
  dom.className = 'ginko-code'
  const toolbar = document.createElement('div')
  toolbar.className = 'ginko-code__tools'
  toolbar.contentEditable = 'false'
  const language = document.createElement('select')
  language.setAttribute('aria-label', 'Code language')
  for (const [value, label] of [['', 'Plain text'], ['js', 'JavaScript'], ['ts', 'TypeScript'], ['vue', 'Vue'], ['html', 'HTML'], ['css', 'CSS'], ['json', 'JSON'], ['bash', 'Shell'], ['python', 'Python'], ['sql', 'SQL'], ['md', 'Markdown']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; language.append(option)
  }
  const filename = document.createElement('input')
  filename.type = 'text'; filename.placeholder = 'File name (optional)'; filename.setAttribute('aria-label', 'Code file name')
  const pre = document.createElement('pre'), contentDOM = document.createElement('code')
  pre.append(contentDOM); toolbar.append(language, filename); dom.append(toolbar, pre)
  function updateAttrs() {
    const pos = getPos()
    if (pos === undefined || !editor.isEditable) return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: language.value || null, filename: filename.value || null }))
  }
  language.addEventListener('change', updateAttrs)
  filename.addEventListener('input', updateAttrs)
  toolbar.addEventListener('focusin', () => {
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))))
  })
  toolbar.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.commands.redo(); else editor.commands.undo() }
    if (event.key === 'Escape' || (event.key === 'Enter' && event.target === filename)) { event.preventDefault(); editor.view.focus() }
  })
  function render() {
    language.disabled = filename.disabled = !editor.isEditable
    if (node.attrs.language && !Array.from(language.options).some(option => option.value === node.attrs.language)) {
      const option = document.createElement('option'); option.value = option.textContent = node.attrs.language; language.append(option)
    }
    language.value = node.attrs.language ?? ''
    if (filename.value !== (node.attrs.filename ?? '')) filename.value = node.attrs.filename ?? ''
  }
  editor.on('update', render)
  editor.on('transaction', render); render()
  return { dom, contentDOM,
    update(next) { if (next.type !== node.type) return false; node = next; render(); return true },
    stopEvent(event) { return event.target instanceof globalThis.Node && toolbar.contains(event.target) },
    ignoreMutation(mutation) { return mutation.type !== 'selection' && !contentDOM.contains(mutation.target) },
    destroy() { editor.off('transaction', render); editor.off('update', render) },
  }
}
