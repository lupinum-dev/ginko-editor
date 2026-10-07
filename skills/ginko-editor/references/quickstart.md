# Quickstart

## Install

```bash
pnpm add @lupinum/ginko-editor @lupinum/ginko-content @tiptap/core @tiptap/pm @tiptap/vue-3 vue
```

## Mount and save

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GinkoEditor, type GinkoEditorHandle } from '@lupinum/ginko-editor'
import '@lupinum/ginko-editor/style.css'

const source = ref('# Hello\n')
const editor = ref<GinkoEditorHandle>()

async function save() {
  const result = await editor.value?.flush()
  if (!result?.ok) return // keep the editor open; show result.error.message
  await persist(source.value)
}
</script>

<template>
  <GinkoEditor ref="editor" v-model="source" @conversion-error="console.warn" />
  <button type="button" @click="save">Save</button>
</template>
```

## Nuxt

```ts
export default defineNuxtConfig({
  css: ['@lupinum/ginko-editor/style.css'],
  vite: { resolve: { dedupe: ['@lupinum/ginko-content'] } },
})
```

Render the editor only where the page is interactive. It renders its content
after it mounts, so wrap it in `<ClientOnly>` when server markup matters.

## Common props

| Prop | Use |
| --- | --- |
| `toolbarItems` | Groups of commands for the top row |
| `messages` | Interface text; `germanMessages` for German |
| `shortcuts` | Change or turn off shortcuts (`false`) |
| `enableImages`, `enableFiles`, `enableVideo` | Show or hide media insertion |
| `imageUpload`, `imagePicker`, `assetProvider` | Host-owned media |
| `authoringKit` | Components and recipes for the insert menu |
| `disabled` | Read-only |
