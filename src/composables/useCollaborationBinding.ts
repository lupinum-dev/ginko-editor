import { onBeforeUnmount, ref, watch } from 'vue'

import type {
  CollaborationStatus,
  EditorCollaborationSession,
} from '../collaboration'
import type { EditorMessageKey } from '../ui/messages'
import { isDevelopment } from '../lib/environment'

const statusMessages = {
  connecting: 'sharedConnecting',
  syncing: 'sharedSyncing',
  synced: 'sharedSynced',
  offline: 'sharedOffline',
  error: 'sharedError',
  stale: 'sharedStale',
  closed: 'sharedClosed',
} as const satisfies Record<CollaborationStatus, EditorMessageKey>

/**
 * Bind one shared session for the lifetime of one mounted editor.
 * The session prop is read once. A different session requires a remount.
 */
export function useCollaborationBinding(
  getSession: () => EditorCollaborationSession | undefined,
) {
  const session = getSession()
  const state = ref(session?.state)
  const invalidBinding = ref(false)
  const stopState = session?.subscribe((next) => { state.value = next })

  function invalidate() {
    invalidBinding.value = true
    session?.close()
  }

  watch(getSession, (value) => {
    if (value === session) return
    if (isDevelopment()) {
      console.warn(
        '[GinkoEditor] The collaboration prop is read only when the editor mounts. '
        + 'Remount the editor with a new key to use another session.',
      )
    }
    invalidate()
  })

  onBeforeUnmount(() => { stopState?.() })

  function downloadRecovery() {
    const recovery = session?.getRecovery()
    if (!recovery) return
    const url = globalThis.URL.createObjectURL(
      new globalThis.Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' }),
    )
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = 'ginko-editor-recovery.json'
    anchor.click()
    // Some browsers start the download after the click task. Keep the URL until then.
    globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 0)
  }

  return {
    session,
    state,
    invalidBinding,
    invalidate,
    canEdit: () => session?.canEdit ?? true,
    pendingSteps: () => state.value?.pendingSteps ?? 0,
    statusMessage: (): EditorMessageKey | undefined =>
      state.value?.status ? statusMessages[state.value.status] : undefined,
    extensions: session ? [session.extension] : [],
    downloadRecovery,
  }
}

export type CollaborationBinding = ReturnType<typeof useCollaborationBinding>
