// Nuxt loads this file before the package build exists, so it reads the policy source.
import { ginkoLayoutComponentPolicy } from '../src/layout-kit'
import { useNuxt } from 'nuxt/kit'

const { hostComponentSources } = await import('./app/playground/authoring-sources')

/**
 * The site renders the layout kit components through the Docs layer, plus
 * the host example components. The layer's own policy uses an older format,
 * so a hook replaces it with one version 2 policy before Content reads it.
 */
const componentPolicy = {
  version: 2 as const,
  components: {
    ...ginkoLayoutComponentPolicy.components,
    ...Object.fromEntries(hostComponentSources.flatMap(source => Object.entries(source.policy.components))),
  },
}

export default defineNuxtConfig({
  extends: ['@lupinum/ginko-docs'],
  hooks: {
    // Replace the merged layer policy before any module reads it.
    'modules:before'() {
      const nuxt = useNuxt()
      nuxt.options.content = { ...nuxt.options.content, componentPolicy }
    },
  },
  content: {
    markdown: {
      tags: {
        'learning-objective': 'LearningObjective',
        'host-note': 'HostNote',
      },
    },
  },
  css: ['@lupinum/ginko-editor/style.css'],
  // The Editor and the site must share one Content parser instance.
  vite: { resolve: { dedupe: ['@lupinum/ginko-content'] } },
  i18n: {
    locales: [{ code: 'en', language: 'en-US', name: 'English' }],
  },
  site: { url: 'https://ginko-editor.lupinum.com', name: 'Ginko Editor' },
})
