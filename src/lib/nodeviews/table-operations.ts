import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { Fragment, type Node, type ResolvedPos } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { CellSelection, TableMap, type Rect } from '@tiptap/pm/tables'

export type TableAxis = 'row' | 'column'
export type TableOperation =
  | { type: 'add'; axis: TableAxis; index: number }
  | { type: 'delete'; axis: TableAxis; from: number; to: number }
  | { type: 'duplicate'; axis: TableAxis; from: number; to: number }
  | { type: 'move'; axis: TableAxis; from: number; to: number; direction: -1 | 1 }
  | { type: 'header'; row: number }
  | { type: 'align'; from: number; to: number; value: 'left' | 'center' | 'right' }

/** These controls operate on the same rectangular, first-row-header table that Markdown can store. */
export function portableTable(table: Node) {
  if (table.type.name !== 'table' || !table.childCount) return undefined
  const rows = Array.from({ length: table.childCount }, (_, index) => table.child(index))
  const width = rows[0].childCount
  if (
    !width ||
    rows.some((row, index) =>
      row.childCount !== width ||
      row.content.content.some(
        (cell) =>
          cell.type.name !== (index === 0 ? 'tableHeader' : 'tableCell') ||
          cell.attrs.colspan !== 1 ||
          cell.attrs.rowspan !== 1,
      ),
    )
  )
    return undefined
  return { rows, width, height: rows.length }
}

export function selectedTableRect(state: EditorState, tablePos: number): Rect | undefined {
  const table = state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return undefined
  const map = TableMap.get(table), { selection } = state
  if (selection instanceof CellSelection) {
    if (selection.$anchorCell.node(-1) !== table || selection.$headCell.node(-1) !== table) return undefined
    return map.rectBetween(selection.$anchorCell.pos - tablePos - 1, selection.$headCell.pos - tablePos - 1)
  }
  const cellOffset = ($pos: ResolvedPos) => {
    for (let depth = $pos.depth; depth > 2; depth--) {
      if (!['tableCell', 'tableHeader'].includes($pos.node(depth).type.name)) continue
      if ($pos.before(depth - 2) !== tablePos) return undefined
      return $pos.before(depth) - tablePos - 1
    }
  }
  const first = cellOffset(selection.$from), last = cellOffset(selection.$to)
  return first === undefined || last === undefined ? undefined : map.rectBetween(first, last)
}

function permitted(table: NonNullable<ReturnType<typeof portableTable>>, operation: TableOperation) {
  if (operation.type === 'header')
    return Number.isInteger(operation.row) && operation.row > 0 && operation.row < table.height
  const axis = operation.type === 'align' ? 'column' : operation.axis
  const size = axis === 'row' ? table.height : table.width
  if (operation.type === 'add')
    return (
      Number.isInteger(operation.index) &&
      operation.index >= (axis === 'row' ? 1 : 0) &&
      operation.index <= size
    )
  if (
    !Number.isInteger(operation.from) ||
    !Number.isInteger(operation.to) ||
    operation.from < 0 ||
    operation.to > size ||
    operation.from >= operation.to
  )
    return false
  if (operation.type === 'delete')
    return axis === 'row' ? operation.from > 0 : operation.to - operation.from < size
  if (operation.type === 'move')
    return (
      (axis !== 'row' || operation.from > 0) &&
      operation.from + operation.direction >= (axis === 'row' ? 1 : 0) &&
      operation.to + operation.direction <= size
    )
  return true
}

export function canChangeTable(table: Node, operation: TableOperation) {
  const shape = portableTable(table)
  return !!shape && permitted(shape, operation)
}

/** A structural operation preserves existing node content, marks and cell attributes. */
export function changeTable(table: Node, operation: TableOperation): { table: Node; selection: Rect } | undefined {
  const shape = portableTable(table)
  if (!shape || !permitted(shape, operation)) return undefined
  const { width, height } = shape
  let rows = [...shape.rows]
  let selection: Rect = { left: 0, right: width, top: 0, bottom: height }
  const copyRow = (row: Node, cells: readonly Node[]) => row.copy(Fragment.fromArray(cells))
  const bodyCell = (cell: Node) => table.type.schema.nodes.tableCell.create(cell.attrs, cell.content, cell.marks)
  const emptyCell = (cell: Node, header: boolean) =>
    table.type.schema.nodes[header ? 'tableHeader' : 'tableCell'].create(
      cell.attrs,
      table.type.schema.nodes.paragraph.create(),
    )
  if (operation.type === 'header') {
    rows.unshift(rows.splice(operation.row, 1)[0])
    rows = rows.map((row, index) =>
      copyRow(
        row,
        row.content.content.map((cell) =>
          table.type.schema.nodes[index === 0 ? 'tableHeader' : 'tableCell'].create(
            cell.attrs,
            cell.content,
            cell.marks,
          ),
        ),
      ),
    )
    selection = { left: 0, right: width, top: 0, bottom: 1 }
  } else if (operation.type === 'align') {
    if (
      rows.every((row) =>
        row.content.content
          .slice(operation.from, operation.to)
          .every((cell) => (cell.attrs.align ?? 'left') === operation.value),
      )
    )
      return undefined
    rows = rows.map((row) =>
      copyRow(
        row,
        row.content.content.map((cell, index) =>
          index < operation.from || index >= operation.to
            ? cell
            : cell.type.create({ ...cell.attrs, align: operation.value }, cell.content, cell.marks),
        ),
      ),
    )
    selection = { left: operation.from, right: operation.to, top: 0, bottom: height }
  } else {
    const axis = operation.axis
    const transform = (values: Node[], blank: () => Node) => {
      if (operation.type === 'add') {
        values.splice(operation.index, 0, blank())
        return [operation.index, operation.index + 1]
      }
      const count = operation.to - operation.from
      if (operation.type === 'delete') {
        values.splice(operation.from, count)
        const from = Math.min(operation.from, values.length - 1)
        return [from, from + 1]
      }
      if (operation.type === 'duplicate') {
        const copies = values
          .slice(operation.from, operation.to)
          .map((value) => (axis === 'row' ? copyRow(value, value.content.content.map(bodyCell)) : value))
        values.splice(operation.to, 0, ...copies)
        return [operation.to, operation.to + count]
      }
      const moved = values.splice(operation.from, count)
      values.splice(operation.from + operation.direction, 0, ...moved)
      return [operation.from + operation.direction, operation.to + operation.direction]
    }
    if (axis === 'row') {
      const [top, bottom] = transform(
        rows,
        () => copyRow(rows[0], rows[0].content.content.map((cell) => emptyCell(cell, false))),
      )
      selection = { left: 0, right: width, top, bottom }
    } else {
      rows = rows.map((row, rowIndex) => {
        const cells = [...row.content.content]
        const [left, right] = transform(
          cells,
          () => emptyCell(
            cells[Math.min(operation.type === 'add' ? operation.index : 0, cells.length - 1)],
            rowIndex === 0,
          ),
        )
        selection = { left, right, top: 0, bottom: height }
        return copyRow(row, cells)
      })
    }
  }
  const next = table.copy(Fragment.fromArray(rows))
  return next.eq(table) ? undefined : { table: next, selection }
}

export function selectTableRect(editor: Editor, tablePos: number, rect: Rect) {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return false
  const map = TableMap.get(table)
  if (
    rect.left < 0 ||
    rect.top < 0 ||
    rect.left >= rect.right ||
    rect.top >= rect.bottom ||
    rect.right > map.width ||
    rect.bottom > map.height
  )
    return false
  const from = tablePos + 1 + map.map[rect.top * map.width + rect.left]
  const to = tablePos + 1 + map.map[(rect.bottom - 1) * map.width + rect.right - 1]
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, from, to)))
  return true
}

export function applyTableOperation(editor: Editor, tablePos: number, operation: TableOperation) {
  if (!editor.isEditable) return false
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table) return false
  const result = changeTable(table, operation)
  if (!result) return false
  // Keep the table boundary stable for mapped controls anchored beside it.
  const tr = closeHistory(editor.state.tr).replaceWith(
    tablePos + 1,
    tablePos + table.nodeSize - 1,
    result.table.content,
  )
  const map = TableMap.get(result.table), { selection } = result
  tr.setSelection(
    CellSelection.create(
      tr.doc,
      tablePos + 1 + map.map[selection.top * map.width + selection.left],
      tablePos + 1 + map.map[(selection.bottom - 1) * map.width + selection.right - 1],
    ),
  )
  editor.view.dispatch(tr)
  // Keep subsequent typing separate from a structural replacement of the table.
  editor.view.dispatch(closeHistory(editor.state.tr))
  editor.view.focus()
  return true
}
