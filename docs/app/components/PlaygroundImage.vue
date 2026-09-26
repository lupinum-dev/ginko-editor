<script setup lang="ts">
import { computed, inject } from 'vue'
import { playgroundImageSource } from '../playground/assets'

const props = defineProps<{
  src?: string
  alt?: string
  title?: string
  width?: string | number
  height?: string | number
}>()

const resolve = inject(playgroundImageSource, source => source)
const src = computed(() => resolve(props.src ?? ''))
</script>

<template>
  <ProseImg
    v-bind="props"
    :src="src"
  />
</template>
