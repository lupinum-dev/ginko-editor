<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

defineProps<{
  editor: Editor
  enableFiles: boolean
  enableVideo: boolean
}>()

const emit = defineEmits<{
  'request-file': []
  'request-image': []
  'request-video': []
}>()

const showMore = ref(false)
const moreId = useId()
const toolbarRoot = ref<InstanceType<typeof globalThis.HTMLElement>>()
function dismiss(event: globalThis.PointerEvent) {
  if (event.target instanceof globalThis.Node && !toolbarRoot.value?.contains(event.target)) showMore.value = false
}
function escape(event: globalThis.KeyboardEvent) {
  if (event.key !== 'Escape' || !showMore.value) return
  showMore.value = false
  toolbarRoot.value?.querySelector<globalThis.HTMLButtonElement>('.ginko-editor__toolbar-more-trigger')?.focus()
}
onMounted(() => globalThis.document.addEventListener('pointerdown', dismiss))
onBeforeUnmount(() => globalThis.document.removeEventListener('pointerdown', dismiss))
</script>

<template>
  <div
    ref="toolbarRoot"
    class="ginko-editor__toolbar"
    aria-label="Rich text formatting tools"
    @keydown="escape"
  >
    <div
      class="ginko-editor__toolbar-primary"
      role="group"
      aria-label="Text formatting"
    >
      <button
        type="button"
        aria-label="Undo"
        title="Undo (⌘/Ctrl Z)"
        :disabled="!editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
      >
        ↶
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (⌘/Ctrl Shift Z)"
        :disabled="!editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
      >
        ↷
      </button>
      <span
        class="ginko-editor__toolbar-divider"
        aria-hidden="true"
      />
      <button
        type="button"
        :aria-pressed="editor.isActive('bold')"
        aria-label="Bold"
        title="Bold (⌘/Ctrl B)"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('italic')"
        aria-label="Italic"
        title="Italic (⌘/Ctrl I)"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('heading', { level: 2 })"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        Heading
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('bulletList')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        List
      </button>
    </div>
    <button
      class="ginko-editor__toolbar-more-trigger"
      type="button"
      :aria-expanded="showMore"
      :aria-controls="moreId"
      @click="showMore = !showMore"
    >
      More
    </button>
    <div
      v-if="showMore"
      :id="moreId"
      class="ginko-editor__toolbar-more"
      role="group"
      aria-label="More formatting"
    >
      <button
        type="button"
        :aria-pressed="editor.isActive('heading', { level: 1 })"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        Title
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('heading', { level: 3 })"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        Subheading
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('strike')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        Strike
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('code')"
        @click="editor.chain().focus().toggleCode().run()"
      >
        Code
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('orderedList')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        Numbered list
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('blockquote')"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        Quote
      </button>
      <button
        type="button"
        :aria-pressed="editor.isActive('codeBlock')"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >
        Code block
      </button>
      <button
        type="button"
        @click="editor.chain().focus().setHorizontalRule().run()"
      >
        Divider
      </button>
      <button
        type="button"
        @click="emit('request-image')"
      >
        Image
      </button>
      <button
        v-if="enableFiles"
        type="button"
        @click="emit('request-file')"
      >
        File
      </button>
      <button
        v-if="enableVideo"
        type="button"
        @click="emit('request-video')"
      >
        Video
      </button>
    </div>
  </div>
</template>

<style scoped>
.ginko-editor__toolbar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: .5rem; border-bottom: 1px solid var(--ginko-border); padding: .35rem .5rem; }
.ginko-editor__toolbar-primary { display: flex; min-width: 0; align-items: center; gap: .15rem; overflow-x: auto; }
.ginko-editor__toolbar button { min-height: 2.25rem; border: 0; border-radius: .4rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .6rem; white-space: nowrap; }
.ginko-editor__toolbar button:hover, .ginko-editor__toolbar button[aria-pressed='true'] { background: var(--ginko-muted); }
.ginko-editor__toolbar button:disabled { opacity: .35; cursor: default; }
.ginko-editor__toolbar button:focus-visible { outline-offset: 2px; }
.ginko-editor__toolbar-divider { align-self: stretch; border-inline-start: 1px solid var(--ginko-border); margin: .2rem .2rem; }
.ginko-editor__toolbar-more-trigger { flex: 0 0 auto; }
.ginko-editor__toolbar-more { position: absolute; z-index: 20; inset-block-start: calc(100% + .35rem); inset-inline-end: .5rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: min(22rem, calc(100vw - 3rem)); border: 1px solid var(--ginko-border); border-radius: .65rem; background: var(--ginko-bg); box-shadow: 0 .75rem 2rem rgb(0 0 0 / .12); padding: .45rem; }
.ginko-editor__toolbar-more button { text-align: start; }
@media (max-width: 34rem) {
  .ginko-editor__toolbar button { min-height: 2.75rem; }
  .ginko-editor__toolbar-primary { scroll-snap-type: inline proximity; }
  .ginko-editor__toolbar-primary button { scroll-snap-align: start; }
}
</style>
