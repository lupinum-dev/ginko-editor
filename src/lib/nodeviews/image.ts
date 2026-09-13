import type { NodeViewRendererProps } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { NodeSelection } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
import type { JsonRecord } from '../../types'
import { icon } from './icons'
import { inlinePopover } from './popover'
import { createEditorText, type EditorMessageKey } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'

export type ImageActions = (props: JsonRecord) => { replace?: () => void; metadata?: () => void }

export function imageView({ node: initial, editor, getPos }: NodeViewRendererProps, getActions?: ImageActions, overlay?: EditorOverlayController): NodeView {
  const text = overlay?.text ?? createEditorText()
  let node = initial
  const dom = document.createElement('figure')
  dom.className = 'ginko-image'
  const picture = document.createElement('div')
  picture.className = 'ginko-image__picture'
  const settings = inlinePopover(text('imageSettings'), 'settings', overlay)
  const fields = document.createElement('div')
  fields.className = 'ginko-editor__fields'
  const altLabel = document.createElement('label'), altText = document.createElement('span'), alt = document.createElement('input')
  alt.type = 'text'
  altLabel.append(altText, alt); fields.append(altLabel); settings.panel.append(fields)
  function select() {
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
  }
  settings.dom.addEventListener('focusin', select)
  settings.panel.addEventListener('focusin', select)
  alt.addEventListener('input', () => {
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: { ...node.attrs.props, alt: alt.value } }))
  })
  const handleUndo = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.commands.redo(); else editor.commands.undo() }
  }
  settings.dom.addEventListener('keydown', handleUndo)
  settings.panel.addEventListener('keydown', handleUndo)
  const actionLabels: { button: HTMLButtonElement; label: Text; key: EditorMessageKey }[] = []
  function action(key: EditorMessageKey, symbol: 'settings' | 'copy' | 'trash', run: () => void) {
    const button = document.createElement('button'); button.type = 'button'; const label = document.createTextNode(text(key)); button.append(icon(symbol), label); button.setAttribute('aria-label', text(key)); actionLabels.push({ button, label, key })
    button.addEventListener('click', () => { if (!editor.isEditable) return; select(); settings.close(); run() })
    settings.panel.append(button); return button
  }
  const replace = action('replaceImage', 'copy', () => getActions?.(node.attrs.props).replace?.())
  const metadata = action('imageMetadata', 'settings', () => getActions?.(node.attrs.props).metadata?.())
  action('removeImage', 'trash', () => {
    const pos = getPos()
    if (pos !== undefined) editor.view.dispatch(closeHistory(editor.state.tr).delete(pos, pos + node.nodeSize))
    editor.view.focus()
  }).className = 'ginko-danger'
  dom.append(picture, settings.dom)
  function paint() {
    const render = node.type.spec.toDOM
    if (!render) return
    const next = DOMSerializer.renderSpec(document, render(node)).dom
    const current = picture.firstChild
    // Asset URLs may change while the stored document stays identical.
    if (current instanceof Element && next instanceof Element && current.tagName === next.tagName) {
      for (const name of current.getAttributeNames()) if (!next.hasAttribute(name)) current.removeAttribute(name)
      for (const name of next.getAttributeNames()) {
        const value = next.getAttribute(name)!
        if (current.getAttribute(name) !== value) current.setAttribute(name, value)
      }
    } else picture.replaceChildren(next)
  }
  function render() {
    settings.setLabel(text('imageSettings')); altText.textContent = text('imageDescription'); alt.setAttribute('aria-label', text('imageDescription'))
    actionLabels.forEach(({ button, label, key }) => { label.data = text(key); button.setAttribute('aria-label', text(key)) })
    paint()
    alt.value = typeof node.attrs.props.alt === 'string' ? node.attrs.props.alt : ''
    settings.dom.hidden = !editor.isEditable
    if (!editor.isEditable) settings.close()
    const actions = getActions?.(node.attrs.props)
    replace.hidden = !actions?.replace; metadata.hidden = !actions?.metadata
  }
  render()
  editor.on('transaction', render); editor.on('update', render)
  return {
    dom,
    update(next) { if (next.type !== node.type) return false; node = next; render(); return true },
    stopEvent(event) { return event.target instanceof globalThis.Node && settings.contains(event.target) },
    ignoreMutation: () => true,
    destroy() { settings.destroy(); editor.off('transaction', render); editor.off('update', render) },
  }
}
