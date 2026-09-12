import { defineGinkoDocsConfig } from '@lupinum/ginko-docs/content'

export default defineGinkoDocsConfig({
  site: {
    name: 'Ginko Editor',
    description: 'A portable Vue editor for Ginko content.',
    whenToUse: 'Use this site to learn and operate Ginko Editor.',
  },
  locales: ['en'],
  blog: false,
})
