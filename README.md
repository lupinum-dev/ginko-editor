<p align="center"><img src="docs/public/icon.svg" width="128" alt="Ginko Editor icon"></p>
<h1 align="center">Ginko Editor</h1>
<p align="center">A portable Vue editor for Ginko content.</p>

> [!WARNING]
> This repository is an unreleased scaffold. Do not install it from npm yet.

## Why use Ginko Editor?

Use Ginko Editor to add one portable Ginko content editor to a Vue application.
The package ships Vue component code, TypeScript declarations, and opt-in CSS.

## When to use it

Use this package in Vue 3 applications. The scaffold is certified with plain
Vue and Nuxt production builds. It does not yet contain the real editor.

## Requirements

- Node.js 22.14 or later, Node.js 24, or Node.js 26.
- pnpm 11 for repository development.

## Installation

```bash
pnpm add @lupinum/ginko-editor
```

## Quick start

```vue
<script setup lang="ts">
import { GinkoEditorScaffold } from '@lupinum/ginko-editor'
import '@lupinum/ginko-editor/style.css'
</script>

<template>
  <GinkoEditorScaffold />
</template>
```

`GinkoEditorScaffold` only proves the package boundary. Step 3 replaces it with
the extracted editor implementation.

The scaffold has no Ginko Content, Tiptap, Nuxt, CMS, or application runtime
dependency. Step 3 will add only the dependencies required by the extracted
editor and its tested host boundaries.

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
