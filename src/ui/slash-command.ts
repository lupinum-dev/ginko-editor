import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'

export interface SlashRange { from: number; to: number; query: string }
interface SlashState { active?: SlashRange; dismissed?: number }
export const slashKey = new PluginKey<SlashState>('ginkoSlash')

function matchSlash(state: EditorState): SlashRange | undefined {
  const { selection } = state
  if (!selection.empty || selection.$from.parent.type.name !== 'paragraph') return
  if (selection.$from.marks().some(mark => ['code', 'link'].includes(mark.type.name))) return
  const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\ufffc', '\ufffc')
  const match = /(?:^|\s)\/([^\s/]{0,80})$/u.exec(before)
  if (!match) return
  const query = match[1]!
  return { from: selection.from - query.length - 1, to: selection.from, query }
}

/** Slash text belongs to the document. Only its menu state is ephemeral. */
export const SlashCommands = Extension.create<{ enabled: () => boolean }>({
  name: 'ginkoSlash',
  addOptions() { return { enabled: () => true } },
  addProseMirrorPlugins() {
    const enabled = this.options.enabled
    return [new Plugin<SlashState>({
      key: slashKey,
      state: {
        init: () => ({}),
        apply(tr, previous, oldState, state) {
          if (!enabled()) return {}
          const match = matchSlash(state)
          if (!match) return {}
          if (tr.getMeta(slashKey) === 'dismiss') return { dismissed: match.from }
          const dismissed = previous.dismissed === undefined
            ? undefined
            : tr.mapping.mapResult(previous.dismissed, 1)
          if (dismissed && !dismissed.deleted && dismissed.pos === match.from) {
            return { dismissed: match.from }
          }
          if (previous.active) {
            const start = tr.mapping.mapResult(previous.active.from, 1)
            if (start.deleted || start.pos !== match.from) return {}
            if (tr.selectionSet && !tr.docChanged && match.to !== previous.active.to) return {}
            return { active: match }
          }
          // Moving the caret into old source must not open a command menu.
          if (!tr.docChanged || tr.getMeta('rebased') !== undefined) return {}
          const oldMatch = matchSlash(oldState)
          if (oldMatch && oldMatch.query === match.query && tr.mapping.map(oldMatch.from, 1) === match.from) return {}
          return { active: match }
        },
      },
    })]
  },
})
