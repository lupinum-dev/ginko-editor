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
- **2026-10-07 — Use registry Content beta.11.** Root, Docs, and packed
  consumers use the published package. Remove the local candidate and its
  defaults together. Matthias approved the temporary `@lupinum/*` quarantine
  exemption; third-party dependencies retain the 24-hour quarantine.
- **2026-10-07 — Prepare the first Editor release with Changesets.** Editor is
  not on npm yet. Use an unpublished `0.0.0` preparation base so the pending
  minor Changesets generate `0.1.0`. Leave the Version packages PR open; the
  maintainer owns bootstrap, provider protection, and publication.
- **2026-09-28 — Complete provider cutover before release.** Configure the main
  ruleset to require `ci` from GitHub Actions and verify CodeQL default setup,
  secret scanning and push protection. Verify that the `npm` environment needs
  maintainer approval, permits main only and denies admin bypass. Editor needs
  its one-time npm bootstrap at a distinct bootstrap version/tag, followed by
  trusted publishing bound to `release.yml` / `npm`. No provider control or
  publication is changed by this source work. Do not reuse pre-cutover workflow
  runs for release approval. Local workflow tests do not prove live scheduling,
  environment approval or OIDC behavior.
- **2026-10-07 — Use the current OSS release starter verbatim.** The workflow
  requires successful CI on the released commit and rejects a version older
  than the current npm dist-tag. Pending Changesets or an open version PR do
  not offer publication. Release helpers follow the same starter. The local
  workflow tests exercise its CI and registry boundaries; starter tests own
  the shared workflow's pending-version condition.
