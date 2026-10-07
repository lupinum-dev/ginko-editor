import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface LocalDraftOptions {
  key: string
  initialValue: string
  isBlocked?: () => boolean
}

export function useLocalDraft(options: LocalDraftOptions) {
  const source = ref(options.initialValue)
  const ready = ref(false)
  const draftStatus = ref('Only in this browser')

  let saveTimer: ReturnType<typeof globalThis.setTimeout> | undefined

  function save() {
    if (!ready.value) {
      return
    }

    try {
      globalThis.localStorage.setItem(options.key, source.value)
      draftStatus.value = 'Saved in this browser'
    }
    catch {
      draftStatus.value = 'Could not save locally. Copy your Markdown to keep it.'
    }
  }

  function restore() {
    try {
      const saved = globalThis.localStorage.getItem(options.key)

      if (saved !== null) {
        source.value = saved
        draftStatus.value = 'Local draft restored'
      }
    }
    catch {
      draftStatus.value = 'Browser storage unavailable'
    }

    ready.value = true
  }

  function scheduleSave() {
    draftStatus.value = 'Saving locally…'

    globalThis.clearTimeout(saveTimer)
    saveTimer = globalThis.setTimeout(save, 500)
  }

  function handlePageHide() {
    if (options.isBlocked?.()) {
      return
    }

    save()
  }

  watch(source, () => {
    if (ready.value) {
      scheduleSave()
    }
  })

  onMounted(() => {
    globalThis.addEventListener('pagehide', handlePageHide)
  })

  onBeforeUnmount(() => {
    globalThis.clearTimeout(saveTimer)

    if (!options.isBlocked?.()) {
      save()
    }

    globalThis.removeEventListener('pagehide', handlePageHide)
  })

  return {
    source,
    ready,
    draftStatus,
    save,
    restore,
  }
}
