import type { Editor, JSONContent } from '@tiptap/core'
import { onBeforeUnmount, onMounted, ref, watch, type Ref, type ShallowRef } from 'vue'

import type { AuthoringKit } from '../authoring'
import type { ConversionErrorPayload, ConversionRecoveredPayload, ConversionResult } from '../lib/conversionPipeline'
import {
  applyTiptapDocToEditor,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
  validateMarkdownForAuthoring,
} from '../lib/conversionPipeline'
import { toConversionErrorPayload } from '../lib/conversionState'
import { waitForEditorOperations } from '../lib/editor-operations'
import type { TiptapToMDCOptions } from '../lib/tiptapToMdc'
import type { EditorFlushResult, EditorFlushStateErrorCode } from '../types'
import type { EditorText } from '../ui/messages'
import type { CollaborationBinding } from './useCollaborationBinding'
import type { StableAuthoringKit } from './useStableAuthoringKit'

export type EditorViewMode = 'raw' | 'visual'

export interface MarkdownSyncOptions {
  editor: ShallowRef<Editor | undefined>
  binding: CollaborationBinding
  authoring: StableAuthoringKit
  getModelValue: () => string
  getDebounceMs: () => number
  getOutputOptions: () => TiptapToMDCOptions
  text: EditorText
  pendingImages: Ref<number>
  pendingCommands: Ref<number>
  emitSource: (value: string) => void
  emitError: (payload: ConversionErrorPayload) => void
  emitRecovered: (payload: ConversionRecoveredPayload) => void
  /** Show why a flush cannot finish while an image operation is open. */
  onImagesPending: (message: string) => void
  /** Discard transient visual state before another document replaces it. */
  beforeLoad: () => void
  /** Close visual-only UI before the Markdown source replaces the canvas. */
  beforeSource: () => void
}

/**
 * Own the Markdown value, its conversion to and from the canvas, and mode changes.
 * Markdown stays canonical: the canvas only emits a value after a validated conversion.
 */
export function useMarkdownSync(options: MarkdownSyncOptions) {
  const { editor, binding, authoring } = options
  const session = binding.session
  const viewMode = ref<EditorViewMode>(session ? 'visual' : 'raw')
  const rawContent = ref(options.getModelValue())
  const conversionError = ref<ConversionErrorPayload | null>(null)
  const hasPendingVisualChanges = ref(false)
  /** False until the first source has been converted, or has failed to convert. */
  const loaded = ref(false)
  let pendingEcho: string | undefined
  let revision = 0
  let syncTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  let pendingVisualUpdate: Promise<EditorFlushResult> | undefined
  let disposed = false
  let applyingDocument = false

  function stateError(code: EditorFlushStateErrorCode, message: string): EditorFlushResult {
    return { ok: false, error: { code, message } }
  }

  function cancelPendingUpdate() {
    revision += 1
    if (syncTimer) globalThis.clearTimeout(syncTimer)
    syncTimer = undefined
    hasPendingVisualChanges.value = false
  }

  function emitSource(value: string) {
    pendingEcho = value
    options.emitSource(value)
  }

  /** Only the latest emitted value is a normal v-model echo. */
  function consumeEcho(value: string) {
    if (value !== pendingEcho) return false
    pendingEcho = undefined
    return true
  }

  function reportFailure(result: ConversionResult<unknown>) {
    const payload = toConversionErrorPayload(result, {
      fallbackCode: 'source_only_required',
      fallbackMessage: options.text('sourceOnlyRequired'),
      fallbackPhase: 'validate',
      recoverable: true,
    })
    conversionError.value = payload
    options.emitError(payload)
    return payload
  }

  function clearFailure(traceId: string) {
    if (!conversionError.value) return
    conversionError.value = null
    options.emitRecovered({ fromStatus: 'failed', toStatus: 'ok', traceId })
  }

  async function loadSource(value: string, load: { initial?: boolean; switchToVisual?: boolean } = {}) {
    if (session || binding.invalidBinding.value) return false
    options.beforeLoad()
    cancelPendingUpdate()
    const currentRevision = revision
    rawContent.value = value
    const result = await prepareMarkdownForVisualEditing(
      value,
      options.getOutputOptions(),
      editor.value?.schema,
      authoring.kit.value,
    )
    if (disposed || currentRevision !== revision || !editor.value) return false
    if (!result.ok || !result.value) {
      reportFailure(result)
      viewMode.value = 'raw'
      return false
    }

    applyingDocument = true
    const applied = applyTiptapDocToEditor(editor.value, result.value)
    applyingDocument = false
    if (!applied.ok) {
      reportFailure(applied)
      viewMode.value = 'raw'
      return false
    }
    clearFailure(result.traceId)
    if (load.initial || load.switchToVisual) viewMode.value = 'visual'
    return true
  }

  function scheduleVisualUpdate(instance: Editor) {
    if (syncTimer) globalThis.clearTimeout(syncTimer)
    revision += 1
    hasPendingVisualChanges.value = true
    const currentRevision = revision
    syncTimer = globalThis.setTimeout(() => {
      syncTimer = undefined
      pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision, authoring.kit.value)
      void pendingVisualUpdate.finally(() => {
        if (currentRevision === revision) pendingVisualUpdate = undefined
      })
    }, options.getDebounceMs())
  }

  async function emitVisualDocument(
    document: JSONContent,
    currentRevision: number,
    authoringKit: AuthoringKit | undefined,
  ): Promise<EditorFlushResult> {
    const result = await convertTiptapDocToMarkdown(document, options.getOutputOptions())
    if (disposed || currentRevision !== revision || !result.ok || result.value === undefined) {
      if (!result.ok && currentRevision === revision) {
        return { error: reportFailure(result), ok: false }
      }
      return { emitted: false, ok: true }
    }
    if (authoringKit) {
      const issue = await validateMarkdownForAuthoring(result.value, authoringKit)
      if (disposed || currentRevision !== revision) return { emitted: false, ok: true }
      if (issue) {
        const rejected = { ...result, issues: [...result.issues, issue], ok: false as const }
        return { error: reportFailure(rejected), ok: false }
      }
    }
    if (disposed || currentRevision !== revision) return { emitted: false, ok: true }
    rawContent.value = result.value
    emitSource(result.value)
    hasPendingVisualChanges.value = false
    clearFailure(result.traceId)
    return { emitted: true, ok: true }
  }

  async function flushLocal(): Promise<EditorFlushResult> {
    const currentEditor = editor.value
    if (currentEditor) await waitForEditorOperations(currentEditor)
    if (viewMode.value === 'raw' && !session) return { emitted: false, ok: true }
    if (!editor.value) return stateError('not_ready', options.text('editorNotReady'))
    if (options.pendingImages.value) {
      const message = options.text('finishImageUpload')
      options.onImagesPending(message)
      return stateError('image_upload_pending', message)
    }

    let emitted = false
    while (hasPendingVisualChanges.value) {
      if (conversionError.value && !syncTimer && !pendingVisualUpdate) {
        return { error: conversionError.value, ok: false }
      }
      const inFlight = pendingVisualUpdate
      if (inFlight) {
        const inFlightRevision = revision
        const result = await inFlight
        if (!result.ok) return result
        emitted ||= result.emitted
        if (inFlightRevision !== revision) continue
        if (!hasPendingVisualChanges.value) break
      }

      const instance = editor.value
      if (!instance) return { emitted, ok: true }
      if (syncTimer) globalThis.clearTimeout(syncTimer)
      syncTimer = undefined
      const currentRevision = revision
      pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision, authoring.kit.value)
      const result = await pendingVisualUpdate
      if (currentRevision === revision) pendingVisualUpdate = undefined
      if (!result.ok) return result
      emitted ||= result.emitted
      if (currentRevision !== revision) continue
    }

    if (options.pendingImages.value || options.pendingCommands.value) {
      const result = await flushLocal()
      return result.ok ? { ok: true, emitted: emitted || result.emitted } : result
    }
    if (conversionError.value) return { error: conversionError.value, ok: false }
    return { emitted, ok: true }
  }

  async function flush(): Promise<EditorFlushResult> {
    const result = await flushLocal()
    if (!result.ok || !session) return result
    try {
      let emitted = result.emitted
      do {
        await session.flush()
        const latest = await flushLocal()
        if (!latest.ok) return latest
        emitted ||= latest.emitted
      } while (session.state.pendingSteps || hasPendingVisualChanges.value)
      return { ok: true, emitted }
    } catch (error) {
      return stateError(
        'collaboration_pending',
        error instanceof Error ? error.message : options.text('sharedError'),
      )
    }
  }

  async function showSource() {
    const result = await flushLocal()
    if (!result.ok || disposed) return
    options.beforeSource()
    viewMode.value = 'raw'
  }

  async function showVisual() {
    if (viewMode.value === 'visual') return
    if (session) { viewMode.value = 'visual'; return }
    await loadSource(rawContent.value, { switchToVisual: true })
  }

  function updateRaw(value: string) {
    if (session || binding.invalidBinding.value) return
    cancelPendingUpdate()
    rawContent.value = value
    emitSource(value)
  }

  watch(options.getModelValue, (value, previous) => {
    if (value === previous) return
    if (consumeEcho(value)) return
    if (session) return
    void loadSource(value)
  })

  // Only a changed Content policy changes what the document may contain.
  watch(authoring.policyRevision, () => {
    if (session) {
      binding.invalidate()
      return
    }
    void (async () => {
      const result = await flush()
      if (!result.ok) return
      await loadSource(rawContent.value)
    })()
  })

  onMounted(() => {
    if (session && editor.value) {
      scheduleVisualUpdate(editor.value)
      loaded.value = true
    }
    else void loadSource(options.getModelValue(), { initial: true }).finally(() => { loaded.value = true })
  })

  onBeforeUnmount(() => {
    disposed = true
    cancelPendingUpdate()
  })

  return {
    viewMode,
    rawContent,
    conversionError,
    hasPendingVisualChanges,
    loaded,
    /** Changes whenever the canvas document is replaced or edited. */
    revision: () => revision,
    isDisposed: () => disposed,
    isApplyingDocument: () => applyingDocument,
    scheduleVisualUpdate,
    flush,
    showSource,
    showVisual,
    updateRaw,
  }
}

export type MarkdownSync = ReturnType<typeof useMarkdownSync>
