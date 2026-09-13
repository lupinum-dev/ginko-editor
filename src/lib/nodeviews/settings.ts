import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import type { AuthoringKitV1 } from '../../authoring'
import type { JsonValue } from '../../types'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { convertTiptapDocToMarkdown, validateMarkdownForAuthoring } from '../conversionPipeline'
import { actOnBlock, canActOnBlock, type BlockAction } from './block-actions'
import { inlinePopover } from './popover'
import { icon } from './icons'

export function blockSettings(editor: Editor, getNode: () => Node, getPos: () => number | undefined, getKit: () => AuthoringKitV1 | undefined, getOutputOptions: () => TiptapToMDCOptions, isPairedColumn: () => boolean) {
  const popover = inlinePopover('Block settings', 'settings')
  const { dom, panel, close } = popover
  dom.classList.add('ginko-settings')
  const heading = document.createElement('strong')
  const fields = document.createElement('div'); fields.className = 'ginko-editor__fields'
  const error = document.createElement('p'); error.className = 'ginko-editor__field-error'; error.setAttribute('role', 'alert'); error.hidden = true
  const actions = document.createElement('div'); actions.className = 'ginko-editor__block-actions'
  panel.append(heading, fields, error, actions)
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>()
  let signature = '', disposed = false, variantRequest = 0
  let previousEditable = editor.isEditable, previousKit = getKit()
  let renderedNode = getNode()
  const report = (message = '') => { error.textContent = message; error.hidden = !message }
  dom.addEventListener('toggle', () => { if (dom.open) render() })
  dom.addEventListener('keydown', event => {
    if (!event.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); event.stopPropagation()
      if (event.shiftKey) editor.commands.redo(); else editor.commands.undo()
    }
  })
  function updateProperty(name: string, value: JsonValue | undefined) {
    const pos = getPos(), node = getNode()
    if (pos === undefined || !editor.isEditable) return
    const props = { ...node.attrs.props }
    if (value === undefined) delete props[name]; else props[name] = value
    report(); editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, props }))
  }
  async function switchVariant(tag: string) {
    // Even choosing the current variant cancels an earlier pending choice.
    const request = ++variantRequest
    const node = getNode(), kit = getKit(), pos = getPos(), before = editor.state
    if (!kit || pos === undefined || !editor.isEditable || tag === node.attrs.tag) return
    const group = kit.authoring[node.attrs.tag]?.canvas?.switchGroup
    if (!group || kit.authoring[tag]?.canvas?.switchGroup !== group) return
    const output = getOutputOptions(), outputKey = JSON.stringify(output)
    const current = () => !disposed && request === variantRequest && dom.isConnected && getKit() === kit && editor.state === before && editor.isEditable && JSON.stringify(getOutputOptions()) === outputKey
    const props = { ...node.attrs.props, $: { ...node.attrs.props.$, syntax: 'angle', block: 1, sourceName: tag } }
    const tr = closeHistory(before.tr).setNodeMarkup(pos, undefined, { ...node.attrs, tag, props })
    try {
      const result = await convertTiptapDocToMarkdown(tr.doc.toJSON(), output)
      if (!current()) return
      const issue = result.ok && result.value !== undefined ? await validateMarkdownForAuthoring(result.value, kit) : 'The component could not be converted.'
      if (!current()) return
      if (issue) { report(`Cannot switch with these properties. ${typeof issue === 'string' ? issue : issue.message}`); render(); return }
      report(); editor.view.dispatch(tr)
    } catch {
      if (current()) { report('The component could not be changed. Your document is unchanged.'); render() }
    }
  }
  for (const [action, text, symbol] of [['up', 'Move up', 'up'], ['down', 'Move down', 'down'], ['duplicate', 'Duplicate', 'copy'], ['delete', 'Delete', 'trash']] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action
    button.append(icon(symbol), document.createTextNode(text))
    if (action === 'delete') button.className = 'ginko-danger'
    button.addEventListener('click', () => { const pos = getPos(); if (pos === undefined || isPairedColumn()) return; close(); actOnBlock(editor, getNode(), pos, action) })
    actions.append(button)
  }
  function render() {
    const node = getNode(), kit = getKit(), metadata = kit?.authoring[node.attrs.tag], paired = isPairedColumn()
    if (editor.isEditable !== previousEditable || kit !== previousKit) variantRequest += 1
    previousEditable = editor.isEditable; previousKit = kit
    const changed = node !== renderedNode
    if (changed) report()
    renderedNode = node
    dom.hidden = !editor.isEditable || paired
    if (dom.hidden) close()
    popover.setLabel(`${metadata?.label ?? node.attrs.tag} settings`)
    heading.textContent = metadata?.label ?? node.attrs.tag
    const variants = metadata?.canvas?.switchGroup
      ? Object.entries(kit?.authoring ?? {}).filter(([, meta]) => meta.canvas?.switchGroup === metadata.canvas?.switchGroup).map(([tag, meta]) => ({ tag, label: meta.label }))
      : []
    const nextSignature = JSON.stringify([node.attrs.tag, metadata, kit?.policy.components[node.attrs.tag], variants])
    if (signature !== nextSignature) {
      signature = nextSignature; inputs.clear(); fields.replaceChildren()
      if (metadata?.canvas?.switchGroup) {
        const label = document.createElement('label'), text = document.createElement('span'), select = document.createElement('select')
        text.textContent = 'Callout type'; select.setAttribute('aria-label', 'Callout type')
        variants.forEach(variant => {
          const option = document.createElement('option'); option.value = variant.tag; option.textContent = variant.label; select.append(option)
        })
        select.addEventListener('change', () => { void switchVariant(select.value) }); inputs.set('$variant', select)
        label.append(text, select); fields.append(label)
      }
      for (const [name, field] of Object.entries(metadata?.props ?? {})) {
        if (!field || name === metadata?.canvas?.titleProp) continue
        const label = document.createElement('label'), text = document.createElement('span')
        text.textContent = field.label
        const input = document.createElement(field.control === 'select' ? 'select' : 'input')
        input.setAttribute('aria-label', field.label)
        const values = kit?.policy.components[node.attrs.tag]?.props[name]?.allowedValues ?? []
        if (input instanceof HTMLSelectElement) {
          const option = document.createElement('option'); option.value = ''; option.textContent = 'Default'; input.append(option)
          values.forEach(value => { const option = document.createElement('option'); option.value = JSON.stringify(value); option.textContent = typeof value === 'string' ? value || 'Empty text' : String(value); input.append(option) })
          input.addEventListener('change', () => updateProperty(name, values.find(value => JSON.stringify(value) === input.value)))
        } else {
          input.type = field.control === 'toggle' ? 'checkbox' : 'text'
          if (field.control === 'number') input.inputMode = 'decimal'
          input.addEventListener(field.control === 'toggle' ? 'change' : 'input', () => {
            if (field.control === 'toggle') { updateProperty(name, input.checked); return }
            if (field.control !== 'number') { updateProperty(name, input.value); return }
            if (!input.value.trim()) { updateProperty(name, undefined); return }
            if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.value.trim()) && Number.isFinite(Number(input.value))) updateProperty(name, Number(input.value))
            else report('Enter a valid number.')
          })
        }
        inputs.set(name, input); label.append(text, input)
        if (field.help) { const help = document.createElement('small'); help.textContent = field.help; label.append(help) }
        fields.append(label)
      }
    }
    for (const [name, input] of inputs) {
      const value = name === '$variant' ? node.attrs.tag : node.attrs.props[name]
      const effective = value ?? kit?.implementation[node.attrs.tag]?.props[name]?.default
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = effective === true
      else if (changed || document.activeElement !== input || name === '$variant') input.value = name === '$variant' ? String(value) : input instanceof HTMLSelectElement ? JSON.stringify(value) ?? '' : String(value ?? '')
    }
    const pos = getPos()
    actions.querySelectorAll('button').forEach(button => { button.disabled = pos === undefined || paired || !canActOnBlock(editor, pos, button.dataset.action as BlockAction) })
    popover.position()
  }
  render()
  return { dom, render, destroy() { disposed = true; variantRequest += 1; popover.destroy() } }
}
