<p align="center"><img src="docs/public/icon.svg" width="128" alt="Ginko Editor icon"></p>
<h1 align="center">Ginko Editor</h1>
<p align="center">A portable Vue editor for Ginko content.</p>

> [!WARNING]
> This package is not published yet. The documented API is the current local release candidate.

## Why use Ginko Editor?

Use Ginko Editor to add one portable Ginko content editor to a Vue application.
The package ships Vue component code, TypeScript declarations, and opt-in CSS.

## When to use it

Use this package in Vue 3 applications that edit Ginko MDC source. Markdown is
the canonical value. The visual editor only opens when it can preserve the
document's parsed meaning. Unsupported or invalid documents stay in source mode.

## Requirements

- Node.js 22.18 or later, Node.js 24.11 or later, or Node.js 26 or later.
- pnpm 11 for repository development.
- Vue 3.5.40 or later and TipTap 3.31.3 in the consuming application.
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
  <GinkoEditor v-model="source" :enable-images="false" :enable-files="false" :enable-video="false" />
</template>
```

Opening, closing, or changing modes does not rewrite `source`. A real visual edit
emits normalized MDC. An invalid or unsupported value remains byte-for-byte
available in the Markdown textarea.

The host owns persistence and asset selection. Supply `image-upload` for the inline
upload flow below, or listen for `request-image`,
`request-file`, or `request-video`, then call the event request's `complete`
method after the user selects an asset. Pass `null` when selection is cancelled.
Each request can complete once. Cancellation is permanent. Completion returns
`false` if nothing was applied, including an empty asset source or a changed
document, selection, mode, or editability. Set `enable-images`, `enable-files`,
and `enable-video` to `false` for pickers your host does not provide. These flags
control insertion actions; existing media remains readable and removable.
Only the latest emitted value is recognized as a normal `v-model` echo. After an
external replacement, the current external source remains authoritative; hosts
should not replay older editor emissions as intentional replacements.
Before closing the editor or replacing its document, await the exposed `flush()`
method. Continue only when it returns `{ ok: true }`. A `{ ok: false, error }`
result means conversion failed or an image upload is unfinished: keep the editor
open so the user can correct the document, finish the upload, or remove it. A failed flush blocks switching to Markdown, which
would otherwise replace pending visual edits with older source. `flush()` emits
the latest converted source but does
not persist it; the host still owns and must await its save operation.
The editor does not import Nuxt, the CMS, Convex, or an application router.

## Writing and component previews

Type `/` on a new paragraph or use **Insert** to search writing blocks. Native
Markdown blocks work without an authoring kit; host kits add component recipes.
Recipes can include a short `description` and search `keywords`.

The optional `recipe-preview` slot receives `{ recipe }`. Hosts render its source
with Ginko Content and their own components. The menu handles selection, focus,
viewport placement, and insertion. The package does not depend on host renderers.

Copy and Cut put canonical Markdown and component source on the clipboard, so
selections can be shared with AI tools or pasted back into the editor. Titles
and settings are serialized as component properties; editing controls are never
copied. Text selected inside a title or settings input copies normally.
Markdown paste uses Content's parser and the same fidelity checks as opening a
document. An unsupported paste leaves the document unchanged and explains why.
`createAuthoringKit` consumes and freezes its input before asynchronous recipe
validation. Pass a fresh object if the application must keep an editable draft
of the configuration.

## Inline image uploads

Provide one callback to enable an upload placeholder for **Add image**, `/image`,
and **Replace image**. The editor accepts one non-empty image file up to 10 MB
per placeholder, from the file chooser or drag and drop.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GinkoEditor, type ImageUploadHandler } from '@lupinum/ginko-editor'
import '@lupinum/ginko-editor/style.css'
import { saveImage } from './assets' // Your host's validated storage operation.

const source = ref('')
const uploadImage: ImageUploadHandler = async (file, { signal }) => {
  const saved = await saveImage(file, { signal })
  return { url: saved.url, alt: file.name }
}
</script>

<template>
  <GinkoEditor v-model="source" :image-upload="uploadImage" :enable-files="false" :enable-video="false" />
</template>
```

Return a durable URL, or an `id` with an `asset-provider` that resolves it for
display. The provider's safe display URL takes precedence over the stored image
source. Match stored references to the consuming Content policy; native image
URLs support site-relative paths such as `/images/photo.png`. Use
`image-output="markdown"` for native Markdown; the default MDC output also
preserves supported image dimensions and crop/focal metadata.

The host validates and persists files. Reject with a user-facing error to keep
the placeholder available for retry. Respect `signal` to cancel work when the
placeholder, document, upload handler, or editor lifetime changes. A failed or
cancelled replacement keeps the original image. Completion follows the original
insertion point as text changes and does not interrupt typing elsewhere.

Pending placeholders are temporary view state, never Markdown or document nodes.
`hasPendingChanges()` and `pending-change` include them; `flush()` returns
`image_upload_pending` until they finish or are removed. Preserve this guard when
saving, leaving, or changing documents. Without `image-upload`, the existing
`request-image` host-picker contract applies.

The docs playground stores uploaded files in this browser's IndexedDB. Its local
image references survive reloads in that browser, but do not publish images or
make them available on other devices. Applications supply their own storage.

## Inline component controls

The kit describes editing controls without depending on Vue render components:

```ts
// Authoring metadata alongside an existing Content policy and implementation.
authoring: {
  note: {
    label: 'Note',
    props: { title: { label: 'Title', control: 'text' } },
    canvas: { titleProp: 'title', switchGroup: 'callout', tone: 'neutral' },
  },
  warning: {
    label: 'Warning',
    props: { title: { label: 'Title', control: 'text' } },
    canvas: { titleProp: 'title', switchGroup: 'callout', tone: 'warning' },
  },
  layout: {
    label: 'Columns',
    canvas: {
      columns: {
        childTag: 'column', sizeProp: 'size',
        presets: [
          { label: 'Small / Large', values: ['sm', 'lg'], ratio: 1 / 3 },
          { label: 'Medium / Medium', values: ['md', 'md'], ratio: 1 / 2 },
          { label: 'Large / Small', values: ['lg', 'sm'], ratio: 2 / 3 },
        ],
      },
    },
  },
}
```

`titleProp` edits the declared text property directly. A populated title slot
keeps its existing rich content. Other declared fields and block actions live in
the block's cog menu. `switchGroup` offers compatible variants; the complete
candidate document must pass the active Content policy before a switch applies.
It never drops properties to make a switch succeed.

`columns` references existing child props and allowed values. For exactly two
columns, the divider changes both sizes in one undoable operation, using pointer
drag or arrow keys. Imported custom pairs and layouts with other column counts
remain unchanged until explicitly edited. Presets require unique pairs and
increasing finite ratios between zero and one.

Tables expose row, column, and alignment menus beside the active table. The first
row is the Markdown header; another row can be promoted to that position.
Merged cells and arbitrary header placement are outside the Markdown table
contract. Code blocks expose their language and file name above the code. Images have a
cog for their description, replacement, host metadata, and removal.

## Documentation

The proposed documentation address is
[ginko-editor.lupinum.com](https://ginko-editor.lupinum.com). Deployment is not
part of the scaffold milestone.

Vercel deploys the documentation from `docs/`. Enable source files outside the
Root Directory because the documentation build uses this package.

## Contributing and development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request. Maintainers use [MAINTAINING.md](MAINTAINING.md).

### Local documentation playground

The playground temporarily needs accepted local Content and Docs candidates
because their required contracts are not published yet. Build both candidates,
then start the playground with explicit absolute paths:

```bash
GINKO_CONTENT_CANDIDATE=/absolute/path/to/ginko-content/packages/content \
GINKO_DOCS_CANDIDATE=/absolute/path/to/ginko-docs/layer \
pnpm docs:dev
```

The preparation script validates both inputs and creates only ignored files in
`docs/.candidate`. Remove this setup after the matching package releases are
published, as tracked in `internals/migrations.md`.

## Support and security

Ask questions in the [Lupinum OSS Discord](https://discord.gg/RPH6SeA36N). Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/lupinum-dev/ginko-editor/security/advisories/new).

## License

[MIT](LICENSE) © Lupinum OG.
