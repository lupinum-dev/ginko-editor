import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const externalPackages = [
  'vue',
  'prosemirror-collab',
  'reka-ui',
  '@lucide/vue',
  'github-slugger',
  '@lupinum/ginko-content',
]

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/**/*.test.ts'],
  },
  build: {
    lib: {
      entry: {
        authoring: fileURLToPath(new URL('./src/authoring.ts', import.meta.url)),
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        runtime: fileURLToPath(new URL('./src/runtime.ts', import.meta.url)),
        collaboration: fileURLToPath(new URL('./src/collaboration.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'style',
    },
    sourcemap: true,
    rolldownOptions: {
      // Keep every declared dependency and peer external so hosts share one copy.
      external: (id) =>
        externalPackages.some((name) => id === name || id.startsWith(`${name}/`)) ||
        id.startsWith('@tiptap/'),
    },
  },
})
