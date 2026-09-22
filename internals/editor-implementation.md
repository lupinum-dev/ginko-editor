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
- [ ] Restore reproducible Docs and packed-consumer candidate setup.
- [ ] Runtime-safe schema/conversion.
- [ ] Slash and component-property behavior.
- [ ] Collaboration protocol/client and real local backend validation.
- [ ] CMS integration.
- [ ] Luis integration.
- [ ] ChiliSkills integration.
- [ ] Independent review, final verification, and cleanup.

The active goal remains authoritative for continued work. Update this record with measured outcomes and concrete limitations as stages complete.

### Runtime layer

Tracking issue: https://github.com/Mat4m0/ginko-editor/issues/6.

The `runtime` export now uses the same schema as the canvas without importing Vue views or browser globals. A packed Node fixture rejects transitive UI imports and checks a source round trip. The full editor gate passed with 263 tests and a Docs production build using the explicit Docs candidate below. Isolated packed Vue and Nuxt consumers passed. Independent review found a lost host-output callback for implicit component actions; it was restored with a regression test. Focused tests, type checking and lint cover that correction; the final goal gate will repeat the complete suite after all layers.

Reproducible candidate settings in this machine's current checkout:

```bash
GINKO_DOCS_CANDIDATE=/Users/matthias/.codex/worktrees/ginko-docs-candidate/layer pnpm verify
GINKO_CONTENT_TARBALL=/Users/matthias/.codex/worktrees/ginko-editor-step1/content/.pack/lupinum-ginko-content-1.0.0-beta.7.tgz node scripts/verify-packed-consumer.mjs
```

These paths select inspected local candidates; they are not supported consumer install paths or evidence of publication. Runtime validation does not yet imply collaboration support.
