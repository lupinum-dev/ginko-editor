# Changelog

## Unreleased

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
