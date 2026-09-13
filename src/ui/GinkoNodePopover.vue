<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, watch, type CSSProperties } from 'vue'

const props = defineProps<{
  panel: InstanceType<typeof globalThis.HTMLDivElement>
  state: { open: boolean; label: string; container: InstanceType<typeof globalThis.HTMLElement> | string; theme: CSSProperties; restoreFocus: boolean }
}>()
const emit = defineEmits<{ 'update:open': [open: boolean]; 'restore-focus': [restore: boolean] }>()
const trigger = ref<InstanceType<typeof globalThis.HTMLButtonElement>>()
const mountPoint = ref<InstanceType<typeof globalThis.HTMLDivElement>>()
watch(mountPoint, element => { if (element) element.append(props.panel) }, { flush: 'post' })
function restoreFocus(event: InstanceType<typeof globalThis.Event>) {
  event.preventDefault()
  if (props.state.restoreFocus && trigger.value?.isConnected) trigger.value.focus({ preventScroll: true })
}
</script>

<template>
  <PopoverRoot
    :open="state.open"
    @update:open="emit('update:open', $event)"
  >
    <PopoverTrigger as-child>
      <button
        ref="trigger"
        type="button"
        class="ginko-icon-button"
        :title="state.label"
        :aria-label="state.label"
      />
    </PopoverTrigger>
    <PopoverPortal :to="state.container">
      <PopoverContent
        class="ginko-node-popover-content"
        :style="state.theme"
        :aria-label="state.label"
        side="bottom"
        align="end"
        :side-offset="8"
        :collision-padding="12"
        position-strategy="fixed"
        update-position-strategy="always"
        hide-when-detached
        @escape-key-down="emit('restore-focus', true)"
        @interact-outside="emit('restore-focus', false)"
        @close-auto-focus="restoreFocus"
      >
        <div ref="mountPoint" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
