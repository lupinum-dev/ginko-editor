<script setup lang="ts">
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import type { AuthoringKitV1, AuthoringRecipeV1 } from './authoring'
import { createEditorExtensions, isCurrentlyNormalizingTable, normalizeTableCells } from './lib/config/editorConfig'
import type { ConversionErrorPayload, ConversionRecoveredPayload, ConversionResult } from './lib/conversionPipeline'
import { applyTiptapDocToEditor, convertTiptapDocToMarkdown, prepareMarkdownForVisualEditing, validateMarkdownForAuthoring } from './lib/conversionPipeline'
import { toConversionErrorPayload } from './lib/conversionState'
import type {
  AssetInfo,
  AssetProvider,
  EditorAssetRequest,
  EditorFlushResult,
  JsonValue,
  VideoInfo,
} from './types'
import GinkoToolbar from './ui/GinkoToolbar.vue'

defineOptions({ name: 'GinkoEditor' })

const props = withDefaults(defineProps<{
  ariaLabel?: string
  assetProvider?: AssetProvider
  authoringKit?: AuthoringKitV1
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
  authoringKit: undefined,
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
  'request-file': [request: EditorAssetRequest<Partial<AssetInfo>>]
  'request-image': [request: EditorAssetRequest<Partial<AssetInfo>>]
  'request-video': [request: EditorAssetRequest<VideoInfo>]
  'update:modelValue': [value: string]
}>()

const viewMode = ref<'raw' | 'visual'>('raw')
const rawContent = ref(props.modelValue)
const conversionError = ref<ConversionErrorPayload | null>(null)
const hasPendingVisualChanges = ref(false)
let pendingEcho: string | undefined
let revision = 0
let syncTimer: ReturnType<typeof globalThis.setTimeout> | undefined
let pendingVisualUpdate: Promise<EditorFlushResult> | undefined
let disposed = false
let applyingDocument = false
const selectionRevision = ref(0)
const insertMenuOpen = ref(false)
const insertMenuOrigin = ref<'button' | 'slash'>('button')
const insertQuery = ref('')
const insertIndex = ref(0)
const insertError = ref<string | null>(null)
const insertBusy = ref(false)
type BrowserInputElement = InstanceType<typeof globalThis.HTMLInputElement>
type BrowserKeyboardEvent = InstanceType<typeof globalThis.KeyboardEvent>

const insertSearch = ref<BrowserInputElement>()
const insertMenuId = useId()
const componentSettingsId = useId()
let insertSelection: { from: number; to: number } | undefined

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
    selectionRevision.value += 1
    if (!isCurrentlyNormalizingTable() && normalizeTableCells(instance)) return
    if (!applyingDocument && transaction.docChanged) scheduleVisualUpdate(instance)
  },
  onSelectionUpdate: () => {
    selectionRevision.value += 1
  },
})

const filteredRecipes = computed(() => {
  const query = insertQuery.value.trim().toLocaleLowerCase()
  const recipes = props.authoringKit?.recipes ?? []
  if (!query) return recipes
  return recipes.filter((recipe) =>
    [recipe.id, recipe.label, ...(recipe.keywords ?? [])]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})

watch(filteredRecipes, () => {
  insertIndex.value = Math.min(insertIndex.value, Math.max(0, filteredRecipes.value.length - 1))
})

function currentElement(instance: TiptapEditor, trackedRevision = 0) {
  const selection = instance.state.selection as typeof instance.state.selection & {
    node?: { attrs: Record<string, unknown>; type: { name: string } }
  }
  if (selection.node?.type.name === 'element') {
    return { node: selection.node, pos: selection.from, trackedRevision }
  }
  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth)
    if (node.type.name === 'element') {
      return { node, pos: selection.$from.before(depth), trackedRevision }
    }
  }
  return undefined
}

const selectedComponent = computed(() => {
  const instance = editor.value
  const kit = props.authoringKit
  if (!instance || !kit) return undefined
  const selected = currentElement(instance, selectionRevision.value)
  const tag = selected?.node.attrs.tag
  if (!selected || typeof tag !== 'string') return undefined
  const metadata = kit.authoring[tag]
  const definition = kit.policy.components[tag]
  if (!metadata || !definition) return undefined
  return {
    ...selected,
    definition,
    description: metadata.description,
    fields: Object.entries(metadata.props ?? {}).flatMap(([name, field]) => {
      if (!field) return []
      const policy = definition.props[name]
      if (!policy) return []
      return [{ field, name, options: policy.allowedValues ?? [] }]
    }),
    label: metadata.label,
    tag,
  }
})

function selectedPropValue(name: string): JsonValue | undefined {
  return selectedComponent.value?.node.attrs.props?.[name] as JsonValue | undefined
}

function updateSelectedProp(name: string, value: JsonValue | undefined) {
  const instance = editor.value
  const selected = selectedComponent.value
  if (!instance || !selected || props.disabled) return
  const current = (selected.node.attrs.props ?? {}) as Record<string, JsonValue>
  const next = { ...current }
  if (value === undefined || value === '') delete next[name]
  else next[name] = value
  instance.view.dispatch(
    instance.state.tr.setNodeMarkup(selected.pos, undefined, {
      ...selected.node.attrs,
      props: next,
    }),
  )
  instance.commands.focus()
}

function valueFromOption(options: readonly JsonValue[], value: string): JsonValue | undefined {
  return options.find((option) => String(option) === value)
}

function canOpenSlashMenu(instance: TiptapEditor) {
  const { selection } = instance.state
  if (!selection.empty || selection.$from.parent.type.name !== 'paragraph') return false
  return selection.$from.parent.textBetween(0, selection.$from.parentOffset).trim() === ''
}

async function openInsertMenu(origin: 'button' | 'slash') {
  const instance = editor.value
  if (!instance || !props.authoringKit?.recipes.length || !canMutateVisualContent()) return
  insertSelection = { from: instance.state.selection.from, to: instance.state.selection.to }
  insertMenuOrigin.value = origin
  insertQuery.value = ''
  insertIndex.value = 0
  insertError.value = null
  insertMenuOpen.value = true
  if (origin === 'button') {
    await nextTick()
    insertSearch.value?.focus()
  }
}

function restoreInsertSelection() {
  const instance = editor.value
  if (!instance || !insertSelection) return
  instance.chain().setTextSelection(insertSelection).focus().run()
}

function closeInsertMenu(restore = true) {
  insertMenuOpen.value = false
  insertQuery.value = ''
  insertError.value = null
  if (restore) restoreInsertSelection()
  insertSelection = undefined
}

function moveInsertSelection(offset: number) {
  const count = filteredRecipes.value.length
  if (!count) return
  insertIndex.value = (insertIndex.value + offset + count) % count
}

function parentComponentTag(instance: TiptapEditor): string | undefined {
  const selected = currentElement(instance)
  return typeof selected?.node.attrs.tag === 'string' ? selected.node.attrs.tag : undefined
}

function placementError(instance: TiptapEditor, document: JSONContent): string | undefined {
  const kit = props.authoringKit
  if (!kit) return 'No authoring kit is available.'
  const parent = parentComponentTag(instance)
  const parentPolicy = parent ? kit.policy.components[parent] : undefined
  for (const node of document.content ?? []) {
    const tag = node.type === 'element' && typeof node.attrs?.tag === 'string' ? node.attrs.tag : undefined
    if (!tag) continue
    const policy = kit.policy.components[tag]
    if (!policy) return `${tag} is not registered in this editor.`
    if (policy.allowedParents && (!parent || !policy.allowedParents.includes(parent))) {
      return `${tag} cannot be inserted here.`
    }
    if (parentPolicy?.allowedChildren && !parentPolicy.allowedChildren.includes(tag)) {
      return `${tag} is not allowed inside ${parent}.`
    }
  }
  return undefined
}

async function insertRecipe(recipe: AuthoringRecipeV1 | undefined) {
  const instance = editor.value
  if (!recipe || !instance || !insertSelection || !props.authoringKit || insertBusy.value) return
  insertBusy.value = true
  insertError.value = null
  try {
    const prepared = await prepareMarkdownForVisualEditing(
      recipe.source,
      outputOptions.value,
      instance.schema,
      props.authoringKit,
    )
    if (!prepared.ok || !prepared.value) {
      insertError.value = 'This block cannot be prepared safely.'
      return
    }
    const reason = placementError(instance, prepared.value)
    if (reason) {
      insertError.value = reason
      return
    }
    const content = prepared.value.content ?? []
    instance.chain().setTextSelection(insertSelection).focus().insertContent(content).run()
    closeInsertMenu(false)
  } finally {
    insertBusy.value = false
  }
}

function handleInsertKeys(event: BrowserKeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeInsertMenu()
    return true
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveInsertSelection(event.key === 'ArrowDown' ? 1 : -1)
    return true
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    void insertRecipe(filteredRecipes.value[insertIndex.value])
    return true
  }
  return false
}

function handleEditorKeydown(event: BrowserKeyboardEvent) {
  const instance = editor.value
  if (!instance || event.isComposing) return
  if (!insertMenuOpen.value) {
    if (event.key !== '/' || !canOpenSlashMenu(instance)) return
    event.preventDefault()
    void openInsertMenu('slash')
    return
  }
  if (handleInsertKeys(event)) return
  if (insertMenuOrigin.value !== 'slash' || event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'Backspace') {
    event.preventDefault()
    insertQuery.value = insertQuery.value.slice(0, -1)
  } else if (event.key.length === 1) {
    event.preventDefault()
    insertQuery.value += event.key
  }
}

function handleInsertSearchKeydown(event: BrowserKeyboardEvent) {
  handleInsertKeys(event)
}

function cancelPendingUpdate() {
  revision += 1
  if (syncTimer) globalThis.clearTimeout(syncTimer)
  syncTimer = undefined
  hasPendingVisualChanges.value = false
}

function emitSource(value: string) {
  pendingEcho = value
  emit('update:modelValue', value)
}

function consumeEcho(value: string) {
  if (value !== pendingEcho) return false
  pendingEcho = undefined
  return true
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
  const result = await prepareMarkdownForVisualEditing(
    value,
    outputOptions.value,
    editor.value?.schema,
    props.authoringKit,
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
  if (options.initial || options.switchToVisual) viewMode.value = 'visual'
  return true
}

function scheduleVisualUpdate(instance: TiptapEditor) {
  if (syncTimer) globalThis.clearTimeout(syncTimer)
  revision += 1
  hasPendingVisualChanges.value = true
  const currentRevision = revision
  syncTimer = globalThis.setTimeout(() => {
    syncTimer = undefined
    pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision, props.authoringKit)
    void pendingVisualUpdate.finally(() => {
      if (currentRevision === revision) pendingVisualUpdate = undefined
    })
  }, props.syncDebounceMs)
}

async function emitVisualDocument(
  document: JSONContent,
  currentRevision: number,
  authoringKit: AuthoringKitV1 | undefined,
): Promise<EditorFlushResult> {
  const result = await convertTiptapDocToMarkdown(document, outputOptions.value)
  if (disposed || currentRevision !== revision || !result.ok || result.value === undefined) {
    if (!result.ok && currentRevision === revision) {
      reportFailure(result)
      return { error: conversionError.value!, ok: false }
    }
    return { emitted: false, ok: true }
  }
  if (authoringKit) {
    const issue = await validateMarkdownForAuthoring(result.value, authoringKit)
    if (disposed || currentRevision !== revision) return { emitted: false, ok: true }
    if (issue) {
      const rejected = { ...result, issues: [...result.issues, issue], ok: false as const }
      reportFailure(rejected)
      return { error: conversionError.value!, ok: false }
    }
  }
  if (disposed || currentRevision !== revision) return { emitted: false, ok: true }
  rawContent.value = result.value
  emitSource(result.value)
  hasPendingVisualChanges.value = false
  clearFailure(result.traceId)
  return { emitted: true, ok: true }
}

async function flush(): Promise<EditorFlushResult> {
  if (viewMode.value === 'raw') return { emitted: false, ok: true }

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
      if (!hasPendingVisualChanges.value) return { emitted, ok: true }
    }

    const instance = editor.value
    if (!instance) return { emitted, ok: true }
    if (syncTimer) globalThis.clearTimeout(syncTimer)
    syncTimer = undefined
    const currentRevision = revision
    pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision, props.authoringKit)
    const result = await pendingVisualUpdate
    if (currentRevision === revision) pendingVisualUpdate = undefined
    if (!result.ok) return result
    emitted ||= result.emitted
    if (currentRevision !== revision) continue
  }

  if (conversionError.value) return { error: conversionError.value, ok: false }
  return { emitted, ok: true }
}

async function showSource() {
  await flush()
  viewMode.value = 'raw'
}

async function showVisual() {
  if (viewMode.value === 'visual') return
  await loadSource(rawContent.value, { switchToVisual: true })
}

function updateRaw(value: string) {
  cancelPendingUpdate()
  rawContent.value = value
  emitSource(value)
}

function canMutateVisualContent(featureEnabled = true) {
  return featureEnabled && !disposed && !props.disabled && viewMode.value === 'visual' && editor.value?.isEditable === true
}

function insertImageAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent()) return false
  const payload = { alt: asset.alt, filename: asset.filename, height: asset.height, id: asset.id, src: asset.url || resolvedAssetProvider.value.buildUrl(asset), title: asset.title, width: asset.width }
  if (instance.isActive('image')) instance.chain().focus().updateAttributes('image', { props: payload }).run()
  else instance.chain().focus().setImage(payload).run()
  return true
}

function insertFileAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableFiles)) return false
  const payload = { filename: asset.filename, id: asset.id, size: asset.size, src: asset.url || resolvedAssetProvider.value.buildUrl(asset), title: asset.title || asset.filename, type: asset.mimeType }
  if (instance.isActive('file')) instance.chain().focus().updateAttributes('file', { props: payload }).run()
  else instance.chain().focus().setFile(payload).run()
  return true
}

function insertVideo(value: VideoInfo): boolean {
  const instance = editor.value
  if (!instance || !value.src.trim() || !canMutateVisualContent(props.enableVideo)) return false
  const payload = { src: value.src.trim(), title: value.title?.trim() || undefined }
  if (instance.isActive('video')) instance.chain().focus().updateAttributes('video', { props: payload, ...payload }).run()
  else instance.chain().focus().setVideo(payload).run()
  return true
}

function removeSelectedMedia(): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent() || !['image', 'file', 'video'].some((name) => instance.isActive(name))) return false
  instance.view.dispatch(instance.state.tr.deleteSelection())
  return true
}

function createAssetRequest<T>(complete: (value: T) => boolean): EditorAssetRequest<T> {
  const instance = editor.value
  const requestRevision = revision
  const requestDocument = instance?.state.doc
  const requestSelection = instance?.state.selection
  return {
    complete(value) {
      if (
        value === null ||
        !instance ||
        editor.value !== instance ||
        revision !== requestRevision ||
        !requestDocument?.eq(instance.state.doc) ||
        !requestSelection?.eq(instance.state.selection)
      ) return false
      return complete(value)
    },
  }
}

function requestImage() {
  if (!canMutateVisualContent()) return
  emit('request-image', createAssetRequest(insertImageAsset))
}

function requestFile() {
  if (!canMutateVisualContent(props.enableFiles)) return
  emit('request-file', createAssetRequest(insertFileAsset))
}

function requestVideo() {
  if (!canMutateVisualContent(props.enableVideo)) return
  emit('request-video', createAssetRequest(insertVideo))
}

watch(() => props.modelValue, (value, previous) => {
  if (value === previous) return
  if (consumeEcho(value)) return
  void loadSource(value)
})
watch(() => props.disabled, (disabled) => editor.value?.setEditable(!disabled))
watch(() => props.authoringKit, () => {
  void (async () => {
    const result = await flush()
    if (!result.ok) return
    await loadSource(rawContent.value)
  })()
})

onMounted(() => { void loadSource(props.modelValue, { initial: true }) })
onBeforeUnmount(() => {
  disposed = true
  cancelPendingUpdate()
  editor.value?.destroy()
})

const statusLabel = computed(() => {
  if (conversionError.value) return 'Source only'
  if (hasPendingVisualChanges.value) return 'Converting changes'
  return viewMode.value === 'visual' ? 'Visual editor' : 'Markdown source'
})

defineExpose({
  editor,
  flush,
  insertFileAsset,
  insertImageAsset,
  insertVideo,
  removeSelectedMedia,
  rawContent,
  viewMode,
})
</script>

<template>
  <div
    class="ginko-editor"
    :data-mode="viewMode"
    :data-invalid="conversionError ? 'true' : undefined"
  >
    <div class="ginko-editor__header">
      <button
        v-if="authoringKit?.recipes.length && viewMode === 'visual'"
        class="ginko-editor__insert-trigger"
        type="button"
        :aria-controls="insertMenuId"
        :aria-expanded="insertMenuOpen"
        aria-label="Insert block"
        :disabled="disabled"
        @click="insertMenuOpen ? closeInsertMenu() : openInsertMenu('button')"
      >
        <span aria-hidden="true">+</span>
        <span>Insert</span>
      </button>
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
      >{{ statusLabel }}</span>
    </div>
    <div
      v-if="insertMenuOpen"
      :id="insertMenuId"
      class="ginko-editor__insert-menu"
      @keydown="handleInsertSearchKeydown"
    >
      <label class="ginko-editor__insert-search">
        <span aria-hidden="true">/</span>
        <span class="ginko-editor__sr-only">Search blocks</span>
        <input
          ref="insertSearch"
          v-model="insertQuery"
          :readonly="insertMenuOrigin === 'slash'"
          autocomplete="off"
          placeholder="Search blocks"
        >
      </label>
      <div
        class="ginko-editor__insert-results"
        role="listbox"
        aria-label="Available blocks"
      >
        <button
          v-for="(recipe, index) in filteredRecipes"
          :key="recipe.id"
          type="button"
          role="option"
          :aria-selected="index === insertIndex"
          @mouseenter="insertIndex = index"
          @click="insertRecipe(recipe)"
        >
          <strong>{{ recipe.label }}</strong>
          <span v-if="recipe.keywords?.length">{{ recipe.keywords.join(' · ') }}</span>
        </button>
        <p
          v-if="filteredRecipes.length === 0"
          class="ginko-editor__insert-empty"
        >
          No matching blocks.
        </p>
      </div>
      <p
        v-if="insertError"
        class="ginko-editor__insert-error"
        role="alert"
      >
        {{ insertError }}
      </p>
      <p class="ginko-editor__insert-help">
        <span v-if="insertMenuOrigin === 'slash'">Keep typing to search.</span>
        Arrow keys choose, Enter inserts, Escape closes.
      </p>
    </div>
    <div
      v-if="conversionError"
      class="ginko-editor__warning"
      role="alert"
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
        @request-file="requestFile"
        @request-image="requestImage"
        @request-video="requestVideo"
      />
      <div
        class="ginko-editor__surface-frame"
        @keydown.capture="handleEditorKeydown"
      >
        <EditorContent
          class="ginko-editor__surface"
          :editor="editor"
        />
      </div>
      <section
        v-if="selectedComponent?.fields.length"
        class="ginko-editor__inspector"
        :aria-labelledby="componentSettingsId"
      >
        <div>
          <p class="ginko-editor__inspector-kicker">
            Selected block
          </p>
          <h3 :id="componentSettingsId">
            {{ selectedComponent.label }}
          </h3>
          <p v-if="selectedComponent.description">
            {{ selectedComponent.description }}
          </p>
        </div>
        <div class="ginko-editor__fields">
          <label
            v-for="item in selectedComponent.fields"
            :key="item.name"
          >
            <span>{{ item.field.label }}</span>
            <input
              v-if="item.field.control === 'toggle'"
              type="checkbox"
              :checked="selectedPropValue(item.name) === true"
              @change="updateSelectedProp(item.name, ($event.target as HTMLInputElement).checked)"
            >
            <select
              v-else-if="item.field.control === 'select'"
              :value="String(selectedPropValue(item.name) ?? '')"
              @change="updateSelectedProp(item.name, valueFromOption(item.options, ($event.target as HTMLSelectElement).value))"
            >
              <option value="">Default</option>
              <option
                v-for="option in item.options"
                :key="String(option)"
                :value="String(option)"
              >
                {{ option }}
              </option>
            </select>
            <input
              v-else
              :type="item.field.control === 'number' ? 'number' : 'text'"
              :value="String(selectedPropValue(item.name) ?? '')"
              @change="updateSelectedProp(item.name, item.field.control === 'number' ? Number(($event.target as HTMLInputElement).value) : ($event.target as HTMLInputElement).value)"
            >
            <small v-if="item.field.help">{{ item.field.help }}</small>
          </label>
        </div>
      </section>
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
.ginko-editor { --ginko-border: #d6d6d6; --ginko-bg: #fff; --ginko-muted: #f5f5f5; --ginko-muted-text: #666; --ginko-text: #171717; position: relative; overflow: hidden; border: 1px solid var(--ginko-border); border-radius: .85rem; background: var(--ginko-bg); color: var(--ginko-text); font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
.ginko-editor button { min-height: 2.25rem; border: 0; border-radius: .4rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .65rem; white-space: nowrap; }
.ginko-editor button:hover, .ginko-editor button[aria-pressed='true'] { background: var(--ginko-muted); }
.ginko-editor button:focus-visible, .ginko-editor input:focus-visible, .ginko-editor select:focus-visible, .ginko-editor textarea:focus-visible { outline-offset: 2px; }
.ginko-editor__header { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: .5rem; border-bottom: 1px solid var(--ginko-border); padding: .45rem .55rem; }
.ginko-editor__insert-trigger { justify-self: start; display: inline-flex; align-items: center; gap: .35rem; font-weight: 650; }
.ginko-editor__insert-trigger span[aria-hidden='true'] { font-size: 1.2rem; line-height: 1; }
.ginko-editor__modes { display: flex; gap: .2rem; }
.ginko-editor__status { color: var(--ginko-muted-text); font-size: .78rem; white-space: nowrap; }
.ginko-editor__sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ginko-editor__insert-menu { position: relative; z-index: 15; display: grid; gap: .45rem; border-bottom: 1px solid var(--ginko-border); background: color-mix(in srgb, var(--ginko-bg) 96%, var(--ginko-text)); padding: .65rem; }
.ginko-editor__insert-search { display: flex; align-items: center; gap: .4rem; border: 1px solid var(--ginko-border); border-radius: .55rem; background: var(--ginko-bg); padding-inline: .7rem; font: 600 1rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ginko-editor__insert-search:focus-within { outline: 2px solid currentColor; outline-offset: 1px; }
.ginko-editor__insert-search input { min-width: 0; flex: 1; border: 0; background: transparent; color: inherit; padding-block: .65rem; font: 400 .9rem/1.3 ui-sans-serif, system-ui, sans-serif; outline: 0; }
.ginko-editor__insert-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .35rem; }
.ginko-editor__insert-results button { display: grid; gap: .1rem; border: 1px solid transparent; background: var(--ginko-bg); text-align: start; }
.ginko-editor__insert-results button[aria-selected='true'] { border-color: currentColor; background: var(--ginko-muted); }
.ginko-editor__insert-results button span { color: var(--ginko-muted-text); font-size: .72rem; font-weight: 400; }
.ginko-editor__insert-empty, .ginko-editor__insert-error, .ginko-editor__insert-help { margin: 0; }
.ginko-editor__insert-empty { color: var(--ginko-muted-text); padding: .45rem; }
.ginko-editor__insert-error { color: #8a2e1b; }
.ginko-editor__insert-help { color: var(--ginko-muted-text); font-size: .75rem; }
.ginko-editor__warning { display: grid; gap: .15rem; border-bottom: 1px solid #e4a11b; background: #fff8e6; padding: .65rem .8rem; color: #5c4300; }
.ginko-editor__surface { padding: clamp(1rem, 3vw, 1.75rem); }
.ginko-editor__surface :deep(.ProseMirror) { max-width: 46rem; min-height: 22rem; margin-inline: auto; outline: none; font-size: 1rem; line-height: 1.7; }
.ginko-editor__surface :deep(.ProseMirror > :first-child) { margin-top: 0; }
.ginko-editor__surface :deep(.ProseMirror > * + *) { margin-block-start: 1em; }
.ginko-editor__surface :deep(.ProseMirror h1), .ginko-editor__surface :deep(.ProseMirror h2), .ginko-editor__surface :deep(.ProseMirror h3) { line-height: 1.2; letter-spacing: -.02em; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='element']) { position: relative; min-width: 0; border: 1px solid var(--ginko-border); border-radius: .7rem; background: color-mix(in srgb, var(--ginko-bg) 96%, var(--ginko-text)); padding: 2.15rem .9rem .9rem; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='element']::before) { position: absolute; inset-block-start: .55rem; inset-inline-start: .75rem; content: attr(tag); color: var(--ginko-muted-text); font: 650 .68rem/1. ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; text-transform: uppercase; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']) { position: relative; min-height: 3.5rem; border: 1px dashed var(--ginko-border); border-radius: .5rem; padding: 1.8rem .7rem .5rem; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']::before) { position: absolute; inset-block-start: .45rem; inset-inline-start: .6rem; content: attr(name); color: var(--ginko-muted-text); font-size: .68rem; font-weight: 650; text-transform: uppercase; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='element'].ProseMirror-selectednode) { outline: 2px solid var(--ginko-text); outline-offset: 2px; }
.ginko-editor__surface :deep(.ProseMirror img) { display: block; max-width: 100%; height: auto; }
.ginko-editor__surface :deep(table) { width: 100%; border-collapse: collapse; }
.ginko-editor__surface :deep(td), .ginko-editor__surface :deep(th) { border: 1px solid var(--ginko-border); padding: .5rem; }
.ginko-editor__inspector { display: grid; grid-template-columns: minmax(10rem, .75fr) minmax(0, 1.25fr); gap: 1rem; border-top: 1px solid var(--ginko-border); background: var(--ginko-muted); padding: .9rem 1rem 1rem; }
.ginko-editor__inspector h3, .ginko-editor__inspector p { margin: 0; }
.ginko-editor__inspector h3 { font-size: 1rem; line-height: 1.3; }
.ginko-editor__inspector > div > p:last-child { margin-block-start: .2rem; color: var(--ginko-muted-text); font-size: .8rem; }
.ginko-editor__inspector-kicker { color: var(--ginko-muted-text); font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.ginko-editor__fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: .65rem; }
.ginko-editor__fields label { display: grid; align-content: start; gap: .25rem; color: var(--ginko-muted-text); font-size: .75rem; font-weight: 650; }
.ginko-editor__fields input:not([type='checkbox']), .ginko-editor__fields select { box-sizing: border-box; width: 100%; min-height: 2.5rem; border: 1px solid var(--ginko-border); border-radius: .45rem; background: var(--ginko-bg); color: var(--ginko-text); padding: .45rem .6rem; font: inherit; font-size: .875rem; font-weight: 400; }
.ginko-editor__fields input[type='checkbox'] { width: 1.25rem; height: 1.25rem; margin: .35rem 0; }
.ginko-editor__fields small { font-weight: 400; }
.ginko-editor__source { box-sizing: border-box; display: block; width: 100%; min-height: 280px; resize: vertical; border: 0; background: var(--ginko-bg); color: var(--ginko-text); padding: 1rem; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; outline: none; }
@media (max-width: 34rem) {
  .ginko-editor button { min-height: 2.75rem; }
  .ginko-editor__header { grid-template-columns: 1fr auto; }
  .ginko-editor__status { grid-column: 1 / -1; grid-row: 2; padding-inline: .65rem; }
  .ginko-editor__surface { padding: 1rem; }
  .ginko-editor__surface :deep(.ProseMirror) { min-height: 18rem; }
  .ginko-editor__inspector { grid-template-columns: 1fr; }
}
</style>
