<script setup lang="ts">
import { LoaderCircle, Undo2, Redo2, Heading, Pilcrow, ChevronDown, List, ListOrdered, Quote, CodeSquare, Bold, Italic, Strikethrough, Code, Link, Minus, ImagePlus, FilePlus, Video, Table2, Plus, Ellipsis, GripVertical, ArrowUp, ArrowDown, Copy, Trash2, CornerUpLeft, Move } from '@lucide/vue'
const icons = { pending: LoaderCircle, undo: Undo2, redo: Redo2, heading: Heading, paragraph: Pilcrow, chevron: ChevronDown, bullets: List, bulletList: List, ordered: ListOrdered, orderedList: ListOrdered, quote: Quote, blockquote: Quote, codeBlock: CodeSquare, bold: Bold, italic: Italic, strike: Strikethrough, code: Code, link: Link, divider: Minus, image: ImagePlus, file: FilePlus, video: Video, table: Table2, insert: Plus, more: Ellipsis, grip: GripVertical, up: ArrowUp, down: ArrowDown, duplicate: Copy, delete: Trash2, parent: CornerUpLeft, move: Move }
defineProps<{ name: string }>()
</script>
<template>
  <component
    :is="icons[name as keyof typeof icons] ?? Heading"
    :size="18"
    :stroke-width="1.7"
    aria-hidden="true"
  />
</template>
