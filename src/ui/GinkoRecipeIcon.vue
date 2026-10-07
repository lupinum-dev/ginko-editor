<script setup lang="ts">
import {
  AlignCenter,
  BookOpen,
  Braces,
  CaseUpper,
  ChevronsDownUp,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Columns2,
  Files,
  FolderCode,
  FolderTree,
  Frame,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  Keyboard,
  LayoutGrid,
  Lightbulb,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  ListTree,
  MessageSquareQuote,
  Milestone,
  Minus,
  PanelTop,
  Plus,
  Puzzle,
  Quote,
  SquareCode,
  StickyNote,
  Table2,
  TextQuote,
  TriangleAlert,
} from '@lucide/vue'

/**
 * Recipe icons use Lucide names in kebab-case. Only these names are bundled;
 * an unknown name shows the generic component icon.
 */
const icons = {
  'align-center': AlignCenter,
  'book-open': BookOpen,
  braces: Braces,
  'case-upper': CaseUpper,
  'chevrons-down-up': ChevronsDownUp,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  'circle-x': CircleX,
  clock: Clock,
  'columns-2': Columns2,
  files: Files,
  'folder-code': FolderCode,
  'folder-tree': FolderTree,
  frame: Frame,
  'heading-1': Heading1,
  'heading-2': Heading2,
  'heading-3': Heading3,
  image: Image,
  info: Info,
  keyboard: Keyboard,
  'layout-grid': LayoutGrid,
  lightbulb: Lightbulb,
  list: List,
  'list-checks': ListChecks,
  'list-collapse': ListCollapse,
  'list-ordered': ListOrdered,
  'list-tree': ListTree,
  'message-square-quote': MessageSquareQuote,
  milestone: Milestone,
  minus: Minus,
  'panel-top': PanelTop,
  plus: Plus,
  puzzle: Puzzle,
  quote: Quote,
  'square-code': SquareCode,
  'sticky-note': StickyNote,
  'table-2': Table2,
  'text-quote': TextQuote,
  'triangle-alert': TriangleAlert,
} as const

defineOptions({ name: 'GinkoRecipeIcon' })
defineProps<{ name?: string }>()
</script>

<template>
  <component
    :is="icons[name as keyof typeof icons] ?? Puzzle"
    :size="16"
    :stroke-width="1.7"
    aria-hidden="true"
  />
</template>
