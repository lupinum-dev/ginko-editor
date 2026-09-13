# Changelog

## Unreleased

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
