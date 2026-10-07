# Changelog

## 0.1.0

First release on npm. Ginko Editor is a Vue editor for Ginko content. Markdown
is the stored value, and the visual editor opens a document only when it can
keep its meaning; any other document stays in source mode. Documentation:
https://ginko-editor.lupinum.com

### What it does

- **Visual and source editing** of Ginko MDC, with a toolbar, a block menu,
  inline component editing, tables, and clipboard round trips that keep
  component values, media metadata, list paragraphs, table alignment and
  code fences.
- **Layout blocks** for the Ginko Docs components (`createGinkoLayoutKit()`):
  callouts, columns, tabs, accordion, steps, cards, timeline, code group,
  figure and more. Tabs, accordion items, steps, cards and timeline entries are
  edited in place, and each change is one undo step.
- **A block menu** grouped by Text, Lists, Media, Layout, Callouts, Advanced and
  your own groups, with fuzzy search, highlighted matches and recent blocks.
- **Images, files and videos** through the `request-image`, `request-file` and
  `request-video` events or an `asset-provider`. Uploads are limited by
  `image-max-bytes` (default 10 MB).
- **Editor profiles, in-place editing and an inline variant** for editing
  inside a page instead of a full editor.
- **Document safety.** Saved Markdown escapes text that a site parser would
  turn into a link, typed `{{ … }}`, `:name:` and times stay text,
  headings keep custom `{#id}` anchors, and an unknown node stops the save with
  an error instead of losing content.
- **A server entry**, `@lupinum/ginko-editor/runtime`, that converts and
  validates documents without Vue or browser globals.
- **Shared editing (experimental).** A transport interface with presence
  (remote carets and a collaborator list), offline and retry states, recovery
  of unsent changes, and server-side validation. It can change in a minor
  release.
- **Styling and text.** Styles live in the `ginko` cascade layer and use public
  `--ginko-*` tokens, with dark mode through a `.dark` ancestor or
  `data-ginko-theme`. All interface text is in `messages`; English and German
  ship with the package.
- **Agent docs.** The package ships its version-matched documentation and an
  agent skill.

### Requirements

- `@lupinum/ginko-content` `>=1.0.0-beta.11 <2`, so the editor and your site
  renderer share one parser.
- TipTap `^3.31.4` (`@tiptap/core`, `@tiptap/pm`, `@tiptap/vue-3`) and Vue
  `^3.5.40`. The `/runtime` entry needs neither Vue nor `@tiptap/vue-3`.

### Upgrading from a pre-release build

Only for hosts that installed a tarball or preview build before 0.1.0, such as
Ginko CMS.

- Install `@lupinum/ginko-content` in the host. It is now a peer dependency.
- The component handle is `GinkoEditorHandle`: `flush()`,
  `hasPendingChanges()`, `removeSelectedMedia()`, `focus(position?)` and
  `getEditor()`. Replace `handle.editor` with `handle.getEditor()`, and insert
  assets through the request events instead of `insertImageAsset`,
  `insertFileAsset` and `insertVideo`. `rawContent` and `viewMode` are gone.
- A flush `error` is a `ConversionErrorPayload` or a state error with the code
  `image_upload_pending`, `collaboration_pending` or `not_ready`. Check `code`
  first.
- The `enableDebug` prop is removed.
- CSS tokens are renamed: `--ginko-bg`, `--ginko-text`, `--ginko-muted-text`,
  `--ginko-popover-text` and `--ginko-accent-bg` become `--ginko-background`,
  `--ginko-foreground`, `--ginko-muted-foreground`,
  `--ginko-popover-foreground` and `--ginko-accent`. Unlayered host rules now
  override editor styles.
- Block drag handles and block reordering are removed.
- Shared editing: import transport types from `@lupinum/ginko-editor/runtime`,
  let backends with strict argument validation accept the optional
  `protocolVersion` field, and re-seed shared rooms for the schema revision
  `ginko-editor-2`. New component insertions record angle syntax; rooms saved
  without source-origin data keep the colon syntax. Update client and backend
  together.
- The `V1` type names and `VideoInfo` still work as deprecated aliases.
