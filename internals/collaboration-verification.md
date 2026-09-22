# Local collaboration verification

This fixture runs a real local Convex backend with two signed test identities.
It does not use a configured application deployment. Keep credentials and
generated state in the temporary fixture directory. Do not copy its test
authentication into an application.

First run the package gate and create the inspected archive:

```bash
pnpm verify
pnpm pack:release
node scripts/prepare-collaboration-fixture.mjs
```

The last command prints a new temporary directory. In that directory, install
the pinned dependencies with `pnpm install`, then start the backend:

```bash
env -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOY_KEY -u CONVEX_SELF_HOSTED_URL -u CONVEX_SELF_HOSTED_ADMIN_KEY CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --local-cloud-port 4321 --local-site-port 4322
```

The directory is new, with an empty `.env.local`. Convex 1.42.2 creates its
project-local anonymous deployment under `.convex/local/default`. The prepare
script refuses a legacy global anonymous-agent deployment that the CLI could
otherwise reuse. Do not add `--local`; this CLI version rejects that removed
option. Do not supply another application's environment file.

After the functions compile, run `node acceptance.mjs` in another terminal in
the fixture directory. It checks real JWT authentication, reactive reads,
concurrent text/property writes, policy and version rejection, publication,
revocation, replacement, and history pruning. It closes its clients when done.

Run `pnpm exec vite --host 127.0.0.1` in the fixture directory to inspect the Vue
editors at `http://127.0.0.1:4323/`. The local Vite middleware signs only the
fixture identities. Pause Alice's connection, edit Alice's title or code
filename, and edit Bob's body or language. Reconnect and check both documents.
Repeat with a page reload while Alice has pending changes. The fixture stores
recovery in session storage and should restore it without overwriting Bob.

Stop only these Vite and Convex processes when finished. Delete the disposable
fixture directory, including its private key and local database. Keep the
acceptance logs when they are needed as review evidence.

## Protocol choice

The implementation uses `prosemirror-collab` 1.3.1 with a small host transport.
The inspected `@convex-dev/prosemirror-sync` 0.2.6 frontend assumes React. Its
backend storage methods also need host checks for versions, schema, policies,
authorization, snapshots, and bounded history. Adding a Vue bridge around that
API would not remove these requirements. The local fixture therefore validates
and writes the log directly in one Convex transaction. There is one merge
algorithm and one Content conversion boundary; no Yjs document is added.

This choice is implementation evidence for the current versions, not a claim
that Convex's component is unsuitable in every application. Revisit it if its
public API gains the required Vue lifecycle and validation boundaries.

## Measured acceptance, 2026-09-22

- A packed runtime imported in a real Convex function without Vue or DOM code.
- Authenticated owner/editor sessions converged through actual reactive reads.
- Readers, outsiders, forged client identities, and revoked members were denied.
- Invalid and future versions, malformed positions, unsupported properties,
  and policy violations did not advance the checkpoint.
- Publication used the accepted source and version. Replacement fenced stale
  clients and retained the previous publication with its original epoch.
- Pruned history returned a stale state and retained the current checkpoint.
- In the real Vue browser fixture, Alice's offline title and Bob's body edits
  converged. Reloading with Alice's pending filename preserved Bob's changed
  code language. Both editors reached version 48 with no pending changes.
- The final packed build repeated backend acceptance using registry Content
  beta.9. A fresh browser room reopened Alice's offline `recovered.ts` filename
  with Bob's JavaScript language change. Both reached version 4, showed saved
  status, and had no console warnings or errors.

These package checks establish local behavior. Separate host checks now verify
CMS, Luis and ChiliSkills authorization, checkpoints and recovery; see the
[implementation handoff](./editor-handoff.md). They do not establish a production
deployment, production credentials, multiplayer cursor presence or load capacity.
The hosts bound operation history and require explicit recovery when it expires.
