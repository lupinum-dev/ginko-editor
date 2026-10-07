export default defineAppConfig({
  ginkoDocs: {
    site: {
      url: 'https://ginko-editor.lupinum.com',
      name: { en: 'Ginko Editor' },
      description: { en: 'A portable Vue editor for Ginko content.' },
      logo: { light: '/icon.svg', dark: '/icon.svg' },
      legalLinks: [
        { label: { en: 'Legal notice' }, to: 'https://lupinum.com/impressum' },
        { label: { en: 'Privacy' }, to: 'https://lupinum.com/datenschutz' },
      ],
    },
    nav: {
      links: [
        { label: { en: 'Playground' }, to: { en: '/playground' } },
        { label: { en: 'Docs' }, to: { en: '/docs' } },
      ],
      socialIcons: true,
    },
    social: {
      github: 'https://github.com/lupinum-dev/ginko-editor',
      discord: 'https://discord.gg/RPH6SeA36N',
    },
    repository: {
      url: 'https://github.com/lupinum-dev/ginko-editor',
      branch: 'main',
      contentDirectory: 'docs/content',
    },
    analytics: { plausible: { scriptId: '' } },
    feedback: { enabled: false },
    landing: {
      title: { en: 'Ginko Editor' },
      description: { en: 'A portable Vue editor for Ginko content.' },
      primary: { label: { en: 'Open playground' }, to: { en: '/playground' } },
      secondary: { label: { en: 'Read the docs' }, to: { en: '/docs' } },
      install: { command: 'pnpm add @lupinum/ginko-editor' },
    },
  },
})
