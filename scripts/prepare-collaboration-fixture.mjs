import { generateKeyPairSync } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

// Remove the default candidate when Content 1.0.0-beta.10 is published (internals/migrations.md).
const contentArchive = process.env.GINKO_CONTENT_TARBALL ?? 'internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz'
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const contentDependency = contentArchive ? `file:${resolve(contentArchive)}` : manifest.devDependencies['@lupinum/ginko-content']
const legacy = join(homedir(), '.convex/anonymous-convex-backend-state/anonymous-agent')
let legacyExists = false
try { await access(legacy); legacyExists = true } catch { /* New anonymous deployment uses project-local storage. */ }
if (legacyExists) throw new Error('An existing anonymous-agent deployment would be reused. Use a separate named local fixture instead.')
if (!process.env.GINKO_EDITOR_TARBALL) throw new Error('Set GINKO_EDITOR_TARBALL to the Editor archive to verify.')
const archive = resolve(process.env.GINKO_EDITOR_TARBALL)
await access(archive)
if (contentArchive) await access(contentArchive)
const root = await mkdtemp(join(tmpdir(), 'ginko-editor-convex-'))

async function copyFixtures(source, target) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name)
    const to = join(target, entry.name.replace(/\.fixture$/, ''))
    if (entry.isDirectory()) { await mkdir(to, { recursive: true }); await copyFixtures(from, to) }
    else await writeFile(to, await readFile(from))
  }
}
await copyFixtures('test/fixtures/convex-collaboration', root)
await writeFile(join(root, 'package.json'), JSON.stringify({
  name: 'ginko-editor-local-collaboration-verification', private: true, type: 'module',
  packageManager: 'pnpm@11.21.0',
  dependencies: { '@lupinum/ginko-editor': `file:${archive}`, '@lupinum/ginko-content': contentDependency,
    '@tiptap/core': '3.31.4', '@tiptap/pm': '3.31.4', '@tiptap/vue-3': '3.31.4',
    convex: '1.42.2', vue: '3.5.42' },
  devDependencies: { '@vitejs/plugin-vue': '6.0.6', vite: '8.1.5', typescript: '5.9.3', '@types/node': '26.1.1' },
}, null, 2))
await writeFile(join(root, 'pnpm-workspace.yaml'), `packages: []
minimumReleaseAge: 1440
minimumReleaseAgeStrict: true
minimumReleaseAgeIgnoreMissingTime: false
allowBuilds:
  esbuild: true
  vue-demi: true
overrides:
  '@lupinum/ginko-content': '${contentDependency}'
  'vite>esbuild': 0.28.2
`)
await writeFile(join(root, '.env.local'), '')
await writeFile(join(root, '.gitignore'), 'node_modules\n.convex\n.env*\n.test-*\n')
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-fixture', use: 'sig', alg: 'RS256' }
const jwks = 'data:text/plain;charset=utf-8;base64,' + Buffer.from(JSON.stringify({ keys: [jwk] })).toString('base64')
const issuer = 'https://ginko-editor.test', applicationID = 'ginko-editor-local-fixture'
await writeFile(join(root, 'convex/auth.config.ts'), `import type { AuthConfig } from 'convex/server'
export default ${JSON.stringify({ providers: [{ type: 'customJwt', issuer, applicationID, algorithm: 'RS256', jwks }] }, null, 2)} satisfies AuthConfig
`)
await writeFile(join(root, '.test-private-key.pem'), privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 })
await writeFile(join(root, '.test-config.json'), JSON.stringify({ issuer, applicationID, url: 'http://127.0.0.1:4321' }))
await mkdir(dirname(join(root, 'src/main.ts')), { recursive: true })
console.log(root)
