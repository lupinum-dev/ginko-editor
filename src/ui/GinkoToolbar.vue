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

function run(editor: Editor, action: string) {
  const chain = editor.chain().focus() as unknown as Record<string, (...args: unknown[]) => unknown>
  const command = chain[action]
  if (typeof command !== 'function') return
  const result = command.call(chain) as { run?: () => void }
  result.run?.()
}
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
      @click="run(editor, 'undo')"
    >
      Undo
    </button>
    <button
      type="button"
      title="Redo"
      @click="run(editor, 'redo')"
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
