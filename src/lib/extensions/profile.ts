import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'

import {
  countProfileViolations,
  editorProfiles,
  isRestrictedProfile,
  profileExemptMeta,
  sanitizeSlice,
  type EditorProfile,
} from '../profiles'

/** prosemirror-history marks undo and redo with this key. Undo may restore loaded content. */
const historyMeta = 'history$'

const profileKey = new PluginKey('ginkoProfile')

function isExempt(transaction: Transaction) {
  return !transaction.docChanged
    || transaction.getMeta(profileExemptMeta) === true
    || transaction.getMeta(historyMeta) !== undefined
}

/**
 * Enforce a content profile. Paste and drop are reduced to the allowed set.
 * As a last line of defense, a writer's transaction can never add a node or
 * mark that the profile does not allow. Toolbar, slash menu, and input rules
 * are limited separately so that this guard normally never has to reject.
 */
export const ProfileGuard = Extension.create<{ profile: EditorProfile }>({
  name: 'ginkoProfile',
  addOptions() { return { profile: editorProfiles.full } },
  addProseMirrorPlugins() {
    const profile = this.options.profile
    if (!isRestrictedProfile(profile)) return []
    return [new Plugin({
      key: profileKey,
      filterTransaction(transaction, state) {
        if (isExempt(transaction)) return true
        return countProfileViolations(transaction.doc, profile) <= countProfileViolations(state.doc, profile)
      },
      props: {
        transformPasted: (slice, view) => sanitizeSlice(slice, view.state.schema, profile),
      },
    })]
  },
})
