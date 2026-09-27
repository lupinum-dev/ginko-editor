# Working on Ginko Editor

Follow the [Lupinum OSS handbook](https://oss.lupinum.com) for repository security,
dependencies and releases. [CONTRIBUTING.md](CONTRIBUTING.md) explains local work.
Read [docs/WRITING.md](docs/WRITING.md) before changing public prose.

## Commands

Use `.node-version` and the pnpm version in `package.json`.
`pnpm install --frozen-lockfile` installs the toolchain. `pnpm dev` starts the
Docs playground. `pnpm verify` is the complete local and CI gate. Focused checks
are `pnpm test`, `pnpm typecheck`, `pnpm build:library` and `pnpm test:packed`.
The packed check needs the complete `pnpm build` output, including agent docs.

## Contracts

- Content owns parsing, portable data and policy validation. Editor owns its
  derived TipTap schema, conversion and editing session. Hosts own persistence,
  authorization, asset selection and publication. Do not add a second parser.
- Keep `/runtime` and `/authoring` usable without Vue or browser globals. Browser
  views stay in the root entry. Keep runtime dependencies external and verify
  package declarations, exports and CSS through clean tarball consumers.
- During normal navigation, hosts await `flush()` before replacing a document
  or closing the editor, then await their own persistence in local mode. A
  failed flush keeps recovery available. Revocation or a principal change must
  stop unauthorized transport; retain recovery under the original principal
  rather than keeping their session active.
- Changes affecting users need a Changeset. Start its summary with Fix, Add,
  Remove or Change. A major change includes a `Migration:` paragraph.
- Versions, exports and commands belong in package manifests. Keep the native
  pnpm 24-hour quarantine and Renovate policy; there is no scope exemption.
- Track temporary compatibility in `internals/migrations.md`. Remove its code
  and entry together only when the dependent registry version is available.
- Do not edit generated `dist`, `.nuxt` or `.output` by hand. Stop only your own
  verification processes. Preserve other branches and unrelated working changes.
- Publication uses `release.yml`, the protected `npm` environment and trusted
  publishing. Never add npm tokens, rebuild in the publish job or publish
  locally after the one-time bootstrap. Provider cutover is still pending;
  see [DECISIONS.md](DECISIONS.md).
