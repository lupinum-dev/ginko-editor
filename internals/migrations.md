# Active migrations

## Local Content 1.0.0-beta.10 candidate

- Why: the Editor needs Content fixes that are not published yet: MDC text escaping, verbatim code, parser-aligned heading ids (`createHeadingIdGenerator`), no bare-domain links, `isSafePublicLinkUrl`, and auto-close that skips fenced code.
- Introduced: 2026-09-25. Source: `ginko-content` branch `fix/mdc-roundtrip-contract` at `2b52207`, packed with version `1.0.0-beta.10`.
- Archive: `internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz`, SHA-256 `02faf479f64fee9c026188e9b5e9f8e3c6fd735bca1ca2a20583ace7321f84e2`.
- Depends on it: the `@lupinum/ginko-content` override in `pnpm-workspace.yaml`, the default archive in `scripts/verify-packed-consumer.mjs` and `scripts/prepare-collaboration-fixture.mjs`, and the `>=1.0.0-beta.10` peer range.
- Removal condition: publish Content `1.0.0-beta.10` from that branch through the Content release workflow. Then remove the override, the archive, the script defaults, and this entry together, and run `pnpm release:verify`.

## Local Docs authoring candidate for the playground

- Why: the Docs authoring and component-kit exports used by the playground still require an unpublished candidate. Content now uses published `1.0.0-beta.9`; it no longer requires a local source candidate.
- Introduced: Gate B2, 2026-09-12. Content registry cutover verified 2026-09-22.
- Depends on it: `scripts/prepare-docs-candidates.mjs`, the Editor docs build/dev scripts (`pnpm verify:docs`), the non-blocking `docs` CI job and the library-only CI install, and the local aliases in `docs/nuxt.config.ts`.
- Local inputs: `GINKO_DOCS_CANDIDATE` selects the accepted Docs layer directory. `GINKO_CONTENT_CANDIDATE` is optional; the default is the installed registry Content package. The script copies that exact contract beside Docs so the playground uses one parser identity.
- Removal condition: publish Docs with the accepted `authoring` and `component-kit` exports, update the docs manifest to that release and matching registry Content, then remove candidate copying, symlink setup, aliases, and this entry together. Make the `docs` CI job required again. Verify the packed documentation consumer before removing the setup.
- Tracking: `plan.md`, Step 4 / Gate B2, and `internals/editor-handoff.md`.
