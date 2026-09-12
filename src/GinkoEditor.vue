<script setup lang="ts">
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { createEditorExtensions, isCurrentlyNormalizingTable, normalizeTableCells } from './lib/config/editorConfig'
import type { ConversionErrorPayload, ConversionRecoveredPayload, ConversionResult } from './lib/conversionPipeline'
import { applyTiptapDocToEditor, convertTiptapDocToMarkdown, prepareMarkdownForVisualEditing } from './lib/conversionPipeline'
import { toConversionErrorPayload } from './lib/conversionState'
import type { AssetInfo, AssetProvider } from './types'
import GinkoToolbar from './ui/GinkoToolbar.vue'

defineOptions({ name: 'GinkoEditor' })

const props = withDefaults(defineProps<{
  ariaLabel?: string
  assetProvider?: AssetProvider
  codeBlockTheme?: 'atom-dark' | 'dark' | 'default' | 'github-dark' | 'github-dim' | 'github-light' | 'visual-studio-dark'
  disabled?: boolean
  enableDebug?: boolean
  enableFiles?: boolean
  enableVideo?: boolean
  fileOutput?: 'markdown' | 'mdc'
  imageOutput?: 'markdown' | 'mdc'
  modelValue: string
  placeholder?: string
  showMarkdownMarkers?: boolean
  syncDebounceMs?: number
  videoOutput?: 'html' | 'mdc'
}>(), {
  codeBlockTheme: 'github-dark',
  ariaLabel: undefined,
  assetProvider: undefined,
  disabled: false,
  enableDebug: false,
  enableFiles: true,
  enableVideo: true,
  fileOutput: 'mdc',
  imageOutput: 'mdc',
  placeholder: undefined,
  showMarkdownMarkers: false,
  syncDebounceMs: 120,
  videoOutput: 'mdc',
})

const emit = defineEmits<{
  'conversion-error': [payload: ConversionErrorPayload]
  'conversion-recovered': [payload: ConversionRecoveredPayload]
  'request-file': []
  'request-image': []
  'request-video': []
  'update:modelValue': [value: string]
}>()

const viewMode = ref<'raw' | 'visual'>('raw')
const rawContent = ref(props.modelValue)
const rawDirty = ref(false)
const conversionError = ref<ConversionErrorPayload | null>(null)
const lastEmittedValue = ref<string | null>(null)
let revision = 0
let syncTimer: ReturnType<typeof globalThis.setTimeout> | undefined
let pendingVisualUpdate: Promise<void> | undefined
let disposed = false
let applyingDocument = false

const outputOptions = computed(() => ({
  enableDebug: props.enableDebug,
  fileOutput: props.fileOutput,
  imageOutput: props.imageOutput,
  videoOutput: props.videoOutput,
}))
const resolvedAssetProvider = computed<AssetProvider>(() => props.assetProvider ?? {
  buildUrl: (asset) => asset.url ?? '',
  parseUrl: () => null,
})

const editor = useEditor({
  content: { content: [{ type: 'paragraph' }], type: 'doc' },
  editable: !props.disabled,
  editorProps: { attributes: { 'aria-label': props.ariaLabel ?? 'Content' } },
  extensions: createEditorExtensions({
    assetProvider: resolvedAssetProvider.value,
    codeBlockTheme: props.codeBlockTheme,
    enableDebug: props.enableDebug,
    enableFiles: props.enableFiles,
    enableVideo: props.enableVideo,
    fileOutput: props.fileOutput,
    imageOutput: props.imageOutput,
    placeholder: props.placeholder,
    showMarkdownMarkers: props.showMarkdownMarkers,
    videoOutput: props.videoOutput,
  }),
  onUpdate: ({ editor: instance, transaction }) => {
    if (!isCurrentlyNormalizingTable() && normalizeTableCells(instance)) return
    if (!applyingDocument && transaction.docChanged) scheduleVisualUpdate(instance)
  },
})

function cancelPendingUpdate() {
  revision += 1
  if (syncTimer) globalThis.clearTimeout(syncTimer)
  syncTimer = undefined
}

function reportFailure(result: ConversionResult<unknown>) {
  const payload = toConversionErrorPayload(result, {
    fallbackCode: 'source_only_required',
    fallbackMessage: 'This document must be edited as source to prevent content loss.',
    fallbackPhase: 'validate',
    recoverable: true,
  })
  conversionError.value = payload
  emit('conversion-error', payload)
}

function clearFailure(traceId: string) {
  if (!conversionError.value) return
  conversionError.value = null
  emit('conversion-recovered', { fromStatus: 'failed', toStatus: 'ok', traceId })
}

async function loadSource(value: string, options: { initial?: boolean; switchToVisual?: boolean } = {}) {
  cancelPendingUpdate()
  const currentRevision = revision
  rawContent.value = value
  rawDirty.value = false
  const result = await prepareMarkdownForVisualEditing(value, outputOptions.value)
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
  if (options.initial || options.switchToVisual) viewMode.value = 'visual'
  return true
}

function scheduleVisualUpdate(instance: TiptapEditor) {
  if (syncTimer) globalThis.clearTimeout(syncTimer)
  revision += 1
  const currentRevision = revision
  syncTimer = globalThis.setTimeout(() => {
    syncTimer = undefined
    pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision)
    void pendingVisualUpdate.finally(() => {
      if (currentRevision === revision) pendingVisualUpdate = undefined
    })
  }, props.syncDebounceMs)
}

async function emitVisualDocument(document: JSONContent, currentRevision: number) {
    const result = await convertTiptapDocToMarkdown(document, outputOptions.value)
    if (disposed || currentRevision !== revision || !result.ok || result.value === undefined) {
      if (!result.ok && currentRevision === revision) reportFailure(result)
      return
    }
    rawContent.value = result.value
    lastEmittedValue.value = result.value
    emit('update:modelValue', result.value)
    clearFailure(result.traceId)
}

async function flushPendingVisualUpdate() {
  if (!syncTimer || !editor.value) {
    await pendingVisualUpdate
    return
  }
  globalThis.clearTimeout(syncTimer)
  syncTimer = undefined
  const currentRevision = revision
  pendingVisualUpdate = emitVisualDocument(editor.value.getJSON(), currentRevision)
  await pendingVisualUpdate
  if (currentRevision === revision) pendingVisualUpdate = undefined
}

async function showSource() {
  await flushPendingVisualUpdate()
  rawContent.value = lastEmittedValue.value ?? props.modelValue
  rawDirty.value = false
  viewMode.value = 'raw'
}

async function showVisual() {
  if (viewMode.value === 'visual') return
  await loadSource(rawContent.value, { switchToVisual: true })
}

function updateRaw(value: string) {
  cancelPendingUpdate()
  rawContent.value = value
  rawDirty.value = true
  lastEmittedValue.value = value
  emit('update:modelValue', value)
}

function insertImageAsset(asset: Partial<AssetInfo>) {
  const instance = editor.value
  if (!instance) return
  const payload = { alt: asset.alt, filename: asset.filename, height: asset.height, id: asset.id, src: asset.url || resolvedAssetProvider.value.buildUrl(asset), title: asset.title, width: asset.width }
  if (instance.isActive('image')) instance.chain().focus().updateAttributes('image', { props: payload }).run()
  else (instance.chain().focus() as unknown as { setImage: (value: Record<string, unknown>) => { run: () => void } }).setImage(payload).run()
}

function insertFileAsset(asset: Partial<AssetInfo>) {
  const instance = editor.value
  if (!instance) return
  const payload = { filename: asset.filename, id: asset.id, size: asset.size, src: asset.url || resolvedAssetProvider.value.buildUrl(asset), title: asset.title || asset.filename, type: asset.mimeType }
  if (instance.isActive('file')) instance.chain().focus().updateAttributes('file', { props: payload }).run()
  else (instance.chain().focus() as unknown as { setFile: (value: Record<string, unknown>) => { run: () => void } }).setFile(payload).run()
}

function insertVideo(value: { src: string; title?: string }) {
  const instance = editor.value
  if (!instance || !value.src.trim()) return
  const payload = { src: value.src.trim(), title: value.title?.trim() || undefined }
  if (instance.isActive('video')) instance.chain().focus().updateAttributes('video', { props: payload, ...payload }).run()
  else (instance.chain().focus() as unknown as { setVideo: (attrs: Record<string, unknown>) => { run: () => void } }).setVideo(payload).run()
}

function removeSelectedMedia() {
  const instance = editor.value
  if (!instance || !['image', 'file', 'video'].some((name) => instance.isActive(name))) return
  instance.view.dispatch(instance.state.tr.deleteSelection())
}

watch(() => props.modelValue, (value, previous) => {
  if (value === previous) return
  if (value === lastEmittedValue.value) {
    lastEmittedValue.value = null
    return
  }
  void loadSource(value)
})
watch(() => props.disabled, (disabled) => editor.value?.setEditable(!disabled))

onMounted(() => { void loadSource(props.modelValue, { initial: true }) })
onBeforeUnmount(() => {
  disposed = true
  cancelPendingUpdate()
  editor.value?.destroy()
})

defineExpose({ editor, insertFileAsset, insertImageAsset, insertVideo, removeSelectedMedia, rawContent, viewMode })
</script>

<template>
  <div
    class="ginko-editor"
    :data-mode="viewMode"
    :data-invalid="conversionError ? 'true' : undefined"
  >
    <div class="ginko-editor__header">
      <div
        class="ginko-editor__modes"
        aria-label="Editing mode"
      >
        <button
          type="button"
          :aria-pressed="viewMode === 'visual'"
          :disabled="disabled"
          @click="showVisual"
        >
          Visual
        </button>
        <button
          type="button"
          :aria-pressed="viewMode === 'raw'"
          :disabled="disabled"
          @click="showSource"
        >
          Markdown
        </button>
      </div>
      <span
        class="ginko-editor__status"
        role="status"
      >{{ conversionError ? 'Source only' : 'Synced' }}</span>
    </div>
    <div
      v-if="conversionError"
      class="ginko-editor__warning"
    >
      <strong>Visual editing is unavailable for this source.</strong>
      <span>{{ conversionError.message }}</span>
    </div>
    <template v-if="viewMode === 'visual' && editor">
      <GinkoToolbar
        v-if="!disabled"
        :editor="editor"
        :enable-files="enableFiles"
        :enable-video="enableVideo"
        @request-file="emit('request-file')"
        @request-image="emit('request-image')"
        @request-video="emit('request-video')"
      />
      <EditorContent
        class="ginko-editor__surface"
        :editor="editor"
      />
    </template>
    <textarea
      v-else
      class="ginko-editor__source"
      :aria-label="`${ariaLabel ?? 'Content'} markdown source`"
      :disabled="disabled"
      :value="rawContent"
      spellcheck="false"
      @input="updateRaw(($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
.ginko-editor { --ginko-border: #d6d6d6; --ginko-bg: #fff; --ginko-muted: #f5f5f5; --ginko-text: #171717; overflow: hidden; border: 1px solid var(--ginko-border); border-radius: .75rem; background: var(--ginko-bg); color: var(--ginko-text); font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
.ginko-editor button { border: 0; border-radius: .35rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .55rem; }
.ginko-editor button:hover, .ginko-editor button[aria-pressed='true'] { background: var(--ginko-muted); }
.ginko-editor button:focus-visible, .ginko-editor textarea:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.ginko-editor__header, .ginko-editor__toolbar { display: flex; align-items: center; gap: .25rem; border-bottom: 1px solid var(--ginko-border); padding: .4rem .5rem; overflow-x: auto; }
.ginko-editor__header { justify-content: space-between; }
.ginko-editor__modes { display: flex; gap: .2rem; }
.ginko-editor__status { color: #666; font-size: .78rem; }
.ginko-editor__toolbar span { align-self: stretch; border-left: 1px solid var(--ginko-border); margin: .15rem .25rem; }
.ginko-editor__warning { display: grid; gap: .15rem; border-bottom: 1px solid #e4a11b; background: #fff8e6; padding: .65rem .8rem; color: #5c4300; }
.ginko-editor__surface { padding: 1rem; }
.ginko-editor__surface :deep(.ProseMirror) { min-height: 220px; outline: none; }
.ginko-editor__surface :deep(.ProseMirror > :first-child) { margin-top: 0; }
.ginko-editor__surface :deep(.ProseMirror img) { display: block; max-width: 100%; height: auto; }
.ginko-editor__surface :deep(table) { width: 100%; border-collapse: collapse; }
.ginko-editor__surface :deep(td), .ginko-editor__surface :deep(th) { border: 1px solid var(--ginko-border); padding: .5rem; }
.ginko-editor__source { box-sizing: border-box; display: block; width: 100%; min-height: 280px; resize: vertical; border: 0; background: var(--ginko-bg); color: var(--ginko-text); padding: 1rem; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; outline: none; }
</style>
