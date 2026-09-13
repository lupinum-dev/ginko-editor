import type { NodeViewRendererProps } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { TableMap } from '@tiptap/pm/tables'
import type { NodeView } from '@tiptap/pm/view'
import { icon, iconButton, type IconName } from './icons'
import { inlinePopover } from './popover'

export function tableView({ node: initial, editor, getPos }: NodeViewRendererProps): NodeView {
  let node = initial
  const dom = document.createElement('div'); dom.className = 'ginko-table'
  const toolbar = document.createElement('div'); toolbar.className = 'ginko-table__tools'; toolbar.contentEditable = 'false'
  toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Table editing')
  const viewport = document.createElement('div'); viewport.className = 'ginko-table__viewport'
  const table = document.createElement('table'), contentDOM = document.createElement('tbody')
  table.append(contentDOM); viewport.append(table); dom.append(toolbar, viewport)
  const rowMenu = inlinePopover('Row actions', 'rows'), columnMenu = inlinePopover('Column actions', 'columns'), tableMenu = inlinePopover('Table options', 'more')
  toolbar.append(rowMenu.dom, columnMenu.dom, tableMenu.dom)
  const menus = [rowMenu, columnMenu, tableMenu]
  const closeMenus = () => menus.forEach(menu => menu.close())
  function action(menu: typeof rowMenu, label: string, symbol: IconName, run: () => void) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', label)
    button.append(icon(symbol), document.createTextNode(label)); button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', () => { if (editor.isEditable) { closeMenus(); editor.view.dispatch(closeHistory(editor.state.tr)); run() } })
    menu.panel.append(button); return button
  }
  const rowAbove = action(rowMenu, 'Add row above', 'up', () => { editor.chain().focus().addRowBefore().run() })
  action(rowMenu, 'Add row below', 'down', () => { editor.chain().focus().addRowAfter().run() })
  const deleteRow = action(rowMenu, 'Delete row', 'trash', () => { editor.chain().focus().deleteRow().run() })
  action(columnMenu, 'Add column left', 'plus', () => { editor.chain().focus().addColumnBefore().run() })
  action(columnMenu, 'Add column right', 'plus', () => { editor.chain().focus().addColumnAfter().run() })
  const deleteColumn = action(columnMenu, 'Delete column', 'trash', () => { editor.chain().focus().deleteColumn().run() })
  action(tableMenu, 'Delete table', 'trash', () => { editor.chain().focus().deleteTable().run() }).className = 'ginko-danger'
  function selectedCell() {
    const pos = getPos()
    if (pos === undefined) return undefined
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 2; depth--) {
      if (['tableCell', 'tableHeader'].includes($from.node(depth).type.name)) {
        if ($from.before(depth - 2) !== pos) return undefined
        return TableMap.get(node).findCell($from.before(depth) - pos - 1)
      }
    }
    return undefined
  }
  const headerButton = action(rowMenu, 'Use selected row as header', 'rows', () => {
    const cell = selectedCell(), pos = getPos()
    if (!cell || cell.top === 0 || pos === undefined) return
    const rows = Array.from({ length: node.childCount }, (_, index) => node.child(index))
    rows.unshift(rows.splice(cell.top, 1)[0])
    const normalized = rows.map((row, index) => row.type.create(row.attrs, row.content.content.map(item => editor.schema.nodes[index === 0 ? 'tableHeader' : 'tableCell'].create(item.attrs, item.content))))
    editor.view.dispatch(closeHistory(editor.state.tr).replaceWith(pos, pos + node.nodeSize, node.type.create(node.attrs, normalized))); editor.view.focus()
  })
  const alignment = document.createElement('div'); alignment.className = 'ginko-table__alignment'; alignment.setAttribute('role', 'group'); alignment.setAttribute('aria-label', 'Column alignment')
  const alignmentButtons = (['left', 'center', 'right'] as const).map(value => {
    const button = iconButton(value === 'left' ? 'alignLeft' : value === 'right' ? 'alignRight' : 'alignCenter', `Align column ${value}`)
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', () => {
      const pos = getPos(), cell = selectedCell()
      if (!editor.isEditable || pos === undefined || !cell) return
      const map = TableMap.get(node), tr = closeHistory(editor.state.tr)
      for (const offset of map.cellsInRect({ left: cell.left, right: cell.left + 1, top: 0, bottom: map.height })) {
        const item = node.nodeAt(offset)
        if (item) tr.setNodeMarkup(pos + 1 + offset, undefined, { ...item.attrs, align: value })
      }
      editor.view.dispatch(tr)
    })
    alignment.append(button); return button
  })
  columnMenu.panel.append(alignment)
  function render() {
    const cell = selectedCell()
    toolbar.hidden = !editor.isEditable || !cell
    if (toolbar.hidden) closeMenus()
    if (cell) {
      const map = TableMap.get(node), header = node.nodeAt(map.map[cell.left]), currentAlignment = header?.attrs.align ?? 'left'
      rowAbove.disabled = headerButton.disabled = cell.top === 0
      deleteRow.disabled = map.height <= 1 || cell.top === 0
      deleteColumn.disabled = map.width <= 1
      alignmentButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(['left', 'center', 'right'][index] === currentAlignment)))
    }
  }
  editor.on('update', render); editor.on('transaction', render); render()
  return { dom, contentDOM,
    update(next) { if (next.type !== node.type) return false; node = next; render(); return true },
    stopEvent(event) { return event.target instanceof globalThis.Node && toolbar.contains(event.target) },
    ignoreMutation(mutation) { return mutation.type !== 'selection' && !contentDOM.contains(mutation.target) },
    destroy() { editor.off('transaction', render); editor.off('update', render); menus.forEach(menu => menu.destroy()) },
  }
}
