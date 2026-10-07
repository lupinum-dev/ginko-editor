<script setup lang="ts">
import { inject } from 'vue'
import { useKeyboardInset } from '../composables/useDevice'
import type { EditorActions, EditorToolbarGroup } from './commands'
import { editorOverlayKey } from './context'
import GinkoToolbar from './GinkoToolbar.vue'

defineProps<{
  actions: EditorActions
  items?: readonly EditorToolbarGroup[]
  visible: boolean
}>()
const emit = defineEmits<{ 'focus-change': [focused: boolean]; 'open-change': [open: boolean] }>()
const ui = inject(editorOverlayKey, undefined)
const inset = useKeyboardInset()

function onFocusOut(event: InstanceType<typeof globalThis.FocusEvent>) {
  const dock = event.currentTarget as InstanceType<typeof globalThis.HTMLElement>
  const next = event.relatedTarget
  if (!(next instanceof globalThis.Node) || !dock.contains(next)) emit('focus-change', false)
}
</script>

<template>
  <Teleport :to="ui?.getContainer() ?? 'body'">
    <Transition name="ginko-keyboard-dock">
      <div
        v-show="visible"
        class="ginko-keyboard-dock"
        :data-keyboard="inset > 0 ? 'open' : undefined"
        :style="{ '--ginko-keyboard-inset': `${inset}px` }"
        @focusin="emit('focus-change', true)"
        @focusout="onFocusOut"
      >
        <GinkoToolbar
          :actions="actions"
          :items="items"
          compact
          @open-change="emit('open-change', $event)"
        />
      </div>
    </Transition>
  </Teleport>
</template>
