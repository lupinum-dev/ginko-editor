# Local collaboration verification

This fixture runs a real local Convex backend with two signed test identities.
It does not use a configured application deployment. Keep credentials and
generated state in the temporary fixture directory. Do not copy its test
authentication into an application.

From the repository root, run the package gate and create the archive:

```bash
pnpm verify
pnpm pack --pack-destination .pack
GINKO_EDITOR_TARBALL="$(pwd)/.pack/lupinum-ginko-editor-$(node -p 'require("./package.json").version').tgz" node scripts/prepare-collaboration-fixture.mjs
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
