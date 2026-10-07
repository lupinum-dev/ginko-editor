<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, provide, ref, watch, type ComputedRef } from 'vue'

import { useAssetRequests } from './composables/useAssetRequests'
import { useCollaborationBinding } from './composables/useCollaborationBinding'
import { useInsertMenu } from './composables/useInsertMenu'
import { useMarkdownSync } from './composables/useMarkdownSync'
import { useStableAuthoringKit } from './composables/useStableAuthoringKit'
import { editorPropDefaults, type GinkoEditorProps } from './editorProps'
import { createEditorExtensions } from './lib/config/editorConfig'
import type { ConversionErrorPayload, ConversionRecoveredPayload } from './lib/conversionPipeline'
import { observeEditorOperations, type EditorOperationContext } from './lib/editor-operations'
import { refreshNodeViews } from './lib/nodeviews/lifecycle'
import type { EditorAssetRequest, EditorFile, EditorImage, EditorVideo, GinkoEditorHandle } from './types'
import { useEditorActions, type EditorActions } from './ui/commands'
import { createEditorOverlayController, editorOverlayKey } from './ui/context'
import { routeEditorKeydown } from './ui/editor-keyboard'
import GinkoInsertMenu from './ui/GinkoInsertMenu.vue'
import GinkoSelectionToolbar from './ui/GinkoSelectionToolbar.vue'
import GinkoToolbar from './ui/GinkoToolbar.vue'
import { SlashCommands } from './ui/slash-command'

defineOptions({ name: 'GinkoEditor' })

const props = withDefaults(defineProps<GinkoEditorProps>(), editorPropDefaults)

const emit = defineEmits<{
  'conversion-error': [payload: ConversionErrorPayload]
  'conversion-recovered': [payload: ConversionRecoveredPayload]
  'request-file': [request: EditorAssetRequest<EditorFile>]
  'request-image': [request: EditorAssetRequest<EditorImage>]
  'request-image-metadata': [assetId: string]
  'pending-change': [pending: boolean]
  'request-video': [request: EditorAssetRequest<EditorVideo>]
  'update:modelValue': [value: string]
}>()

const binding = useCollaborationBinding(() => props.collaboration)
const authoring = useStableAuthoringKit(() => props.authoringKit)
const editorRoot = ref<InstanceType<typeof globalThis.HTMLElement>>()
const sourceInput = ref<InstanceType<typeof globalThis.HTMLTextAreaElement>>()
const insertMenuView = ref<InstanceType<typeof GinkoInsertMenu>>()
const clipboardError = ref<string>()
const imageUploadNotice = ref('')
const pendingImages = ref(0)
const pendingCommands = ref(0)
const selectionRevision = ref(0)
const overlays = createEditorOverlayController({
  getContainer: () => props.overlayContainer ?? editorRoot.value,
  getThemeElement: () => editorRoot.value,
  getMessages: () => props.messages,
})
provide(editorOverlayKey, overlays)
const text = overlays.text
const outputOptions = computed(() => ({
  fileOutput: props.fileOutput,
  imageOutput: props.imageOutput,
  videoOutput: props.videoOutput,
}))
const label = computed(() => props.ariaLabel ?? text('contentLabel'))

const editor = useEditor({
  content: binding.session?.initialDocument ?? { content: [{ type: 'paragraph' }], type: 'doc' },
  editable: !props.disabled && binding.canEdit(),
  editorProps: { attributes: { 'aria-label': label.value, role: 'textbox', 'aria-multiline': 'true' } },
  extensions: [...createEditorExtensions({
    overlay: overlays,
    getMessages: () => props.messages,
    assetProvider: {
      buildUrl: asset => assets.resolvedAssetProvider.value.buildUrl(asset),
      parseUrl: url => assets.resolvedAssetProvider.value.parseUrl(url),
    },
    codeBlockTheme: props.codeBlockTheme,
    showMarkdownMarkers: props.showMarkdownMarkers,
    getPlaceholder: () => props.placeholder,
    getAuthoringKit: () => authoring.kit.value,
    getOutputOptions: () => outputOptions.value,
    canPaste: () => canMutate(),
    onPasteError: (message) => { clipboardError.value = message },
    onCopyError: (message) => { clipboardError.value = message },
    getImageDropTarget: () => props.imageDropTarget,
    getImageUpload: () => props.imageUpload,
    getImagePicker: () => props.imagePicker,
    getImageMaxBytes: () => props.imageMaxBytes,
    canUploadImage: () => canMutate(props.enableImages),
    insertUploadedImage: (asset, pos, size) => assets.insertUploadedImageAt(asset, pos, size),
    onImageUploadPending: (count) => {
      pendingImages.value = count
      if (!count) imageUploadNotice.value = ''
    },
    imageActions: (imageProps) => {
      const source = typeof imageProps.src === 'string' ? imageProps.src : ''
      const id = typeof imageProps.id === 'string' && imageProps.id
        ? imageProps.id
        : assets.resolvedAssetProvider.value.parseUrl(source)?.id
      return {
        replace: props.enableImages ? () => assets.requestImage() : undefined,
        metadata: props.enableImageMetadata && id
          ? () => { if (canMutate()) emit('request-image-metadata', id) }
          : undefined,
      }
    },
  }), SlashCommands.configure({ enabled: () => !sync.isApplyingDocument() && canMutate() }),
  ...binding.extensions],
  onTransaction: ({ editor: instance }) => { insertMenu.syncSlash(instance) },
  onUpdate: ({ editor: instance, transaction }) => {
    selectionRevision.value += 1
    if (transaction.docChanged && insertMenu.open.value && insertMenu.origin.value === 'button') insertMenu.close(false)
    if (!sync.isApplyingDocument() && transaction.docChanged) sync.scheduleVisualUpdate(instance)
  },
  onSelectionUpdate: () => { selectionRevision.value += 1 },
})

const sync = useMarkdownSync({
  editor,
  binding,
  authoring,
  getModelValue: () => props.modelValue,
  getDebounceMs: () => props.syncDebounceMs,
  getOutputOptions: () => outputOptions.value,
  text,
  pendingImages,
  pendingCommands,
  emitSource: value => emit('update:modelValue', value),
  emitError: payload => emit('conversion-error', payload),
  emitRecovered: payload => emit('conversion-recovered', payload),
  onImagesPending: (message) => { imageUploadNotice.value = message },
  beforeLoad: () => {
    editor.value?.commands.clearImageUploads()
    clipboardError.value = undefined
    insertMenu.close(false)
  },
  beforeSource: () => {
    overlays.close()
    insertMenu.close(false)
  },
})
const { viewMode, rawContent, conversionError } = sync

/** True when the visual document accepts a change now. */
function canMutate(featureEnabled = true) {
  return featureEnabled
    && !sync.isDisposed()
    && !props.disabled
    && !binding.invalidBinding.value
    && binding.canEdit()
    && viewMode.value === 'visual'
    && editor.value?.isEditable === true
}

const assets = useAssetRequests({
  props,
  editor,
  canMutate,
  documentRevision: sync.revision,
  selectionRevision,
  viewMode,
  policyRevision: authoring.policyRevision,
  emitImage: request => emit('request-image', request),
  emitFile: request => emit('request-file', request),
  emitVideo: request => emit('request-video', request),
})

const operationContext: EditorOperationContext = {
  getAuthoringKit: () => authoring.kit.value,
  getOutputOptions: () => outputOptions.value,
  canMutate: () => canMutate(),
}
const insertMenu = useInsertMenu({
  editor,
  editorRoot,
  menu: insertMenuView,
  overlays,
  kit: authoring.kit,
  enableImages: () => props.enableImages,
  canMutate: () => canMutate(),
  isDisposed: sync.isDisposed,
  operationContext,
  requestImage: range => assets.requestImage(range),
})
const actions: ComputedRef<EditorActions> = useEditorActions(editor, {
  enabled: () => canMutate(),
  messages: () => props.messages,
  shortcuts: () => props.shortcuts,
  image: () => assets.requestImage(),
  file: assets.requestFile,
  video: assets.requestVideo,
  insert: () => { void insertMenu.show('button') },
  mediaEnabled: kind => kind === 'image' ? props.enableImages : kind === 'file' ? props.enableFiles : props.enableVideo,
  context: operationContext,
})

const hasPendingChanges = computed(() =>
  sync.hasPendingVisualChanges.value || pendingImages.value > 0 || pendingCommands.value > 0
  || binding.pendingSteps() > 0,
)
watch(hasPendingChanges, pending => emit('pending-change', pending), { flush: 'sync' })
watch(editor, (instance, _, cleanup) => {
  pendingCommands.value = 0
  if (instance) cleanup(observeEditorOperations(instance, (count) => { pendingCommands.value = count }))
}, { immediate: true, flush: 'sync' })

const editorAttributes = computed(() => ({
  'aria-label': label.value,
  ...insertMenu.editorAttributes.value,
}))
watch([editor, editorAttributes], ([instance, attributes]) => {
  instance?.setOptions({ editorProps: { attributes } })
})
watch([() => props.disabled, binding.state, binding.invalidBinding], ([disabled]) => {
  const editable = !disabled && !binding.invalidBinding.value && binding.canEdit()
  if (editor.value?.isEditable !== editable) editor.value?.setEditable(editable)
  if (!editable) insertMenu.close(false)
}, { flush: 'sync' })
// Node views and decorations read these options when they render.
watch([
  () => props.imageDropTarget,
  () => props.assetProvider,
  () => props.enableImageMetadata,
  () => props.enableImages,
  () => props.placeholder,
  authoring.kit,
], () => refreshNodeViews(editor.value))
watch(() => props.messages, () => {
  overlays.notifyMessagesChanged()
  refreshNodeViews(editor.value)
}, { deep: true })
watch([editor, () => props.codeBlockTheme, () => props.showMarkdownMarkers], ([instance, theme, markers]) => {
  const storage = instance?.storage as Record<string, Record<string, unknown> | undefined> | undefined
  if (storage?.codeBlock) storage.codeBlock.theme = theme
  if (storage?.heading) storage.heading.showMarkers = markers
})
onBeforeUnmount(() => overlays.destroy())

function handleEditorKeydown(event: InstanceType<typeof globalThis.KeyboardEvent>) {
  if (!editor.value) return
  routeEditorKeydown(editor.value, event, {
    actions: actions.value,
    shortcuts: props.shortcuts,
    operationContext,
    insertMenuOpen: insertMenu.open.value,
    handleInsertKeys: insertMenu.handleKeys,
  })
}

const statusLabel = computed(() => {
  if (conversionError.value) return text(viewMode.value === 'visual' ? 'changesNeedAttention' : 'sourceOnly')
  if (sync.hasPendingVisualChanges.value) return text('convertingChanges')
  const shared = binding.statusMessage()
  if (shared) return text(shared)
  return text(viewMode.value === 'visual' ? 'visualEditor' : 'markdownSource')
})
/** Screen readers hear errors and shared state, not each background conversion. */
const announcement = computed(() => {
  if (conversionError.value) return statusLabel.value
  const shared = binding.statusMessage()
  return shared ? text(shared) : ''
})

function focus(position?: 'start' | 'end') {
  if (viewMode.value === 'visual') {
    editor.value?.commands.focus(position)
    return
  }
  const source = sourceInput.value
  if (!source) return
  source.focus()
  if (position) {
    const offset = position === 'start' ? 0 : source.value.length
    source.setSelectionRange(offset, offset)
  }
}

defineExpose<GinkoEditorHandle>({
  flush: sync.flush,
  hasPendingChanges: () => hasPendingChanges.value,
  removeSelectedMedia: assets.removeSelectedMedia,
  focus,
  getEditor: () => editor.value,
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
        :aria-controls="insertMenu.open.value ? insertMenu.id : undefined"
        :aria-expanded="insertMenu.open.value"
        :aria-label="actions.text('insert')"
        :disabled="disabled || binding.invalidBinding.value || !binding.canEdit()"
        @click="insertMenu.toggle()"
      >
        <span aria-hidden="true">+</span>
        <span>{{ actions.text('insertShort') }}</span>
      </button>
      <div
        class="ginko-editor__modes"
        role="group"
        :aria-label="actions.text('editingMode')"
      >
        <button
          type="button"
          :aria-pressed="viewMode === 'visual'"
          :disabled="disabled"
          @click="sync.showVisual"
        >
          {{ actions.text('visual') }}
        </button>
        <button
          type="button"
          :aria-pressed="viewMode === 'raw'"
          :disabled="disabled"
          @click="sync.showSource"
        >
          {{ actions.text('markdown') }}
        </button>
      </div>
      <ul
        v-if="binding.peers.value.length"
        class="ginko-editor__peers"
        :aria-label="actions.text('sharedPeers')"
      >
        <li
          v-for="peer in binding.peers.value.slice(0, 5)"
          :key="peer.clientId"
          class="ginko-editor__peer"
          :style="{ '--ginko-collab-color': peer.user.color }"
          :title="peer.user.name"
        >
          <span aria-hidden="true">{{ peer.user.name.trim().charAt(0).toUpperCase() || '?' }}</span>
          <span class="ginko-editor__sr-only">{{ peer.user.name }}</span>
        </li>
        <li
          v-if="binding.peers.value.length > 5"
          class="ginko-editor__peer ginko-editor__peer--more"
        >
          +{{ binding.peers.value.length - 5 }}
        </li>
      </ul>
      <span class="ginko-editor__status">{{ statusLabel }}</span>
      <span
        class="ginko-editor__sr-only"
        role="status"
      >{{ announcement }}</span>
    </div>
    <slot
      v-if="binding.session"
      name="collaboration"
      :state="binding.state.value"
      :session="binding.session"
    >
      <div
        v-if="binding.invalidBinding.value || binding.state.value?.message"
        class="ginko-editor__warning"
        role="status"
      >
        <span>{{ binding.invalidBinding.value ? actions.text('sharedRemount') : binding.state.value?.message }}</span>
        <button
          v-if="binding.state.value?.status === 'offline' || binding.state.value?.status === 'error'"
          type="button"
          @click="binding.session.retry()"
        >
          {{ actions.text('sharedRetry') }}
        </button>
        <button
          v-if="binding.canDiscard()"
          type="button"
          @click="binding.discardPending()"
        >
          {{ actions.text('sharedDiscard') }}
        </button>
        <button
          v-if="binding.state.value?.pendingSteps"
          type="button"
          @click="binding.downloadRecovery"
        >
          {{ actions.text('sharedRecovery') }}
        </button>
      </div>
    </slot>
    <GinkoInsertMenu
      v-if="insertMenu.open.value && insertMenu.container.value"
      :id="insertMenu.id"
      ref="insertMenuView"
      v-model:query="insertMenu.query.value"
      v-model:active-index="insertMenu.activeIndex.value"
      :to="insertMenu.container.value"
      :origin="insertMenu.origin.value"
      :groups="insertMenu.groups.value"
      :busy="insertMenu.busy.value"
      :error="insertMenu.error.value"
      :position="insertMenu.position.value"
      :text="text"
      @select="insertMenu.insert"
      @keydown="insertMenu.handleKeys"
    >
      <template
        v-if="$slots['recipe-preview']"
        #recipe-preview="{ recipe }"
      >
        <slot
          name="recipe-preview"
          :recipe="recipe"
        />
      </template>
    </GinkoInsertMenu>
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
        @compositionstart="insertMenu.close(false, false)"
        @compositionend="editor && insertMenu.syncSlash(editor)"
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
      ref="sourceInput"
      class="ginko-editor__source"
      :aria-label="text('markdownSourceLabel', { label })"
      :disabled="disabled"
      :readonly="!!binding.session || binding.invalidBinding.value"
      :value="rawContent"
      spellcheck="false"
      @input="sync.updateRaw(($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>
