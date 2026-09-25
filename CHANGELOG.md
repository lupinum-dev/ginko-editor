# Changelog

## Unreleased

### Breaking changes and migration

- Requires Ginko Content `1.0.0-beta.10` or later. Content now escapes text
  that looks like MDC syntax, keeps code verbatim, keeps bare domains as text,
  and generates the heading ids that the editor uses.
- **Breaking:** install `@lupinum/ginko-content` in the host. It is now a peer
  dependency (`>=1.0.0-beta.10 <2`), so the editor and the host renderer share
  one parser. TipTap peers accept `^3.31.3`.
- Keep Reka UI and Lucide external, which halves `dist/index.js`.
- Ship source maps and NodeNext-safe declarations. The `/runtime` entry does not
  require Vue.
- The component handle now exposes only `GinkoEditorHandle`: `flush()`,
  `hasPendingChanges()`, `removeSelectedMedia()`, the new `focus(position?)`,
  and the new `getEditor()`. The handle no longer exposes `editor`, `rawContent`,
  `viewMode`, `insertImageAsset`, `insertFileAsset`, or `insertVideo`.
  Migration: replace `handle.editor` with `handle.getEditor()`. This is an
  unstable escape hatch. Insert assets through `request-image`, `request-file`,
  and `request-video`. Read the source from `v-model`. Hosts that use only
  `flush()`, `hasPendingChanges()`, and the request events, such as Ginko CMS,
  need no change.
- A flush `error` is now a `ConversionErrorPayload` or a state error
  `{ code, message }` with code `image_upload_pending`, `collaboration_pending`,
  or `not_ready`. State errors no longer contain empty `phase`, `issues`,
  `timeline`, or `traceId` fields. Check `code` first.
- `request-image`, `request-file`, and `request-video` requests now take
  `EditorImage`, `EditorFile`, and `EditorVideo`. An `AssetInfo` value still
  fits. A value without an `id` or `url` no longer type-checks.
- `ConversionIssue.code` and `ConversionErrorPayload.code` now have the type
  `ConversionIssueCode` instead of `string`.
- Styles are now in the `ginko` cascade layer and use public `--ginko-*` tokens.
  The internal names `--ginko-bg`, `--ginko-text`, `--ginko-muted-text`,
  `--ginko-popover-text`, and `--ginko-accent-bg` are replaced by
  `--ginko-background`, `--ginko-foreground`, `--ginko-muted-foreground`,
  `--ginko-popover-foreground`, and `--ginko-accent`. Fallback colors are now the
  same in all components. Unlayered host rules now override editor styles.

### Changes

- Headings keep the parser's generated ids implicitly and preserve custom
  `{#id}` anchors. Documents with non-ASCII or nested headings now open in the
  visual editor. `github-slugger` is no longer a dependency.
- Typed links default to `https:`. Shared-editing validation uses Content's
  `isSafePublicLinkUrl` rule and checks heading ids.
- Split `GinkoEditor` into composables and a separate insert menu component.
  Component boundary protection is a ProseMirror plugin.
- New inline `image-upload` or `image-picker` functions, new `asset-provider`
  objects, and equal new authoring kits no longer cancel uploads, invalidate
  asset requests, reload the document, or close a shared session. Only a removed
  capability, a disabled editor, a mode change, or a changed Content policy does.
- Make `placeholder`, `aria-label`, `show-markdown-markers`, `code-block-theme`,
  and the output props reactive. `collaboration` stays mount-only; development
  builds warn when it changes.
- Add `image-max-bytes` (default 10 MB). The upload hint and size error show the
  configured limit.
- Add `EditorFile`, `EditorVideo`, `EditorFlushError`, `ConversionIssueCode`,
  and `GinkoEditorProps`. Export `defaultMessages`, `EditorMessageKey`,
  `defaultToolbarItems`, `formatShortcut`, `ConversionTraceEvent`,
  `ConversionSeverity`, `ConversionHealthState`, `JsonValue`, and `JsonRecord`.
- Add unsuffixed authoring type names such as `AuthoringKit`,
  `AuthoringKitSource`, and `AuthoringRecipe`. The `V1` names and `VideoInfo`
  remain as deprecated aliases. The `Partial<AssetInfo>` upload result is
  deprecated; return `EditorImage`.
- Move the remaining English interface text into `messages`: the default
  accessible names, empty document text, conversion fallback, clipboard errors,
  and recipe descriptions.
- Accessibility: the mode switcher is a group; the live status region announces
  only errors and shared state; the insert trigger references its menu only while
  it is open; table size cells leave the tab order; the image replacement panel
  is labelled, non-modal, and returns focus when it closes.
- Add dark fallbacks for a `.dark` ancestor, `data-ginko-theme="dark"`, and
  `data-ginko-theme="auto"`. Replace hard-coded warning, error, selection, and
  tone colors with tokens.
- Node views render once per change instead of on each transaction and update
  event. Table handle layout runs in one animation frame. Overlays create their
  portal once and follow theme changes with one observer. A recovery download
  keeps its object URL until the browser starts the download.
- Mark the collaboration API as experimental. It can change in a minor release.
- Breaking: import protocol and transport types such as `CollaborationTransport`,
  `CollaborationHead` and `CollaborationReply` from `@lupinum/ginko-editor/runtime`.
  The collaboration entry no longer re-exports them. It now exports
  `CollaborationError` and `CollaborationErrorCode`.
- Add `protocolVersion` to collaboration heads. Clients send `1` with pull and
  push requests. Backends with strict argument validation must accept this
  optional field.
- Give each offline, error and stale collaboration state a `code`. Retry network,
  timeout and server-unavailable failures with jittered backoff, end the wait on
  a new head or the browser `online` event, and time out requests after 15 seconds.
- Add `discardPendingAndResync()` and `onDiscard` to continue after the server
  rejects unsent changes. `flush()` rejects with `CollaborationError`.
- Write `onRecovery` at most every 300 ms and immediately when the page is
  hidden, on flush, discard and close. Set `recoveryDelayMs: 0` for the previous
  behavior. Typing no longer serializes the whole document for each character.
- Add `readCollaborationRecovery()` to convert a recovery copy from another schema
  revision to Markdown, and a documented re-seed procedure for schema changes.
- Validate attribute values, marks and link URLs on the collaboration server and
  check seeded documents against the schema.
- Add optional presence: remote carets, selections and collaborator lists through
  a transport `presence` channel, with `.ginko-collab-*` styles.

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
