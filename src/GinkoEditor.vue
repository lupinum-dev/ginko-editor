<script setup lang="ts">
import { closeHistory } from '@tiptap/pm/history'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
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
  VideoInfo,
  ImageUploadHandler,
} from './types'
import { parentColumnConfig } from './lib/nodeviews/columns'
import { actOnBlock } from './lib/nodeviews/block-actions'
import GinkoToolbar from './ui/GinkoToolbar.vue'
import { writingRecipes, recipeSymbol, isImageRecipe } from './ui/writingRecipes'

defineOptions({ name: 'GinkoEditor' })

const props = withDefaults(defineProps<{
  imageDropTarget?: globalThis.HTMLElement
  imageUpload?: ImageUploadHandler
  ariaLabel?: string
  assetProvider?: AssetProvider
  authoringKit?: AuthoringKitV1
  codeBlockTheme?: 'atom-dark' | 'dark' | 'default' | 'github-dark' | 'github-dim' | 'github-light' | 'visual-studio-dark'
  disabled?: boolean
  enableDebug?: boolean
  enableFiles?: boolean
  enableImages?: boolean
  enableImageMetadata?: boolean
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
  imageUpload: undefined,
  imageDropTarget: undefined,
  authoringKit: undefined,
  disabled: false,
  enableDebug: false,
  enableFiles: true,
  enableImages: true,
  enableImageMetadata: false,
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
  'request-image-metadata': [assetId: string]
  'pending-change': [pending: boolean]
  'request-video': [request: EditorAssetRequest<VideoInfo>]
  'update:modelValue': [value: string]
}>()

const viewMode = ref<'raw' | 'visual'>('raw')
const rawContent = ref(props.modelValue)
const conversionError = ref<ConversionErrorPayload | null>(null)
const clipboardError = ref<string>()
const hasPendingVisualChanges = ref(false)
const pendingImages = ref(0)
const imageUploadNotice = ref('')
const hasPendingChanges = computed(() => hasPendingVisualChanges.value || pendingImages.value > 0)
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
const editorRoot = ref<InstanceType<typeof globalThis.HTMLElement>>()
const insertMenu = ref<InstanceType<typeof globalThis.HTMLElement>>()
let menuResizeObserver: InstanceType<typeof globalThis.ResizeObserver> | undefined
watch(insertMenu, (element) => {
  menuResizeObserver?.disconnect()
  if (element) menuResizeObserver?.observe(element)
})
const insertPosition = ref({ left: '8px', top: '48px', maxHeight: '420px' })
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
    assetProvider: {
      buildUrl: asset => resolvedAssetProvider.value.buildUrl(asset),
      parseUrl: url => resolvedAssetProvider.value.parseUrl(url),
    },
    codeBlockTheme: props.codeBlockTheme,
    enableDebug: props.enableDebug,
    enableFiles: props.enableFiles,
    enableVideo: props.enableVideo,
    fileOutput: props.fileOutput,
    getAuthoringKit: () => props.authoringKit,
    getOutputOptions: () => outputOptions.value,
    canPaste: () => canMutateVisualContent(),
    onPasteError: message => { clipboardError.value = message },
    onCopyError: message => { clipboardError.value = message },
    getImageDropTarget: () => props.imageDropTarget,
    getImageUpload: () => props.imageUpload,
    canUploadImage: () => canMutateVisualContent(props.enableImages),
    insertUploadedImage: insertUploadedImageAt,
    onImageUploadPending: count => { pendingImages.value = count; if (!count) imageUploadNotice.value = '' },
    imageActions: imageProps => {
      const source = typeof imageProps.src === 'string' ? imageProps.src : ''
      const id = typeof imageProps.id === 'string' && imageProps.id ? imageProps.id : resolvedAssetProvider.value.parseUrl(source)?.id
      return {
        replace: props.enableImages ? requestImage : undefined,
        metadata: props.enableImageMetadata && id ? () => { if (canMutateVisualContent()) emit('request-image-metadata', id) } : undefined,
      }
    },
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
  const recipes = [...(props.authoringKit?.recipes ?? []), ...writingRecipes.filter(recipe => props.enableImages || !isImageRecipe(recipe))]
  if (!query) return recipes
  return recipes.filter((recipe) =>
    [recipe.id, recipe.label, recipe.description ?? '', ...(recipe.keywords ?? [])]
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
    node?: ProseMirrorNode
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
    label: metadata.label,
    tag,
  }
})

const activeRecipe = computed(() => filteredRecipes.value[insertIndex.value])
watch([insertQuery, activeRecipe], () => { void nextTick(positionInsertMenu) })

function positionInsertMenu() {
  const instance = editor.value
  const root = editorRoot.value
  if (!instance || !root || !insertMenuOpen.value) return
  const bounds = root.getBoundingClientRect()
  const anchor = insertMenuOrigin.value === 'slash'
    ? instance.view.coordsAtPos(insertSelection?.from ?? instance.state.selection.from)
    : { left: bounds.left + 12, bottom: bounds.top + 48, top: bounds.top + 48 }
  const below = globalThis.innerHeight - anchor.bottom - 20
  const above = anchor.top - 20
  const opensAbove = below < 240 && above > below
  const available = Math.max(160, Math.min(440, opensAbove ? above : below))
  const height = Math.min(insertMenu.value?.getBoundingClientRect().height || available, available)
  const top = opensAbove ? Math.max(12, anchor.top - height - 8) : anchor.bottom + 8
  insertPosition.value = {
    left: `${Math.max(8 - bounds.left, Math.min(anchor.left, globalThis.innerWidth - (insertMenu.value?.getBoundingClientRect().width || 320) - 12) - bounds.left)}px`,
    top: `${top - bounds.top}px`,
    maxHeight: `${available}px`,
  }
}

function dismissOutside(event: globalThis.PointerEvent) {
  if (!insertMenuOpen.value || !(event.target instanceof globalThis.Node)) return
  const ownTrigger = editorRoot.value?.querySelector('.ginko-editor__insert-trigger')
  if (!insertMenu.value?.contains(event.target) && !ownTrigger?.contains(event.target)) closeInsertMenu(false)
}

function canOpenSlashMenu(instance: TiptapEditor) {
  const { selection } = instance.state
  if (!selection.empty || selection.$from.parent.type.name !== 'paragraph') return false
  return selection.$from.parent.textBetween(0, selection.$from.parentOffset).trim() === ''
}

async function openInsertMenu(origin: 'button' | 'slash') {
  const instance = editor.value
  if (!instance || !canMutateVisualContent()) return
  insertSelection = { from: instance.state.selection.from, to: instance.state.selection.to }
  insertMenuOrigin.value = origin
  insertQuery.value = ''
  insertIndex.value = 0
  insertError.value = null
  insertMenuOpen.value = true
  const openingSelection = insertSelection
  await nextTick()
  if (!insertMenuOpen.value || insertSelection !== openingSelection) return
  positionInsertMenu()
  insertSearch.value?.focus()
}

function restoreInsertSelection(selection = insertSelection) {
  const instance = editor.value
  if (!instance || !selection) return
  instance.chain().setTextSelection(selection).run()
  instance.view.focus()
}

function closeInsertMenu(restore = true) {
  const selection = insertSelection
  insertMenuOpen.value = false
  insertQuery.value = ''
  insertError.value = null
  insertSelection = undefined
  if (restore) restoreInsertSelection(selection)
}

function moveInsertSelection(offset: number) {
  const count = filteredRecipes.value.length
  if (!count) return
  insertIndex.value = (insertIndex.value + offset + count) % count
  void nextTick(() => insertMenu.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }))
}

function parentComponentTag(instance: TiptapEditor): string | undefined {
  const resolved = instance.state.selection.$from
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const node = resolved.node(depth)
    if (node.type.name === 'element' && typeof node.attrs.tag === 'string') {
      return node.attrs.tag
    }
  }
  return undefined
}

function placementError(instance: TiptapEditor, document: JSONContent): string | undefined {
  const kit = props.authoringKit
  if (!kit) return undefined
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

function moveSelectedComponent(offset: -1 | 1) {
  const instance = editor.value, selected = selectedComponent.value
  if (instance && selected && !props.disabled) actOnBlock(instance, selected.node, selected.pos, offset < 0 ? 'up' : 'down')
}
function duplicateSelectedComponent() {
  const instance = editor.value, selected = selectedComponent.value
  if (instance && selected && !props.disabled && !parentColumnConfig(instance.state.doc, selected.pos, props.authoringKit)) actOnBlock(instance, selected.node, selected.pos, 'duplicate')
}

function handleComponentShortcut(event: BrowserKeyboardEvent) {
  if (!event.altKey || !selectedComponent.value) return false
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelectedComponent(event.key === 'ArrowUp' ? -1 : 1)
    return true
  }
  if (event.shiftKey && event.key.toLocaleLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelectedComponent()
    return true
  }
  return false
}

function isAtComponentBoundary(instance: TiptapEditor, direction: 'end' | 'start') {
  const selection = instance.state.selection
  if (!selection.empty) return false
  const resolved = selection.$from
  for (let depth = resolved.depth - 1; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name !== 'element') continue
    for (let childDepth = depth + 1; childDepth <= resolved.depth; childDepth += 1) {
      const parent = resolved.node(childDepth - 1)
      const index = resolved.index(childDepth - 1)
      if (direction === 'start' && index !== 0) return false
      if (direction === 'end' && index !== parent.childCount - 1) return false
    }
    return direction === 'start'
      ? resolved.parentOffset === 0
      : resolved.parentOffset === resolved.parent.content.size
  }
  return false
}

function protectComponentBoundary(instance: TiptapEditor, event: BrowserKeyboardEvent) {
  const direction = event.key === 'Backspace'
    ? 'start'
    : event.key === 'Delete'
      ? 'end'
      : undefined
  if (!direction || !isAtComponentBoundary(instance, direction)) return false
  event.preventDefault()
  return true
}

async function insertRecipe(recipe: AuthoringRecipeV1 | undefined) {
  const instance = editor.value
  if (!recipe || !instance || !insertSelection || insertBusy.value) return
  const documentAtStart = instance.state.doc
  const selectionAtStart = insertSelection
  if (isImageRecipe(recipe)) {
    restoreInsertSelection()
    closeInsertMenu(false)
    requestImage()
    return
  }
  insertBusy.value = true
  insertError.value = null
  try {
    const prepared = await prepareMarkdownForVisualEditing(
      recipe.source,
      outputOptions.value,
      instance.schema,
      props.authoringKit,
    )
    if (disposed || !insertMenuOpen.value || insertSelection !== selectionAtStart || instance.state.doc !== documentAtStart || !canMutateVisualContent()) return
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
    instance.view.focus()
  } finally {
    insertBusy.value = false
  }
}

function handleInsertKeys(event: BrowserKeyboardEvent) {
  if (event.isComposing) return false
  if (event.key === 'Tab') {
    closeInsertMenu(false)
    return false
  }
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
  if (protectComponentBoundary(instance, event)) return
  if (handleComponentShortcut(event)) return
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
  editor.value?.commands.clearImageUploads()
  clipboardError.value = undefined
  closeInsertMenu(false)
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
  if (pendingImages.value) {
    imageUploadNotice.value = 'Finish or remove the image upload before leaving the editor.'
    return { ok: false, error: { code: 'image_upload_pending', phase: 'validate', message: imageUploadNotice.value, recoverable: true, traceId: 'image-upload', issues: [], timeline: [] } }
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
    pendingVisualUpdate = emitVisualDocument(instance.getJSON(), currentRevision, props.authoringKit)
    const result = await pendingVisualUpdate
    if (currentRevision === revision) pendingVisualUpdate = undefined
    if (!result.ok) return result
    emitted ||= result.emitted
    if (currentRevision !== revision) continue
  }

  if (pendingImages.value) return flush()
  if (conversionError.value) return { error: conversionError.value, ok: false }
  return { emitted, ok: true }
}

async function showSource() {
  const result = await flush()
  if (!result.ok || disposed) return
  closeInsertMenu(false)
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

function storedAssetSource(asset: Partial<AssetInfo>) {
  // A host-owned provider uses the stable id as canonical source and resolves
  // display URLs separately. Without a provider, a supplied URL is already the
  // only durable source; do not discard it merely because metadata also has an id.
  if (props.assetProvider && asset.id) return asset.id
  return asset.url || asset.id || resolvedAssetProvider.value.buildUrl(asset)
}

function imagePayload(asset: Partial<AssetInfo>) {
  const src = storedAssetSource(asset)
  if (!src.trim()) return
  return { alt: asset.alt, filename: asset.filename, height: asset.height, id: asset.id, src, title: asset.title, width: asset.width, fit: asset.fit, quality: asset.quality, focalX: asset.focalX, focalY: asset.focalY, cropX: asset.cropX, cropY: asset.cropY, cropWidth: asset.cropWidth, cropHeight: asset.cropHeight }
}

function insertImageAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableImages)) return false
  const payload = imagePayload(asset)
  if (!payload) return false
  return instance.isActive('image')
    ? instance.chain().focus().updateAttributes('image', { props: payload }).run()
    : instance.chain().focus().setImage(payload).run()
}

function insertUploadedImageAt(asset: Partial<AssetInfo>, pos: number, replaceSize = 0): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableImages)) return false
  const payload = imagePayload(asset)
  if (!payload) return false
  return instance.chain().command(({ tr }) => { closeHistory(tr); return true }).insertContentAt({ from: pos, to: pos + replaceSize }, { type: 'image', attrs: { props: payload } }, { updateSelection: false }).run()
}

function insertFileAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableFiles)) return false
  const src = storedAssetSource(asset)
  if (!src.trim()) return false
  const payload = { filename: asset.filename, id: asset.id, size: asset.size, src, title: asset.title || asset.filename, type: asset.mimeType }
  return instance.isActive('file')
    ? instance.chain().focus().updateAttributes('file', { props: payload }).run()
    : instance.chain().focus().setFile(payload).run()
}

function insertVideo(value: VideoInfo): boolean {
  const instance = editor.value
  if (!instance || !value.src.trim() || !canMutateVisualContent(props.enableVideo)) return false
  const payload = { src: value.src.trim(), title: value.title?.trim() || undefined }
  return instance.isActive('video')
    ? instance.chain().focus().updateAttributes('video', { props: payload, ...payload }).run()
    : instance.chain().focus().setVideo(payload).run()
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
  const requestSelectionRevision = selectionRevision.value
  const requestContext = assetContextRevision
  let settled = false
  return {
    complete(value) {
      if (settled) return false
      settled = true
      if (
        value === null ||
        !instance ||
        editor.value !== instance ||
        revision !== requestRevision ||
        assetContextRevision !== requestContext ||
        selectionRevision.value !== requestSelectionRevision ||
        !requestDocument?.eq(instance.state.doc) ||
        !requestSelection?.eq(instance.state.selection)
      ) return false
      return complete(value)
    },
  }
}

function requestImage() {
  if (!canMutateVisualContent(props.enableImages)) return
  if (props.imageUpload) { editor.value?.commands.insertImageUpload(); return }
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
watch(hasPendingChanges, (pending) => emit('pending-change', pending), {
  flush: 'sync',
})
let assetContextRevision = 0
watch([viewMode, () => props.disabled, () => props.enableImages, () => props.enableFiles, () => props.enableVideo, () => props.assetProvider], () => {
  assetContextRevision += 1
}, { flush: 'sync' })
watch([() => props.imageDropTarget, () => props.assetProvider, () => props.enableImageMetadata, () => props.enableImages], () => {
  const instance = editor.value
  if (instance && !instance.isDestroyed) instance.view.dispatch(instance.state.tr)
})
watch([() => props.imageUpload, () => props.disabled, () => props.enableImages, () => props.assetProvider, () => props.authoringKit], () => { editor.value?.commands.clearImageUploads() }, { flush: 'sync' })
watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled)
  if (disabled) closeInsertMenu(false)
}, { flush: 'sync' })
watch(() => props.authoringKit, () => {
  void (async () => {
    const result = await flush()
    if (!result.ok) return
    await loadSource(rawContent.value)
  })()
})

onMounted(() => {
  if (globalThis.ResizeObserver) menuResizeObserver = new globalThis.ResizeObserver(positionInsertMenu)
  void loadSource(props.modelValue, { initial: true })
  globalThis.document.addEventListener('pointerdown', dismissOutside)
  globalThis.addEventListener('resize', positionInsertMenu)
  globalThis.addEventListener('scroll', positionInsertMenu, true)
})
onBeforeUnmount(() => {
  globalThis.document.removeEventListener('pointerdown', dismissOutside)
  globalThis.removeEventListener('resize', positionInsertMenu)
  globalThis.removeEventListener('scroll', positionInsertMenu, true)
  menuResizeObserver?.disconnect()
  disposed = true
  cancelPendingUpdate()
  editor.value?.destroy()
})

const statusLabel = computed(() => {
  if (conversionError.value) return viewMode.value === 'visual' ? 'Changes need attention' : 'Source only'
  if (hasPendingVisualChanges.value) return 'Converting changes'
  return viewMode.value === 'visual' ? 'Visual editor' : 'Markdown source'
})

defineExpose({
  editor,
  flush,
  hasPendingChanges: () => hasPendingChanges.value,
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
    ref="editorRoot"
    class="ginko-editor"
    :data-mode="viewMode"
    :data-invalid="conversionError ? 'true' : undefined"
  >
    <div class="ginko-editor__header">
      <button
        v-if="viewMode === 'visual'"
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
      ref="insertMenu"
      class="ginko-editor__insert-menu"
      :class="{ 'ginko-editor__insert-menu--preview': activeRecipe && !isImageRecipe(activeRecipe) && $slots['recipe-preview'] }"
      :style="insertPosition"
      @keydown="handleInsertSearchKeydown"
    >
      <label class="ginko-editor__insert-search">
        <span aria-hidden="true">/</span>
        <span class="ginko-editor__sr-only">Search blocks</span>
        <input
          ref="insertSearch"
          v-model="insertQuery"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="insertMenuId"
          :aria-activedescendant="activeRecipe ? `${insertMenuId}-${insertIndex}` : undefined"
          autocomplete="off"
          placeholder="Search blocks"
        >
      </label>
      <div
        :id="insertMenuId"
        class="ginko-editor__insert-results"
        role="listbox"
        aria-label="Available blocks"
      >
        <button
          v-for="(recipe, index) in filteredRecipes"
          :id="`${insertMenuId}-${index}`"
          :key="`${index}-${recipe.id}`"
          tabindex="-1"
          type="button"
          role="option"
          :aria-selected="index === insertIndex"
          @mouseenter="insertIndex = index"
          @click="insertRecipe(recipe)"
        >
          <span
            class="ginko-editor__recipe-symbol"
            aria-hidden="true"
          >{{ recipeSymbol(recipe) }}</span>
          <span class="ginko-editor__recipe-text"><strong>{{ recipe.label }}</strong><small>{{ recipe.description || (recipe.keywords?.length ? `/${recipe.keywords[0]}` : `Insert ${recipe.label.toLocaleLowerCase()}`) }}</small></span>
          <span
            v-if="index === insertIndex"
            aria-hidden="true"
          >↵</span>
        </button>
        <p
          v-if="filteredRecipes.length === 0"
          class="ginko-editor__insert-empty"
        >
          No matching blocks.
        </p>
      </div>
      <div
        v-if="activeRecipe && !isImageRecipe(activeRecipe) && $slots['recipe-preview']"
        class="ginko-editor__recipe-preview"
      >
        <slot
          name="recipe-preview"
          :recipe="activeRecipe"
        />
      </div>
      <p
        v-if="insertError"
        class="ginko-editor__insert-error"
        role="alert"
      >
        {{ insertError }}
      </p>
      <p class="ginko-editor__insert-help">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> insert</span><span><kbd>esc</kbd> close</span>
      </p>
    </div>
    <div
      v-if="clipboardError"
      class="ginko-editor__warning"
      role="alert"
    >
      {{ clipboardError }}
    </div>
    <div
      v-if="conversionError"
      class="ginko-editor__warning"
      role="alert"
    >
      <strong>{{ viewMode === 'visual' ? 'Your changes are still here. Correct the document or use Undo before switching modes.' : 'Visual editing is unavailable for this source.' }}</strong>
      <span>{{ conversionError.message }}</span>
    </div>
    <p
      v-if="imageUploadNotice"
      class="ginko-editor__clipboard-error"
      role="alert"
    >
      {{ imageUploadNotice }}
    </p>
    <template v-if="viewMode === 'visual' && editor">
      <GinkoToolbar
        v-if="!disabled"
        :editor="editor"
        :enable-files="enableFiles"
        :enable-images="enableImages"
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
.ginko-editor { --ginko-border: var(--border, #e5e5e3); --ginko-bg: var(--card, #fff); --ginko-muted: var(--muted, #f3f3f1); --ginko-muted-text: var(--muted-foreground, #6f6f6b); --ginko-text: var(--foreground, #292925); position: relative; overflow: visible; border: 1px solid var(--ginko-border); border-radius: .85rem; background: var(--ginko-bg); color: var(--ginko-text); font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
.ginko-editor button { min-height: 2.25rem; border: 0; border-radius: .4rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .65rem; white-space: nowrap; }
.ginko-editor button:hover, .ginko-editor button[aria-pressed='true'] { background: var(--ginko-muted); }
.ginko-editor button:focus-visible, .ginko-editor input:focus-visible, .ginko-editor select:focus-visible, .ginko-editor textarea:focus-visible { outline-offset: 2px; }
.ginko-editor__header { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: .5rem; border-bottom: 1px solid var(--ginko-border); padding: .45rem .55rem; }
.ginko-editor__insert-trigger { justify-self: start; display: inline-flex; align-items: center; gap: .35rem; font-weight: 650; }
.ginko-editor__insert-trigger span[aria-hidden='true'] { font-size: 1.2rem; line-height: 1; }
.ginko-editor__modes { display: flex; gap: .2rem; }
.ginko-editor__status { color: var(--ginko-muted-text); font-size: .78rem; white-space: nowrap; }
.ginko-editor__sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* The menu overlays the page without changing the writer's document geometry. */
.ginko-editor__insert-menu { position: absolute; z-index: 50; display: flex; flex-direction: column; width: min(320px, calc(100vw - 24px)); overflow: hidden; border: 1px solid var(--ginko-border); border-radius: .75rem; background: var(--ginko-bg); box-shadow: 0 12px 40px rgb(0 0 0 / .16), 0 2px 6px rgb(0 0 0 / .06); padding: .35rem; }
@media (min-width: 700px) {
  .ginko-editor__insert-menu--preview { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto; width: min(620px, calc(100vw - 24px)); }
  .ginko-editor__insert-menu--preview .ginko-editor__insert-search, .ginko-editor__insert-menu--preview .ginko-editor__insert-results, .ginko-editor__insert-menu--preview .ginko-editor__insert-help, .ginko-editor__insert-menu--preview .ginko-editor__insert-error { grid-column: 1; }
  .ginko-editor__insert-menu--preview .ginko-editor__recipe-preview { display: flex; align-items: safe center; min-width: 0; grid-column: 2; grid-row: 1 / 5; max-height: none; margin: -.35rem -.35rem -.35rem .35rem; padding: 1.1rem; border-top: 0; border-left: 1px solid var(--ginko-border); background: color-mix(in srgb, var(--ginko-bg) 97%, var(--ginko-text)); }
}
.ginko-editor__insert-search { display: flex; align-items: center; gap: .65rem; border-bottom: 1px solid var(--ginko-border); margin: 0 .35rem .35rem; padding: .2rem .35rem .55rem; color: var(--ginko-muted-text); }
.ginko-editor__insert-search input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--ginko-text); padding: .4rem 0; font: inherit; }
.ginko-editor__insert-search:focus-within { border-bottom-color: var(--ginko-muted-text); }
.ginko-editor__insert-results { overflow-y: auto; overscroll-behavior: contain; min-height: 48px; flex: 1 1 auto; }
.ginko-editor__insert-results button { display: flex; align-items: center; gap: .7rem; width: 100%; min-height: 57px; padding: .5rem; text-align: start; white-space: normal; }
.ginko-editor__insert-results button[aria-selected='true'] { background: var(--ginko-muted); }
.ginko-editor__recipe-symbol { display: grid; place-items: center; flex: 0 0 35px; height: 35px; border: 1px solid var(--ginko-border); border-radius: .4rem; background: var(--ginko-bg); font: 500 16px/1 ui-sans-serif, system-ui, sans-serif; }
.ginko-editor__recipe-text { display: grid; gap: .1rem; flex: 1; }
.ginko-editor__recipe-text strong { font-size: .85rem; font-weight: 550; }
.ginko-editor__recipe-text small { font-size: .73rem; color: var(--ginko-muted-text); line-height: 1.4; }
.ginko-editor__recipe-preview { flex: 0 0 auto; max-height: 150px; overflow: auto; border-top: 1px solid var(--ginko-border); padding: .7rem; }
.ginko-editor__insert-empty, .ginko-editor__insert-error { margin: 0; padding: .75rem; font-size: .85rem; }
.ginko-editor__insert-empty { color: var(--ginko-muted-text); }
.ginko-editor__insert-error { color: #b54a35; }
.ginko-editor__insert-help { display: flex; justify-content: space-between; gap: .5rem; border-top: 1px solid var(--ginko-border); margin: .3rem 0 0; padding: .55rem .35rem .15rem; color: var(--ginko-muted-text); font-size: .68rem; }
.ginko-editor__insert-help kbd { font: inherit; margin-inline-end: .2rem; }
.ginko-editor__warning { display: grid; gap: .15rem; border-bottom: 1px solid #e4a11b; background: #fff8e6; padding: .65rem .8rem; color: #5c4300; }
.ginko-editor__surface { padding: clamp(1rem, 3vw, 1.75rem); }
.ginko-editor__surface :deep(.ProseMirror) { max-width: 46rem; min-height: 22rem; margin-inline: auto; outline: none; font-size: 1rem; line-height: 1.7; }
.ginko-editor__surface :deep(.ProseMirror p.mdc-editor-empty:first-child::before) { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: var(--ginko-muted-text); }
.ginko-editor__surface :deep(.ProseMirror h1) { font-size: 2rem; font-weight: 650; }
.ginko-editor__surface :deep(.ProseMirror h2) { font-size: 1.5rem; font-weight: 650; }
.ginko-editor__surface :deep(.ProseMirror h3) { font-size: 1.2rem; font-weight: 650; }
.ginko-editor__surface :deep(.ProseMirror ul) { list-style: disc; padding-inline-start: 1.5rem; }
.ginko-editor__surface :deep(.ProseMirror ol) { list-style: decimal; padding-inline-start: 1.5rem; }
.ginko-editor__surface :deep(.ProseMirror blockquote) { border-inline-start: 3px solid var(--ginko-text); padding-inline-start: 1rem; margin-inline: 0; }
.ginko-editor__surface :deep(.ProseMirror pre) { background: var(--ginko-muted); border-radius: .5rem; padding: 1rem; overflow-x: auto; }
.ginko-editor__surface :deep(.ProseMirror > :first-child) { margin-top: 0; }
.ginko-editor__surface :deep(.ProseMirror > * + *) { margin-block-start: 1em; }
.ginko-editor__surface :deep(.ProseMirror h1), .ginko-editor__surface :deep(.ProseMirror h2), .ginko-editor__surface :deep(.ProseMirror h3) { line-height: 1.2; letter-spacing: -.02em; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']) { position: relative; min-height: 3.5rem; border: 1px dashed var(--ginko-border); border-radius: .5rem; padding: 1.8rem .7rem .5rem; }
.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']::before) { position: absolute; inset-block-start: .45rem; inset-inline-start: .6rem; content: attr(name); color: var(--ginko-muted-text); font-size: .68rem; font-weight: 650; text-transform: uppercase; }
.ginko-editor__surface :deep(.ProseMirror img) { display: block; max-width: 100%; height: auto; }
.ginko-editor__surface :deep(table) { width: 100%; border-collapse: collapse; }
.ginko-editor__surface :deep(td), .ginko-editor__surface :deep(th) { border: 1px solid var(--ginko-border); padding: .5rem; }
.ginko-editor__source { box-sizing: border-box; display: block; width: 100%; min-height: 280px; resize: vertical; border: 0; background: var(--ginko-bg); color: var(--ginko-text); padding: 1rem; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; outline: none; }
@media (max-width: 34rem) {
  .ginko-editor button { min-height: 2.75rem; }
  .ginko-editor__header { grid-template-columns: 1fr auto; }
  .ginko-editor__status { grid-column: 1 / -1; grid-row: 2; padding-inline: .65rem; }
  .ginko-editor__surface { padding: 1rem; }
  .ginko-editor__surface :deep(.ProseMirror) { min-height: 18rem; }
}
</style>
