# Active migrations

## Local Content 1.0.0-beta.10 candidate

- Why: the Editor needs Content fixes that are not published yet: MDC text escaping, verbatim code, parser-aligned heading ids (`createHeadingIdGenerator`), no bare-domain links, `isSafePublicLinkUrl`, and auto-close that skips fenced code.
- Introduced: 2026-09-25. Source: `ginko-content` branch `fix/mdc-roundtrip-contract` at `0000675`, packed with version `1.0.0-beta.10`.
- Archive: `internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz`, SHA-256 `7185d72961d8a96c4ce290c4952a5a6cfe2eae6e5461bc99063d5ec605fa62a5`.
- Depends on it: the `@lupinum/ginko-content` override in `pnpm-workspace.yaml`, the default archive in `scripts/test-packed.mjs` and `scripts/prepare-collaboration-fixture.mjs`, and the `>=1.0.0-beta.10` peer range.
- Removal condition: publish a Content version that includes these contracts through the Content release workflow, and select it in the Editor development dependencies and peer range. Then remove the override, the archive, the script defaults, and this entry together, and run `pnpm verify`.

## Component origin in older Editor rooms

- Why: `setElement` and `setInlineElement` previously wrote nodes without `props.$`. Matching CMS rooms retain their ProseMirror snapshots and operation history, so changing Content's implicit write default to angle syntax can rewrite accepted colon source after an unrelated edit. Editor temporarily calls the shared serializer with `componentSyntax: 'colon'`. Parsed origins and origins on new command/input-rule nodes take precedence. No persisted schema or room is rewritten by this fallback.
- Introduced: 2026-09-28, paired with Content's angle authoring default.
- Confirmed dependents: existing Editor command-created nodes; Ginko CMS's matching `ginko-editor-2` room path retains snapshots when draft, source hash, policy and schema match. Luis's local Markdown host also uses the Editor commands, but no persisted Luis shared-room inventory has been established.
- Preferred migration: after old writer versions are retired, use each host's accepted canonical Markdown to call `createCollaborationSnapshot` in an authorized transaction with a new epoch and version 0. This supplies parser-owned origins once instead of keeping a second permanent format. Back up source, snapshot and operations; retain pending recovery under its original principal, and deliberately convert/merge it rather than replaying old-epoch operations. A one-time per-node annotation is acceptable only if the host proves its alignment with canonical source; do not infer every missing origin is angle or relabel old history.
- Removal condition: CMS and every host retaining pre-origin Editor JSON have completed that migration, old clients cannot write metadata-less nodes, and old recovery files remain recoverable through the host's migration path. Confirm source equality and edit/reload behavior, then remove `legacyRoomSerialization`, its type bridge, and this entry together. Keep the stored-room regression until its fixture represents the migrated data.
- Rollback: retain the prior Editor/Content tuple and accepted source/snapshot backup. Stop writers before restoring a room; an epoch reset cannot safely restore an old operation log beside newer edits. This change does not itself require a schema revision bump because node shapes and wire operations are unchanged.
- Tracking issue: none; host migration is deferred, not executed by this library change.
