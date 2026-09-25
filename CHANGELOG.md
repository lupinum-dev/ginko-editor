# Changelog

## Unreleased

- **Breaking:** install `@lupinum/ginko-content` in the host. It is now a peer
  dependency (`>=1.0.0-beta.9 <2`), so the editor and the host renderer share
  one parser. TipTap peers accept `^3.31.3`.
- Keep Reka UI, Lucide and github-slugger external, which halves `dist/index.js`.
- Ship source maps and NodeNext-safe declarations. The `/runtime` entry does not
  require Vue.

- Keep typed `{{ … }}` text and inline code verbatim. The editor no longer turns
  template braces into binding nodes, which Content does not define.
- Keep `:name:` text verbatim. The editor no longer rewrites emoji shortcodes or
  removes colons from times such as `10:30:45`.
- Remove the `enableDebug` prop and the internal debug event log. Conversion
  results still report their trace identifier and timeline.
- Stop conversion with an error for an unknown editor node instead of writing
  placeholder text into the document.
- Change the collaboration schema revision to `ginko-editor-2` because the
  binding node left the editor schema.

- Remove block drag handles, content dragging, and block-reordering menus and
  shortcuts. Keep component duplication, deletion, column sizing and image uploads.

- Unify toolbar, slash recipes, table actions and component operations behind guarded
  commands with Reka controls, Lucide icons and scoped shadcn-style tokens.
- Add inline component editing, selection formatting, and coordinated editor-local
  overlays.
- Add controlled image-library selection alongside uploads, preserving stable
  host asset references and cancellation, flush and undo behavior.
- Export `GinkoToolbar` and `GinkoImagePicker`, toolbar/actions slots, toolbar item
  selection, messages, shortcut overrides and an optional overlay container.
- Preserve empty list/quote source on reload and reject obsolete selections.

- Preserve visual edits on failed flushes and reject stale asset or paste requests.
- Keep component values, media metadata, list paragraphs, table alignment, and
  unlabeled code fences intact through editing and native clipboard round trips.
- Add `enableImages` alongside file and video insertion controls, with consistent
  read-only behavior and live asset-provider updates.
- Harden authoring-kit immutability and document the consumed-input contract.

## v0.1.0

- Add the initial Vue package scaffold, documentation site, and protected release workflow.
- Certify explicit CSS, declarations, and production builds in packed Vue and Nuxt consumers.
