import type { NodeViewRendererProps } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import type { Rect } from '@tiptap/pm/tables'
import type { NodeView } from '@tiptap/pm/view'
import { watch } from 'vue'
import { createEditorText, type EditorMessageKey } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import { iconButton, type IconName } from './icons'
import { inlinePopover } from './popover'
import {
  applyTableOperation,
  canChangeTable,
  portableTable,
  selectedTableRect,
  selectTableRect,
  type TableOperation,
} from './table-operations'

export function tableView(
  { node: initial, editor, getPos }: NodeViewRendererProps,
  controller?: EditorOverlayController,
): NodeView {
  const text = controller?.text ?? createEditorText()
  let node = initial
  let hovered: Rect | undefined
  let destroyed = false
  const dom = document.createElement('div')
  dom.className = 'ginko-table'
  const toolbar = document.createElement('div')
  toolbar.className = 'ginko-table__tools'
  toolbar.contentEditable = 'false'
  toolbar.setAttribute('role', 'group')
  toolbar.setAttribute('aria-label', text('tableEditing'))
  const scope = document.createElement('span')
  scope.className = 'ginko-table__scope'
  const viewport = document.createElement('div')
  viewport.className = 'ginko-table__viewport'
  const table = document.createElement('table')
  const contentDOM = document.createElement('tbody')
  table.append(contentDOM)
  viewport.append(table)
  dom.append(toolbar, viewport)
  const rowMenu = inlinePopover(text('rowActions'), 'rows', controller)
  const columnMenu = inlinePopover(text('columnActions'), 'columns', controller)
  const tableMenu = inlinePopover(text('tableOptions'), 'more', controller)
  rowMenu.dom.classList.add('ginko-table__row-handle')
  columnMenu.dom.classList.add('ginko-table__column-handle')
  dom.append(rowMenu.dom, columnMenu.dom)
  const rowHeading = document.createElement('strong')
  const columnHeading = document.createElement('strong')
  const headerHint = document.createElement('p')
  headerHint.className = 'ginko-table__header-hint'
  headerHint.textContent = text('tableHeaderHint')
  rowMenu.panel.append(rowHeading, headerHint)
  columnMenu.panel.append(columnHeading)
  const menus = [rowMenu, columnMenu, tableMenu]
  const competingOverlay = () => !!controller?.active.value && !menus.some((menu) => menu.isOpen())
  const closeMenus = () => menus.forEach((menu) => menu.close())
  const controls: {
    button: HTMLButtonElement
    key: EditorMessageKey
    label?: Text
    operation: () => TableOperation | undefined
  }[] = []
  function selected() {
    const pos = getPos()
    return pos === undefined ? undefined : selectedTableRect(editor.state, pos)
  }
  function action(
    parent: HTMLElement,
    key: EditorMessageKey,
    symbol: IconName,
    operation: () => TableOperation | undefined,
    direct = false,
  ) {
    const button = iconButton(symbol, text(key))
    const label = direct ? undefined : document.createTextNode(text(key))
    if (label) button.append(label)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => {
      const pos = getPos()
      const next = operation()
      if (pos === undefined || !next || !editor.isEditable) return
      closeMenus()
      applyTableOperation(editor, pos, next)
    })
    parent.append(button)
    controls.push({ button, key, label, operation })
    return button
  }
  const alignment = document.createElement('div')
  alignment.className = 'ginko-table__alignment'
  alignment.setAttribute('role', 'group')
  alignment.setAttribute('aria-label', text('columnAlignment'))
  const alignmentButtons = (['left', 'center', 'right'] as const).map((value) =>
    action(
      alignment,
      ({ left: 'alignColumnLeft', center: 'alignColumnCenter', right: 'alignColumnRight' } as const)[value],
      value === 'left' ? 'alignLeft' : value === 'right' ? 'alignRight' : 'alignCenter',
      () => {
        const rect = selected()
        return rect && { type: 'align', from: rect.left, to: rect.right, value }
      },
      true,
    ),
  )
  const add = document.createElement('div')
  add.className = 'ginko-table__add'
  add.setAttribute('role', 'group')
  add.setAttribute('aria-label', text('addToTable'))
  action(add, 'addRow', 'plus', () => {
    const rect = selected()
    return rect && { type: 'add', axis: 'row', index: rect.bottom }
  })
  action(add, 'addColumn', 'plus', () => {
    const rect = selected()
    return rect && { type: 'add', axis: 'column', index: rect.right }
  })
  toolbar.append(scope, alignment, add, tableMenu.dom)
  for (const [axis, menu] of [['row', rowMenu], ['column', columnMenu]] as const) {
    const range = () => {
      const rect = selected()
      return (
        rect && {
          from: axis === 'row' ? rect.top : rect.left,
          to: axis === 'row' ? rect.bottom : rect.right,
        }
      )
    }
    action(
      menu.panel,
      axis === 'row' ? 'addRowAbove' : 'addColumnLeft',
      axis === 'row' ? 'up' : 'plus',
      () => {
        const current = range()
        return current && { type: 'add', axis, index: current.from }
      },
    )
    action(
      menu.panel,
      axis === 'row' ? 'addRowBelow' : 'addColumnRight',
      axis === 'row' ? 'down' : 'plus',
      () => {
        const current = range()
        return current && { type: 'add', axis, index: current.to }
      },
    )
    action(menu.panel, axis === 'row' ? 'moveRowUp' : 'moveColumnLeft', 'up', () => {
      const current = range()
      return current && { type: 'move', axis, ...current, direction: -1 }
    })
    action(menu.panel, axis === 'row' ? 'moveRowDown' : 'moveColumnRight', 'down', () => {
      const current = range()
      return current && { type: 'move', axis, ...current, direction: 1 }
    })
    action(menu.panel, axis === 'row' ? 'duplicateRow' : 'duplicateColumn', 'copy', () => {
      const current = range()
      return current && { type: 'duplicate', axis, ...current }
    })
    action(menu.panel, axis === 'row' ? 'deleteRow' : 'deleteColumn', 'trash', () => {
      const current = range()
      return current && { type: 'delete', axis, ...current }
    }).classList.add('ginko-danger')
  }
  action(rowMenu.panel, 'moveRowToHeader', 'rows', () => {
    const rect = selected()
    return rect && rect.bottom === rect.top + 1 ? { type: 'header', row: rect.top } : undefined
  })
  const deleteTable = iconButton('trash', text('deleteTable'))
  const deleteLabel = document.createTextNode(text('deleteTable'))
  deleteTable.append(deleteLabel)
  deleteTable.classList.add('ginko-danger')
  deleteTable.addEventListener('mousedown', (event) => event.preventDefault())
  deleteTable.addEventListener('click', () => {
    const pos = getPos()
    if (!editor.isEditable || pos === undefined) return
    closeMenus()
    editor.view.dispatch(closeHistory(editor.state.tr).delete(pos, pos + node.nodeSize))
    editor.view.focus()
  })
  tableMenu.panel.append(deleteTable)

  function handleRange(axis: 'row' | 'column') {
    const current = selected()
    const rect = hovered ?? current
    if (!rect) return undefined
    const from = axis === 'row' ? rect.top : rect.left
    const start = current && (axis === 'row' ? current.top : current.left)
    const end = current && (axis === 'row' ? current.bottom : current.right)
    return start !== undefined && end !== undefined && from >= start && from < end
      ? { from: start, to: end }
      : { from, to: from + 1 }
  }
  function targetHandle(axis: 'row' | 'column') {
    const pos = getPos()
    const rect = hovered ?? selected()
    const shape = portableTable(node)
    const range = handleRange(axis)
    if (pos === undefined || !rect || !range || !shape || !editor.isEditable) return
    selectTableRect(
      editor,
      pos,
      axis === 'row'
        ? { left: 0, right: shape.width, top: range.from, bottom: range.to }
        : { left: range.from, right: range.to, top: 0, bottom: shape.height },
    )
  }
  for (const [axis, menu] of [['row', rowMenu], ['column', columnMenu]] as const) {
    menu.toggle.addEventListener('mousedown', (event) => {
      event.preventDefault()
      targetHandle(axis)
    })
    menu.toggle.addEventListener('keydown', (event) => {
      if (['Enter', ' '].includes(event.key)) targetHandle(axis)
    })
    menu.toggle.addEventListener('click', () => targetHandle(axis))
  }
  function move(event: PointerEvent) {
    if (menus.some((menu) => menu.isOpen())) return
    const cell = event.target instanceof Element ? event.target.closest('td, th') : undefined
    if (
      !(cell instanceof HTMLTableCellElement) ||
      !contentDOM.contains(cell) ||
      !(cell.parentElement instanceof HTMLTableRowElement)
    )
      return
    const top = cell.parentElement.rowIndex
    const left = cell.cellIndex
    if (hovered?.top === top && hovered.left === left) return
    hovered = { top, bottom: top + 1, left, right: left + 1 }
    render()
  }
  dom.addEventListener('pointermove', move)
  dom.addEventListener('pointerleave', () => {
    if (!menus.some((menu) => menu.isOpen())) {
      hovered = undefined
      render()
    }
  })
  function placeHandles() {
    if (destroyed) return
    const rect = hovered ?? selected()
    const root = dom.getBoundingClientRect()
    const clip = viewport.getBoundingClientRect()
    columnMenu.dom.hidden = !editor.isEditable || !rect || !portableTable(node) || competingOverlay()
    const row = rect && contentDOM.rows[rect.top]
    const cell = rect && contentDOM.rows[0]?.cells[rect.left]
    if (row) {
      const bounds = row.getBoundingClientRect()
      rowMenu.dom.style.left = `${clip.left - root.left}px`
      rowMenu.dom.style.top = `${bounds.top + bounds.height / 2 - root.top}px`
    }
    if (cell) {
      const bounds = cell.getBoundingClientRect()
      columnMenu.dom.style.left = `${bounds.left + bounds.width / 2 - root.left}px`
      columnMenu.dom.style.top = `${clip.top - root.top}px`
      columnMenu.dom.hidden ||= bounds.right <= clip.left || bounds.left >= clip.right
    }
    menus.forEach((menu) => menu.position())
  }
  const rangeLabel = (axis: 'row' | 'column', start: number, end: number) =>
    end - start > 1
      ? text(axis === 'row' ? 'tableRows' : 'tableColumns', { start: start + 1, end })
      : text(axis === 'row' ? 'tableRow' : 'tableColumn', { number: start + 1 })
  function render() {
    if (destroyed) return
    const rect = selected()
    const target = hovered ?? rect
    const shape = portableTable(node)
    toolbar.setAttribute('aria-label', text('tableEditing'))
    alignment.setAttribute('aria-label', text('columnAlignment'))
    add.setAttribute('aria-label', text('addToTable'))
    tableMenu.setLabel(text('tableOptions'))
    headerHint.textContent = text('tableHeaderHint')
    deleteTable.setAttribute('aria-label', text('deleteTable'))
    deleteTable.title = deleteLabel.data = text('deleteTable')
    controls.forEach(({ button, key, label }) => {
      button.setAttribute('aria-label', text(key))
      button.title = text(key)
      if (label) label.data = text(key)
    })
    const competing = competingOverlay()
    toolbar.hidden = !editor.isEditable || !rect || competing
    rowMenu.dom.hidden = columnMenu.dom.hidden = !editor.isEditable || !target || !shape || competing
    if (toolbar.hidden) tableMenu.close()
    if (!target || !editor.isEditable) closeMenus()
    if (rect) {
      scope.textContent = text('tableScope', {
        rows: rangeLabel('row', rect.top, rect.bottom),
        columns: rangeLabel('column', rect.left, rect.right),
      })
      alignmentButtons.forEach((button, index) => {
        const value = ['left', 'center', 'right'][index]
        const active = shape?.rows.every((row) =>
          row.content.content
            .slice(rect.left, rect.right)
            .every((cell) => (cell.attrs.align ?? 'left') === value),
        )
        button.setAttribute('aria-pressed', String(!!active))
        button.title = text('tableActionScope', {
          action: text(controls.find((control) => control.button === button)!.key),
          scope: rangeLabel('column', rect.left, rect.right),
        })
      })
    }
    if (target) {
      const rows = handleRange('row')!
      const columns = handleRange('column')!
      rowMenu.setLabel(text('tableRangeActions', { range: rangeLabel('row', rows.from, rows.to) }))
      columnMenu.setLabel(text('tableRangeActions', { range: rangeLabel('column', columns.from, columns.to) }))
    }
    rowHeading.textContent = rect ? rangeLabel('row', rect.top, rect.bottom) : text('rowActions')
    columnHeading.textContent = rect ? rangeLabel('column', rect.left, rect.right) : text('columnActions')
    headerHint.hidden = rect?.top !== 0
    controls.forEach(({ button, operation }) => {
      const next = operation()
      button.disabled = !editor.isEditable || !next || !canChangeTable(node, next)
    })
    deleteTable.disabled = !editor.isEditable
    placeHandles()
  }
  const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(placeHandles)
  resize?.observe(viewport)
  resize?.observe(table)
  viewport.addEventListener('scroll', render)
  window.addEventListener('resize', render)
  const selectionChanged = () => {
    hovered = undefined
    render()
  }
  editor.on('selectionUpdate', selectionChanged)
  const stopOverlayWatch = controller && watch(controller.active, render, { flush: 'post' })
  menus.forEach((menu) => menu.onOpenChange(render))
  editor.on('update', render)
  editor.on('transaction', render)
  render()
  return {
    dom,
    contentDOM,
    update(next) {
      if (next.type !== node.type) return false
      if (node !== next) hovered = undefined
      node = next
      render()
      return true
    },
    stopEvent(event) {
      const target = event.target
      return (
        target instanceof globalThis.Node &&
        (toolbar.contains(target) || menus.some((menu) => menu.contains(target)))
      )
    },
    ignoreMutation(mutation) {
      return mutation.type !== 'selection' && !contentDOM.contains(mutation.target)
    },
    destroy() {
      destroyed = true
      stopOverlayWatch?.()
      resize?.disconnect()
      window.removeEventListener('resize', render)
      viewport.removeEventListener('scroll', render)
      editor.off('transaction', render)
      editor.off('update', render)
      editor.off('selectionUpdate', selectionChanged)
      menus.forEach((menu) => menu.destroy())
    },
  }
}
