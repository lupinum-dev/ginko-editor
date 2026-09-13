<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Image, Search, Upload, X } from '@lucide/vue'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
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
}>(), { messages: undefined, query: '', loading: false, hasMore: false, enableUpload: false, error: undefined, overlayContainer: undefined })
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
    returnFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement ? globalThis.document.activeElement : undefined
    returnEditor = returnFocus?.closest('.ginko-editor')?.querySelector<globalThis.HTMLElement>('[contenteditable="true"]') ?? undefined
    failedThumbnails.value.clear()
  }
}, { immediate: true, flush: 'sync' })
const choices = computed(() => props.images.map(item => {
  const url = item.thumbnailUrl ?? item.image.url ?? ''
  const thumbnailKey = `${item.key}:${url}`
  return { ...item, thumbnailKey, preview: failedThumbnails.value.has(thumbnailKey) ? undefined : sanitizeResolvedImageUrl(url) ?? undefined }
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

<style scoped>
.ginko-image-picker__overlay { position: fixed; inset: 0; z-index: 100; background: rgb(0 0 0 / .32); }
.ginko-image-picker { position: fixed; z-index: 101; inset-inline-start: 50%; inset-block-start: 50%; transform: translate(-50%, -50%); width: min(42rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border, #dededb); border-radius: .875rem; background: var(--popover, var(--card, #fff)); color: var(--popover-foreground, var(--foreground, #292924)); box-shadow: 0 1.5rem 5rem rgb(0 0 0 / .2); font: inherit; }
.ginko-image-picker__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.25rem .75rem; }
.ginko-image-picker__title { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1.5; }
.ginko-image-picker__description { margin: .25rem 0 0; font-size: .875rem; color: var(--muted-foreground, #71716a); }
.ginko-image-picker button, .ginko-image-picker input { font: inherit; }
.ginko-image-picker button { cursor: pointer; color: inherit; }
.ginko-image-picker button:disabled { cursor: default; opacity: .5; }
.ginko-image-picker button:focus-visible, .ginko-image-picker input:focus-visible { outline: 2px solid var(--ring, #77786e); outline-offset: 3px; }
.ginko-image-picker__close { display: grid; place-items: center; min-width: 2.25rem; min-height: 2.25rem; background: none; border: 0; border-radius: .375rem; }
.ginko-image-picker__close:hover, .ginko-image-picker__button:hover { background: var(--muted, #f3f3ef); }
.ginko-image-picker__tools { display: flex; gap: .75rem; padding: .5rem 1.25rem 1rem; }
.ginko-image-picker__search { display: flex; flex: 1; min-width: 0; align-items: center; gap: .5rem; padding: .5rem .625rem; border: 1px solid var(--border, #dededb); border-radius: .5rem; color: var(--muted-foreground, #71716a); }
.ginko-image-picker__search input { width: 100%; min-width: 0; border: 0; padding: 0; background: transparent; color: var(--foreground, #292924); outline-offset: 2px; }
.ginko-image-picker__button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-height: 2.25rem; padding: .375rem .75rem; border: 1px solid var(--border, #dededb); border-radius: .5rem; background: transparent; font-size: .875rem !important; }
.ginko-image-picker__error { margin: 0 1.25rem .75rem; color: var(--destructive, #b42318); font-size: .875rem; }
.ginko-image-picker__results { overflow: auto; min-height: 10rem; padding: .25rem 1.25rem 1.25rem; }
.ginko-image-picker__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .875rem; }
.ginko-image-picker__item { min-width: 0; padding: 0; border: 1px solid var(--border, #dededb); border-radius: .5rem; overflow: hidden; background: transparent; text-align: start; }
.ginko-image-picker__item:hover { border-color: var(--ring, #96978c); background: var(--muted, #f3f3ef); }
.ginko-image-picker__thumbnail { display: grid; place-items: center; aspect-ratio: 4 / 3; background: var(--muted, #f3f3ef); color: var(--muted-foreground, #71716a); }
.ginko-image-picker__thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ginko-image-picker__label { display: block; padding: .625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8125rem; }
.ginko-image-picker__empty { padding: 2.5rem 1rem; text-align: center; color: var(--muted-foreground, #71716a); font-size: .875rem; }
.ginko-image-picker__status { text-align: center; font-size: .8125rem; color: var(--muted-foreground, #71716a); }
.ginko-image-picker__footer { display: flex; justify-content: space-between; padding: 1rem 1.25rem; border-top: 1px solid var(--border, #dededb); }
@media (max-width: 30rem) { .ginko-image-picker__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ginko-image-picker__button, .ginko-image-picker__close { min-height: 2.75rem; } }
</style>
