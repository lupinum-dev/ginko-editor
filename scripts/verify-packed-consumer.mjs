import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { URL } from 'node:url'

const release = JSON.parse(await readFile('release-artifacts/release.json', 'utf8'))
const pkg = release.packages[0]
const archive = resolve('release-artifacts', pkg.filename)
// Remove the default candidate when Content 1.0.0-beta.10 is published (internals/migrations.md).
const contentArchive = resolve(process.env.GINKO_CONTENT_TARBALL ?? 'internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz')
const root = await mkdtemp(join(tmpdir(), 'ginko-editor-packed-consumers-'))

const packageInputs = [...(contentArchive ? [contentArchive] : []), archive]
// Content is a peer. Hosts install it; a candidate archive replaces the registry version.
const contentPeer = { '@lupinum/ginko-content': '1.0.0-beta.9' }

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
    run('npm', ['exec', '--', 'tsc', '--noEmit', '--skipLibCheck', '--strict', '--target', 'ESNext',
      '--module', 'NodeNext', '--moduleResolution', 'NodeNext', file], consumer)
  }
}

// A backend installs only the document runtime peers. Other packages declare
// Vue as a peer, so legacy peer resolution keeps npm from adding it. The
// runtime entry must then load and round trip a document without Vue.
async function verifyNodeRuntimeConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { ...contentPeer, '@tiptap/core': '3.31.3', '@tiptap/pm': '3.31.3' },
    }, null, 2)}\n`,
  )
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps', ...packageInputs], consumer)
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
  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...packageInputs],
    consumer,
  )
  run('npm', ['run', 'typecheck'], consumer)
  run('npm', ['run', 'build'], consumer)
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
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...packageInputs], consumer)
  run('npm', ['run', 'prepare'], consumer)
  run('npm', ['run', 'typecheck'], consumer)
  run('npm', ['run', 'build'], consumer)
  await verifyDeclarations(consumer)
  for (const marker of cssMarkers) {
    if (!(await containsCss(join(consumer, '.output'), marker))) {
      throw new Error(`The Nuxt production build dropped package CSS: ${marker}.`)
    }
  }
}

try {
  await verifyVueConsumer(join(root, 'vue'))
  await verifyNuxtConsumer(join(root, 'nuxt'))
  await verifyNodeRuntimeConsumer(join(root, 'node-runtime'))
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(`Verified packed Vue, Nuxt, and Node runtime consumers for ${pkg.name}@${pkg.version}.`)
