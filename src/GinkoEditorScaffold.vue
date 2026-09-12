<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  {
    label: 'Ginko Editor',
  },
)
</script>

<template>
  <section
    class="ginko-editor-scaffold"
    :aria-label="label"
  >
    <slot>Ginko Editor package scaffold</slot>
  </section>
</template>

<style>
.ginko-editor-scaffold {
  box-sizing: border-box;
  min-block-size: 4rem;
  padding: 1rem;
  color: var(--ginko-editor-color, #18181b);
  background: var(--ginko-editor-background, #fafafa);
  border: 1px solid var(--ginko-editor-border-color, #d4d4d8);
  border-radius: 0.5rem;
}
</style>
