import type { NodeViewRendererProps } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { NodeSelection } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
import type { JsonRecord } from '../../types'
import { icon } from './icons'
import { inlinePopover } from './popover'

export type ImageActions = (props: JsonRecord) => { replace?: () => void; metadata?: () => void }

export function imageView({ node: initial, editor, getPos }: NodeViewRendererProps, getActions?: ImageActions): NodeView {
  let node = initial
  const dom = document.createElement('figure')
  dom.className = 'ginko-image'
  const picture = document.createElement('div')
  picture.className = 'ginko-image__picture'
  const settings = inlinePopover('Image settings', 'settings')
  const fields = document.createElement('div')
  fields.className = 'ginko-editor__fields'
  const altLabel = document.createElement('label'), altText = document.createElement('span'), alt = document.createElement('input')
  altText.textContent = 'Image description'; alt.type = 'text'; alt.setAttribute('aria-label', 'Image description')
  altLabel.append(altText, alt); fields.append(altLabel); settings.panel.append(fields)
  function select() {
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
  }
  settings.dom.addEventListener('focusin', select)
  alt.addEventListener('input', () => {
    const pos = getPos()
    if (pos !== undefined && editor.isEditable) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: { ...node.attrs.props, alt: alt.value } }))
  })
  settings.dom.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.commands.redo(); else editor.commands.undo() }
  })
  function action(label: string, symbol: 'settings' | 'copy' | 'trash', run: () => void) {
    const button = document.createElement('button'); button.type = 'button'; button.append(icon(symbol), document.createTextNode(label)); button.setAttribute('aria-label', label)
    button.addEventListener('click', () => { if (!editor.isEditable) return; select(); settings.close(); run() })
    settings.panel.append(button); return button
  }
  const replace = action('Replace image', 'copy', () => getActions?.(node.attrs.props).replace?.())
  const metadata = action('Image metadata', 'settings', () => getActions?.(node.attrs.props).metadata?.())
  action('Remove image', 'trash', () => {
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
    stopEvent(event) { return event.target instanceof globalThis.Node && settings.dom.contains(event.target) },
    ignoreMutation: () => true,
    destroy() { settings.destroy(); editor.off('transaction', render); editor.off('update', render) },
  }
}
