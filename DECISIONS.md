# Decisions

- **2026-09-28 — Use the lean OSS release workflow.** Three workflows replace
  custom certification, artifact ledgers, repeated provenance checks and deploy
  automation. The shared release and preview workflow, Changeset lint and
  release helper come from Lupinum OSS. CI runs one complete gate plus the
  minimum supported Node compatibility check; the final required status is `ci`.
  Vite, Vue template ESLint, vue-tsc and the existing test suite remain.
- **2026-09-28 — Retain actual package boundaries.** Clean tarball consumers
  prove Vue and Nuxt builds, explicit CSS, public NodeNext declarations, and
  backend runtime imports without Vue. They use pnpm's same 24-hour quarantine.
  Built public Docs pages ship through `/agent-docs` with the package version.
  These checks replace the release manifest, not the behavior it used to test.
- **2026-09-28 — Keep one Content authority and host-owned persistence.** The
  Editor schema and ProseMirror collaboration state are derived from Content's
  contract. Hosts own authenticated room access, bounded operation history,
  atomic checkpoints, assets and publication. The current host migration and
  recovery contract is in the public collaboration guide. A local Convex
  fixture is retained under `test/fixtures/convex-collaboration`; historical
  reports in Git history are not current acceptance evidence.
- **2026-09-28 — Keep the Content candidate until registry adoption.** The
  required beta.10 contracts are not published. The existing archive and
  override stay under `internals/migrations.md`; no own-scope quarantine
  exemption is active. Content must publish before the normal Editor release.
  Docs' reusable authoring kit is a separate pending cutover: keep Editor's
  existing layout kit until the Docs package is published and consumed.
- **2026-09-28 — Complete provider cutover before release.** Configure the main
  ruleset to require `ci` from GitHub Actions and verify CodeQL default setup,
  secret scanning and push protection. Verify that the `npm` environment needs
  maintainer approval, permits main only and denies admin bypass. Editor needs
  its one-time npm bootstrap at a distinct bootstrap version/tag, followed by
  trusted publishing bound to `release.yml` / `npm`. No provider control or
  publication is changed by this source work. Do not reuse pre-cutover workflow
  runs for release approval. Local workflow tests do not prove live scheduling,
  environment approval or OIDC behavior.
- **2026-09-28 — Reject stale approved releases.** Publication is serialized and
  checks current main after approval immediately before npm. Stale runs fail and
  must restart from current main. Registry lookup failures must fail closed;
  only a confirmed JSON E404 means the package version is absent.
