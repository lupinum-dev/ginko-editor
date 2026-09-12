# Active migrations

## Local Content and Docs candidates for the playground

- Why: Step 4 needs the accepted Content parser contract and Docs authoring/component-kit exports before either package is available from the registry.
- Introduced: Gate B2, 2026-09-12.
- Depends on it: `scripts/prepare-docs-candidates.mjs`, the Editor docs build/dev scripts, and the local aliases in `docs/nuxt.config.ts`.
- Local inputs: set `GINKO_CONTENT_CANDIDATE` to a built Content package directory and `GINKO_DOCS_CANDIDATE` to the Docs layer directory. The current sibling Docs checkout and installed Content package are defaults, but the script rejects a stale registry Content package with a corrective error.
- Removal condition: publish Content with the accepted strict parser contract and Docs with the accepted `authoring` and `component-kit` exports; update the docs manifest to those versions; remove candidate copying, symlink setup, aliases, and this entry together.
- Tracking: `plan.md`, Step 4 / Gate B2.
