import { columnChildren, parentColumnConfig } from './columns'
import { createEditorText } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import type { NodeViewRendererProps } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { TextSelection } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
import { blockSettings } from './settings'
import { icon } from './icons'
import type { TiptapToMDCOptions } from '../tiptapToMdc'
import type { AuthoringKitV1 } from '../../authoring'
import { SetNodePropertyStep } from '../property-step'
import { createPropertyInput } from '../property-input'

export function componentView(
  { node: initial, editor, getPos }: NodeViewRendererProps,
  getKit: () => AuthoringKitV1 | undefined,
  getOutputOptions: () => TiptapToMDCOptions,
  overlay?: EditorOverlayController,
): NodeView {
  const text = overlay?.text ?? createEditorText()
  const titleInput = createPropertyInput(editor)
  let node = initial
  const dom = document.createElement('div')
  dom.className = 'ginko-block'
  dom.dataset.type = 'element'
  const header = document.createElement('div')
  header.className = 'ginko-block__header'
  header.contentEditable = 'false'
  const label = document.createElement('span')
  label.className = 'ginko-block__label'
  const title = document.createElement('input')
  title.className = 'ginko-block__title'
  title.type = 'text'
  const contentDOM = document.createElement('div')
  contentDOM.className = 'ginko-block__content'
  const divider = document.createElement('div')
  divider.className = 'ginko-block__divider'
  divider.contentEditable = 'false'
  divider.setAttribute('role', 'separator')
  divider.setAttribute('aria-orientation', 'vertical')
  divider.setAttribute('aria-label', text('columnWidths'))
  divider.tabIndex = 0
  const symbol = document.createElement('span')
  symbol.className = 'ginko-block__symbol'
  header.append(label, symbol, title)
  const body = document.createElement('div')
  body.className = 'ginko-block__body'
  body.append(contentDOM, divider)
  dom.append(header, body)
  let dragging: { pointerId: number; ratio: number } | undefined
  let destroyed = false
  let previousKit = getKit()
  const position = () => destroyed ? undefined : getPos()
  const metadata = () => getKit()?.authoring[node.attrs.tag]
  const columns = () => metadata()?.canvas?.columns
  const paired = () => {
    const config = columns()
    return config ? columnChildren(node, config.childTag) : []
  }
  const presetIndex = () => {
    const config = columns(), children = paired()
    return config?.presets.findIndex(preset => children.length === 2
      && preset.values.every((value, i) => (children[i].node.attrs.props[config.sizeProp]
        ?? getKit()?.implementation[config.childTag]?.props[config.sizeProp]?.default) === value)) ?? -1
  }
  const parentColumns = () => {
    const pos = position()
    return pos === undefined ? undefined : parentColumnConfig(editor.state.doc, pos, getKit())
  }
  const settings = blockSettings(
    editor,
    () => node,
    position,
    getKit,
    getOutputOptions,
    () => !!parentColumns(),
    overlay,
  )
  header.append(settings.dom)
  let paintedTone = ''
  const paintRatio = (ratio: number) => {
    dom.style.setProperty('--column-ratio', `${ratio * 100}%`)
  }
  const cancelDrag = () => {
    const drag = dragging
    dragging = undefined
    if (drag && divider.hasPointerCapture?.(drag.pointerId)) divider.releasePointerCapture(drag.pointerId)
    const preset = columns()?.presets[presetIndex()]
    paintRatio(preset?.ratio ?? .5)
    divider.setAttribute('aria-valuenow', String(Math.round((preset?.ratio ?? .5) * 100)))
    divider.setAttribute('aria-valuetext', preset?.label ?? text('customWidths'))
  }
  function choosePreset(index: number) {
    const config = columns(), children = paired(), pos = position()
    const preset = config?.presets[index]
    if (!editor.isEditable || !config || !preset || children.length !== 2 || pos === undefined) return
    cancelDrag()
    if (index === presetIndex()) return
    const tr = closeHistory(editor.state.tr)
    children.forEach((child, i) => tr.step(new SetNodePropertyStep(pos + child.offset, config.sizeProp, preset.values[i])))
    editor.view.dispatch(tr)
  }
  title.addEventListener('focus', () => {
    titleInput.reset()
    const pos = position()
    if (pos !== undefined && editor.isEditable) {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))))
    }
  })
  title.addEventListener('blur', () => titleInput.reset())
  title.addEventListener('input', () => {
    const prop = metadata()?.canvas?.titleProp, pos = position()
    if (!prop || pos === undefined || !editor.isEditable) return
    editor.view.dispatch(titleInput.transaction(pos, prop, title.value))
  })
  title.addEventListener('keydown', event => {
    if (event.isComposing) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      titleInput.reset()
      if (event.shiftKey) editor.commands.redo()
      else editor.commands.undo()
    }
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      editor.view.focus()
    }
  })
  divider.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      cancelDrag()
      event.preventDefault()
      return
    }
    const presets = columns()?.presets
    if (!presets || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = Math.max(0, presetIndex())
    choosePreset(event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? presets.length - 1
        : Math.max(0, Math.min(presets.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1))))
  })
  divider.addEventListener('pointerdown', event => {
    if (!editor.isEditable || event.button !== 0 || dragging) return
    event.preventDefault()
    divider.focus()
    dragging = { pointerId: event.pointerId, ratio: columns()?.presets[presetIndex()]?.ratio ?? .5 }
    divider.setPointerCapture(event.pointerId)
  })
  divider.addEventListener('pointermove', event => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    const bounds = contentDOM.getBoundingClientRect(), presets = columns()?.presets
    if (!presets || bounds.width === 0) return
    dragging.ratio = Math.max(
      presets[0].ratio,
      Math.min(presets[presets.length - 1].ratio, (event.clientX - bounds.left) / bounds.width),
    )
    const nearest = presets.reduce(
      (best, preset) => Math.abs(preset.ratio - dragging!.ratio) < Math.abs(best.ratio - dragging!.ratio)
        ? preset
        : best,
      presets[0],
    )
    paintRatio(nearest.ratio)
    divider.setAttribute('aria-valuetext', nearest.label)
    divider.setAttribute('aria-valuenow', String(Math.round(nearest.ratio * 100)))
  })
  divider.addEventListener('pointerup', event => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    const ratio = dragging.ratio, presets = columns()?.presets
    cancelDrag()
    if (presets) {
      choosePreset(presets.reduce(
        (best, preset, index) => Math.abs(preset.ratio - ratio) < Math.abs(presets[best].ratio - ratio)
          ? index
          : best,
        0,
      ))
    }
  })
  divider.addEventListener('pointercancel', cancelDrag)
  divider.addEventListener('lostpointercapture', cancelDrag)
  function render() {
    if ((!editor.isEditable || getKit() !== previousKit) && dragging) cancelDrag()
    previousKit = getKit()
    const meta = metadata(), config = columns(), children = paired()
    const isPair = !!config && children.length === 2
    const prop = meta?.canvas?.titleProp
    const titleSlot = prop
      && node.content.content.some(child => child.type.name === 'slot'
        && child.attrs.name === prop
        && child.content.size > 0)
    dom.dataset.label = meta?.label ?? node.attrs.tag
    dom.setAttribute('tag', node.attrs.tag)
    const parentConfig = parentColumns()
    label.textContent = isPair
      ? text('resizeColumns')
      : parentConfig
        ? text('columnSize', {
          label: meta?.label ?? node.attrs.tag,
          size: String(node.attrs.props[parentConfig.sizeProp]
            ?? getKit()?.implementation[node.attrs.tag]?.props[parentConfig.sizeProp]?.default
            ?? 'md'),
        })
        : meta?.label ?? node.attrs.tag
    label.hidden = !!prop && !isPair
    dom.dataset.tone = meta?.canvas?.tone ?? 'neutral'
    dom.dataset.callout = String(!!meta?.canvas?.switchGroup)
    dom.dataset.appearance = typeof node.attrs.props.appearance === 'string'
      ? node.attrs.props.appearance
      : 'tint'
    dom.dataset.column = String(!!parentConfig)
    symbol.hidden = !meta?.canvas?.tone
    if (paintedTone !== dom.dataset.tone) {
      paintedTone = dom.dataset.tone
      symbol.replaceChildren(icon(
        paintedTone === 'warning' || paintedTone === 'danger'
          ? 'warning'
          : paintedTone === 'success'
            ? 'check'
            : paintedTone === 'idea'
              ? 'idea'
              : 'info',
      ))
    }
    const titleValue = prop
      ? String(node.attrs.props[prop] ?? getKit()?.implementation[node.attrs.tag]?.props[prop]?.default ?? '')
      : ''
    title.hidden = !prop || !!titleSlot
    title.disabled = !editor.isEditable
    title.setAttribute('aria-label', text('componentTitle', {
      label: meta?.label ?? node.attrs.tag,
      field: prop ? meta?.props?.[prop]?.label ?? prop : text('title'),
    }))
    title.placeholder = text('addTitle')
    divider.setAttribute('aria-label', text('columnWidths'))
    if (title.value !== titleValue) title.value = titleValue
    dom.dataset.columns = String(isPair)
    const selected = presetIndex()
    if (!dragging) paintRatio(config?.presets[selected]?.ratio ?? .5)
    divider.hidden = !isPair || !editor.isEditable
    if (config && isPair) {
      divider.setAttribute('aria-valuemin', String(Math.round(config.presets[0].ratio * 100)))
      divider.setAttribute('aria-valuemax', String(Math.round(config.presets[config.presets.length - 1].ratio * 100)))
      divider.setAttribute('aria-valuenow', String(Math.round((config.presets[selected]?.ratio ?? .5) * 100)))
      divider.setAttribute('aria-valuetext', config.presets[selected]?.label ?? text('customWidths'))
      divider.title = text('resizeColumnsHint', { label: config.presets[selected]?.label ?? text('customWidths') })

    }
    settings.render()
  }
  const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (transaction.docChanged && dragging) cancelDrag()
    render()
  }
  const onUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (!transaction.docChanged) render()
  }
  editor.on('transaction', onTransaction)
  editor.on('update', onUpdate)
  render()
  return {
    dom, contentDOM,
    update(next) {
      if (next.type !== node.type) return false
      node = next
      render()
      return true
    },
    stopEvent(event) {
      return event.target instanceof globalThis.Node
        && (header.contains(event.target) || divider.contains(event.target) || settings.contains(event.target))
    },
    ignoreMutation(mutation) {
      return mutation.type !== 'selection' && !contentDOM.contains(mutation.target)
    },
    destroy() {
      destroyed = true
      cancelDrag()
      settings.destroy()
      editor.off('transaction', onTransaction)
      editor.off('update', onUpdate)
    },
  }
}
