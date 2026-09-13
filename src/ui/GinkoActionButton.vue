<script setup lang="ts">
import { ToolbarButton, TooltipContent, TooltipRoot, TooltipTrigger } from 'reka-ui'
import type { EditorAction } from './commands'
import GinkoToolbarIcon from './GinkoToolbarIcon.vue'
defineProps<{ action: EditorAction; label?: boolean }>()
</script>
<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <ToolbarButton
        class="ginko-control"
        :disabled="action.disabled"
        :aria-label="action.label"
        :aria-pressed="action.active"
        :aria-busy="action.pending || undefined"
        :title="action.shortcut ? `${action.label} (${action.shortcut})` : action.label"
        @mousedown.prevent
        @click="action.run()"
      >
        <GinkoToolbarIcon :name="action.pending ? 'pending' : action.id" /><span v-if="label">{{ action.label }}</span>
      </ToolbarButton>
    </TooltipTrigger>
    <TooltipContent
      class="ginko-tooltip"
      :side-offset="6"
    >
      {{ action.label }}<kbd v-if="action.shortcut">{{ action.shortcut }}</kbd>
    </TooltipContent>
  </TooltipRoot>
</template>
