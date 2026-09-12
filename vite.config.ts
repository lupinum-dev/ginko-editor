import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
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
