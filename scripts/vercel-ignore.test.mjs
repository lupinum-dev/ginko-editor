import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { URL } from 'node:url'

test('Vercel rebuilds for package inputs and fails open when the previous commit is unavailable', () => {
  const root = mkdtempSync(join(tmpdir(), 'editor-vercel-ignore-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  const commit = () => { git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-m', 'fixture') }
  try {
    git('init', '-b', 'main')
    mkdirSync(join(root, 'docs/scripts'), { recursive: true })
    copyFileSync(new URL('../docs/scripts/vercel-ignore.mjs', import.meta.url), join(root, 'docs/scripts/vercel-ignore.mjs'))
    commit()
    const check = previous => spawnSync(process.execPath, ['docs/scripts/vercel-ignore.mjs'], {
      cwd: root, env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous },
    }).status
    assert.equal(check(''), 1)
    assert.equal(check('missing'), 1)
    for (const [path, expected] of [
      ['vite.config.ts', 1], ['scripts/fix-declaration-imports.mjs', 1],
      ['.node-version', 1], ['tsconfig.build.json', 1], ['.npmrc', 1],
      ['src/index.ts', 1],
      ['docs/content/index.md', 1], ['pnpm-lock.yaml', 1], ['test/example.test.ts', 0],
    ]) {
      const previous = git('rev-parse', 'HEAD')
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), 'changed\n')
      commit()
      assert.equal(check(previous), expected, path)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})
