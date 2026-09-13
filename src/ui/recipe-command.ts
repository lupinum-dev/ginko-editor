import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import type { AuthoringRecipeV1 } from '../authoring'
import { commitEditorTransaction, trackEditorOperation, type BlockMovementContext, type BlockOperationResult } from '../lib/block-movement'
import { prepareMarkdownForVisualEditing } from '../lib/conversionPipeline'
import { buildEditorCommandTransaction, type EditorCommand } from './commands'
import { writingRecipes } from './writingRecipes'

const nativeCommands: Record<string, EditorCommand> = {
  'ginko.heading-1': { kind: 'heading', level: 1 },
  'ginko.heading-2': { kind: 'heading', level: 2 },
  'ginko.heading-3': { kind: 'heading', level: 3 },
  'ginko.bullets': { kind: 'bulletList' },
  'ginko.numbered': { kind: 'orderedList' },
  'ginko.quote': { kind: 'blockquote' },
  'ginko.code': { kind: 'codeBlock' },
  'ginko.divider': { kind: 'divider' },
  'ginko.table': { kind: 'table', rows: 3, columns: 3 },
}

/** Slash insertion shares toolbar commands and Content's final-document gate. */
export function runRecipeCommand(editor: Editor, recipe: AuthoringRecipeV1, context: BlockMovementContext): Promise<BlockOperationResult> {
  return trackEditorOperation(editor, async () => {
    if (editor.isDestroyed || !editor.isEditable || context.canMutate?.() === false) return { ok: false, reason: 'unavailable' }
    const before = editor.state, kit = context.getAuthoringKit?.(), output = context.getOutputOptions?.() ?? {}, outputKey = JSON.stringify(output)
    let stale = false
    const invalidate = () => { stale = true }
    const current = () => !stale && !editor.isDestroyed && editor.isEditable && editor.state === before && context.canMutate?.() !== false
      && context.getAuthoringKit?.() === kit && JSON.stringify(context.getOutputOptions?.() ?? {}) === outputKey
    editor.on('transaction', invalidate)
    try {
      // Only our own recipe objects select native behavior; host IDs are free.
      const command = writingRecipes.includes(recipe) ? nativeCommands[recipe.id] : undefined
      let transaction: Transaction | undefined
      if (command) transaction = buildEditorCommandTransaction(editor, command)
      else {
        const prepared = await prepareMarkdownForVisualEditing(recipe.source, output, editor.schema, kit, 'fragment')
        if (!current()) return { ok: false, reason: 'stale' }
        if (!prepared.ok || !prepared.value) return { ok: false, reason: 'invalid-content' }
        const accepted = editor.chain().command(({ tr }) => { tr.setMeta('preventDispatch', true); transaction = tr; return true })
          .insertContent(prepared.value.content ?? []).run()
        if (!accepted) return { ok: false, reason: 'unavailable' }
        transaction?.setMeta('preventDispatch', false)
      }
      if (!current()) return { ok: false, reason: 'stale' }
      if (!transaction) return { ok: false, reason: 'unavailable' }
      return await commitEditorTransaction(editor, transaction, { ...context, canMutate: current })
    } catch {
      return { ok: false, reason: current() ? 'invalid-content' : 'stale' }
    } finally { editor.off('transaction', invalidate) }
  })
}
