<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import type { EditorActions, EditorToolbarGroup } from './commands'
import { editorOverlayKey } from './context'
import GinkoToolbar from './GinkoToolbar.vue'
const props = defineProps<{ editor: Editor; actions: EditorActions }>()
const ui = inject(editorOverlayKey, undefined)
const ownOverlay = ref(false), hasSelection = ref(false)
const position = ref({ left: '0px', top: '0px' })
const visible = computed(() => hasSelection.value && (!ui?.active.value || ownOverlay.value))
const items: readonly EditorToolbarGroup[] = [[{ kind: 'mark', mark: 'bold' }, { kind: 'mark', mark: 'italic' }, { kind: 'mark', mark: 'strike' }, { kind: 'mark', mark: 'code' }, { kind: 'link' }]]
function update() {
  const editor = props.editor
  if (editor.isDestroyed) return
  const selection = editor.state.selection
  hasSelection.value = editor.isEditable && selection instanceof TextSelection && !selection.empty && editor.view.hasFocus()
  if (!hasSelection.value && ownOverlay.value && selection instanceof TextSelection && !selection.empty) hasSelection.value = true
  if (!hasSelection.value) return
  const from = editor.view.coordsAtPos(selection.from), to = editor.view.coordsAtPos(selection.to)
  position.value = { left: `${Math.max(12, Math.min((from.left + to.right) / 2 - 98, globalThis.innerWidth - 208))}px`, top: `${Math.max(12, from.top - 46)}px` }
}
watch(() => props.editor, (editor, _, cleanup) => {
  editor.on('transaction', update); editor.on('focus', update); editor.on('blur', update)
  globalThis.addEventListener('scroll', update, true); globalThis.addEventListener('resize', update)
  cleanup(() => { editor.off('transaction', update); editor.off('focus', update); editor.off('blur', update); globalThis.removeEventListener('scroll', update, true); globalThis.removeEventListener('resize', update) })
}, { immediate: true })
onBeforeUnmount(() => { ownOverlay.value = false })
</script>
<template>
  <Teleport :to="ui?.getContainer() ?? 'body'">
    <div
      v-show="visible"
      class="ginko-selection-toolbar"
      :style="position"
    >
      <GinkoToolbar
        :actions="actions"
        :items="items"
        compact
        @open-change="ownOverlay = $event"
      />
    </div>
  </Teleport>
</template>
