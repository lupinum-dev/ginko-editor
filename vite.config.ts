import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

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
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'style',
    },
    rolldownOptions: {
      external: (id) =>
        id === 'vue' ||
        id.startsWith('@tiptap/') ||
        id === '@lupinum/ginko-content' ||
        id.startsWith('@lupinum/ginko-content/'),
    },
  },
})
