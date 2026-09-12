<p align="center"><img src="docs/public/icon.svg" width="128" alt="Ginko Editor icon"></p>
<h1 align="center">Ginko Editor</h1>
<p align="center">A portable Vue editor for Ginko content.</p>

> [!WARNING]
> This package is not published yet. The documented API is the Step 3 release candidate.

## Why use Ginko Editor?

Use Ginko Editor to add one portable Ginko content editor to a Vue application.
The package ships Vue component code, TypeScript declarations, and opt-in CSS.

## When to use it

Use this package in Vue 3 applications that edit Ginko MDC source. Markdown is
the canonical value. The visual editor only opens when it can preserve the
document's parsed meaning. Unsupported or invalid documents stay in source mode.

## Requirements

- Node.js 22.14 or later, Node.js 24, or Node.js 26.
- pnpm 11 for repository development.
- Vue 3.5 and TipTap 3.31.3 in the consuming application.
- `@lupinum/ginko-content` 1.0.0-beta.7 or later for the shared CMS contract.

## Installation

```bash
pnpm add @lupinum/ginko-editor @lupinum/ginko-content @tiptap/core @tiptap/pm @tiptap/vue-3
```

## Quick start

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GinkoEditor } from '@lupinum/ginko-editor'
import '@lupinum/ginko-editor/style.css'

const source = ref('# Hello\n')
</script>

<template>
  <GinkoEditor v-model="source" />
</template>
```

Opening, closing, or changing modes does not rewrite `source`. A real visual edit
emits normalized MDC. An invalid or unsupported value remains byte-for-byte
available in the Markdown textarea.

The host owns persistence and asset selection. Listen for `request-image`,
`request-file`, or `request-video`, then call the matching exposed insertion
method after the user selects an asset. If selection is cancelled, do nothing.
The editor does not import Nuxt, the CMS, Convex, or an application router.

## Documentation

The proposed documentation address is
[ginko-editor.lupinum.com](https://ginko-editor.lupinum.com). Deployment is not
part of the scaffold milestone.

Vercel deploys the documentation from `docs/`. Enable source files outside the
Root Directory because the documentation build uses this package.

## Contributing and development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request. Maintainers use [MAINTAINING.md](MAINTAINING.md).

## Support and security

Ask questions in the [Lupinum OSS Discord](https://discord.gg/RPH6SeA36N). Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/lupinum-dev/ginko-editor/security/advisories/new).

## License

[MIT](LICENSE) © Lupinum OG.
