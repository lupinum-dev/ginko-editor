<script setup lang="ts">
import {
  Bold,
  ChevronDown,
  Code,
  CodeSquare,
  Copy,
  Ellipsis,
  FilePlus,
  Heading,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  Video,
} from '@lucide/vue'

const icons = {
  pending: LoaderCircle,
  undo: Undo2,
  redo: Redo2,
  heading: Heading,
  paragraph: Pilcrow,
  chevron: ChevronDown,
  bullets: List,
  bulletList: List,
  ordered: ListOrdered,
  orderedList: ListOrdered,
  quote: Quote,
  blockquote: Quote,
  codeBlock: CodeSquare,
  bold: Bold,
  italic: Italic,
  strike: Strikethrough,
  code: Code,
  link: Link,
  divider: Minus,
  image: ImagePlus,
  file: FilePlus,
  video: Video,
  table: Table2,
  insert: Plus,
  more: Ellipsis,
  duplicate: Copy,
  delete: Trash2,
}
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
