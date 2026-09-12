<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

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

</script>

<template>
  <div
    class="ginko-editor__toolbar"
    role="toolbar"
    aria-label="Rich text formatting tools"
  >
    <button
      type="button"
      title="Undo"
      @click="editor.chain().focus().undo().run()"
    >
      Undo
    </button>
    <button
      type="button"
      title="Redo"
      @click="editor.chain().focus().redo().run()"
    >
      Redo
    </button>
    <span aria-hidden="true" />
    <button
      v-for="level in ([1, 2, 3] as const)"
      :key="level"
      type="button"
      :aria-pressed="editor.isActive('heading', { level })"
      @click="editor.chain().focus().toggleHeading({ level }).run()"
    >
      H{{ level }}
    </button>
    <span aria-hidden="true" />
    <button
      type="button"
      :aria-pressed="editor.isActive('bold')"
      @click="editor.chain().focus().toggleBold().run()"
    >
      <strong>B</strong>
    </button>
    <button
      type="button"
      :aria-pressed="editor.isActive('italic')"
      @click="editor.chain().focus().toggleItalic().run()"
    >
      <em>I</em>
    </button>
    <button
      type="button"
      :aria-pressed="editor.isActive('strike')"
      @click="editor.chain().focus().toggleStrike().run()"
    >
      <s>S</s>
    </button>
    <button
      type="button"
      :aria-pressed="editor.isActive('code')"
      @click="editor.chain().focus().toggleCode().run()"
    >
      Code
    </button>
    <span aria-hidden="true" />
    <button
      type="button"
      :aria-pressed="editor.isActive('bulletList')"
      @click="editor.chain().focus().toggleBulletList().run()"
    >
      List
    </button>
    <button
      type="button"
      :aria-pressed="editor.isActive('orderedList')"
      @click="editor.chain().focus().toggleOrderedList().run()"
    >
      1. List
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
      Block code
    </button>
    <button
      type="button"
      @click="editor.chain().focus().setHorizontalRule().run()"
    >
      Rule
    </button>
    <button
      type="button"
      title="Image"
      @click="emit('request-image')"
    >
      Image
    </button>
    <button
      v-if="enableFiles"
      type="button"
      title="File"
      @click="emit('request-file')"
    >
      File
    </button>
    <button
      v-if="enableVideo"
      type="button"
      title="Video"
      @click="emit('request-video')"
    >
      Video
    </button>
  </div>
</template>

<style scoped>
.ginko-editor__toolbar { display: flex; align-items: center; gap: .25rem; border-bottom: 1px solid var(--ginko-border); padding: .4rem .5rem; overflow-x: auto; }
.ginko-editor__toolbar button { border: 0; border-radius: .35rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .55rem; }
.ginko-editor__toolbar button:hover, .ginko-editor__toolbar button[aria-pressed='true'] { background: var(--ginko-muted); }
.ginko-editor__toolbar button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.ginko-editor__toolbar span { align-self: stretch; border-left: 1px solid var(--ginko-border); margin: .15rem .25rem; }
</style>
