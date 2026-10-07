<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { defaultSelectionToolbarItems, type EditorActions, type EditorToolbarGroup } from './commands'
import { editorOverlayKey } from './context'
import GinkoToolbar from './GinkoToolbar.vue'

const props = defineProps<{
  editor: Editor
  actions: EditorActions
  items?: readonly EditorToolbarGroup[]
}>()
const ui = inject(editorOverlayKey, undefined)

const root = ref<InstanceType<typeof globalThis.HTMLElement>>()
const ownOverlay = ref(false)
const hasSelection = ref(false)
const position = ref({ left: '0px', top: '0px' })
const side = ref<'top' | 'bottom'>('top')

const visibleItems = computed(() => (props.items ?? defaultSelectionToolbarItems)
  .map(group => group.filter(item => item.kind === 'menu'
    ? item.items.some(command => command.kind !== 'paragraph' && props.actions.get(command).available)
    : props.actions.get(item).available))
  .filter(group => group.length))

const visible = computed(
  () => visibleItems.value.length > 0 && hasSelection.value && (!ui?.active.value || ownOverlay.value),
)

/** Distance between the selection and the toolbar, and between the toolbar and the viewport edge. */
const gap = 8
const edge = 12

function update() {
  const editor = props.editor

  if (editor.isDestroyed) return

  const selection = editor.state.selection
  const textSelected = selection instanceof TextSelection && !selection.empty

  hasSelection.value = editor.isEditable && textSelected && (editor.view.hasFocus() || ownOverlay.value)

  if (!hasSelection.value) return

  const from = editor.view.coordsAtPos(selection.from)
  const to = editor.view.coordsAtPos(selection.to, -1)
  const width = root.value?.offsetWidth || 200
  const height = root.value?.offsetHeight || 40
  const center = (Math.min(from.left, to.left) + Math.max(from.right, to.right)) / 2
  const left = Math.max(edge, Math.min(center - width / 2, globalThis.innerWidth - width - edge))
  const above = from.top - height - gap
  side.value = above < edge ? 'bottom' : 'top'
  const top = side.value === 'top' ? above : to.bottom + gap

  position.value = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` }
}

watch(() => props.editor, (editor, _, cleanup) => {
  editor.on('transaction', update)
  editor.on('focus', update)
  editor.on('blur', update)
  globalThis.addEventListener('scroll', update, true)
  globalThis.addEventListener('resize', update)

  cleanup(() => {
    editor.off('transaction', update)
    editor.off('focus', update)
    editor.off('blur', update)
    globalThis.removeEventListener('scroll', update, true)
    globalThis.removeEventListener('resize', update)
  })
}, { immediate: true })

// The first measurement runs before the toolbar has a size. Place it again once it is visible.
watch(visible, (shown) => { if (shown) globalThis.requestAnimationFrame?.(update) })

onBeforeUnmount(() => {
  ownOverlay.value = false
})
</script>

<template>
  <Teleport :to="ui?.getContainer() ?? 'body'">
    <div
      v-show="visible"
      ref="root"
      class="ginko-selection-toolbar"
      :data-side="side"
      :style="position"
    >
      <GinkoToolbar
        :actions="actions"
        :items="visibleItems"
        compact
        @open-change="ownOverlay = $event"
      />
    </div>
  </Teleport>
</template>
