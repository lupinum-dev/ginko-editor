<script setup lang="ts">
import { closeHistory } from '@tiptap/pm/history'
import type { Selection } from '@tiptap/pm/state'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  useId,
  watch,
} from 'vue'

import type { AuthoringKitV1, AuthoringRecipeV1 } from './authoring'
import type { EditorCollaborationSession } from './collaboration'
import type { CollaborationStatus } from './collaboration'
import type { EditorMessageKey } from './ui/messages'
import { SetNodePropertyStep, SetNodeAttributeStep } from './lib/property-step'
import type { JsonRecord } from './types'
import {
  createEditorExtensions,
  isCurrentlyNormalizingTable,
  normalizeTableCells,
} from './lib/config/editorConfig'
import type {
  ConversionErrorPayload,
  ConversionRecoveredPayload,
  ConversionResult,
} from './lib/conversionPipeline'
import {
  applyTiptapDocToEditor,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
  validateMarkdownForAuthoring,
} from './lib/conversionPipeline'
import { toConversionErrorPayload } from './lib/conversionState'
import type {
  AssetInfo,
  AssetProvider,
  EditorAssetRequest,
  EditorFlushResult,
  VideoInfo,
  ImageUploadHandler,
  ImagePicker,
} from './types'
import GinkoToolbar from './ui/GinkoToolbar.vue'
import GinkoSelectionToolbar from './ui/GinkoSelectionToolbar.vue'
import { handleBlockShortcut } from './ui/block-shortcuts'
import {
  observeEditorOperations,
  waitForEditorOperations,
  type EditorOperationContext,
} from './lib/editor-operations'
import {
  useEditorActions,
  handleActionShortcut,
  hasCustomActionShortcut,
  matchesShortcut,
  type EditorMessages,
  type EditorShortcuts,
  type EditorToolbarGroup,
} from './ui/commands'
import { createEditorOverlayController, editorOverlayKey } from './ui/context'
import { writingRecipes, recipeSymbol, isImageRecipe, recipeCopy, searchRecipes } from './ui/writingRecipes'
import { runRecipeCommand } from './ui/recipe-command'
import { SlashCommands, slashKey } from './ui/slash-command'

defineOptions({ name: 'GinkoEditor' })

const props = withDefaults(defineProps<{
  toolbarItems?: readonly EditorToolbarGroup[]
  messages?: EditorMessages
  shortcuts?: EditorShortcuts
  overlayContainer?: globalThis.HTMLElement
  imageDropTarget?: globalThis.HTMLElement
  imageUpload?: ImageUploadHandler
  imagePicker?: ImagePicker
  ariaLabel?: string
  assetProvider?: AssetProvider
  authoringKit?: AuthoringKitV1
  collaboration?: EditorCollaborationSession
  codeBlockTheme?:
    | 'atom-dark'
    | 'dark'
    | 'default'
    | 'github-dark'
    | 'github-dim'
    | 'github-light'
    | 'visual-studio-dark'
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
  toolbarItems: undefined,
  messages: undefined,
  shortcuts: undefined,
  overlayContainer: undefined,
  imagePicker: undefined,
  ariaLabel: undefined,
  assetProvider: undefined,
  imageUpload: undefined,
  imageDropTarget: undefined,
  authoringKit: undefined,
  collaboration: undefined,
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

const collaboration = props.collaboration
const collaborationState = ref(collaboration?.state)
const invalidBinding = ref(false)
const stopCollaborationState = collaboration?.subscribe(state => { collaborationState.value = state })
const viewMode = ref<'raw' | 'visual'>(collaboration ? 'visual' : 'raw')
const rawContent = ref(props.modelValue)
const conversionError = ref<ConversionErrorPayload | null>(null)
const clipboardError = ref<string>()
const hasPendingVisualChanges = ref(false)
const pendingImages = ref(0)
const pendingCommands = ref(0)
const imageUploadNotice = ref('')
const hasPendingChanges = computed(() =>
  hasPendingVisualChanges.value || pendingImages.value > 0 || pendingCommands.value > 0
    || (collaborationState.value?.pendingSteps ?? 0) > 0,
)
let pendingEcho: string | undefined
let revision = 0
let syncTimer: ReturnType<typeof globalThis.setTimeout> | undefined
let pendingVisualUpdate: Promise<EditorFlushResult> | undefined
let disposed = false
let applyingDocument = false
const selectionRevision = ref(0)
const insertOverlayOwner = {}
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
const overlays = createEditorOverlayController({
  getContainer: () => props.overlayContainer ?? editorRoot.value,
  getThemeElement: () => editorRoot.value,
  getMessages: () => props.messages,
})
provide(editorOverlayKey, overlays)
const insertMenu = ref<InstanceType<typeof globalThis.HTMLElement>>()
let menuResizeObserver: InstanceType<typeof globalThis.ResizeObserver> | undefined
watch(insertMenu, (element) => {
  menuResizeObserver?.disconnect()
  if (element) menuResizeObserver?.observe(element)
})
const insertPosition = ref({ left: '8px', top: '48px', maxHeight: '420px' })
let insertSelection: Selection | undefined

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
  content: collaboration?.initialDocument ?? { content: [{ type: 'paragraph' }], type: 'doc' },
  editable: !props.disabled && (collaboration?.canEdit ?? true),
  editorProps: { attributes: { 'aria-label': props.ariaLabel ?? 'Content' } },
  extensions: [...createEditorExtensions({
    overlay: overlays,
    getMessages: () => props.messages,
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
    getImagePicker: () => props.imagePicker,
    canUploadImage: () => canMutateVisualContent(props.enableImages),
    insertUploadedImage: insertUploadedImageAt,
    onImageUploadPending: count => { pendingImages.value = count; if (!count) imageUploadNotice.value = '' },
    imageActions: imageProps => {
      const source = typeof imageProps.src === 'string' ? imageProps.src : ''
      const id = typeof imageProps.id === 'string' && imageProps.id
        ? imageProps.id
        : resolvedAssetProvider.value.parseUrl(source)?.id
      return {
        replace: props.enableImages ? requestImage : undefined,
        metadata: props.enableImageMetadata && id
          ? () => {
            if (canMutateVisualContent()) emit('request-image-metadata', id)
          }
          : undefined,
      }
    },
    imageOutput: props.imageOutput,
    placeholder: props.placeholder,
    showMarkdownMarkers: props.showMarkdownMarkers,
    videoOutput: props.videoOutput,
  }), SlashCommands.configure({ enabled: () => !applyingDocument && canMutateVisualContent() }),
  ...(collaboration ? [collaboration.extension] : [])],
  onTransaction: ({ editor: instance }) => { syncSlashMenu(instance) },
  onUpdate: ({ editor: instance, transaction }) => {
    selectionRevision.value += 1
    if (transaction.docChanged && insertMenuOpen.value && insertMenuOrigin.value === 'button') closeInsertMenu(false)
    if (!isCurrentlyNormalizingTable(instance) && normalizeTableCells(instance)) return
    if (!applyingDocument && transaction.docChanged) scheduleVisualUpdate(instance)
  },
  onSelectionUpdate: () => {
    selectionRevision.value += 1
  },
})

watch(editor, (instance, _, cleanup) => {
  pendingCommands.value = 0
  if (instance) cleanup(observeEditorOperations(instance, count => { pendingCommands.value = count }))
}, { immediate: true, flush: 'sync' })

const operationContext: EditorOperationContext = {
  getAuthoringKit: () => props.authoringKit,
  getOutputOptions: () => outputOptions.value,
  canMutate: () => canMutateVisualContent(),
}
const actions = useEditorActions(editor, {
  enabled: () => canMutateVisualContent(),
  messages: () => props.messages,
  shortcuts: () => props.shortcuts,
  image: requestImage, file: requestFile, video: requestVideo,
  insert: () => { void openInsertMenu('button') },
  mediaEnabled: kind => kind === 'image' ? props.enableImages : kind === 'file' ? props.enableFiles : props.enableVideo,
  context: operationContext,
})

const filteredRecipes = computed(() => {
  const recipes = [
    ...(props.authoringKit?.recipes ?? []),
    ...writingRecipes.filter(recipe => props.enableImages || !isImageRecipe(recipe)),
  ]
  return searchRecipes(recipes, insertQuery.value, recipe => recipeCopy(recipe, overlays.text))
})

watch(filteredRecipes, () => {
  insertIndex.value = Math.min(insertIndex.value, Math.max(0, filteredRecipes.value.length - 1))
})

const activeRecipe = computed(() => filteredRecipes.value[insertIndex.value])
watch([insertQuery, activeRecipe], () => { void nextTick(positionInsertMenu) })
watch([insertMenuOpen, insertMenuOrigin, insertIndex, activeRecipe], () => {
  const slashOpen = insertMenuOpen.value && insertMenuOrigin.value === 'slash'
  editor.value?.setOptions({ editorProps: { attributes: {
    'aria-label': props.ariaLabel ?? 'Content',
    role: slashOpen ? 'combobox' : 'textbox',
    'aria-multiline': 'true',
    ...(slashOpen ? {
      'aria-autocomplete': 'list',
      'aria-expanded': 'true',
      'aria-controls': insertMenuId,
      ...(activeRecipe.value ? { 'aria-activedescendant': `${insertMenuId}-${insertIndex.value}` } : {}),
    } : {}),
  } } })
})

function positionInsertMenu() {
  const instance = editor.value
  const root = editorRoot.value
  if (!instance || !root || !insertMenuOpen.value) return
  if (insertSelection?.$from.doc !== instance.state.doc) { closeInsertMenu(false); return }
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
    left: `${Math.max(
      8,
      Math.min(
        anchor.left,
        globalThis.innerWidth - (insertMenu.value?.getBoundingClientRect().width || 320) - 12,
      ),
    )}px`,
    top: `${top}px`,
    maxHeight: `${available}px`,
  }
}

function dismissOutside(event: globalThis.PointerEvent) {
  if (!insertMenuOpen.value || !(event.target instanceof globalThis.Node)) return
  const ownTrigger = editorRoot.value?.querySelector('.ginko-editor__insert-trigger')
  if (!insertMenu.value?.contains(event.target) && !ownTrigger?.contains(event.target)) closeInsertMenu(false)
}

function syncSlashMenu(instance: TiptapEditor) {
  if (insertMenuOpen.value && insertMenuOrigin.value === 'button') return
  const range = slashKey.getState(instance.state)?.active
  if (!range || !canMutateVisualContent() || instance.view.composing) {
    if (insertMenuOpen.value) closeInsertMenu(false, false)
    return
  }
  if (!insertMenuOpen.value) void openInsertMenu('slash')
  insertSelection = instance.state.selection
  if (insertQuery.value !== range.query) insertIndex.value = 0
  insertQuery.value = range.query
  void nextTick(positionInsertMenu)
}

async function openInsertMenu(origin: 'button' | 'slash') {
  const instance = editor.value
  if (!instance || !canMutateVisualContent()) return
  insertSelection = instance.state.selection
  insertMenuOrigin.value = origin
  insertQuery.value = ''
  insertIndex.value = 0
  insertError.value = null
  overlays.open(insertOverlayOwner, () => closeInsertMenu(false))
  insertMenuOpen.value = true
  const openingSelection = insertSelection
  await nextTick()
  if (!insertMenuOpen.value || insertSelection !== openingSelection) return
  positionInsertMenu()
  if (origin === 'button') insertSearch.value?.focus()
}

function restoreInsertSelection(selection = insertSelection) {
  const instance = editor.value
  if (!instance || !selection || selection.$from.doc !== instance.state.doc) return
  instance.view.dispatch(instance.state.tr.setSelection(selection))
  instance.view.focus()
}

function closeInsertMenu(restore = true, dismissSlash = true) {
  const selection = insertSelection
  insertMenuOpen.value = false
  overlays.release(insertOverlayOwner)
  insertQuery.value = ''
  insertError.value = null
  insertSelection = undefined
  if (dismissSlash && editor.value && slashKey.getState(editor.value.state)?.active) {
    editor.value.view.dispatch(editor.value.state.tr.setMeta(slashKey, 'dismiss'))
  }
  if (restore) restoreInsertSelection(selection)
}

function moveInsertSelection(offset: number) {
  const count = filteredRecipes.value.length
  if (!count) return
  insertIndex.value = (insertIndex.value + offset + count) % count
  void nextTick(() => insertMenu.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }))
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
  const selectionAtStart = insertSelection
  const range = insertMenuOrigin.value === 'slash' ? slashKey.getState(instance.state)?.active : undefined
  if (selectionAtStart.$from.doc !== instance.state.doc) { closeInsertMenu(false); return }
  if (isImageRecipe(recipe)) {
    restoreInsertSelection()
    closeInsertMenu(false)
    requestImage(range)
    return
  }
  insertBusy.value = true
  insertError.value = null
  try {
    restoreInsertSelection(selectionAtStart)
    const result = await runRecipeCommand(instance, recipe, {
      ...operationContext,
      canMutate: () =>
        !disposed
        && insertMenuOpen.value
        && insertSelection === selectionAtStart
        && canMutateVisualContent(),
    }, range)
    if (disposed) return
    if (result.ok) { closeInsertMenu(false); instance.view.focus(); return }
    if (!insertMenuOpen.value || insertSelection !== selectionAtStart) return
    if (result.reason !== 'stale') insertError.value = overlays.text('insertFailed')
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
  if (
    hasCustomActionShortcut(event, props.shortcuts)
    && handleActionShortcut(instance, event, actions.value, props.shortcuts)
  ) {
    return
  }

  const customBlockShortcut = typeof props.shortcuts?.duplicate === 'string'
    && matchesShortcut(event, props.shortcuts.duplicate)

  if (
    customBlockShortcut
    && !insertMenuOpen.value
    && handleBlockShortcut(instance, event, operationContext, props.shortcuts)
  ) {
    return
  }
  if (handleActionShortcut(instance, event, actions.value, props.shortcuts)) return
  if (protectComponentBoundary(instance, event)) return
  if (!insertMenuOpen.value && handleBlockShortcut(instance, event, operationContext, props.shortcuts)) return
  if (insertMenuOpen.value) handleInsertKeys(event)
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
  if (collaboration || invalidBinding.value) return false
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

async function flushLocal(): Promise<EditorFlushResult> {
  const currentEditor = editor.value
  if (currentEditor) await waitForEditorOperations(currentEditor)
  if (viewMode.value === 'raw' && !collaboration) return { emitted: false, ok: true }
  if (pendingImages.value) {
    imageUploadNotice.value = overlays.text('finishImageUpload')
    return {
      ok: false,
      error: {
        code: 'image_upload_pending',
        phase: 'validate',
        message: imageUploadNotice.value,
        recoverable: true,
        traceId: 'image-upload',
        issues: [],
        timeline: [],
      },
    }
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

  if (pendingImages.value || pendingCommands.value) {
    const result = await flushLocal()
    return result.ok ? { ok: true, emitted: emitted || result.emitted } : result
  }
  if (conversionError.value) return { error: conversionError.value, ok: false }
  return { emitted, ok: true }
}

async function flush(): Promise<EditorFlushResult> {
  const result = await flushLocal()
  if (!result.ok || !collaboration) return result
  try {
    let emitted = result.emitted
    do {
      await collaboration.flush()
      const latest = await flushLocal()
      if (!latest.ok) return latest
      emitted ||= latest.emitted
    } while (collaboration.state.pendingSteps || hasPendingVisualChanges.value)
    return { ok: true, emitted }
  } catch (error) {
    return { ok: false, error: { code: 'collaboration_pending', phase: 'validate',
      message: error instanceof Error ? error.message : overlays.text('sharedError'), recoverable: true,
      traceId: 'collaboration', issues: [], timeline: [] } }
  }
}

async function showSource() {
  const result = await flushLocal()
  if (!result.ok || disposed) return
  overlays.close()
  closeInsertMenu(false)
  viewMode.value = 'raw'
}

async function showVisual() {
  if (viewMode.value === 'visual') return
  if (collaboration) { viewMode.value = 'visual'; return }
  await loadSource(rawContent.value, { switchToVisual: true })
}

function updateRaw(value: string) {
  if (collaboration || invalidBinding.value) return
  cancelPendingUpdate()
  rawContent.value = value
  emitSource(value)
}

function canMutateVisualContent(featureEnabled = true) {
  return featureEnabled
    && !disposed
    && !props.disabled
    && !invalidBinding.value
    && (collaboration?.canEdit ?? true)
    && viewMode.value === 'visual'
    && editor.value?.isEditable === true
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
  return {
    alt: asset.alt,
    filename: asset.filename,
    height: asset.height,
    id: asset.id,
    src,
    title: asset.title,
    width: asset.width,
    fit: asset.fit,
    quality: asset.quality,
    focalX: asset.focalX,
    focalY: asset.focalY,
    cropX: asset.cropX,
    cropY: asset.cropY,
    cropWidth: asset.cropWidth,
    cropHeight: asset.cropHeight,
  }
}

function insertImageAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableImages)) return false
  const payload = imagePayload(asset)
  if (!payload) return false
  return instance.isActive('image')
    ? replaceSelectedMedia('image', payload)
    : instance.chain().focus().setImage(payload).run()
}

function replaceMediaAt(type: 'image' | 'file' | 'video', pos: number, payload: JsonRecord): boolean {
  const instance = editor.value
  const node = instance?.state.doc.nodeAt(pos)
  if (!instance || node?.type.name !== type || !canMutateVisualContent()) return false
  const transaction = closeHistory(instance.state.tr)
  for (const [key, value] of Object.entries(payload)) {
    // Description/title belong to this placement. A picker may supply an
    // explicit replacement, but missing asset metadata must not clear them.
    if (type === 'image' && ['alt', 'title'].includes(key) && value === undefined) continue
    if (node.attrs.props?.[key] !== value) transaction.step(new SetNodePropertyStep(pos, key, value))
    if (type === 'video' && ['src', 'title'].includes(key) && node.attrs[key] !== (value ?? null)) {
      transaction.step(new SetNodeAttributeStep(pos, key, value ?? null))
    }
  }
  if (transaction.docChanged) {
    instance.view.dispatch(transaction)
    const expected = transaction.doc.nodeAt(pos)
    if (!expected || !instance.state.doc.nodeAt(pos)?.eq(expected)) return false
    instance.view.dispatch(closeHistory(instance.state.tr).setMeta('addToHistory', false))
  }
  return true
}

function replaceSelectedMedia(type: 'image' | 'file' | 'video', payload: JsonRecord): boolean {
  const instance = editor.value
  if (!instance) return false
  let pos: number | undefined
  const { from, to } = instance.state.selection
  instance.state.doc.nodesBetween(from, to, (node, offset) => {
    if (pos === undefined && node.type.name === type) pos = offset
  })
  if (pos === undefined && instance.state.doc.nodeAt(from)?.type.name === type) pos = from
  return pos !== undefined && replaceMediaAt(type, pos, payload)
}

function insertUploadedImageAt(asset: Partial<AssetInfo>, pos: number, replaceSize = 0): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableImages)) return false
  const payload = imagePayload(asset)
  if (!payload) return false
  const target = instance.state.doc.nodeAt(pos)
  if (target?.type.name === 'image' && target.nodeSize === replaceSize) return replaceMediaAt('image', pos, payload)
  const inserted = instance.chain().command(({ tr }) => {
    closeHistory(tr)
    return true
  }).insertContentAt(
    { from: pos, to: pos + replaceSize },
    { type: 'image', attrs: { props: payload } },
    { updateSelection: false },
  ).run()
  if (inserted) instance.view.dispatch(closeHistory(instance.state.tr).setMeta('addToHistory', false))
  return inserted
}

function insertFileAsset(asset: Partial<AssetInfo>): boolean {
  const instance = editor.value
  if (!instance || !canMutateVisualContent(props.enableFiles)) return false
  const src = storedAssetSource(asset)
  if (!src.trim()) return false
  const payload = {
    filename: asset.filename,
    id: asset.id,
    size: asset.size,
    src,
    title: asset.title || asset.filename,
    type: asset.mimeType,
  }
  return instance.isActive('file')
    ? replaceSelectedMedia('file', payload)
    : instance.chain().focus().setFile(payload).run()
}

function insertVideo(value: VideoInfo): boolean {
  const instance = editor.value
  if (!instance || !value.src.trim() || !canMutateVisualContent(props.enableVideo)) return false
  const payload = { src: value.src.trim(), title: value.title?.trim() || undefined }
  return instance.isActive('video')
    ? replaceSelectedMedia('video', payload)
    : instance.chain().focus().setVideo(payload).run()
}

function removeSelectedMedia(): boolean {
  const instance = editor.value
  if (
    !instance
    || !canMutateVisualContent()
    || !['image', 'file', 'video'].some(name => instance.isActive(name))
  ) {
    return false
  }
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

function requestImage(range?: { from: number; to: number }) {
  if (!canMutateVisualContent(props.enableImages)) return
  if (props.imageUpload || props.imagePicker) { editor.value?.commands.insertImageUpload(range); return }
  emit('request-image', createAssetRequest(range
    ? asset => insertUploadedImageAt(asset, range.from, range.to - range.from)
    : insertImageAsset))
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
  if (collaboration) return
  void loadSource(value)
})
watch(hasPendingChanges, (pending) => emit('pending-change', pending), {
  flush: 'sync',
})
let assetContextRevision = 0
watch([
  viewMode,
  () => props.disabled,
  () => props.enableImages,
  () => props.enableFiles,
  () => props.enableVideo,
  () => props.assetProvider,
], () => {
  assetContextRevision += 1
}, { flush: 'sync' })

watch([
  () => props.imageDropTarget,
  () => props.assetProvider,
  () => props.enableImageMetadata,
  () => props.enableImages,
  () => props.messages,
], () => {
  const instance = editor.value
  if (instance && !instance.isDestroyed) instance.view.dispatch(instance.state.tr)
}, { deep: true })

watch([
  () => props.imageUpload,
  () => props.imagePicker,
  () => props.disabled,
  () => props.enableImages,
  () => props.assetProvider,
  () => props.authoringKit,
], () => {
  editor.value?.commands.clearImageUploads()
}, { flush: 'sync' })
watch([() => props.disabled, collaborationState, invalidBinding], ([disabled]) => {
  const editable = !disabled && !invalidBinding.value && (collaboration?.canEdit ?? true)
  if (editor.value?.isEditable !== editable) editor.value?.setEditable(editable)
  if (!editable) closeInsertMenu(false)
}, { flush: 'sync' })
watch(() => props.collaboration, value => {
  if (value === collaboration) return
  invalidBinding.value = true
  collaboration?.close()
})
watch(() => props.authoringKit, (value, previous) => {
  if (collaboration) {
    if (JSON.stringify(value?.policy) !== JSON.stringify(previous?.policy)) {
      invalidBinding.value = true
      collaboration.close()
    }
    return
  }
  void (async () => {
    const result = await flush()
    if (!result.ok) return
    await loadSource(rawContent.value)
  })()
})

onMounted(() => {
  if (globalThis.ResizeObserver) menuResizeObserver = new globalThis.ResizeObserver(positionInsertMenu)
  if (collaboration && editor.value) scheduleVisualUpdate(editor.value)
  else void loadSource(props.modelValue, { initial: true })
  globalThis.document.addEventListener('pointerdown', dismissOutside)
  globalThis.addEventListener('resize', positionInsertMenu)
  globalThis.addEventListener('scroll', positionInsertMenu, true)
})
onBeforeUnmount(() => {
  globalThis.document.removeEventListener('pointerdown', dismissOutside)
  globalThis.removeEventListener('resize', positionInsertMenu)
  globalThis.removeEventListener('scroll', positionInsertMenu, true)
  menuResizeObserver?.disconnect()
  stopCollaborationState?.()
  disposed = true
  overlays.destroy()
  cancelPendingUpdate()
  editor.value?.destroy()
})

const statusLabel = computed(() => {
  if (conversionError.value) return overlays.text(viewMode.value === 'visual' ? 'changesNeedAttention' : 'sourceOnly')
  if (hasPendingVisualChanges.value) return overlays.text('convertingChanges')
  const shared = collaborationState.value?.status
  if (shared) {
    const labels = { connecting: 'sharedConnecting', syncing: 'sharedSyncing', synced: 'sharedSynced',
      offline: 'sharedOffline', error: 'sharedError', stale: 'sharedStale', closed: 'sharedClosed' } satisfies Record<CollaborationStatus, EditorMessageKey>
    return overlays.text(labels[shared])
  }
  return overlays.text(viewMode.value === 'visual' ? 'visualEditor' : 'markdownSource')
})

function downloadRecovery() {
  const recovery = collaboration?.getRecovery()
  if (!recovery) return
  const url = globalThis.URL.createObjectURL(new globalThis.Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' }))
  const anchor = globalThis.document.createElement('a')
  anchor.href = url
  anchor.download = 'ginko-editor-recovery.json'
  anchor.click()
  globalThis.URL.revokeObjectURL(url)
}

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
        :aria-label="actions.text('insert')"
        :disabled="disabled || invalidBinding || (collaboration && !collaboration.canEdit)"
        @click="insertMenuOpen ? closeInsertMenu() : openInsertMenu('button')"
      >
        <span aria-hidden="true">+</span>
        <span>{{ actions.text('insertShort') }}</span>
      </button>
      <div
        class="ginko-editor__modes"
        :aria-label="actions.text('editingMode')"
      >
        <button
          type="button"
          :aria-pressed="viewMode === 'visual'"
          :disabled="disabled"
          @click="showVisual"
        >
          {{ actions.text('visual') }}
        </button>
        <button
          type="button"
          :aria-pressed="viewMode === 'raw'"
          :disabled="disabled"
          @click="showSource"
        >
          {{ actions.text('markdown') }}
        </button>
      </div>
      <span
        class="ginko-editor__status"
        role="status"
      >{{ statusLabel }}</span>
    </div>
    <slot
      v-if="collaboration"
      name="collaboration"
      :state="collaborationState"
      :session="collaboration"
    >
      <div
        v-if="invalidBinding || collaborationState?.message"
        class="ginko-editor__warning"
        role="status"
      >
        <span>{{ invalidBinding ? actions.text('sharedRemount') : collaborationState?.message }}</span>
        <button
          v-if="collaborationState?.status === 'offline' || collaborationState?.status === 'error'"
          type="button"
          @click="collaboration.retry()"
        >
          {{ actions.text('sharedRetry') }}
        </button>
        <button
          v-if="collaborationState?.pendingSteps"
          type="button"
          @click="downloadRecovery"
        >
          {{ actions.text('sharedRecovery') }}
        </button>
      </div>
    </slot>
    <Teleport
      v-if="insertMenuOpen"
      :to="overlays.getContainer()!"
    >
      <div
        ref="insertMenu"
        class="ginko-editor__insert-menu"
        :class="{
          'ginko-editor__insert-menu--preview':
            activeRecipe && !isImageRecipe(activeRecipe) && $slots['recipe-preview'],
        }"
        :style="insertPosition"
        @keydown="handleInsertSearchKeydown"
      >
        <label
          v-if="insertMenuOrigin === 'button'"
          class="ginko-editor__insert-search"
        >
          <span aria-hidden="true">/</span>
          <span class="ginko-editor__sr-only">{{ actions.text('searchBlocks') }}</span>
          <input
            ref="insertSearch"
            v-model="insertQuery"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="insertMenuId"
            :aria-activedescendant="activeRecipe ? `${insertMenuId}-${insertIndex}` : undefined"
            autocomplete="off"
            :placeholder="actions.text('searchBlocks')"
          >
        </label>
        <div
          v-else
          class="ginko-editor__insert-query"
          aria-hidden="true"
        >
          <span>{{ actions.text('availableBlocks') }}</span>
          <kbd>/{{ insertQuery }}</kbd>
        </div>
        <div
          :id="insertMenuId"
          class="ginko-editor__insert-results"
          role="listbox"
          :aria-label="actions.text('availableBlocks')"
        >
          <button
            v-for="(recipe, index) in filteredRecipes"
            :id="`${insertMenuId}-${index}`"
            :key="`${index}-${recipe.id}`"
            tabindex="-1"
            type="button"
            role="option"
            :aria-selected="index === insertIndex"
            :disabled="insertBusy"
            @mousedown.prevent
            @mouseenter="insertIndex = index"
            @click="insertRecipe(recipe)"
          >
            <span
              class="ginko-editor__recipe-symbol"
              aria-hidden="true"
            >{{ recipeSymbol(recipe) }}</span>
            <span class="ginko-editor__recipe-text">
              <strong>{{ recipeCopy(recipe, overlays.text).label }}</strong>
              <small>
                {{
                  recipeCopy(recipe, overlays.text).description
                    || (recipe.keywords?.length
                      ? `/${recipe.keywords[0]}`
                      : `Insert ${recipe.label.toLocaleLowerCase()}`)
                }}
              </small>
            </span>
            <span
              v-if="index === insertIndex"
              aria-hidden="true"
            >↵</span>
          </button>
          <p
            v-if="filteredRecipes.length === 0"
            class="ginko-editor__insert-empty"
          >
            {{ actions.text('noBlocks') }}
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
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {{ actions.text('navigate') }}
          </span>
          <span>
            <kbd>↵</kbd>
            {{ actions.text('insertHelp') }}
          </span>
          <span>
            <kbd>esc</kbd>
            {{ actions.text('closeHelp') }}
          </span>
        </p>
      </div>
    </Teleport>
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
      <strong>{{ actions.text(viewMode === 'visual' ? 'visualRecovery' : 'sourceUnavailable') }}</strong>
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
      <slot
        v-if="!disabled"
        name="toolbar"
        :actions="actions"
      >
        <GinkoToolbar
          :actions="actions"
          :items="toolbarItems"
        />
      </slot>
      <GinkoSelectionToolbar
        v-if="!disabled"
        :editor="editor"
        :actions="actions"
      />
      <div
        class="ginko-editor__surface-frame"
        @keydown.capture="handleEditorKeydown"
        @compositionstart="closeInsertMenu(false, false)"
        @compositionend="editor && syncSlashMenu(editor)"
        @dragstart.capture.prevent.stop
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
      :readonly="!!collaboration || invalidBinding"
      :value="rawContent"
      spellcheck="false"
      @input="updateRaw(($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
.ginko-editor {
  --ginko-border: var(--border, #e5e5e3);
  --ginko-bg: var(--background, #fff);
  --ginko-muted: var(--muted, #f3f3f1);
  --ginko-muted-text: var(--muted-foreground, #6f6f6b);
  --ginko-text: var(--foreground, #292925);
  position: relative;
  overflow: visible;
  border: 1px solid var(--ginko-border);
  border-radius: var(--radius, .625rem);
  background: var(--ginko-bg);
  color: var(--ginko-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.ginko-editor button {
  min-height: 2.25rem;
  border: 0;
  border-radius: .4rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: .35rem .65rem;
  white-space: nowrap;
}

.ginko-editor button:hover, .ginko-editor button[aria-pressed='true'] {
  background: var(--ginko-muted);
}

.ginko-editor button:focus-visible,
.ginko-editor input:focus-visible,
.ginko-editor select:focus-visible,
.ginko-editor textarea:focus-visible {
  outline-offset: 2px;
}

.ginko-editor__header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: .5rem;
  border-bottom: 1px solid var(--ginko-border);
  padding: .45rem .55rem;
}

.ginko-editor__insert-trigger {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  font-weight: 650;
}

.ginko-editor__insert-trigger span[aria-hidden='true'] {
  font-size: 1.2rem;
  line-height: 1;
}

.ginko-editor__modes {
  display: flex;
  gap: .2rem;
}

.ginko-editor__status {
  color: var(--ginko-muted-text);
  font-size: .78rem;
  white-space: nowrap;
}

.ginko-editor__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* The menu overlays the page without changing the writer's document geometry. */
.ginko-editor__insert-menu {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  width: min(320px, calc(100vw - 24px));
  overflow: hidden;
  border: 1px solid var(--ginko-border);
  border-radius: .75rem;
  background: var(--ginko-bg);
  box-shadow: 0 12px 40px rgb(0 0 0 / .16), 0 2px 6px rgb(0 0 0 / .06);
  padding: .35rem;
}

@media (min-width: 700px) {
  .ginko-editor__insert-menu--preview {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    width: min(620px, calc(100vw - 24px));
  }
  .ginko-editor__insert-menu--preview .ginko-editor__insert-search,
  .ginko-editor__insert-menu--preview .ginko-editor__insert-query,
  .ginko-editor__insert-menu--preview .ginko-editor__insert-results,
  .ginko-editor__insert-menu--preview .ginko-editor__insert-help,
  .ginko-editor__insert-menu--preview .ginko-editor__insert-error {
    grid-column: 1;
  }
  .ginko-editor__insert-menu--preview .ginko-editor__recipe-preview {
    display: flex;
    align-items: safe center;
    min-width: 0;
    grid-column: 2;
    grid-row: 1 / 5;
    max-height: none;
    margin: -.35rem -.35rem -.35rem .35rem;
    padding: 1.1rem;
    border-top: 0;
    border-left: 1px solid var(--ginko-border);
    background: color-mix(in srgb, var(--ginko-bg) 97%, var(--ginko-text));
  }
}

.ginko-editor__insert-search {
  display: flex;
  align-items: center;
  gap: .65rem;
  border-bottom: 1px solid var(--ginko-border);
  margin: 0 .35rem .35rem;
  padding: .2rem .35rem .55rem;
  color: var(--ginko-muted-text);
}

.ginko-editor__insert-query {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: .55rem .6rem;
  color: var(--ginko-muted-text);
  font-size: .75rem;
  border-bottom: 1px solid var(--ginko-border);
  margin-bottom: .35rem;
}

.ginko-editor__insert-query kbd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ginko-editor__insert-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ginko-text);
  padding: .4rem 0;
  font: inherit;
}

.ginko-editor__insert-search:focus-within {
  border-bottom-color: var(--ginko-muted-text);
}

.ginko-editor__insert-results {
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 48px;
  flex: 1 1 auto;
}

.ginko-editor__insert-results button {
  display: flex;
  align-items: center;
  gap: .7rem;
  width: 100%;
  min-height: 57px;
  padding: .5rem;
  text-align: start;
  white-space: normal;
}

.ginko-editor__insert-results button[aria-selected='true'] {
  background: var(--ginko-muted);
}

.ginko-editor__recipe-symbol {
  display: grid;
  place-items: center;
  flex: 0 0 35px;
  height: 35px;
  border: 1px solid var(--ginko-border);
  border-radius: .4rem;
  background: var(--ginko-bg);
  font: 500 16px/1 ui-sans-serif, system-ui, sans-serif;
}

.ginko-editor__recipe-text {
  display: grid;
  gap: .1rem;
  flex: 1;
}

.ginko-editor__recipe-text strong {
  font-size: .85rem;
  font-weight: 550;
}

.ginko-editor__recipe-text small {
  font-size: .73rem;
  color: var(--ginko-muted-text);
  line-height: 1.4;
}

.ginko-editor__recipe-preview {
  flex: 0 0 auto;
  max-height: 150px;
  overflow: auto;
  border-top: 1px solid var(--ginko-border);
  padding: .7rem;
}

.ginko-editor__insert-empty, .ginko-editor__insert-error {
  margin: 0;
  padding: .75rem;
  font-size: .85rem;
}

.ginko-editor__insert-empty {
  color: var(--ginko-muted-text);
}

.ginko-editor__insert-error {
  color: #b54a35;
}

.ginko-editor__insert-help {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
  border-top: 1px solid var(--ginko-border);
  margin: .3rem 0 0;
  padding: .55rem .35rem .15rem;
  color: var(--ginko-muted-text);
  font-size: .68rem;
}

.ginko-editor__insert-help kbd {
  font: inherit;
  margin-inline-end: .2rem;
}

.ginko-editor__warning {
  display: grid;
  gap: .15rem;
  border-bottom: 1px solid #e4a11b;
  background: #fff8e6;
  padding: .65rem .8rem;
  color: #5c4300;
}

.ginko-editor__surface {
  padding: clamp(1rem, 3vw, 1.75rem);
}

.ginko-editor__surface :deep(.ProseMirror) {
  max-width: 46rem;
  min-height: 22rem;
  margin-inline: auto;
  outline: none;
  font-size: 1rem;
  line-height: 1.7;
}

.ginko-editor__surface :deep(.ProseMirror p.mdc-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--ginko-muted-text);
}

.ginko-editor__surface :deep(.ProseMirror h1) {
  font-size: 2rem;
  font-weight: 650;
}

.ginko-editor__surface :deep(.ProseMirror h2) {
  font-size: 1.5rem;
  font-weight: 650;
}

.ginko-editor__surface :deep(.ProseMirror h3) {
  font-size: 1.2rem;
  font-weight: 650;
}

.ginko-editor__surface :deep(.ProseMirror ul) {
  list-style: disc;
  padding-inline-start: 1.5rem;
}

.ginko-editor__surface :deep(.ProseMirror ol) {
  list-style: decimal;
  padding-inline-start: 1.5rem;
}

.ginko-editor__surface :deep(.ProseMirror blockquote) {
  border-inline-start: 3px solid var(--ginko-text);
  padding-inline-start: 1rem;
  margin-inline: 0;
}

.ginko-editor__surface :deep(.ProseMirror pre) {
  background: var(--ginko-muted);
  border-radius: .5rem;
  padding: 1rem;
  overflow-x: auto;
}

.ginko-editor__surface :deep(.ProseMirror > :first-child) {
  margin-top: 0;
}

.ginko-editor__surface :deep(.ProseMirror > * + *) {
  margin-block-start: 1em;
}

.ginko-editor__surface :deep(.ProseMirror h1),
.ginko-editor__surface :deep(.ProseMirror h2),
.ginko-editor__surface :deep(.ProseMirror h3) {
  line-height: 1.2;
  letter-spacing: -.02em;
}

.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']) {
  position: relative;
  min-height: 3.5rem;
  border: 1px dashed var(--ginko-border);
  border-radius: .5rem;
  padding: 1.8rem .7rem .5rem;
}

.ginko-editor__surface :deep(.ProseMirror div[data-type='Slot']::before) {
  position: absolute;
  inset-block-start: .45rem;
  inset-inline-start: .6rem;
  content: attr(name);
  color: var(--ginko-muted-text);
  font-size: .68rem;
  font-weight: 650;
  text-transform: uppercase;
}

.ginko-editor__surface :deep(.ProseMirror img) {
  display: block;
  max-width: 100%;
  height: auto;
}

.ginko-editor__surface :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.ginko-editor__surface :deep(td), .ginko-editor__surface :deep(th) {
  border: 1px solid var(--ginko-border);
  padding: .5rem;
}

.ginko-editor__source {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 280px;
  resize: vertical;
  border: 0;
  background: var(--ginko-bg);
  color: var(--ginko-text);
  padding: 1rem;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  outline: none;
}

@media (max-width: 34rem) {
  .ginko-editor button {
    min-height: 2.75rem;
  }
  .ginko-editor__header {
    grid-template-columns: 1fr auto;
  }
  .ginko-editor__status {
    grid-column: 1 / -1;
    grid-row: 2;
    padding-inline: .65rem;
  }
  .ginko-editor__surface {
    padding: 1rem;
  }
  .ginko-editor__surface :deep(.ProseMirror) {
    min-height: 18rem;
  }
}
</style>
