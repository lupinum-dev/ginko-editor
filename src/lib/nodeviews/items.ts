import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

import type { AuthoringKit } from '../../authoring'
import type { EditorText } from '../../ui/messages'
import {
  addContainerItem,
  containerLayout,
  itemHasContent,
  itemLabel,
  removeContainerItem,
  renameContainerItem,
  type ContainerItem,
  type ContainerLayout,
} from '../container-items'
import { activeItemIndex, selectContainerItem } from '../extensions/container-items'
import type { BlockOperationResult } from '../editor-operations'
import { icon } from './icons'

let nextStripId = 0

/**
 * Canvas controls of a container with repeated items: a tab strip for the
 * `tabs` presentation and an add control for every presentation.
 */
export function containerControls(
  editor: Editor,
  getNode: () => ProseMirrorNode,
  getPos: () => number | undefined,
  getKit: () => AuthoringKit | undefined,
  text: EditorText,
  contentDOM: HTMLElement,
) {
  const id = `ginko-items-${++nextStripId}`
  const strip = document.createElement('div')
  strip.className = 'ginko-items__strip'
  strip.contentEditable = 'false'
  const tablist = document.createElement('div')
  tablist.className = 'ginko-items__tabs'
  tablist.setAttribute('role', 'tablist')
  tablist.setAttribute('aria-orientation', 'horizontal')
  const stripAdd = document.createElement('button')
  stripAdd.type = 'button'
  stripAdd.className = 'ginko-items__add ginko-items__add--strip'
  strip.append(tablist, stripAdd)
  const footer = document.createElement('div')
  footer.className = 'ginko-items__footer'
  footer.contentEditable = 'false'
  const footerAdd = document.createElement('button')
  footerAdd.type = 'button'
  footerAdd.className = 'ginko-items__add'
  footer.append(footerAdd)
  const status = document.createElement('p')
  status.className = 'ginko-editor__field-error'
  status.setAttribute('role', 'alert')
  status.hidden = true
  footer.append(status)
  contentDOM.id = `${id}-panel`

  let pendingRemove: number | undefined
  let renaming: number | undefined
  let focusIndex: number | undefined
  let signature = ''
  let busy = false

  const layout = (): ContainerLayout | undefined => {
    const pos = getPos()
    return pos === undefined ? undefined : containerLayout(editor.state.doc, pos, getKit())
  }
  const itemName = (item: ContainerItem, current: ContainerLayout) => {
    const label = itemLabel(item, current.config)
    if (label.trim()) return label
    const childLabel = current.config.childTag
      ? getKit()?.authoring[current.config.childTag]?.label ?? current.config.childTag
      : text('codeBlock')
    return text('untitledItem', { label: childLabel, number: item.index + 1 })
  }
  let failure = ''
  const report = (result: BlockOperationResult) => {
    failure = result.ok || result.reason === 'stale' ? '' : text('itemChangeFailed')
    render()
  }
  /** One status line for a failed change or a pending removal. */
  function paintStatus(current: ContainerLayout | undefined) {
    const item = pendingRemove === undefined || !current ? undefined : current.items[pendingRemove]
    status.textContent = item ? text('confirmRemoveItem', { label: itemName(item, current!) }) : failure
    status.hidden = !status.textContent
  }
  async function run(action: () => Promise<BlockOperationResult>) {
    if (busy) return
    busy = true
    try { report(await action()) } finally { busy = false }
  }

  function select(index: number, focusEditor: boolean) {
    const current = layout(), item = current?.items[index]
    if (!current || !item) return
    const tr = selectContainerItem(editor.state.tr, current.pos, item.from)
    if (editor.isEditable) {
      const inside = item.node.type.name === 'codeBlock' ? item.from + 1 : Math.min(item.from + 2, item.to - 1)
      tr.setSelection(TextSelection.near(tr.doc.resolve(inside)))
    }
    editor.view.dispatch(tr)
    if (focusEditor) editor.view.focus()
  }
  function add() {
    const current = layout()
    if (!current || !editor.isEditable) return
    const after = current.config.presentation === 'tabs' ? activeItemIndex(editor.state, current) : undefined
    // The new item receives the selection, so a new tab also becomes the selected tab.
    void run(() => addContainerItem(editor, current.pos, { after }))
  }
  function remove(index: number) {
    const current = layout(), item = current?.items[index]
    if (!current || !item || current.items.length < 2 || !editor.isEditable) return
    if (itemHasContent(item) && pendingRemove !== index) {
      pendingRemove = index
      render()
      return
    }
    pendingRemove = undefined
    void run(() => removeContainerItem(editor, current.pos, index))
  }
  function startRename(index: number) {
    if (!editor.isEditable) return
    renaming = index
    signature = ''
    render()
    const input = tablist.querySelector<HTMLInputElement>('input')
    input?.focus()
    input?.select()
  }
  function finishRename(index: number, value: string | undefined) {
    if (renaming !== index) return
    renaming = undefined
    focusIndex = index
    signature = ''
    const current = layout()
    if (value !== undefined && current) void run(() => renameContainerItem(editor, current.pos, index, value))
    render()
  }

  stripAdd.addEventListener('click', add)
  footerAdd.addEventListener('click', add)
  tablist.addEventListener('focusout', event => {
    if (pendingRemove !== undefined && !tablist.contains(event.relatedTarget as globalThis.Node | null)) {
      pendingRemove = undefined
      render()
    }
  })

  function renderTabs(current: ContainerLayout, active: number) {
    const label = getKit()?.authoring[current.node.attrs.tag]?.label ?? current.node.attrs.tag
    tablist.setAttribute('aria-label', text('containerItems', { label }))
    const nextSignature = JSON.stringify([
      current.items.map(item => itemName(item, current)),
      active,
      renaming,
      pendingRemove,
      editor.isEditable,
      label,
      text('removeItem', { label: '' }),
    ])
    if (nextSignature === signature) return
    signature = nextSignature
    const restoreFocus = focusIndex ?? (tablist.contains(document.activeElement)
      ? Number((document.activeElement as HTMLElement).dataset.index ?? active)
      : undefined)
    focusIndex = undefined
    tablist.replaceChildren()
    current.items.forEach((item, index) => {
      const name = itemName(item, current)
      const wrapper = document.createElement('span')
      wrapper.className = 'ginko-items__tab'
      wrapper.dataset.active = String(index === active)
      if (renaming === index) {
        const input = document.createElement('input')
        input.type = 'text'
        input.value = itemLabel(item, current.config)
        input.className = 'ginko-items__rename'
        input.setAttribute('aria-label', text('itemName', { label: name }))
        let done = false
        input.addEventListener('keydown', event => {
          if (event.isComposing) return
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault()
            done = true
            finishRename(index, event.key === 'Enter' ? input.value : undefined)
          }
        })
        input.addEventListener('blur', () => { if (!done) finishRename(index, input.value) })
        wrapper.append(input)
      } else {
        const tab = document.createElement('button')
        tab.type = 'button'
        tab.id = `${id}-tab-${index}`
        tab.dataset.index = String(index)
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', String(index === active))
        tab.setAttribute('aria-controls', contentDOM.id)
        tab.setAttribute('aria-keyshortcuts', 'F2 Delete')
        tab.title = text('itemTabHint')
        tab.tabIndex = index === active ? 0 : -1
        tab.textContent = name
        tab.addEventListener('click', () => select(index, true))
        tab.addEventListener('dblclick', () => startRename(index))
        tab.addEventListener('keydown', event => {
          if (event.isComposing) return
          const count = current.items.length
          const move = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: count - 1 }[event.key]
          if (move !== undefined) {
            event.preventDefault()
            focusIndex = (move + count) % count
            select(focusIndex, false)
            return
          }
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault()
            select(index, true)
          } else if (event.key === 'F2') {
            event.preventDefault()
            startRename(index)
          } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            focusIndex = index
            remove(index)
          }
        })
        wrapper.append(tab)
        if (editor.isEditable && current.items.length > 1) {
          const confirm = pendingRemove === index
          const removeButton = document.createElement('button')
          removeButton.type = 'button'
          removeButton.tabIndex = -1
          // Delete and Backspace on the tab remove it; a tablist owns only tabs.
          removeButton.setAttribute('aria-hidden', 'true')
          removeButton.className = 'ginko-items__remove'
          removeButton.dataset.confirm = String(confirm)
          const removeLabel = text(confirm ? 'confirmRemoveItem' : 'removeItem', { label: name })
          removeButton.setAttribute('aria-label', removeLabel)
          removeButton.title = removeLabel
          removeButton.append(icon(confirm ? 'trash' : 'close'))
          removeButton.addEventListener('mousedown', event => event.preventDefault())
          removeButton.addEventListener('click', () => remove(index))
          wrapper.append(removeButton)
        }
      }
      tablist.append(wrapper)
    })
    if (restoreFocus !== undefined) {
      tablist.querySelector<HTMLElement>(`[data-index="${restoreFocus}"]`)?.focus()
    }
    contentDOM.setAttribute('role', 'tabpanel')
    const activeTab = tablist.querySelector(`[data-index="${active}"]`)
    if (activeTab) contentDOM.setAttribute('aria-labelledby', activeTab.id)
  }

  function render() {
    const current = layout()
    const node = getNode()
    if (!current) {
      strip.hidden = true
      footer.hidden = true
      failure = ''
      return
    }
    const config = current.config
    const isTabs = config.presentation === 'tabs'
    const addLabel = config.addLabel ?? text('addItem')
    for (const button of [stripAdd, footerAdd]) {
      button.replaceChildren(icon('plus'), document.createTextNode(isTabs ? '' : addLabel))
      button.setAttribute('aria-label', addLabel)
      button.title = addLabel
      button.disabled = !editor.isEditable
    }
    strip.hidden = !isTabs
    footerAdd.hidden = isTabs || !editor.isEditable
    if (config.columnsProp) {
      const value = node.attrs.props?.[config.columnsProp]
        ?? getKit()?.implementation[node.attrs.tag]?.props[config.columnsProp]?.default
      const columns = Math.max(1, Math.min(6, Math.round(Number(value)) || 2))
      contentDOM.style.setProperty('--ginko-item-columns', String(columns))
    }
    if (isTabs) renderTabs(current, activeItemIndex(editor.state, current))
    else {
      contentDOM.removeAttribute('role')
      contentDOM.removeAttribute('aria-labelledby')
    }
    paintStatus(current)
    footer.hidden = !status.textContent && (isTabs || !editor.isEditable)
  }

  return {
    strip,
    footer,
    render,
    contains: (target: globalThis.Node) => strip.contains(target) || footer.contains(target),
    presentation: () => layout()?.config.presentation,
  }
}
