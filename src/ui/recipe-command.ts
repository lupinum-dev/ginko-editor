import type { Editor } from '@tiptap/core'
import { Selection, type Transaction } from '@tiptap/pm/state'
import type { AuthoringRecipe } from '../authoring'
import {
  commitEditorTransaction,
  trackEditorOperation,
  type EditorOperationContext,
  type BlockOperationResult,
} from '../lib/editor-operations'
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
export function runRecipeCommand(
  editor: Editor,
  recipe: AuthoringRecipe,
  context: EditorOperationContext,
  replaceRange?: { from: number; to: number },
): Promise<BlockOperationResult> {
  return trackEditorOperation(editor, async () => {
    if (editor.isDestroyed || !editor.isEditable || context.canMutate?.() === false) {
      return { ok: false, reason: 'unavailable' }
    }

    const before = editor.state
    const kit = context.getAuthoringKit?.()
    const output = context.getOutputOptions?.() ?? {}
    const outputKey = JSON.stringify(output)

    let stale = false

    const invalidate = () => {
      stale = true
    }

    const current = () =>
      !stale
      && !editor.isDestroyed
      && editor.isEditable
      && editor.state === before
      && context.canMutate?.() !== false
      && context.getAuthoringKit?.() === kit
      && JSON.stringify(context.getOutputOptions?.() ?? {}) === outputKey

    editor.on('transaction', invalidate)

    try {
      // Only our own recipe objects select native behavior; host IDs are free.
      const command = writingRecipes.includes(recipe) ? nativeCommands[recipe.id] : undefined

      let transaction: Transaction | undefined

      if (command) {
        transaction = buildEditorCommandTransaction(editor, command, replaceRange)
      }
      else {
        const prepared = await prepareMarkdownForVisualEditing(
          recipe.source,
          output,
          editor.schema,
          kit,
          'fragment',
        )

        if (!current()) return { ok: false, reason: 'stale' }
        if (!prepared.ok || !prepared.value) return { ok: false, reason: 'invalid-content' }

        const insertAt = replaceRange?.from ?? editor.state.selection.from
        const accepted = editor.chain().command(({ tr }) => {
          tr.setMeta('preventDispatch', true)
          if (replaceRange) tr.delete(replaceRange.from, replaceRange.to)
          transaction = tr
          return true
        }).insertContent(prepared.value.content ?? []).command(({ tr }) => {
          // Continue writing in the first text of the new block, as in its first tab or item.
          const start = Selection.findFrom(tr.doc.resolve(Math.min(insertAt, tr.doc.content.size)), 1, true)
          if (start) tr.setSelection(start)
          return true
        }).run()

        if (!accepted) return { ok: false, reason: 'unavailable' }

        transaction?.setMeta('preventDispatch', false)
      }

      if (!current()) return { ok: false, reason: 'stale' }
      if (!transaction) return { ok: false, reason: 'unavailable' }

      return await commitEditorTransaction(editor, transaction, { ...context, canMutate: current })
    }
    catch {
      return { ok: false, reason: current() ? 'invalid-content' : 'stale' }
    }
    finally {
      editor.off('transaction', invalidate)
    }
  })
}
