// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TableMap } from '@tiptap/pm/tables'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyTableOperation, canChangeTable, changeTable, selectedTableRect, selectTableRect, type TableOperation } from '../src/lib/nodeviews/table-operations'
import { tableView } from '../src/lib/nodeviews/table'
import { inlinePopover } from '../src/lib/nodeviews/popover'
import { createEditorOverlayController, type EditorOverlayController } from '../src/ui/context'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren() })
function setup(overlay?: EditorOverlayController) {
  const element = document.createElement('div'); element.className = 'ginko-editor'; document.body.append(element)
  const editor = new Editor({ element, extensions: [StarterKit, Table.extend({ addNodeView() { return props => tableView(props, overlay) } }), TableRow, TableHeader.extend({ content: 'paragraph+' }), TableCell.extend({ content: 'paragraph+' })], content: {
    type: 'doc', content: [{ type: 'table', content: [['Name', 'Value', 'Source'], ['Apple', '10', 'First'], ['Pear', '20', 'Second'], ['Plum', '30', 'Third']].map((values, row) => ({ type: 'tableRow', content: values.map((text, column) => ({ type: row === 0 ? 'tableHeader' : 'tableCell', attrs: { align: column === 1 ? 'right' : null }, content: [{ type: 'paragraph', content: [{ type: 'text', text, ...(text === 'Apple' ? { marks: [{ type: 'bold' }] } : {}) }] }] })) })) }],
  } })
  editor.view.dispatch(editor.state.tr)
  editors.push(editor); return editor
}
const rows = (editor: Editor) => editor.state.doc.firstChild!.content.content.map(row => row.content.content.map(cell => cell.textContent))
function textCell(editor: Editor, row: number, column: number) {
  const table = editor.state.doc.firstChild!, map = TableMap.get(table)
  editor.commands.setTextSelection(1 + map.map[row * map.width + column] + 2)
}
function click(editor: Editor, label: string) {
  const button = editor.view.dom.parentElement!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(button, label).not.toBeNull(); button!.click()
}

describe('portable table operations', () => {
  it('hides table controls for a competing node popover while keeping its own menus visible', async () => {
    const overlay = createEditorOverlayController(), editor = setup(overlay)
    textCell(editor, 1, 0); await flushPromises()
    const root = editor.view.dom.parentElement!
    const toolbar = root.querySelector<HTMLDivElement>('.ginko-table__tools')!
    const row = root.querySelector<HTMLDivElement>('.ginko-table__row-handle')!
    const column = root.querySelector<HTMLDivElement>('.ginko-table__column-handle')!
    const viewport = root.querySelector<HTMLDivElement>('.ginko-table__viewport')!
    viewport.getBoundingClientRect = () => new DOMRect(0, 0, 600, 300)
    root.querySelector('th')!.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40)
    viewport.dispatchEvent(new Event('scroll'))
    expect(toolbar.hidden).toBe(false); expect(row.hidden).toBe(false); expect(column.hidden).toBe(false)
    const selected = editor.state.selection
    const settings = inlinePopover('Note settings', 'settings', overlay)
    settings.panel.append(document.createElement('input')); root.append(settings.dom)
    try {
      settings.toggle.click(); await flushPromises()
      expect(settings.isOpen()).toBe(true)
      expect(editor.state.selection.eq(selected)).toBe(true)
      expect(toolbar.hidden).toBe(true); expect(row.hidden).toBe(true); expect(column.hidden).toBe(true)
      viewport.dispatchEvent(new Event('scroll'))
      expect(column.hidden).toBe(true)
      settings.close(); await flushPromises()
      expect(toolbar.hidden).toBe(false); expect(row.hidden).toBe(false); expect(column.hidden).toBe(false)
      row.querySelector<HTMLButtonElement>('button')!.click(); await flushPromises()
      expect(row.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
      expect(toolbar.hidden).toBe(false); expect(row.hidden).toBe(false)
      settings.toggle.click(); await flushPromises()
      expect(row.querySelector('button')!.getAttribute('aria-expanded')).toBe('false')
      expect(toolbar.hidden).toBe(true)
    } finally { settings.destroy(); overlay.destroy() }
  })
  it.each([
    [{ type: 'move', axis: 'row', from: 1, to: 2, direction: 1 }, ['Name', 'Pear', 'Apple', 'Plum']],
    [{ type: 'duplicate', axis: 'row', from: 1, to: 3 }, ['Name', 'Apple', 'Pear', 'Apple', 'Pear', 'Plum']],
    [{ type: 'header', row: 2 }, ['Pear', 'Name', 'Apple', 'Plum']],
    [{ type: 'delete', axis: 'row', from: 1, to: 3 }, ['Name', 'Plum']],
  ] satisfies [TableOperation, string[]][])('preserves row content and restores the full document in one Undo for %j', (operation, expected) => {
    const editor = setup(), before = editor.state.doc
    expect(applyTableOperation(editor, 0, operation)).toBe(true)
    expect(rows(editor).map(row => row[0])).toEqual(expected)
    const table = editor.state.doc.firstChild!
    expect(table.child(0).content.content.every(cell => cell.type.name === 'tableHeader')).toBe(true)
    expect(table.content.content.slice(1).every(row => row.content.content.every(cell => cell.type.name === 'tableCell'))).toBe(true)
    editor.commands.undo(); expect(editor.state.doc.eq(before)).toBe(true)
  })

  it('duplicates the header as a body row and preserves rich cell content', () => {
    const editor = setup()
    expect(applyTableOperation(editor, 0, { type: 'duplicate', axis: 'row', from: 0, to: 1 })).toBe(true)
    expect(rows(editor)[1]).toEqual(['Name', 'Value', 'Source'])
    expect(editor.state.doc.firstChild!.child(1).firstChild!.type.name).toBe('tableCell')
    const apple = editor.state.doc.firstChild!.child(2).firstChild!.firstChild!.firstChild!
    expect(apple.marks[0].type.name).toBe('bold')
  })

  it('moves and duplicates whole columns including their header and alignment', () => {
    const editor = setup(), before = editor.state.doc
    expect(applyTableOperation(editor, 0, { type: 'move', axis: 'column', from: 1, to: 2, direction: 1 })).toBe(true)
    expect(rows(editor)).toEqual([['Name', 'Source', 'Value'], ['Apple', 'First', '10'], ['Pear', 'Second', '20'], ['Plum', 'Third', '30']])
    expect(editor.state.doc.firstChild!.content.content.every(row => row.child(2).attrs.align === 'right')).toBe(true)
    expect(applyTableOperation(editor, 0, { type: 'duplicate', axis: 'column', from: 2, to: 3 })).toBe(true)
    expect(rows(editor)[1]).toEqual(['Apple', 'First', '10', '10'])
    editor.commands.undo(); expect(rows(editor)[1]).toEqual(['Apple', 'First', '10'])
    editor.commands.undo(); expect(editor.state.doc.eq(before)).toBe(true)
  })

  it('does not merge subsequent typing into the structural undo step', () => {
    const editor = setup(), before = editor.state.doc
    applyTableOperation(editor, 0, { type: 'duplicate', axis: 'row', from: 1, to: 2 })
    const duplicated = editor.state.doc
    textCell(editor, 2, 0); editor.commands.insertContent('Fresh ')
    editor.commands.undo(); expect(editor.state.doc.eq(duplicated)).toBe(true)
    editor.commands.undo(); expect(editor.state.doc.eq(before)).toBe(true)
  })

  it('preserves mapped controls anchored after the table while rows change', () => {
    const editor = setup()
    let anchors = DecorationSet.create(editor.state.doc, [Decoration.widget(editor.state.doc.firstChild!.nodeSize, () => document.createElement('span'), { side: -1 })])
    editor.on('transaction', ({ transaction }) => { anchors = anchors.map(transaction.mapping, transaction.doc) })
    applyTableOperation(editor, 0, { type: 'duplicate', axis: 'row', from: 1, to: 2 })
    expect(anchors.find().map(anchor => anchor.from)).toEqual([editor.state.doc.firstChild!.nodeSize])
  })

  it('keeps a header and at least one column and rejects unsupported merged cells', () => {
    const editor = setup(), table = editor.state.doc.firstChild!
    for (const operation of [
      { type: 'delete', axis: 'row', from: 0, to: 1 },
      { type: 'move', axis: 'row', from: 1, to: 2, direction: -1 },
      { type: 'move', axis: 'row', from: 0, to: 1, direction: 1 },
      { type: 'add', axis: 'row', index: 0 },
      { type: 'delete', axis: 'column', from: 0, to: 3 },
      { type: 'header', row: 0 },
    ] satisfies TableOperation[]) {
      expect(canChangeTable(table, operation)).toBe(false)
      expect(changeTable(table, operation)).toBeUndefined()
    }
    editor.view.dispatch(editor.state.tr.setNodeMarkup(2, undefined, { ...table.firstChild!.firstChild!.attrs, colspan: 2 }))
    expect(changeTable(editor.state.doc.firstChild!, { type: 'add', axis: 'row', index: 1 })).toBeUndefined()
  })

  it('aligns all selected columns and leaves the unselected column intact', () => {
    const editor = setup()
    expect(changeTable(editor.state.doc.firstChild!, { type: 'align', from: 0, to: 1, value: 'left' })).toBeUndefined()
    selectTableRect(editor, 0, { top: 1, bottom: 3, left: 1, right: 3 })
    expect(selectedTableRect(editor.state, 0)).toEqual({ top: 1, bottom: 3, left: 1, right: 3 })
    applyTableOperation(editor, 0, { type: 'align', from: 1, to: 3, value: 'center' })
    expect(editor.state.doc.firstChild!.content.content.every(row => row.child(0).attrs.align === null && row.child(1).attrs.align === 'center' && row.child(2).attrs.align === 'center')).toBe(true)
    expect(changeTable(editor.state.doc.firstChild!, { type: 'align', from: 1, to: 3, value: 'center' })).toBeUndefined()
  })

  it('shows direct actions with the current scope and targets a row handle at its actual hovered row', async () => {
    const editor = setup(); textCell(editor, 1, 1)
    expect(editor.view.dom.querySelector('.ginko-table__scope')?.textContent).toBe('Row 2 · Column 2')
    expect(editor.view.dom.querySelector('.ginko-table__tools [aria-label="Align column center"]')).not.toBeNull()
    click(editor, 'Add row'); expect(rows(editor)).toHaveLength(5)
    const cell = editor.view.dom.querySelectorAll('tr')[3].querySelector('td')!
    cell.dispatchEvent(new MouseEvent('pointermove', { bubbles: true })); await flushPromises()
    const handle = editor.view.dom.querySelector<HTMLElement>('.ginko-table__row-handle > :first-child')!
    expect(handle.getAttribute('aria-label')).toBe('Row 4 actions')
    handle.click(); await flushPromises()
    expect(selectedTableRect(editor.state, 0)).toEqual({ top: 3, bottom: 4, left: 0, right: 3 })
    click(editor, 'Duplicate row'); expect(rows(editor)[4]).toEqual(rows(editor)[3])
  })

  it('retains a selected row range when opening its handle', async () => {
    const editor = setup()
    selectTableRect(editor, 0, { top: 1, bottom: 3, left: 0, right: 3 }); await flushPromises()
    const handle = editor.view.dom.querySelector<HTMLElement>('.ginko-table__row-handle > :first-child')!
    expect(handle.getAttribute('aria-label')).toBe('Rows 2–3 actions')
    handle.click(); await flushPromises()
    expect(selectedTableRect(editor.state, 0)).toEqual({ top: 1, bottom: 3, left: 0, right: 3 })
    click(editor, 'Duplicate row')
    expect(rows(editor).map(row => row[0])).toEqual(['Name', 'Apple', 'Pear', 'Apple', 'Pear', 'Plum'])
  })
})
