import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const docsSource = realpathSync(
  resolve(process.env.GINKO_DOCS_CANDIDATE ?? resolve(root, '../ginko-docs/layer')),
)
const contentSource = realpathSync(
  resolve(
    process.env.GINKO_CONTENT_CANDIDATE ?? resolve(root, 'node_modules/@lupinum/ginko-content'),
  ),
)
const installedDocsPackage = realpathSync(resolve(root, 'docs/node_modules/@lupinum/ginko-docs'))
const installedDocsDependencies = resolve(installedDocsPackage, '../..')
const candidateRoot = resolve(root, 'docs/.candidate')
const docsDestination = resolve(candidateRoot, 'ginko-docs')
const contentDestination = resolve(candidateRoot, 'ginko-content')
const docsContentLink = resolve(root, 'docs/node_modules/@lupinum/ginko-content')

if (!existsSync(resolve(docsSource, 'authoring.ts'))) {
  throw new Error(
    'GINKO_DOCS_CANDIDATE must point to the accepted Ginko Docs layer until its authoring-kit release is published.',
  )
}
const contentContractPath = resolve(contentSource, 'dist/cms-contract/index.js')
if (
  !existsSync(contentContractPath) ||
  !['parseMdcBody', 'parseMdcDocument', 'serializeMdcDocument'].every((name) =>
    readFileSync(contentContractPath, 'utf8').includes(name),
  )
) {
  throw new Error(
    'The installed Content package must contain the required parser contract. '
    + 'Install the committed dependency graph or select a built candidate with GINKO_CONTENT_CANDIDATE.',
  )
}

rmSync(candidateRoot, { force: true, recursive: true })
mkdirSync(candidateRoot, { recursive: true })
cpSync(docsSource, docsDestination, {
  recursive: true,
  filter: (path) => !/(?:^|\/)(?:\.pack|node_modules)(?:\/|$)/u.test(path),
})
mkdirSync(contentDestination, { recursive: true })
for (const path of ['dist', 'package.json']) {
  cpSync(resolve(contentSource, path), resolve(contentDestination, path), { recursive: true })
}
const contentDependencies = existsSync(resolve(contentSource, 'node_modules'))
  ? resolve(contentSource, 'node_modules') : resolve(contentSource, '../..')
symlinkSync(contentDependencies, resolve(contentDestination, 'node_modules'), 'dir')
const candidateConfigPath = resolve(docsDestination, 'nuxt.config.ts')
const candidateConfig = readFileSync(candidateConfigPath, 'utf8')
const contentModuleSpecifier = '"@lupinum/ginko-content",'
if (!candidateConfig.includes(contentModuleSpecifier)) {
  throw new Error('The Ginko Docs candidate no longer contains the expected Content module entry.')
}
writeFileSync(
  candidateConfigPath,
  candidateConfig.replace(
    contentModuleSpecifier,
    `${JSON.stringify(resolve(contentDestination, 'dist/module.mjs'))},`,
  ),
)
symlinkSync(installedDocsDependencies, resolve(docsDestination, 'node_modules'), 'dir')
mkdirSync(resolve(root, 'docs/node_modules/@lupinum'), { recursive: true })
rmSync(docsContentLink, { force: true, recursive: true })
symlinkSync(contentDestination, docsContentLink, 'dir')

console.log(`Prepared Docs candidate from ${docsSource}`)
console.log(`Prepared Content candidate from ${contentSource}`)
