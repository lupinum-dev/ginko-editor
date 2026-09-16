import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

const localDocsLayer = resolve(import.meta.dirname, '.candidate/ginko-docs')
const localContentCandidate = realpathSync(
  resolve(import.meta.dirname, 'node_modules/@lupinum/ginko-content'),
)
const usesLocalDocsCandidate = existsSync(resolve(localDocsLayer, 'authoring.ts'))
if (!usesLocalDocsCandidate) {
  throw new Error(
    'The playground currently requires the accepted Ginko Docs candidate. '
    + 'Run pnpm docs:build from the repository root.',
  )
}
const { hostComponentSources } = await import('./app/playground/authoring-sources')
const rendererComponents = Object.fromEntries(
  hostComponentSources.flatMap((source) => Object.entries(source.policy.components)),
)

export default defineNuxtConfig({
  extends: [localDocsLayer],
  alias: {
    '@lupinum/ginko-content/agent-paths': resolve(
      localContentCandidate,
      'dist/public/agent-paths.js',
    ),
    '@lupinum/ginko-content/agent-registry': resolve(
      localContentCandidate,
      'dist/public/agent-registry.js',
    ),
    '@lupinum/ginko-content/client': resolve(localContentCandidate, 'dist/public/client.js'),
    '@lupinum/ginko-content/cms-contract': resolve(
      localContentCandidate,
      'dist/cms-contract/index.js',
    ),
    '@lupinum/ginko-content/config': resolve(localContentCandidate, 'dist/config.mjs'),
    '@lupinum/ginko-content/navigation': resolve(
      localContentCandidate,
      'dist/public/navigation.js',
    ),
    '@lupinum/ginko-content/server': resolve(localContentCandidate, 'dist/public/server.js'),
    '@lupinum/ginko-docs/authoring': resolve(localDocsLayer, 'authoring.ts'),
  },
  content: {
    componentPolicy: { version: 2, components: rendererComponents },
    markdown: {
      tags: {
        'learning-objective': 'LearningObjective',
        'host-note': 'HostNote',
      },
    },
  },
  css: ['@lupinum/ginko-editor/style.css'],
  i18n: {
    locales: [{ code: 'en', language: 'en-US', name: 'English' }],
  },
  site: { url: 'https://ginko-editor.lupinum.com', name: 'Ginko Editor' },
})
