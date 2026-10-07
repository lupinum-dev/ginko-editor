import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import type { AuthoringKit } from '../../authoring'
import type { JsonValue } from '../../types'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import { convertTiptapDocToMarkdown, validateMarkdownForAuthoring } from '../conversionPipeline'
import { actOnBlock, canActOnBlock, type BlockAction } from './block-actions'
import { inlinePopover } from './popover'
import { icon } from './icons'
import { createEditorText } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import { SetComponentVariantStep } from '../property-step'
import { createPropertyInput } from '../property-input'
import { createStalenessGuard, handleHistoryKeydown } from './lifecycle'

let nextListId = 0

export function blockSettings(
  editor: Editor,
  getNode: () => Node,
  getPos: () => number | undefined,
  getKit: () => AuthoringKit | undefined,
  getOutputOptions: () => TiptapToMDCOptions,
  isPairedColumn: () => boolean,
  overlay?: EditorOverlayController,
) {
  const text = overlay?.text ?? createEditorText()
  const propertyInput = createPropertyInput(editor)
  const popover = inlinePopover(text('blockSettings'), 'settings', overlay)
  const { dom, panel, close } = popover
  dom.classList.add('ginko-settings')
  const heading = document.createElement('strong')
  const fields = document.createElement('div')
  fields.className = 'ginko-editor__fields'
  const error = document.createElement('p')
  error.className = 'ginko-editor__field-error'
  error.setAttribute('role', 'alert')
  error.hidden = true
  const actions = document.createElement('div')
  actions.className = 'ginko-editor__block-actions'
  panel.append(heading, fields, error, actions)
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>()
  let signature = ''
  const variantRequests = createStalenessGuard()
  let previousEditable = editor.isEditable, previousKit = getKit()
  let renderedNode = getNode()
  const report = (message = '') => {
    error.textContent = message
    error.hidden = !message
  }
  popover.onOpenChange(open => {
    if (open) render()
  })
  const handleUndo = (event: KeyboardEvent) => { handleHistoryKeydown(editor, event, propertyInput.reset, true) }
  dom.addEventListener('keydown', handleUndo)
  panel.addEventListener('keydown', handleUndo)
  panel.addEventListener('focusin', () => propertyInput.reset())
  panel.addEventListener('focusout', () => propertyInput.reset())
  function updateProperty(name: string, value: JsonValue | undefined) {
    const pos = getPos()
    if (pos === undefined || !editor.isEditable) return
    report()
    editor.view.dispatch(propertyInput.transaction(pos, name, value))
  }
  async function switchVariant(tag: string) {
    // Even choosing the current variant cancels an earlier pending choice.
    const isCurrentRequest = variantRequests.start()
    const node = getNode(), kit = getKit(), pos = getPos(), before = editor.state
    if (!kit || pos === undefined || !editor.isEditable || tag === node.attrs.tag) return
    const group = kit.authoring[node.attrs.tag]?.canvas?.switchGroup
    if (!group || kit.authoring[tag]?.canvas?.switchGroup !== group) return
    const output = getOutputOptions(), outputKey = JSON.stringify(output)
    const current = () => isCurrentRequest()
      && dom.isConnected
      && getKit() === kit
      && editor.state === before
      && editor.isEditable
      && JSON.stringify(getOutputOptions()) === outputKey
    const syntax = { ...node.attrs.props.$, syntax: 'angle', block: 1, sourceName: tag }
    const tr = closeHistory(before.tr).step(new SetComponentVariantStep(pos, tag, syntax))
    try {
      const result = await convertTiptapDocToMarkdown(tr.doc.toJSON(), output)
      if (!current()) return
      const issue = result.ok && result.value !== undefined
        ? await validateMarkdownForAuthoring(result.value, kit)
        : text('componentConversionFailed')
      if (!current()) return
      if (issue) {
        report(text('variantInvalid', { reason: typeof issue === 'string' ? issue : issue.message }))
        render()
        return
      }
      report()
      editor.view.dispatch(tr)
    } catch {
      if (current()) {
        report(text('variantFailed'))
        render()
      }
    }
  }
  const actionLabels: { label: Text; key: 'duplicate' | 'delete' }[] = []
  for (const [action, key, symbol] of [['duplicate', 'duplicate', 'copy'], ['delete', 'delete', 'trash']] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
    const label = document.createTextNode(text(key))
    actionLabels.push({ label, key })
    button.append(icon(symbol), label)
    if (action === 'delete') button.className = 'ginko-danger'
    button.addEventListener('click', () => {
      const pos = getPos()
      if (pos === undefined || isPairedColumn()) return
      close()
      actOnBlock(editor, getNode(), pos, action)
    })
    actions.append(button)
  }
  function render() {
    const node = getNode(), kit = getKit(), metadata = kit?.authoring[node.attrs.tag], paired = isPairedColumn()
    if (editor.isEditable !== previousEditable || kit !== previousKit) variantRequests.cancel()
    previousEditable = editor.isEditable
    previousKit = kit
    const changed = node !== renderedNode
    if (changed) report()
    renderedNode = node
    dom.hidden = !editor.isEditable || paired
    if (dom.hidden) close()
    popover.setLabel(text('componentSettings', { label: metadata?.label ?? node.attrs.tag }))
    actionLabels.forEach(({ label, key }) => {
      label.data = text(key)
    })
    heading.textContent = metadata?.label ?? node.attrs.tag
    const variants = metadata?.canvas?.switchGroup
      ? Object.entries(kit?.authoring ?? {})
        .filter(([, meta]) => meta.canvas?.switchGroup === metadata.canvas?.switchGroup)
        .map(([tag, meta]) => ({ tag, label: meta.label }))
      : []
    const nextSignature = JSON.stringify([
      node.attrs.tag,
      metadata,
      kit?.policy.components[node.attrs.tag],
      variants,
      text('calloutType'),
      text('defaultValue'),
      text('emptyText'),
    ])
    if (signature !== nextSignature) {
      signature = nextSignature
      inputs.clear()
      fields.replaceChildren()
      if (metadata?.canvas?.switchGroup) {
        const label = document.createElement('label')
        const caption = document.createElement('span')
        const select = document.createElement('select')
        caption.textContent = text('calloutType')
        select.setAttribute('aria-label', text('calloutType'))
        variants.forEach(variant => {
          const option = document.createElement('option')
          option.value = variant.tag
          option.textContent = variant.label
          select.append(option)
        })
        select.addEventListener('change', () => {
          void switchVariant(select.value)
        })
        inputs.set('$variant', select)
        label.append(caption, select)
        fields.append(label)
      }
      for (const [name, field] of Object.entries(metadata?.props ?? {})) {
        if (!field || name === metadata?.canvas?.titleProp) continue
        const label = document.createElement('label'), caption = document.createElement('span')
        caption.textContent = field.label
        const input = document.createElement(
          field.control === 'select' ? 'select' : field.control === 'json' ? 'textarea' : 'input',
        )
        input.setAttribute('aria-label', field.label)
        const values = kit?.policy.components[node.attrs.tag]?.props[name]?.allowedValues ?? []
        const isRequired = kit?.policy.components[node.attrs.tag]?.props[name]?.required === true
        if (input instanceof HTMLTextAreaElement) {
          input.rows = 4
          input.spellcheck = false
          input.className = 'ginko-editor__json'
          input.addEventListener('input', () => {
            const source = input.value.trim()
            if (!source) {
              if (isRequired) report(text('valueRequired'))
              else updateProperty(name, undefined)
              input.setAttribute('aria-invalid', String(isRequired))
              return
            }
            let value: JsonValue
            try {
              value = JSON.parse(source) as JsonValue
            } catch {
              input.setAttribute('aria-invalid', 'true')
              report(text('invalidJson'))
              return
            }
            input.setAttribute('aria-invalid', 'false')
            updateProperty(name, value)
          })
        } else if (input instanceof HTMLSelectElement) {
          const option = document.createElement('option')
          option.value = ''
          option.textContent = text('defaultValue')
          input.append(option)
          values.forEach(value => {
            const option = document.createElement('option')
            option.value = JSON.stringify(value)
            option.textContent = typeof value === 'string' ? value || text('emptyText') : String(value)
            input.append(option)
          })
          input.addEventListener('change', () => updateProperty(
            name,
            values.find(value => JSON.stringify(value) === input.value),
          ))
        } else {
          input.type = field.control === 'toggle' ? 'checkbox' : 'text'
          if (field.control === 'number') input.inputMode = 'decimal'
          const suggestions = field.control === 'text'
            ? kit?.implementation[node.attrs.tag]?.props[name]?.options?.filter(value => typeof value === 'string')
            : undefined
          if (suggestions?.length) {
            const list = document.createElement('datalist')
            list.id = `ginko-suggestions-${++nextListId}`
            suggestions.forEach(value => {
              const option = document.createElement('option')
              option.value = String(value)
              list.append(option)
            })
            input.setAttribute('list', list.id)
            label.append(list)
          }
          input.addEventListener(field.control === 'toggle' ? 'change' : 'input', () => {
            if (field.control === 'toggle') {
              updateProperty(name, input.checked)
              return
            }
            if (field.control !== 'number') {
              updateProperty(name, input.value)
              return
            }
            if (!input.value.trim()) {
              updateProperty(name, undefined)
              return
            }
            if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.value.trim())
              && Number.isFinite(Number(input.value))) {
              updateProperty(name, Number(input.value))
            } else report(text('invalidNumber'))
          })
        }
        inputs.set(name, input)
        label.append(caption, input)
        if (field.help) {
          const help = document.createElement('small')
          help.textContent = field.help
          label.append(help)
        }
        fields.append(label)
      }
    }
    for (const [name, input] of inputs) {
      const value = name === '$variant' ? node.attrs.tag : node.attrs.props[name]
      const effective = value ?? kit?.implementation[node.attrs.tag]?.props[name]?.default
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = effective === true
      else if (input instanceof HTMLTextAreaElement && document.activeElement === input && sameJson(input.value, value)) {
        // Keep the author's formatting and caret while the typed JSON matches the stored value.
        continue
      }
      else if (changed || document.activeElement !== input || name === '$variant') {
        input.value = name === '$variant'
          ? String(value)
          : input instanceof HTMLSelectElement
            ? JSON.stringify(value) ?? ''
            : input instanceof HTMLTextAreaElement
              ? value === undefined ? '' : JSON.stringify(value, null, 2)
              : String(value ?? '')
        if (input instanceof HTMLTextAreaElement) input.removeAttribute('aria-invalid')
      }
    }
    const pos = getPos()
    actions.querySelectorAll('button').forEach(button => {
      button.disabled = pos === undefined
        || paired
        || !canActOnBlock(editor, pos, button.dataset.action as BlockAction)
    })
    popover.position()
  }
  render()
  return {
    dom,
    render,
    contains: popover.contains,
    destroy() {
      variantRequests.dispose()
      popover.destroy()
    },
  }
}

function sameJson(source: string, value: unknown) {
  if (!source.trim()) return value === undefined
  try { return JSON.stringify(JSON.parse(source)) === JSON.stringify(value) } catch { return false }
}
