import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const release = JSON.parse(await readFile('release-artifacts/release.json', 'utf8'))
const pkg = release.packages[0]
const archive = resolve('release-artifacts', pkg.filename)
const root = await mkdtemp(join(tmpdir(), 'ginko-editor-packed-consumers-'))

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
  if (!entryTypes.includes('GinkoEditorScaffold')) throw new Error('The packed public declaration is missing.')
  await readFile(join(packageRoot, 'dist', 'GinkoEditorScaffold.vue.d.ts'), 'utf8')
}

async function verifyVueConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      scripts: { build: 'vite build', typecheck: 'vue-tsc --noEmit' },
      dependencies: { vue: '3.5.42' },
      devDependencies: {
        '@types/node': '26.1.1',
        '@vitejs/plugin-vue': '6.0.6',
        typescript: '5.9.3',
        vite: '8.1.5',
        'vue-tsc': '3.3.7',
      },
    }, null, 2)}\n`,
  )
  await write(join(consumer, 'index.html'), '<div id="app"></div><script type="module" src="/src.ts"></script>\n')
  await write(
    join(consumer, 'src.ts'),
    "import { createApp } from 'vue'\nimport App from './App.vue'\nimport '@lupinum/ginko-editor/style.css'\n\ncreateApp(App).mount('#app')\n",
  )
  await write(
    join(consumer, 'App.vue'),
    "<script setup lang=\"ts\">\nimport { GinkoEditorScaffold } from '@lupinum/ginko-editor'\n</script>\n\n<template><GinkoEditorScaffold>Vue consumer</GinkoEditorScaffold></template>\n",
  )
  await write(
    join(consumer, 'vite.config.ts'),
    "import vue from '@vitejs/plugin-vue'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [vue()] })\n",
  )
  await write(
    join(consumer, 'tsconfig.json'),
    `${JSON.stringify({ compilerOptions: { lib: ['ESNext', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler', strict: true, target: 'ESNext', types: ['node'] }, include: ['*.ts', '*.vue'] }, null, 2)}\n`,
  )
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive], consumer)
  run('npm', ['run', 'typecheck'], consumer)
  run('npm', ['run', 'build'], consumer)
  await verifyDeclarations(consumer)
  if (!(await containsCss(join(consumer, 'dist'), '.ginko-editor-scaffold'))) {
    throw new Error('The Vue production build dropped the package CSS.')
  }
}

async function verifyNuxtConsumer(consumer) {
  await write(
    join(consumer, 'package.json'),
    `${JSON.stringify({
      private: true,
      type: 'module',
      scripts: { build: 'nuxt build', prepare: 'nuxt prepare', typecheck: 'nuxt typecheck' },
      dependencies: { nuxt: '4.5.2', vue: '3.5.42' },
      devDependencies: { typescript: '5.9.3', 'vue-tsc': '3.3.7' },
    }, null, 2)}\n`,
  )
  await write(
    join(consumer, 'nuxt.config.ts'),
    "export default defineNuxtConfig({ css: ['@lupinum/ginko-editor/style.css'] })\n",
  )
  await write(
    join(consumer, 'app.vue'),
    "<script setup lang=\"ts\">\nimport { GinkoEditorScaffold } from '@lupinum/ginko-editor'\n</script>\n\n<template><GinkoEditorScaffold>Nuxt consumer</GinkoEditorScaffold></template>\n",
  )
  await write(join(consumer, 'tsconfig.json'), '{ "extends": "./.nuxt/tsconfig.json" }\n')
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive], consumer)
  run('npm', ['run', 'prepare'], consumer)
  run('npm', ['run', 'typecheck'], consumer)
  run('npm', ['run', 'build'], consumer)
  await verifyDeclarations(consumer)
  if (!(await containsCss(join(consumer, '.output'), '.ginko-editor-scaffold'))) {
    throw new Error('The Nuxt production build dropped the package CSS.')
  }
}

try {
  await verifyVueConsumer(join(root, 'vue'))
  await verifyNuxtConsumer(join(root, 'nuxt'))
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(`Verified packed Vue and Nuxt consumers for ${pkg.name}@${pkg.version}.`)
