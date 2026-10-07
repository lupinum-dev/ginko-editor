<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Image, Search, Upload, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import type { EditorImage, EditorImagePickerItem } from './types'
import { createEditorText, type EditorMessages } from './ui/messages'
import { sanitizeResolvedImageUrl } from './lib/props'

const props = withDefaults(defineProps<{
  messages?: EditorMessages
  open: boolean
  images: readonly EditorImagePickerItem[]
  query?: string
  loading?: boolean
  error?: string
  hasMore?: boolean
  enableUpload?: boolean
  overlayContainer?: string | globalThis.HTMLElement
}>(), {
  messages: undefined,
  query: '',
  loading: false,
  hasMore: false,
  enableUpload: false,
  error: undefined,
  overlayContainer: undefined,
})
const text = createEditorText(() => props.messages)
const emit = defineEmits<{
  'update:open': [open: boolean]
  'update:query': [query: string]
  select: [image: EditorImage]
  'load-more': []
  upload: []
}>()
const failedThumbnails = ref(new Set<string>())
const searchInput = ref<globalThis.HTMLInputElement>()
let returnFocus: globalThis.HTMLElement | undefined
let returnEditor: globalThis.HTMLElement | undefined
watch(() => props.open, open => {
  if (open && typeof globalThis.document !== 'undefined') {
    returnFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement
      ? globalThis.document.activeElement
      : undefined
    returnEditor = returnFocus
      ?.closest('.ginko-editor')
      ?.querySelector<globalThis.HTMLElement>('[contenteditable="true"]')
      ?? undefined
    failedThumbnails.value.clear()
  }
}, { immediate: true, flush: 'sync' })
const choices = computed(() => props.images.map(item => {
  const url = item.thumbnailUrl ?? item.image.url ?? ''
  const thumbnailKey = `${item.key}:${url}`
  return {
    ...item,
    thumbnailKey,
    preview: failedThumbnails.value.has(thumbnailKey)
      ? undefined
      : sanitizeResolvedImageUrl(url) ?? undefined,
  }
}))
function select(image: EditorImage) {
  emit('select', image)
  emit('update:open', false)
}
function restoreFocus(event: globalThis.Event) {
  event.preventDefault()
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  else if (returnEditor?.isConnected) returnEditor.focus({ preventScroll: true })
}
function focusSearch(event: globalThis.Event) {
  event.preventDefault()
  searchInput.value?.focus({ preventScroll: true })
}
</script>

<template>
  <DialogRoot
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogPortal :to="overlayContainer">
      <DialogOverlay class="ginko-image-picker__overlay" />
      <DialogContent
        class="ginko-image-picker"
        @open-auto-focus="focusSearch"
        @close-auto-focus="restoreFocus"
      >
        <header class="ginko-image-picker__header">
          <div>
            <DialogTitle class="ginko-image-picker__title">
              {{ text('chooseImage') }}
            </DialogTitle>
            <DialogDescription class="ginko-image-picker__description">
              {{ text('imagePickerDescription') }}
            </DialogDescription>
          </div>
          <DialogClose
            class="ginko-image-picker__close"
            :aria-label="text('closeImagePicker')"
          >
            <X
              :size="18"
              aria-hidden="true"
            />
          </DialogClose>
        </header>
        <div class="ginko-image-picker__tools">
          <label class="ginko-image-picker__search">
            <Search
              :size="17"
              aria-hidden="true"
            />
            <input
              ref="searchInput"
              :value="query"
              type="search"
              :aria-label="text('searchImages')"
              :placeholder="text('searchImagesPlaceholder')"
              @input="emit('update:query', ($event.target as HTMLInputElement).value)"
            >
          </label>
          <button
            v-if="enableUpload"
            class="ginko-image-picker__button"
            type="button"
            @click="emit('upload')"
          >
            <Upload
              :size="16"
              aria-hidden="true"
            /> {{ text('upload') }}
          </button>
        </div>
        <p
          v-if="error"
          class="ginko-image-picker__error"
          role="alert"
        >
          {{ error }}
        </p>
        <div
          class="ginko-image-picker__results"
          :aria-busy="loading"
          :aria-label="text('imageLibrary')"
        >
          <div
            v-if="choices.length"
            class="ginko-image-picker__grid"
          >
            <button
              v-for="item in choices"
              :key="item.key"
              type="button"
              class="ginko-image-picker__item"
              :aria-label="text('chooseNamedImage', { label: item.label })"
              @click="select(item.image)"
            >
              <span class="ginko-image-picker__thumbnail">
                <img
                  v-if="item.preview"
                  :src="item.preview"
                  alt=""
                  loading="lazy"
                  @error="failedThumbnails.add(item.thumbnailKey)"
                >
                <Image
                  v-else
                  :size="28"
                  aria-hidden="true"
                />
              </span>
              <span class="ginko-image-picker__label">{{ item.label }}</span>
            </button>
          </div>
          <p
            v-else
            class="ginko-image-picker__empty"
            role="status"
          >
            {{ text(loading ? 'loadingImages' : query ? 'noMatchingImages' : 'noImages') }}
          </p>
          <p
            v-if="loading && choices.length"
            class="ginko-image-picker__status"
            role="status"
          >
            {{ text('loadingImages') }}
          </p>
        </div>
        <footer class="ginko-image-picker__footer">
          <DialogClose class="ginko-image-picker__button">
            {{ text('cancel') }}
          </DialogClose>
          <button
            v-if="hasMore"
            class="ginko-image-picker__button"
            type="button"
            :disabled="loading"
            @click="emit('load-more')"
          >
            {{ text(loading ? 'loading' : 'loadMore') }}
          </button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
