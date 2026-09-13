# Changelog

## Unreleased

- Unify toolbar, slash recipes, table actions and block movement behind guarded
  commands with Reka controls, Lucide icons and scoped shadcn-style tokens.
- Add nested block handles, keyboard and menu movement, inline component editing,
  selection formatting, and coordinated editor-local overlays.
- Add controlled image-library selection alongside uploads, preserving stable
  host asset references and cancellation, flush and undo behavior.
- Export `GinkoToolbar` and `GinkoImagePicker`, toolbar/actions slots, toolbar item
  selection, messages, shortcut overrides and an optional overlay container.
- Preserve empty list/quote source on reload; reject obsolete selections and
  route native block dragging through the same guarded movement operation.

- Preserve visual edits on failed flushes and reject stale asset or paste requests.
- Keep component values, media metadata, list paragraphs, table alignment, and
  unlabeled code fences intact through editing and native clipboard round trips.
- Add `enableImages` alongside file and video insertion controls, with consistent
  read-only behavior and live asset-provider updates.
- Harden authoring-kit immutability and document the consumed-input contract.

## v0.1.0

- Add the initial Vue package scaffold, documentation site, and protected release workflow.
- Certify explicit CSS, declarations, and production builds in packed Vue and Nuxt consumers.
