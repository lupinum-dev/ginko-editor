# Active migrations

## Local Docs authoring candidate for the playground

- Why: the Docs authoring and component-kit exports used by the playground still require an unpublished candidate. Content now uses published `1.0.0-beta.9`; it no longer requires a local source candidate.
- Introduced: Gate B2, 2026-09-12. Content registry cutover verified 2026-09-22.
- Depends on it: `scripts/prepare-docs-candidates.mjs`, the Editor docs build/dev scripts, and the local aliases in `docs/nuxt.config.ts`.
- Local inputs: `GINKO_DOCS_CANDIDATE` selects the accepted Docs layer directory. `GINKO_CONTENT_CANDIDATE` is optional; the default is the installed registry Content package. The script copies that exact contract beside Docs so the playground uses one parser identity.
- Removal condition: publish Docs with the accepted `authoring` and `component-kit` exports, update the docs manifest to that release and matching registry Content, then remove candidate copying, symlink setup, aliases, and this entry together. Verify the packed documentation consumer before removing the setup.
- Tracking: `plan.md`, Step 4 / Gate B2, and `internals/editor-handoff.md`.
