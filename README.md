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

- A bundler that resolves package `exports`, such as Vite or Nuxt, on Node.js 22.18 or later.
- Vue 3.5.40 or later and TipTap 3.31.4 or a later 3.x version in the application.
  The root entry needs `vue` and `@tiptap/vue-3`.
- `@lupinum/ginko-content` 1.0.0-beta.10 or a later 1.x version. It is a peer
  dependency and supplies the shared CMS contract.

Repository development has separate requirements. Read [CONTRIBUTING.md](CONTRIBUTING.md).

## Installation

```bash
pnpm add @lupinum/ginko-editor @lupinum/ginko-content @tiptap/core @tiptap/pm @tiptap/vue-3 vue
```

Import `@lupinum/ginko-editor/style.css` one time in the application. The
JavaScript entries do not import CSS.

The `@lupinum/ginko-editor/runtime` entry converts and validates documents
without Vue views or browser globals. Server code needs only these packages:

```bash
pnpm add @lupinum/ginko-editor @lupinum/ginko-content @tiptap/core @tiptap/pm
```

The runtime entry does not import Vue. A package manager can still install Vue
because other packages declare it as a peer dependency.

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

The host owns persistence and asset selection. Supply `image-upload` and/or `image-picker` for the inline
image flow below, or listen for `request-image`,
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
result means conversion failed or an image operation is unfinished: keep the editor
open so the user can correct the document, finish the image operation, or remove it. The `error` is a
`ConversionErrorPayload`, or `{ code, message }` with code `image_upload_pending`,
`collaboration_pending`, or `not_ready`. A failed flush blocks switching to Markdown, which
would otherwise replace pending visual edits with older source. `flush()` emits
the latest converted source but does
not persist it; the host still owns and must await its save operation.
The editor does not import Nuxt, the CMS, Convex, or an application router.

The component handle, from a template ref, has the type `GinkoEditorHandle`:
`flush()`, `hasPendingChanges()`, `removeSelectedMedia()`, `focus(position?)`, and
`getEditor()`. `getEditor()` returns the TipTap editor as an unstable escape hatch.
All props are reactive except `collaboration`, which the editor reads once when it
mounts. New inline callbacks and equal authoring kits do not cancel uploads or
reload the document.

## Writing and component previews

Type `/` on a new paragraph or use **Insert** to search writing blocks. Native
Markdown blocks work without an authoring kit; host kits add component recipes.
Recipes can include a short `description`, search `keywords`, a menu `group`,
and a Lucide `icon` name. The menu groups results, shows recent blocks first, and
offers "Add tab" or "Add item" when the caret is inside a container.

### Built-in layout blocks

The editor includes a layout kit with the Ginko Docs components: callouts, tabs,
accordions, steps, cards, timelines, columns, code groups, figures, quizzes, and
more. Its policy is the Ginko Docs policy, so the documents render on a Docs site.
Compose it with your own kit:

```ts
import { composeAuthoringKits, ginkoLayoutKitSource } from '@lupinum/ginko-editor/authoring'

const kit = await composeAuthoringKits(ginkoLayoutKitSource, hostKitSource)
```

`createGinkoLayoutKit()` returns the layout kit alone. See
[Layout blocks](docs/content/docs/1.getting-started/4.layout-blocks.md) for what
each block can edit.

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

## Images: upload and browse

Provide one callback to enable an upload placeholder for **Add image**, `/image`,
and **Replace image**. The editor accepts one non-empty image file per placeholder,
up to 10 MB by default, from the file chooser or drag and drop. Set
`image-max-bytes` to change the limit. Add `image-picker` to
show **Browse images** in the same placeholder. A picker can also run without
an upload callback. Drop a file directly
onto the editor to see its preview and confirm **Add image**. Drop onto an
existing editor image to confirm **Replace image** in a compact popover attached
to that image, without moving the document. Cancel preserves the original;
no upload starts before confirmation. Dropping inside text chooses the nearby
block boundary, independently of the current caret.

By default, the editor owns file drops within its own surface. To include an
outer writing workspace, pass its element as `image-drop-target`. Drops outside
the editor append to the document; nested independent editors keep their own
drop handling. The playground uses this option for its whole workspace, including
the reader pane. Dragging existing content and block-reordering controls are not supported.

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
source. A host-policy `image` keeps native controls after reload when its stable
`id` equals `src` and its complete property and media contract matches native
image editing. Restricted or extended image policies keep component controls so
native actions cannot write unsupported properties.
Match stored references to the consuming Content policy; native image
URLs support site-relative paths such as `/images/photo.png`. Use
`image-output="markdown"` for native Markdown; the default MDC output also
preserves supported image dimensions and crop/focal metadata.

The host validates and persists files. Reject with a user-facing error to keep
the placeholder available for retry. Respect `signal` to cancel work when the
placeholder, document, active handler, or editor lifetime changes. A failed or
cancelled replacement keeps the original image. Completion follows the original
insertion point as text changes and does not interrupt typing elsewhere.

Pending placeholders are temporary view state, never Markdown or document nodes.
`hasPendingChanges()` and `pending-change` include them; `flush()` returns
`image_upload_pending` until upload or browse operations finish or are removed. Preserve this guard when
saving, leaving, or changing documents. When neither `image-upload` nor `image-picker` is provided, the existing
`request-image` event applies. The callback flow takes precedence over that event.

`ImagePicker` receives `{ signal, current? }` and resolves an `EditorImage` or
`null`. Return a stored `{ id }` or a durable `{ url }`, plus optional presentation
metadata. Use the exported `GinkoImagePicker` for a controlled library dialog, or
provide your own picker. The host owns its images, search, pagination, and uploads.
See the [image picker guide](docs/content/docs/1.getting-started/3.images.md) for a
complete callback adapter and cancellation rules.

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

`items` describes the repeated children of a container:

```ts
tabs: {
  label: 'Tabs',
  canvas: {
    items: {
      childTag: 'tab', labelProp: 'label', presentation: 'tabs', addLabel: 'Add tab',
      template: '::tab{label="New tab"}\nWrite the tab content here.\n::',
    },
  },
}
```

Set `childTag` for component items, or `childNode: 'codeBlock'` or
`childNode: 'heading'` for code blocks and heading sections. `presentation` is
`tabs`, `accordion`, `stack`, `grid`, `steps`, or `timeline`. `columnsProp` names
a container property with the grid column count. The template must contain
exactly one item. Adding, removing, and renaming items are single undoable
changes that pass the Content policy. The selected tab and collapsed accordion
items are view state and never enter the document.

A `json` control edits a property whose policy allows `json`. The field accepts
JSON text and applies it only when it is valid.

Tables expose row, column, and alignment menus beside the active table. The first
row is the Markdown header; another row can be promoted to that position.
Merged cells and arbitrary header placement are outside the Markdown table
contract. Code blocks expose their language and file name above the code. Images have a
cog for their description, replacement, host metadata, and removal.

## Toolbar and host controls

Use `toolbar-items` to group the built-in commands. Replace individual controls
through `GinkoToolbar` slots, or render your toolbar with the editor
`#toolbar="{ actions }"` slot. The same actions expose labels, active and disabled
states, and guarded `run()` operations. `messages`, `shortcuts`, and
`overlay-container` configure each editor independently. Compiled styles use
public `--ginko-*` tokens with shadcn semantic variables as fallbacks, and work
without Tailwind. All styles are in the `ginko` cascade layer, so unlayered host
rules override them. Dark fallbacks apply below a `.dark` ancestor or with
`data-ginko-theme="dark"` or `"auto"`.

- [Customize the editor](docs/content/docs/1.getting-started/2.customize.md): Vue, Nuxt, toolbar actions, messages, shortcuts, and overlays.
- [Layout blocks](docs/content/docs/1.getting-started/4.layout-blocks.md): the built-in layout kit and what each block can edit.
- [Component coverage](docs/content/docs/1.getting-started/5.component-coverage.md): current Docs tags, named slots, and source-mode limits.

## Documentation

The proposed documentation address is
[ginko-editor.lupinum.com](https://ginko-editor.lupinum.com). Deployment is not
part of the scaffold milestone.

Vercel deploys the documentation from `docs/`. Enable source files outside the
Root Directory because the documentation build uses this package.

## Contributing and development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.

### Local documentation playground

Build the package, then start the documentation site with the playground:

```bash
pnpm dev
```

The site uses the published Ginko Docs layer and the Content version of this
workspace, so the playground and the Editor share one parser.

## Support and security

Ask questions in the [Lupinum OSS Discord](https://discord.gg/RPH6SeA36N). Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/lupinum-dev/ginko-editor/security/advisories/new).

## License

[MIT](LICENSE) © Lupinum OG.
