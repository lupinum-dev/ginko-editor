# Contributing

Use the Node version in `.node-version` and the pnpm version in `package.json`.

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

The development app is the Docs playground. `src/` owns the portable Vue editor;
`test/` owns behavior and failure-boundary checks. Keep changes focused on an
observable result and preserve source round trips.

Run focused checks while working, then `pnpm verify` before handoff. That gate
checks dependency advisories, lint, types, unit tests, the package and Docs
builds, and clean Vue, Nuxt and backend tarball consumers. `pnpm test:packed`
uses the output of `pnpm build`; it checks public exports, NodeNext declarations,
CSS retention, agent docs and a backend with no Vue installed. Its temporary
consumers keep the same dependency quarantine as the repository.

Inspect material UI changes in the Docs playground at desktop and narrow widths.
A build alone does not prove an interaction. The optional real backend fixture
has [local collaboration instructions](test/fixtures/convex-collaboration/README.md).
Each host must separately verify its authorization, persistence and recovery.

Add a Changeset for a user-visible change. Start its summary with Fix, Add,
Remove or Change; a major change includes a `Migration:` paragraph. Maintenance
changes need no version bump. Keep versions and generated changelog sections
under Changesets. Edit public prose in `docs/content/docs` and follow
[docs/WRITING.md](docs/WRITING.md).

The [OSS handbook](https://oss.lupinum.com/docs/releasing) owns the release
procedure. CI reports one required `ci` status. `release.yml` prepares a Version
packages PR with read-only dependency execution, packs without publishing
credentials and publishes approved tarballs through the `npm` environment.
`preview.yml` provides pkg.pr.new pull-request packages. Vercel Git integration
builds Docs and previews with `docs/` as Root Directory and access to files
outside it. Provider setup and the initial npm bootstrap remain separate actions.

Report undisclosed vulnerabilities through [SECURITY.md](SECURITY.md).
