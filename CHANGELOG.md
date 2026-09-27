# Changelog

## Unreleased

- Refresh image URLs when a reactive asset provider replaces its URL methods,
  without changing stored image identity or interrupting an upload.
- Keep native image replacement and description controls after reopening a
  canonical host-policy image. Restricted and extended image components retain
  their own controls and authored properties.

### Breaking changes and migration

- Install `@lupinum/ginko-content` in the host. It is now a peer dependency
  (`>=1.0.0-beta.10 <2`), so the editor and the host renderer share one parser.
  Content `1.0.0-beta.10` escapes text that looks like MDC syntax, keeps code
  verbatim, keeps bare domains as text, keeps typed, quoted and multi-line
  properties, and generates the heading ids that the editor uses.
- TipTap peers accept `^3.31.3`. `vue` and `@tiptap/vue-3` are optional peers for
  the `/runtime` entry only; the root entry still needs them.
- The component handle exposes only `GinkoEditorHandle`: `flush()`,
  `hasPendingChanges()`, `removeSelectedMedia()`, `focus(position?)`, and
  `getEditor()`. It no longer exposes `editor`, `rawContent`, `viewMode`,
  `insertImageAsset`, `insertFileAsset`, or `insertVideo`. Replace
  `handle.editor` with `handle.getEditor()`, an unstable escape hatch. Insert
  assets through `request-image`, `request-file`, and `request-video`. Hosts that
  use only `flush()`, `hasPendingChanges()`, and the request events need no change.
- A flush `error` is a `ConversionErrorPayload` or a state error
  `{ code, message }` with code `image_upload_pending`, `collaboration_pending`,
  or `not_ready`. Check `code` first.
- `request-image`, `request-file`, and `request-video` take `EditorImage`,
  `EditorFile`, and `EditorVideo`. An `AssetInfo` value still fits.
- `ConversionIssue.code` and `ConversionErrorPayload.code` have the type
  `ConversionIssueCode`.
- Remove the `enableDebug` prop and the internal debug event log. Conversion
  results still report their trace identifier and timeline.
- Styles are in the `ginko` cascade layer and use public `--ginko-*` tokens.
  `--ginko-bg`, `--ginko-text`, `--ginko-muted-text`, `--ginko-popover-text`,
  and `--ginko-accent-bg` become `--ginko-background`, `--ginko-foreground`,
  `--ginko-muted-foreground`, `--ginko-popover-foreground`, and `--ginko-accent`.
  Unlayered host rules now override editor styles.
- Collaboration is experimental and can change in a minor release. Import
  protocol and transport types such as `CollaborationTransport`,
  `CollaborationHead`, and `CollaborationReply` from
  `@lupinum/ginko-editor/runtime`. Backends with strict argument validation must
  accept the optional `protocolVersion` field. The schema revision is
  `ginko-editor-2`; re-seed shared rooms as documented.
- Block drag handles, content dragging, and block-reordering menus and shortcuts
  are removed. Component duplication, deletion, column sizing, and image uploads
  remain.

### Layout blocks and the block menu

- Add the built-in Ginko layout kit (`ginkoLayoutKitSource`,
  `createGinkoLayoutKit()`) for the Ginko Docs components: callouts, aside,
  excerpt, columns, tabs, accordion, steps, cards, timeline, code group,
  collapse, center, figure, drop cap, keyboard key, read more, table of contents,
  quiz, API, files, and code tree. Its policy matches the Docs renderer policy.
- Edit container items in place with `canvas.items`: a tab strip with add,
  rename, remove, and keyboard selection; accordion headers; numbered steps;
  card grids; timeline markers; and code-group tabs. Each change is one undo
  step. The selected tab and collapsed items are view state only.
- Add the `json` authoring control for structured properties.
- Group the block menu (Text, Lists, Media, Layout, Callouts, Advanced, and host
  groups), rank exact, prefix, keyword, and fuzzy matches, highlight matched
  characters, show recent blocks, and offer "Add item" inside a container.
  Recipes accept `group` and `icon`. Native blocks come first; the caret moves
  into a new block after insertion.

### Shared editing

- Add optional presence: remote carets, selections, and a collaborator list
  through a transport `presence` channel, with `.ginko-collab-*` styles.
- Give each offline, error, and stale state a `code`. Retry network, timeout, and
  server-unavailable failures with jittered backoff; typing offline keeps the
  wait. Requests time out after 15 seconds.
- Add `discardPendingAndResync()` and `onDiscard` to continue after the server
  rejects unsent changes. The editor shows a discard action for this state.
- Write `onRecovery` at most every 300 ms and immediately when the page is hidden
  and on flush, discard, and close. Add `readCollaborationRecovery()`.
- Validate attribute values, marks, link URLs (`isSafePublicLinkUrl`), and
  heading ids on the server, and check seeded documents against the schema.

### Document fidelity

- Keep typed `{{ … }}`, `:name:`, and times such as `10:30:45` as text. The editor
  no longer creates binding nodes or rewrites emoji shortcodes.
- Headings keep generated ids implicit and preserve custom `{#id}` anchors, so
  documents with non-ASCII or nested headings open visually. A split, paste, or
  duplicate never repeats a custom anchor.
- Typed links default to `https:`.
- Saved Markdown escapes text that a site parser would turn into a link, such as
  `example\.com`, so the published page shows the text that was typed.
- Stop conversion with an error for an unknown editor node instead of writing
  placeholder text.
- A seeded property test saves and reopens mutated versions of every layout
  recipe and requires identical text and property values.

### Other changes

- Split `GinkoEditor` into composables and a separate insert menu component.
- New inline `image-upload` or `image-picker` functions, new `asset-provider`
  objects, and equal new authoring kits no longer cancel uploads, reload the
  document, or close a shared session.
- Make `placeholder`, `aria-label`, `show-markdown-markers`, `code-block-theme`,
  and the output props reactive. `collaboration` stays mount-only; development
  builds warn when it changes.
- Add `image-max-bytes` (default 10 MB).
- Add `EditorFile`, `EditorVideo`, `EditorFlushError`, `ConversionIssueCode`,
  and `GinkoEditorProps`. Export `defaultMessages`, `EditorMessageKey`,
  `defaultToolbarItems`, `formatShortcut`, `ConversionTraceEvent`,
  `ConversionSeverity`, `ConversionHealthState`, `JsonValue`, and `JsonRecord`.
  Add unsuffixed authoring type names; the `V1` names and `VideoInfo` remain as
  deprecated aliases.
- Move the remaining English interface text into `messages`.
- Accessibility: grouped mode switcher, quieter live status, valid combobox,
  listbox, and tablist roles, page-unique menu ids, and a result count
  announcement.
- Add dark fallbacks for a `.dark` ancestor and `data-ginko-theme`.
- Node views render once per change; table layout reads run in one animation
  frame.
- Keep Reka UI and Lucide external, which halves `dist/index.js`. Ship source
  maps and NodeNext-safe declarations.
- Unify toolbar, block menu, table, and component operations behind guarded
  commands. Add inline component editing, selection formatting, and controlled
  image-library selection. Export `GinkoToolbar` and `GinkoImagePicker`, toolbar
  slots, messages, shortcut overrides, and an optional overlay container.
- Preserve visual edits on failed flushes, reject stale asset or paste requests,
  and keep component values, media metadata, list paragraphs, table alignment,
  and unlabeled code fences through editing and clipboard round trips.

## v0.1.0

- Add the initial Vue package scaffold, documentation site, and protected release workflow.
- Certify explicit CSS, declarations, and production builds in packed Vue and Nuxt consumers.
