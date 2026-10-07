# Maintaining Ginko Editor

## Dev-only audit exceptions

Matthias approved these exact dev/build paths until 2026-11-06T00:00:00Z,
or a compatible published fix, whichever comes first. `pnpm audit:all`
checks the raw audit against these paths and rejects every advisory in the
Editor published dependency graph, regardless of severity. Other dev/build
advisories still fail at high or critical severity. No package or severity
is ignored. The content candidate remains unchanged until wave B.

### GHSA-86w9-cpqp-85rv (node-forge)

Expires: 2026-11-06T00:00:00Z. The advertised patched version is unpublished.

- `.>@lupinum/ginko-content>nitropack>listhen>node-forge`
- `.>@lupinum/ginko-content>nuxt>@nuxt/cli>listhen>node-forge`
- `.>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-content>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`
- `docs>nuxt>@nuxt/cli>listhen>node-forge`
- `docs>nuxt>@nuxt/nitro-server>nitropack>listhen>node-forge`

### GHSA-vfj7-8cjw-p6xm (braces)

Expires: 2026-11-06T00:00:00Z. The advertised patched version is unpublished.

- `.>@changesets/cli>@changesets/apply-release-plan>@changesets/config>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/apply-release-plan>@changesets/config>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/apply-release-plan>@changesets/config>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/apply-release-plan>@changesets/git>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/apply-release-plan>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/apply-release-plan>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/assemble-release-plan>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/assemble-release-plan>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/assemble-release-plan>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/config>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/config>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/config>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/assemble-release-plan>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/assemble-release-plan>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/assemble-release-plan>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/config>@changesets/get-dependents-graph>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/config>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/config>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/pre>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@changesets/read>@changesets/git>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/get-release-plan>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/git>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/pre>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/read>@changesets/git>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@changesets/should-skip-package>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@changesets/cli>@manypkg/get-packages>globby>fast-glob>micromatch>braces`
- `.>@lupinum/ginko-content>globby>fast-glob>micromatch>braces`
- `.>@lupinum/ginko-content>globby>micromatch>braces`
- `.>@lupinum/ginko-content>nitropack>globby>fast-glob>micromatch>braces`
- `.>@lupinum/ginko-content>nitropack>globby>micromatch>braces`
- `.>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `.>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-content>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-content>globby>micromatch>braces`
- `docs>@lupinum/ginko-content>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-content>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/i18n>@intlify/unplugin-vue-i18n>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/mcp-toolkit>vite-plugin-singlefile>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`
- `docs>nuxt>@nuxt/nitro-server>nitropack>globby>fast-glob>micromatch>braces`
- `docs>nuxt>@nuxt/nitro-server>nitropack>globby>micromatch>braces`

### GHSA-x6jw-m9v5-85vh (simple-git)

Expires: 2026-11-06T00:00:00Z. Published 4.x removes the default export used by Nuxt DevTools; 3.36.1 is unpublished.

- `.>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt>@nuxt/devtools>simple-git`

### GHSA-g4wm-2vf7-vfgr (simple-git)

Expires: 2026-11-06T00:00:00Z. Published 4.x removes the default export used by Nuxt DevTools; 3.36.1 is unpublished.

- `.>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt>@nuxt/devtools>simple-git`

### GHSA-858h-whjf-mvg5 (simple-git)

Expires: 2026-11-06T00:00:00Z. Published 4.x removes the default export used by Nuxt DevTools; 3.36.1 is unpublished.

- `.>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@lupinum/ginko-content>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/robots>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>@nuxtjs/sitemap>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt-og-image>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>@lupinum/ginko-docs>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt-site-config>nuxtseo-shared>nuxt>@nuxt/devtools>simple-git`
- `docs>nuxt>@nuxt/devtools>simple-git`
