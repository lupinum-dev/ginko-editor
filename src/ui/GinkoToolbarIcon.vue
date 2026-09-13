<script setup lang="ts">
const paths = {
  undo: 'M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5',
  redo: 'M21 10H10a6 6 0 0 0 0 12M21 10l-5-5M21 10l-5 5',
  heading: 'M5 4v16M19 4v16M5 12h14',
  paragraph: 'M13 4v16M18 4v16M20 4H9a4 4 0 0 0 0 8h4',
  chevron: 'm8 10 4 4 4-4',
  bullets: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  ordered: 'M10 6h11M10 12h11M10 18h11M3 3h1v6M2 9h4M2 14a2 2 0 0 1 4 0c0 2-4 2-4 5h4',
  quote: 'M4 5h6v7H4V5Zm0 7v3a4 4 0 0 0 4 4M14 5h6v7h-6V5Zm0 7v3a4 4 0 0 0 4 4',
  codeBlock: 'M4 3h16v18H4zM9 9l-3 3 3 3M15 9l3 3-3 3',
  bold: 'M6 4h7a4 4 0 0 1 0 8H6V4Zm0 8h8a4 4 0 0 1 0 8H6v-8Z',
  italic: 'M10 4h10M4 20h10M15 4 9 20',
  strike: 'M17 6c-1-2-3-3-5-3-3 0-5 2-5 4 0 3 3 4 5 5M3 12h18M7 18c1 2 3 3 5 3 3 0 5-2 5-4 0-2-1-3-3-4',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  divider: 'M4 12h16',
  image: 'M4 3h16v18H4zM4 17l5-5 4 4 3-3 4 4M9 7h.01',
  file: 'M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8',
  video: 'M3 5h13v14H3zM16 10l5-4v12l-5-4',
} as const

defineProps<{ name: keyof typeof paths }>()
</script>

<template>
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
