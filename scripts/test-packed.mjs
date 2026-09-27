import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { URL } from 'node:url'
import { parse, stringify } from 'yaml'

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const policy = parse(await readFile('pnpm-workspace.yaml', 'utf8'))
// Remove the default candidate after the registry cutover (internals/migrations.md).
const contentCandidate = process.env.GINKO_CONTENT_TARBALL ?? 'internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz'
const contentDependency = contentCandidate ? `file:${resolve(contentCandidate)}` : pkg.devDependencies['@lupinum/ginko-content']
const root = await mkdtemp(join(tmpdir(), 'ginko-editor-packed-consumers-'))
let archive

async function install(consumer, { runtimeOnly = false } = {}) {
  const manifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'))
  manifest.packageManager = pkg.packageManager
  manifest.dependencies['@lupinum/ginko-editor'] = `file:${archive}`
  await write(join(consumer, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await write(join(consumer, 'pnpm-workspace.yaml'), stringify({
    packages: [],
    minimumReleaseAge: policy.minimumReleaseAge,
    minimumReleaseAgeStrict: policy.minimumReleaseAgeStrict,
    minimumReleaseAgeIgnoreMissingTime: policy.minimumReleaseAgeIgnoreMissingTime,
    allowBuilds: policy.allowBuilds,
    // The backend intentionally installs no optional UI peers.
    ...(runtimeOnly ? { autoInstallPeers: false } : {}),
    overrides: { ...policy.overrides, '@lupinum/ginko-content': contentDependency },
  }))
  run('pnpm', ['install', '--ignore-scripts'], consumer)
}

const contentPeer = { '@lupinum/ginko-content': contentDependency }

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}.\n${result.stdout}\n${result.stderr}`)
  }
}

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

const cssMarkers = [
  '.ginko-editor',
  '.ginko-block',
  '.ginko-popover__panel',
  '.ginko-table',
  '.ginko-image-upload',
  '.ginko-toolbar',
  '.ginko-image-picker',
  '.host-button',
]

async function containsCss(directory, marker) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory() && (await containsCss(path, marker))) return true
    if (entry.isFile() && entry.name.endsWith('.css') && (await readFile(path, 'utf8')).includes(marker)) return true
  }
  return false
}

async function verifyDeclarations(consumer) {
  const packageRoot = join(consumer, 'node_modules', '@lupinum', 'ginko-editor')
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (manifest.exports?.['./style.css'] !== './dist/style.css') throw new Error('The packed CSS export is missing.')
  if (manifest.exports?.['./agent-docs'] !== './dist/agent/AGENTS.md') throw new Error('The packed agent docs export is missing.')
  const agentDocs = await readFile(join(packageRoot, 'dist/agent/AGENTS.md'), 'utf8')
  if (!agentDocs.includes(pkg.version) || !agentDocs.includes('./pages/')) throw new Error('The packed agent docs are empty or from another version.')
  const entryTypes = await readFile(join(packageRoot, 'dist', 'index.d.ts'), 'utf8')
  const publicNames = [
    'GinkoEditor',
    'GinkoToolbar',
    'GinkoImagePicker',
    'EditorActions',
    'EditorCommand',
    'EditorMessages',
    'EditorShortcuts',
    'EditorToolbarGroup',
    'EditorImage',
    'EditorImagePickerItem',
    'ImagePicker',
  ]
  for (const name of publicNames) {
    if (!entryTypes.includes(name)) {
      throw new Error(`The packed public declaration is missing: ${name}.`)
    }
  }
  const authoringEntry = manifest.exports?.['./authoring']
  if (authoringEntry?.import !== './dist/authoring.js' || authoringEntry?.types !== './dist/authoring.d.ts') {
    throw new Error('The packed authoring export is missing.')
  }
  const authoringRuntime = await readFile(join(packageRoot, 'dist', 'authoring.js'), 'utf8')
  if (/\b(?:vue|tiptap|nuxt)\b/i.test(authoringRuntime)) {
    throw new Error('The authoring-only entry imports UI or framework runtime code.')
  }
  await readFile(join(packageRoot, 'dist', 'GinkoEditor.vue.d.ts'), 'utf8')
  const runtimeEntry = manifest.exports?.['./runtime']
  if (runtimeEntry?.import !== './dist/runtime.js' || runtimeEntry?.types !== './dist/runtime.d.ts') {
    throw new Error('The packed runtime export is missing.')
  }
  await write(
    join(consumer, 'verify-runtime.mjs'),
    await readFile(new URL('../test/fixtures/packed-consumer/runtime.mjs.fixture', import.meta.url), 'utf8'),
  )
  run('node', ['verify-runtime.mjs'], consumer)
  await write(join(consumer, 'runtime-types.ts'),
    await readFile(new URL('../test/fixtures/packed-consumer/runtime-types.ts.fixture', import.meta.url), 'utf8'))
  await write(join(consumer, 'editor-types.ts'),
    await readFile(new URL('../test/fixtures/packed-consumer/editor-types.ts.fixture', import.meta.url), 'utf8'))
  for (const file of ['runtime-types.ts', 'editor-types.ts']) {
    run('pnpm', ['exec', 'tsc', '--noEmit', '--skipLibCheck', '--strict', '--target', 'ESNext',
      '--module', 'NodeNext', '--moduleResolution', 'NodeNext', file], consumer)
  }
}

// A backend installs only the document runtime peers. Disable automatic peer
// installation in this fixture so importing the runtime proves that neither
// Vue nor its DOM integration is needed.
async function verifyNodeRuntimeConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { ...contentPeer, '@tiptap/core': '3.31.3', '@tiptap/pm': '3.31.3' },
    }, null, 2)}\n`,
  )
  await install(consumer, { runtimeOnly: true })
  for (const name of ['vue', '@tiptap/vue-3']) {
    if (existsSync(join(consumer, 'node_modules', name))) {
      throw new Error(`The runtime consumer unexpectedly installed ${name}.`)
    }
  }
  await write(
    join(consumer, 'verify-runtime.mjs'),
    await readFile(new URL('../test/fixtures/packed-consumer/runtime.mjs.fixture', import.meta.url), 'utf8'),
  )
  run('node', ['verify-runtime.mjs'], consumer)
}

// The same source exercises default and host-owned controls in both frameworks.
// It imports only packed exports; its extension keeps repository typechecking
// from accidentally resolving this fixture against the previous local dist.
async function writeEditorExample(consumer, appName) {
  const fixtureRoot = new URL('../test/fixtures/packed-consumer/', import.meta.url)
  await write(join(consumer, appName), await readFile(new URL('App.vue.fixture', fixtureRoot), 'utf8'))
  await write(join(consumer, 'Button.vue'), await readFile(new URL('Button.vue.fixture', fixtureRoot), 'utf8'))
}

async function verifyVueConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      scripts: { build: 'vite build', typecheck: 'vue-tsc --noEmit' },
      dependencies: {
        ...contentPeer,
        '@tiptap/core': '3.31.3',
        '@tiptap/pm': '3.31.3',
        '@tiptap/vue-3': '3.31.3',
        vue: '3.5.42',
      },
      devDependencies: {
        '@types/node': '26.1.1',
        '@vitejs/plugin-vue': '6.0.6',
        typescript: '5.9.3',
        vite: '8.1.5',
        'vue-tsc': '3.3.7',
      },
    }, null, 2)}\n`,
  )
  await write(
    join(consumer, 'index.html'),
    '<div id="app"></div><script type="module" src="/src.ts"></script>\n',
  )
  await write(
    join(consumer, 'src.ts'),
    'import { createApp } from \'vue\'\n'
    + 'import App from \'./App.vue\'\n'
    + 'import \'@lupinum/ginko-editor/style.css\'\n'
    + '\n'
    + 'createApp(App).mount(\'#app\')\n',
  )
  await writeEditorExample(consumer, 'App.vue')
  await write(
    join(consumer, 'vite.config.ts'),
    'import vue from \'@vitejs/plugin-vue\'\n'
    + 'import { defineConfig } from \'vite\'\n'
    + '\n'
    + 'export default defineConfig({ plugins: [vue()] })\n',
  )
  const vueCompilerOptions = {
    lib: ['ESNext', 'DOM'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    skipLibCheck: true,
    strict: true,
    target: 'ESNext',
    types: ['node'],
  }
  await write(
    join(consumer, 'tsconfig.json'),
    `${JSON.stringify({ compilerOptions: vueCompilerOptions, include: ['*.ts', '*.vue'] }, null, 2)}\n`,
  )
  await install(consumer)
  run('pnpm', ['run', 'typecheck'], consumer)
  run('pnpm', ['run', 'build'], consumer)
  await verifyDeclarations(consumer)
  for (const marker of cssMarkers) {
    if (!(await containsCss(join(consumer, 'dist'), marker))) {
      throw new Error(`The Vue production build dropped package CSS: ${marker}.`)
    }
  }
}

async function verifyNuxtConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      scripts: { build: 'nuxt build', prepare: 'nuxt prepare', typecheck: 'nuxt typecheck' },
      dependencies: {
        ...contentPeer,
        '@tiptap/core': '3.31.3',
        '@tiptap/pm': '3.31.3',
        '@tiptap/vue-3': '3.31.3',
        nuxt: '4.5.2',
        vue: '3.5.42',
      },
      devDependencies: { typescript: '5.9.3', 'vue-tsc': '3.3.7' },
    }, null, 2)}\n`,
  )
  await write(
    join(consumer, 'nuxt.config.ts'),
    "export default defineNuxtConfig({ css: ['@lupinum/ginko-editor/style.css'] })\n",
  )
  await writeEditorExample(consumer, 'app.vue')
  await write(join(consumer, 'tsconfig.json'), '{ "extends": "./.nuxt/tsconfig.json" }\n')
  await install(consumer)
  run('pnpm', ['run', 'prepare'], consumer)
  run('pnpm', ['run', 'typecheck'], consumer)
  run('pnpm', ['run', 'build'], consumer)
  await verifyDeclarations(consumer)
  for (const marker of cssMarkers) {
    if (!(await containsCss(join(consumer, '.output'), marker))) {
      throw new Error(`The Nuxt production build dropped package CSS: ${marker}.`)
    }
  }
}

try {
  const destination = join(root, 'package')
  await mkdir(destination)
  run('pnpm', ['pack', '--pack-destination', destination], process.cwd())
  const archives = (await readdir(destination)).filter(name => name.endsWith('.tgz'))
  if (archives.length !== 1) throw new Error('Expected one Editor package archive.')
  archive = join(destination, archives[0])
  console.log('Checking the packed Vue consumer…')
  await verifyVueConsumer(join(root, 'vue'))
  console.log('Checking the packed Nuxt consumer…')
  await verifyNuxtConsumer(join(root, 'nuxt'))
  console.log('Checking the packed backend consumer without Vue…')
  await verifyNodeRuntimeConsumer(join(root, 'node-runtime'))
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(`Verified packed Vue, Nuxt, and Node runtime consumers for ${pkg.name}@${pkg.version}.`)
