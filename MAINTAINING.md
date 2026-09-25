# Maintaining Ginko Editor

## Setup and daily work

Use Node.js 22.18 or later in the 22 line, 24.11 or later in the 24 line, or 26
or later. The package itself supports consumers on Node.js 22.18 or later.

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

The root publishes one Vue package. Vite builds the browser-safe ESM entries with
source maps and extracts `dist/style.css`. `vue-tsc` emits the public
declarations; the build removes the source CSS import from them. Vue, the TipTap
runtime, and Ginko Content are peer dependencies. Vue and `@tiptap/vue-3` are
optional peers because only the root entry needs them. The build keeps all
dependencies and peers external so hosts share one copy. The package imports only
the browser-safe `@lupinum/ginko-content/cms-contract` entry. Consumers must
import `@lupinum/ginko-editor/style.css` explicitly. Package certification builds isolated Vue and Nuxt applications
from the generated archive; it does not use sibling aliases or source links.

The `runtime` entry shares the canvas schema and Content conversion without Vue
views or browser globals. Packed certification checks its transitive imports and
round trips a document in Node, also in a consumer without Vue. It also checks
the emitted runtime and toolbar slot declarations with NodeNext resolution. The build gives emitted relative declaration imports
their `.js` extensions so backend types remain complete. Keep schema-affecting definitions in the shared
document configuration; attach browser node views in the editor configuration.

The CMS integration consumes the shared Editor package. The Editor package owns
conversion, TipTap schema, mode switching, and editor UI. The CMS owns
persistence, asset dialogs, and workflow state. Authenticated CMS acceptance and
release certification remain separate gates in `plan.md`.

Hosts must await the component's `flush()` method before closing an editor or
replacing its document. In local mode a successful flush only updates `v-model`;
the host must then await its own persistence path. With a collaboration session,
flush also waits for accepted server operations. The host still owns publication.
Keep the editor mounted when flush returns
an error so the user can recover without losing the visual document. Asset
pickers must complete the request-scoped callback from their event; stale
callbacks safely return `false` after document, selection, mode, editability, or
lifetime changes.

The package requires the published Content parser contract from `1.0.0-beta.9`
or a later 1.x version as a peer. Development and tests use the exact version in
`devDependencies`. Packed consumers install that registry version as their peer. Set
`GINKO_CONTENT_TARBALL` only when explicitly verifying a newer candidate archive.

Use the local URL printed by the development server. Keep that session running
while you work. Stop only processes you started. Keep temporary changes and
controlled failures in an isolated checkout.

An assigned task delegates setup, diagnosis, implementation, verification,
review, routine pull requests and protected merges. Routine work has no breaking
contract, data migration, or permission change, and has passing checks and a
known rollback. Meaningful code, CI, and dependency changes need independent
review of the final diff. Ask for unresolved product decisions or expanded
security authority. Prepare the evidence before asking.

## Commands and evidence

| Command | Evidence |
|---|---|
| `pnpm dev` | A usable local development target. Inspect its real browser behavior. |
| `pnpm build` | The primary production output. |
| `pnpm verify` | The handoff gate: dependency policy, lint, type checks, tests, the library build, and the documentation site build. |
| `pnpm audit:all` | Dependency audit for the full workspace. |
| `pnpm docs:build` | The public documentation site builds. |
| `pnpm release:verify` | Certified tarballs install and work in isolated consumers. |

For documentation changes, explore navigation, search, and one documented example
on desktop and a narrow screen. A successful docs build alone does not prove the
packed package works. Release verification installs the tarball independently.
Linux CI repeats certification in its own environment, including the
documentation build. npm provenance and public release records are checked by
the protected release workflow.

Routine version pull requests may be independently reviewed and merged by agents.
Keep the final protected npm approval with the maintainer. Retry the retained
tarball; do not rebuild it after approval. Documentation deploys automatically
from protected `main`; pull-request previews are on demand.

## Large change

Open an issue first. Record important architecture decisions. Keep migrations explicit and remove temporary compatibility code after the cutover.

## Dependency update

`pnpm check:dependencies` checks the install policy and exception expiry.
For an exception, put `reason`, `owner`, and UTC `expires` in an inline JSON
comment on its exact `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml`.
Use a removal time within 24 hours. Remove the entry and comment when it expires.
CI checks expiry daily, including while the repository is idle. Check generated
install configuration before installing it with
`node scripts/check-dependency-policy.mjs path/to/pnpm-workspace.yaml`.

Use Renovate for routine updates. Review release notes and lockfile changes. Do not bypass the 24-hour quarantine. Run `pnpm audit:all` and `pnpm verify`.

## Documentation change

Follow [docs/WRITING.md](docs/WRITING.md). Run `pnpm verify`. Verify links, mobile navigation, search, analytics, and feedback on the deployed preview.

Vercel uses `docs/` as the Root Directory. Enable source files outside the Root
Directory because the documentation build needs this workspace package. Keep
`vercel.json` in `docs/`.

## First npm release

The package must exist before npm can bind a trusted publisher. Download the exact tarball from the successful main CI release-candidate artifact and verify its SHA-256. Publish that same file once with 2FA, `--access public`, the correct dist-tag, and `--ignore-scripts`. Then bind `publish.yml` and environment `npm` as the trusted publisher. Dispatch `publish.yml` for the same version. It derives bootstrap state only when the registry bytes match and this is the sole published version. It records the exception in the GitHub release. Never rebuild the artifact or provide a bootstrap switch.

## Normal release

Update `CHANGELOG.md` with `pnpm release:prepare` in a focused pull request. Merge after `pnpm release:verify` and CI pass. Dispatch `publish.yml` from current `main` with the reviewed package version. The workflow derives every other value from exact successful `main` CI. It requests npm approval only when publication is required and repairs the tag or GitHub release separately.

## Rollback

Do not delete a published version. Deprecate a broken version, restore the last good code in a new pull request, and publish a patch. Move the dist-tag only when users need an immediate safe version.

## Credential incident

Stop releases. Revoke the affected credential or trusted publisher. Review audit logs and published bytes. Do not commit replacement secrets. Restore trusted publishing only after the repository and account are safe.
