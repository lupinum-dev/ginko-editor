<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import DragHandle from '@tiptap/extension-drag-handle-vue-3'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import { PopoverRoot, PopoverPortal, PopoverContent } from 'reka-ui'
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2, CornerLeftUp, MoveRight } from '@lucide/vue'
import { captureBlock, selectedBlock, parentBlock, selectParentBlock, canPerformBlockAction, moveBlock, performBlockAction, type BlockReference, type BlockTarget, type BlockMovementContext, type BlockAction } from '../lib/block-movement'
import { blockDestinations, blockDropTarget, blockKeyboardIntent, blockLabel } from './block-controls'
import type { EditorActions, EditorShortcuts } from './commands'
import { translateEditorMessage, type EditorText } from './messages'
import { editorOverlayKey } from './context'

type ElementType = InstanceType<typeof globalThis.HTMLElement>
type Keyboard = InstanceType<typeof globalThis.KeyboardEvent>
type Drag = InstanceType<typeof globalThis.DragEvent>
const props = defineProps<{ editor: Editor; actions: EditorActions; context: BlockMovementContext; shortcuts?: EditorShortcuts }>()
const overlay = inject(editorOverlayKey, undefined), owner = {}
const text: EditorText = (key, parameters) => overlay?.text(key, parameters) ?? translateEditorMessage({ [key]: props.actions.text(key) }, key, parameters)
const placementLabel = (placement: BlockTarget['placement']) => text(({ before: 'before', after: 'after', start: 'insideFirst', end: 'insideLast' } as const)[placement])
const hovered = shallowRef<BlockReference>(), source = shallowRef<BlockReference>()
const menuOpen = ref(false), busy = ref(false), error = ref(''), chooser = ref(false), query = ref(''), revision = ref(0)
const anchor = shallowRef<ElementType>()
const handle = ref<ElementType>()
const destinationSearch = ref<InstanceType<typeof globalThis.HTMLInputElement>>()
const returnFocus = ref(false)
const announcement = ref('')
const indicator = ref<{ left: string; top: string; width: string }>()
let drag: { source: BlockReference; target?: BlockTarget; canceled: boolean; x: number; y: number } | undefined
let scrollFrame = 0, disposed = false
let dragElement: ElementType | undefined
const current = () => source.value && props.editor.state.doc === source.value.doc ? source.value : undefined
const label = computed(() => { void revision.value; return source.value ? blockLabel(source.value, props.context, text) : text('blockActions') })
const parent = computed(() => { void revision.value; const block = current(); return block && parentBlock(props.editor, block) })
const destinations = computed(() => {
  void revision.value
  const block = current()
  return chooser.value && block ? blockDestinations(props.editor, block, props.context, text).filter(item => item.label.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())) : []
})
function available(action: BlockAction) { const block = current(); return !busy.value && !!block && canPerformBlockAction(props.editor, block, action, props.context) }
function lock(locked: boolean) {
  if (!props.editor.isDestroyed) props.editor.view.dispatch(props.editor.state.tr.setMeta('lockDragHandle', locked).setMeta('addToHistory', false))
}
function close(focus = false) {
  returnFocus.value = focus
  menuOpen.value = false; chooser.value = false
  overlay?.release(owner); lock(false)
}
function open(block = hovered.value ?? selectedBlock(props.editor), fromKeyboard = false) {
  if (!block || busy.value || !props.editor.isEditable || props.context.canMutate?.() === false) return
  const captured = captureBlock(props.editor, block.pos)
  if (!captured || captured.doc !== block.doc) return
  props.editor.view.dispatch(props.editor.state.tr.setSelection(NodeSelection.create(props.editor.state.doc, captured.pos)))
  source.value = captured
  const element = props.editor.view.nodeDOM(captured.pos)
  anchor.value = !fromKeyboard && handle.value ? handle.value : element instanceof globalThis.HTMLElement ? element : props.editor.view.dom
  error.value = ''; query.value = ''; chooser.value = false; returnFocus.value = false
  overlay?.open(owner, () => close())
  menuOpen.value = true; lock(true)
}
function onNodeChange({ pos }: { pos: number }) { if (!menuOpen.value && !drag) hovered.value = captureBlock(props.editor, pos) }
function focusAfterClose(event: InstanceType<typeof globalThis.Event>) { event.preventDefault(); if (returnFocus.value && !props.editor.isDestroyed) props.editor.view.focus() }
async function run(action: BlockAction) {
  const block = current()
  if (!block || !available(action)) return
  busy.value = true; error.value = ''
  const result = await performBlockAction(props.editor, block, action, props.context)
  busy.value = false
  if (disposed) return
  if (result.ok) { close(); announcement.value = action === 'delete' ? text('blockDeleted') : action === 'duplicate' ? text('blockDuplicated') : text('blockMoved') }
  else error.value = result.reason === 'stale' ? text('staleBlock') : text('blockChangeForbidden')
}
async function move(target: BlockTarget, block = current()) {
  if (!block || busy.value) return
  busy.value = true; error.value = ''
  const result = await moveBlock(props.editor, block, target, props.context)
  busy.value = false
  if (disposed) return
  if (result.ok) { close(); announcement.value = text('blockMoved') }
  else { error.value = result.reason === 'stale' ? text('staleBlock') : text('blockMoveForbidden'); announcement.value = error.value }
}
function showDestinations() { chooser.value = true; void nextTick(() => destinationSearch.value?.focus()) }
function selectParent() { const block = parent.value; if (block) open(block, true) }
function escapeMenu(event: InstanceType<typeof globalThis.Event>) { event.preventDefault(); close(true) }
function handleKeydown(event: Keyboard): boolean {
  if (busy.value || props.context.canMutate?.() === false) return false
  if (drag && event.key === 'Escape') { cancelDrag(); event.preventDefault(); return true }
  const intent = blockKeyboardIntent(props.editor, event, props.shortcuts)
  if (!intent) return false
  let block = selectedBlock(props.editor)
  if (intent === 'duplicate-component') { while (block && block.node.type.name !== 'element') block = parentBlock(props.editor, block) }
  if (!block) return false
  if (intent === 'menu') open(block, true)
  else if (intent === 'escape') {
    if (menuOpen.value) close(true)
    else if (props.editor.state.selection instanceof NodeSelection) { if (!selectParentBlock(props.editor, block)) return false }
    else { props.editor.view.dispatch(props.editor.state.tr.setSelection(NodeSelection.create(props.editor.state.doc, block.pos))); props.editor.view.focus() }
  } else if (intent === 'write') {
    const inside = Selection.findFrom(props.editor.state.doc.resolve(block.pos + 1), 1, true)
    if (!inside) return false
    props.editor.view.dispatch(props.editor.state.tr.setSelection(inside)); props.editor.view.focus()
  } else {
    const action = intent === 'duplicate-component' ? 'duplicate' : intent
    if (!canPerformBlockAction(props.editor, block, action, props.context)) return false
    source.value = block; void run(action)
  }
  event.preventDefault(); event.stopPropagation(); return true
}
function beginDrag(event: Drag, block = hovered.value ?? selectedBlock(props.editor)) {
  // Stop before TipTap's draggable wrapper can create a native PM move. Only
  // our captured source/target may commit, through Content validation.
  event.stopPropagation(); event.stopImmediatePropagation()
  if (!block || !props.editor.isEditable || props.context.canMutate?.() === false || busy.value) { event.preventDefault(); return }
  close()
  drag = { source: block, canceled: false, x: event.clientX, y: event.clientY }
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-ginko-block', 'internal') }
  announcement.value = text('blockMoving')
}
function nativeDrag(event: Drag) {
  const editor = props.editor, target = event.target
  if (!(target instanceof globalThis.Element) || !editor.view.dom.contains(target)) return
  if (target.closest('input, textarea, select')) return
  const selection = editor.state.selection
  if (selection instanceof NodeSelection) {
    const node = editor.view.nodeDOM(selection.from)
    if (node instanceof globalThis.Element && node.contains(target)) {
      const block = captureBlock(editor, selection.from)
      if (block) beginDrag(event, block)
      return
    }
  }
  const element = target.closest('[draggable="true"]')
  if (!element || !editor.view.dom.contains(element)) return
  const pos = editor.view.posAtDOM(element, 0), resolved = editor.state.doc.resolve(pos)
  const positions = [pos, ...Array.from({ length: resolved.depth }, (_, index) => resolved.before(resolved.depth - index))]
  const block = positions.map(position => captureBlock(editor, position)).find(candidate => candidate && editor.view.nodeDOM(candidate.pos) === element)
  if (block) beginDrag(event, block)
  else event.preventDefault()
}
function cancelDrag() {
  if (drag) { drag.canceled = true; drag.target = undefined }
  indicator.value = undefined; globalThis.cancelAnimationFrame(scrollFrame); scrollFrame = 0
  announcement.value = text('moveCanceled')
}
function endDrag() { drag = undefined; indicator.value = undefined; globalThis.cancelAnimationFrame(scrollFrame); scrollFrame = 0 }
function updateDrop(x: number, y: number) {
  if (!drag || drag.canceled) return
  const bounds = props.editor.view.dom.getBoundingClientRect()
  if (x < bounds.left - 36 || x > bounds.right + 36 || y < bounds.top || y > bounds.bottom) { drag.target = undefined; indicator.value = undefined; return }
  const found = blockDropTarget(props.editor, drag.source, Math.max(bounds.left + 1, Math.min(x, bounds.right - 1)), y, props.context)
  drag.target = found?.target
  indicator.value = found ? { left: `${found.rect.left}px`, top: `${found.target.placement === 'start' ? found.rect.top + 8 : found.target.placement === 'end' ? found.rect.bottom - 8 : found.target.placement === 'before' ? found.rect.top : found.rect.bottom}px`, width: `${found.rect.width}px` } : undefined
}
function autoScroll() {
  scrollFrame = 0
  if (!drag || drag.canceled) return
  let element: ElementType | null = props.editor.view.dom
  while (element) {
    const style = globalThis.getComputedStyle(element), bounds = element.getBoundingClientRect()
    if (element.scrollHeight > element.clientHeight && /auto|scroll/.test(style.overflowY)) {
      const change = drag.y < bounds.top + 40 ? -12 : drag.y > bounds.bottom - 40 ? 12 : 0
      if (change) { element.scrollTop += change; updateDrop(drag.x, drag.y) }
      break
    }
    element = element.parentElement
  }
  if (!element) {
    const change = drag.y < 45 ? -12 : drag.y > globalThis.innerHeight - 45 ? 12 : 0
    if (change) { globalThis.scrollBy(0, change); updateDrop(drag.x, drag.y) }
  }
  scrollFrame = globalThis.requestAnimationFrame(autoScroll)
}
function over(event: Drag) {
  if (!drag) return
  event.preventDefault(); event.stopPropagation()
  drag.x = event.clientX; drag.y = event.clientY
  updateDrop(drag.x, drag.y)
  if (event.dataTransfer) event.dataTransfer.dropEffect = drag.target && !drag.canceled ? 'move' : 'none'
  if (!scrollFrame && !drag.canceled) scrollFrame = globalThis.requestAnimationFrame(autoScroll)
}
function drop(event: Drag) {
  if (!drag) return
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
  updateDrop(event.clientX, event.clientY)
  const { source: block, target, canceled } = drag
  endDrag()
  if (!canceled && target) void move(target, block)
  else announcement.value = text('moveCanceledUnchanged')
}
function escapeDrag(event: Keyboard) { if (drag && event.key === 'Escape') { event.preventDefault(); cancelDrag() } }
function refresh() {
  revision.value++
  if (drag && (drag.source.doc !== props.editor.state.doc || !props.editor.isEditable || props.context.canMutate?.() === false)) cancelDrag()
  if (menuOpen.value && !busy.value && (!current() || !props.editor.isEditable)) close()
}
onMounted(() => {
  dragElement = props.editor.view.dom
  dragElement.addEventListener('dragstart', nativeDrag, true)
  props.editor.on('transaction', refresh); props.editor.on('update', refresh)
  globalThis.document.addEventListener('dragover', over, true)
  globalThis.document.addEventListener('drop', drop, true)
  globalThis.document.addEventListener('dragend', endDrag, true)
  globalThis.document.addEventListener('keydown', escapeDrag, true)
})
onBeforeUnmount(() => {
  dragElement?.removeEventListener('dragstart', nativeDrag, true)
  disposed = true; endDrag(); overlay?.release(owner)
  props.editor.off('transaction', refresh); props.editor.off('update', refresh)
  globalThis.document.removeEventListener('dragover', over, true)
  globalThis.document.removeEventListener('drop', drop, true)
  globalThis.document.removeEventListener('dragend', endDrag, true)
  globalThis.document.removeEventListener('keydown', escapeDrag, true)
})
defineExpose({ handleKeydown })
</script>

<template>
  <DragHandle
    :editor="editor"
    :nested="true"
    :on-node-change="onNodeChange"
    class="ginko-block-handle"
    :compute-position-config="{ placement: 'left-start', strategy: 'fixed' }"
  >
    <button
      ref="handle"
      type="button"
      draggable="true"
      class="ginko-control ginko-block-handle__button"
      :aria-label="text('blockActions')"
      :title="text('blockDragHint')"
      :aria-expanded="menuOpen"
      @click="open()"
      @dragstart="beginDrag"
      @dragend="endDrag"
    >
      <GripVertical
        :size="16"
        aria-hidden="true"
      />
    </button>
  </DragHandle>
  <PopoverRoot
    :open="menuOpen"
    @update:open="value => { if (!value) close() }"
  >
    <PopoverPortal :to="overlay?.getContainer()">
      <PopoverContent
        class="ginko-menu ginko-block-menu"
        :reference="anchor"
        :aria-label="label"
        side="right"
        align="start"
        :side-offset="8"
        :collision-padding="12"
        position-strategy="fixed"
        @escape-key-down="escapeMenu"
        @close-auto-focus="focusAfterClose"
      >
        <strong class="ginko-block-menu__title">{{ label }}</strong>
        <template v-if="!chooser">
          <button
            type="button"
            class="ginko-menu__item"
            :disabled="!parent || busy"
            @click="selectParent"
          >
            <CornerLeftUp
              :size="16"
              aria-hidden="true"
            />{{ text('selectParent') }}
          </button>
          <button
            type="button"
            class="ginko-menu__item"
            :disabled="!available('up')"
            @click="run('up')"
          >
            <ArrowUp
              :size="16"
              aria-hidden="true"
            />{{ text('moveUp') }}
          </button>
          <button
            type="button"
            class="ginko-menu__item"
            :disabled="!available('down')"
            @click="run('down')"
          >
            <ArrowDown
              :size="16"
              aria-hidden="true"
            />{{ text('moveDown') }}
          </button>
          <button
            type="button"
            class="ginko-menu__item"
            :disabled="busy"
            @click="showDestinations"
          >
            <MoveRight
              :size="16"
              aria-hidden="true"
            />{{ text('moveTo') }}
          </button>
          <button
            type="button"
            class="ginko-menu__item"
            :disabled="!available('duplicate')"
            @click="run('duplicate')"
          >
            <Copy
              :size="16"
              aria-hidden="true"
            />{{ text('duplicate') }}
          </button>
          <button
            type="button"
            class="ginko-menu__item ginko-danger"
            :disabled="!available('delete')"
            @click="run('delete')"
          >
            <Trash2
              :size="16"
              aria-hidden="true"
            />{{ text('delete') }}
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="ginko-menu__item"
            @click="chooser = false"
          >
            {{ text('backToBlockActions') }}
          </button>
          <input
            ref="destinationSearch"
            v-model="query"
            type="search"
            :aria-label="text('findDestination')"
            :placeholder="text('findDestinationPlaceholder')"
          >
          <div class="ginko-block-menu__destinations">
            <div
              v-for="destination in destinations"
              :key="destination.block.pos"
              class="ginko-block-menu__destination"
            >
              <span>{{ destination.label }}</span>
              <div>
                <button
                  v-for="target in destination.targets"
                  :key="target.placement"
                  type="button"
                  class="ginko-control"
                  :disabled="busy"
                  :aria-label="text('destinationPlacement', { placement: placementLabel(target.placement), label: destination.label })"
                  @click="move(target)"
                >
                  {{ placementLabel(target.placement) }}
                </button>
              </div>
            </div>
            <p v-if="!destinations.length">
              {{ text('noDestinations') }}
            </p>
          </div>
        </template>
        <p
          v-if="error"
          role="alert"
        >
          {{ error }}
        </p>
        <p
          v-if="busy"
          role="status"
        >
          {{ text('checkingDocument') }}
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <Teleport :to="overlay?.getContainer() ?? 'body'">
    <div
      v-if="indicator"
      class="ginko-block-insertion-line"
      :style="indicator"
      aria-hidden="true"
    />
  </Teleport>
  <span
    class="ginko-editor__sr-only"
    role="status"
  >{{ announcement }}</span>
</template>
