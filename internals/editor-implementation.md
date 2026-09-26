# Shared editor implementation

Started 2026-09-22. The user authorized sustained implementation of the editor research, including necessary changes across Content, CMS, ChiliSkills, and Luis. This supersedes historical implementation pauses in `plan.md`. Preserve unrelated work and existing data. Publication and production deployment remain separate.

## Acceptance

- One Content parser/portable policy and one shared Vue editor implementation.
- Slash insertion preserves typing, keyboard/composition input, and positions through document edits.
- Authoring controls compose with shadcn-vue and preserve source round trips.
- A runtime-safe Editor schema/conversion entry works without UI or browser globals.
- A verified Vue/Convex collaboration path preserves independent text/property edits, enforces host authorization, fences stale clients and whole-document replacements, and produces versioned Content checkpoints.
- CMS adopts the shared editor, with working save/locale/media/preview boundaries.
- Luis narrative editing and its web/PDF readers agree on supported content; commercial data remains domain-owned.
- ChiliSkills retains local mode, history and export/import while shared authoring has explicit host persistence and asset ownership.
- Focused regression tests, real browser exploration and relevant owning repository gates pass. Unsupported external environments are reported honestly.

## Reviewable layers

1. `feat/editor-runtime`: pure schema/conversion boundary and representative server tests.
2. `feat/editor-authoring`: mapped slash interaction and safe component-property operations.
3. `feat/editor-collaboration`: Vue collaboration lifecycle, server protocol validation, recovery and checkpoint tests.
4. Owning host changes: CMS shared editor/checkpoints, Luis narrative/PDF parity, ChiliSkills shared authoring.

Commit directly related tests and documentation with each behavior. Keep unpublished local candidate dependencies explicit. Use the existing package certification scripts rather than source aliases to claim host compatibility.

## Baseline discoveries

- Editor starts at `b834ddf`. Current changes contain only this task's research document.
- CMS main `d0e2798` is an ancestor of the existing `fix/parser-parity` integration at `5aa1217`. Reuse that inspected implementation in an isolated branch instead of recreating it. The user's CMS main has unrelated landing-page changes.
- Content's accepted editor candidate is available at `961ba5f` in the existing `ginko-editor-step1/content` worktree. Main and that candidate have diverged; inspect and reconcile before modifying Content.
- A newer Docs authoring candidate exists at `fc6452f` in `ginko-docs-candidate`. Inspect compatibility before using it. The previous `pnpm verify` stopped because the default sibling Docs main lacks authoring exports.
- Luis's document feature is uncommitted work in the supplied checkout. Preserve it and do not sweep it into an editor commit.
- The application handbook was located under `/Users/matthias/Git/0_libs/lupinum-app`, replacing the stale `1_apps` reference. Its standard and working procedure have been read.

## Progress

- [x] Research and implementation goal.
- [x] Inspect branches, worktrees, preservation boundaries, and recover handbook location.
- [x] Restore reproducible Docs and packed-consumer candidate setup.
- [x] Runtime-safe schema/conversion.
- [x] Slash and component-property behavior.
- [x] Collaboration protocol/client and real local backend validation.
- [x] CMS integration.
- [x] Luis integration.
- [x] ChiliSkills integration.
- [x] Independent review, final verification, and cleanup.

The authorized local implementation is complete. See `editor-handoff.md` for source locations, measured checks, deliberate limits and separate rollout actions.

### Runtime layer

Tracking issue: https://github.com/Mat4m0/ginko-editor/issues/6.

The `runtime` export now uses the same schema as the canvas without importing Vue views or browser globals. A packed Node fixture rejects transitive UI imports and checks a source round trip. The full editor gate passed with 263 tests and a Docs production build using the explicit Docs candidate below. Isolated packed Vue and Nuxt consumers passed. Independent review found a lost host-output callback for implicit component actions; it was restored with a regression test. Focused tests, type checking and lint cover that correction; the final goal gate will repeat the complete suite after all layers.

Reproducible candidate settings in this machine's current checkout:

```bash
GINKO_DOCS_CANDIDATE=/Users/matthias/.codex/worktrees/ginko-docs-candidate/layer pnpm verify
GINKO_CONTENT_TARBALL=/Users/matthias/.codex/worktrees/ginko-editor-step1/content/.pack/lupinum-ginko-content-1.0.0-beta.7.tgz node scripts/verify-packed-consumer.mjs
```

These paths select inspected local candidates; they are not supported consumer install paths or evidence of publication. Runtime validation does not yet imply collaboration support.

Later integration update: the root and Docs Content dependency now use the
published `1.0.0-beta.9`. Its parser/policy work includes the required candidate
changes and later fixes. All 306 Editor tests and packed Vue/Nuxt consumers
passed against registry Content. `GINKO_CONTENT_TARBALL` is now optional for
future candidate verification. The Docs authoring layer still needs its explicit
local candidate; `0.4.0-rc.11` is not published.

### Authoring layer

Slash queries are real paragraph text. A ProseMirror plugin follows the query through document changes. Insertion removes the query and adds its content in one transaction. Escape, cancelled image selection and stale asynchronous results preserve the original source. Built-in command search uses translated labels. Button insertion retains its search field.

Component property changes use a versioned, per-property step. A variant changes its tag and source syntax in one step. These operations preserve independent properties and body edits when mapped through other changes. Inputs outside the editor group each typing burst for Undo. Wire registration survives Nuxt module reloads.

The complete local gate passed with 282 tests, lint, types, package build and Docs production build. Browser checks covered inline slash typing, insertion/Undo, Escape, a 390 px viewport, column resize by keyboard, image cancellation, and title Undo preserving a preceding body edit. Independent review findings were corrected and rechecked. Packed certification also exercises custom-step decoding in the runtime entry.

### Collaboration layer

The runtime validates versioned operations and produces a source checkpoint.
The Vue session handles reactive heads, retries, operation rebasing, bounded
pending changes, host-owned recovery, stale epochs, and flush acknowledgement.
Property/code/image controls preserve independent edits. Shared table geometry
and alignment remain fixed; body rows and cells can be edited. The server
rejects unsupported table attributes and inconsistent column alignment.

The full package gate passed against registry Content with 306 tests, types,
lint, package build, and Docs production build. The final focused suite adds
tests for remote recovery growth and refused media acknowledgements. The
dependency audit is clean. Packed Vue/Nuxt consumers and the runtime import
boundary passed. See `collaboration-verification.md` for the real backend and
browser checks and the direct-log decision.

Independent review found and helped resolve fractional positions, old
subscription callbacks, stalled requests, metadata loss, recovery escaping and
remote growth, publication epoch ambiguity, whole-table replacements, and media
acknowledgement after a rejected transaction. Final focused review found no
remaining concrete blocker. The refreshed packed fixture passed real Convex
acceptance against registry Content and reopened Alice's offline filename with
Bob's language change at version 4. Browser console warnings/errors were empty.

CMS work is isolated at
`/Users/matthias/.codex/worktrees/ginko-editor-shared/cms` on
`feat/shared-editor`, based on the existing accepted `fix/parser-parity`
integration. The supplied CMS checkout and its landing-page work are untouched.

## Host integration results

The final source and acceptance boundaries are summarized in
[the implementation handoff](./editor-handoff.md).

### CMS

`feat/shared-editor` at `ba9088d` in the isolated CMS worktree uses the shared
Editor package for entry bodies. Canonical draft checkpoints and asset references
update in the same transaction as accepted steps. Studio save, publish, locale
and entry switches wait for the shared session. Typed durable recovery, Web Locks,
auth generation checks and contract fences protect session replacement.

The full check passed 1,319 tests (one skipped), lint, types and builds. Both pnpm
and strict npm packed consumers passed with the explicit local Editor archive.
A real packed backend accepted two actual FieldRichtext editors and preserved
independent component title/tone edits at version 5 with zero form-write races.
The dependency audit was clean. Independent review findings were resolved.

### Luis

`feat/shared-document-editor` in the isolated Luis worktree preserves the user's
uncommitted commercial-document feature. Narrative prose uses Ginko Editor with
atomic Convex checkpoints. Stable section keys, strict legacy revision checks,
structured-field compare-and-set behavior, PDF preparation leases and save
barriers protect the existing document lifecycle. Content parsing now feeds one
typed projection for both the HTML preview and PDF. Unknown or unsupported markup
stays visible as literal source.

The full check passed 395 tests, lint, types and production build. A real local
backend and two actual NarrativeEditor instances converged at revision 7 without
altering prices or issuing competing form saves. Two rendered PDF pages were
visually checked; a discovered link-prop mismatch now has a PDF annotation test.
The isolated changes patch was applied to a temporary copy of the exact baseline
and every resulting source file matched the integration worktree. The original
tracked WIP is unchanged. No unrelated WIP was committed.

### ChiliSkills

The isolated `feat/shared-module-scripts` worktree at `18eb99a` adds optional authenticated
shared copies for slide scripts, text blocks, assignment bodies and module
metadata. Local slides, history, files and ZIP workflows remain available.
Workspace membership, verified email, per-module roles, upload intents, atomic
script checkpoints, source compare-and-set writes and typed recovery are checked
at their owning boundaries. Shared source and unreadable recovery both survive
permission loss without becoming a second writer.

The full check passed 91 tests, frontend and Convex types, lint, formatting,
PPTist build and Nuxt production build. Real HTTP storage preserved the nonce
header and rejected an unrelated account's claim to an unrecorded upload. Two
actual shared script editors converged at revision 7; viewer downgrade blocked
offline writes and retained their recovery download. The complete workspace
saved metadata at revision 8 and produced a ZIP whose title, accepted source and
image bytes were checked. Local mode and a 390 px shared view were inspected.
The production dependency audit is clean; remaining peer-range notices and
scoped dependency removal conditions are documented in the host.

## Final package evidence

The final code archive is Editor `0.1.0` from `e579d55`, SHA-256
`aa075de076960731a77d83e57e91f6457d98ddd6e10b5371968a3732728ee3a9`.
The complete Editor gate passed 309 tests, lint, types, runtime declarations,
package build and Docs production build. Packed runtime, Vue and Nuxt consumers
passed against registry Content `1.0.0-beta.9`. Subsequent root changes are
documentation only, not a different runtime candidate.

Ginko Content required no code change: its published beta.9 contract already
contains the needed portable parser, policy, equality and asset helpers. The
implementation removes beta.7 candidate dependencies from consumers. Editor and
Docs archives still require their normal package release before registry rollout.
