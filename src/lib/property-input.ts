import type { Editor } from '@tiptap/core'
import { SetNodePropertyStep } from './property-step'
import type { JsonValue } from '../types'

// ProseMirror history reserves -1 for its initial composition state.
let composition = -1

/** Property controls live outside ProseMirror's editable DOM. Reuse its input
 * grouping metadata with negative IDs, separate from native composition IDs.
 * Empty position maps must stay empty so remote edits do not lose their target.
 */
export function createPropertyInput(editor: Editor) {
  let last: { pos: number; key: string; time: number; composition: number } | undefined
  return {
    reset() { last = undefined },
    transaction(pos: number, key: string, value: JsonValue | undefined) {
      const time = Date.now()
      const sameBurst = last?.pos === pos && last.key === key && time - last.time <= 500
      const id = sameBurst ? last!.composition : --composition
      last = { pos, key, time, composition: id }
      return editor.state.tr.step(new SetNodePropertyStep(pos, key, value)).setMeta('composition', id)
    },
  }
}
