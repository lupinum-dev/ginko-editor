import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { URL } from 'node:url'
import { parse } from 'yaml'

const workflow = parse(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'))
const publish = workflow.jobs.publish
const guardIndex = publish.steps.findIndex(step => step.name === 'Reject stale release')
const guard = publish.steps[guardIndex].run
const script = publish.steps[guardIndex + 1].run

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'release-publish-'))
  try {
    mkdirSync(join(root, 'bin'))
    mkdirSync(join(root, 'release'))
    mkdirSync(join(root, 'package'))
    writeFileSync(join(root, 'package/package.json'), JSON.stringify({ name: '@scope/example', version: '1.2.3' }))
    execFileSync('tar', ['-czf', 'release/example-1.2.3.tgz', 'package/package.json'], { cwd: root })
    for (const [name, body] of Object.entries({
      gh: '#!/bin/sh\nif [ "$GH_FAIL" = yes ]; then exit 1; fi\nprintf "%s\\n" "$MAIN_SHA"\n',
      npm: '#!/bin/sh\nif [ "$1" = view ]; then printf "%s\\n" "$NPM_RESPONSE"; exit "$NPM_STATUS"; fi\necho published >> "$RUNNER_TEMP/published"\n',
    })) {
      const path = join(root, 'bin', name)
      writeFileSync(path, body)
      chmodSync(path, 0o755)
    }
    const shell = (source, env = {}) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', source], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: root, GITHUB_REPOSITORY: 'scope/example', GITHUB_SHA: 'original', MAIN_SHA: 'original', ...env },
    })
    run({ root, shell })
  } finally { rmSync(root, { recursive: true, force: true }) }
}

test('publication serializes and checks current main after approval immediately before npm', () => {
  assert.equal(publish.environment, 'npm')
  assert.deepEqual(publish.concurrency, { group: 'release-publish', 'cancel-in-progress': false })
  assert.ok(guardIndex > publish.steps.findIndex(step => step.uses?.startsWith('actions/download-artifact@')))
  assert.match(script, /npm publish/)
  assert.equal(publish.steps.some(step => step.uses?.startsWith('actions/checkout@')), false)
  assert.equal(publish.steps.some(step => /pnpm install|npm install/.test(step.run ?? '')), false)
  fixture(({ shell }) => {
    assert.equal(shell(guard).status, 0)
    assert.equal(shell(guard, { MAIN_SHA: 'newer' }).status, 1)
    assert.equal(shell(guard, { GH_FAIL: 'yes' }).status, 1)
    assert.equal(shell(guard, { MAIN_SHA: '' }).status, 1)
  })
})

test('publication accepts only a confirmed absent npm version', () => {
  for (const [response, status, expected, writes] of [
    ['"1.2.3"', '0', 0, false],
    ['{"error":{"code":"E404"}}', '1', 0, true],
    ['{"error":{"code":"E500"}}', '1', 1, false],
    ['{"error":{"code":"E401"}}', '1', 1, false],
    ['', '1', 1, false],
    ['not-json', '0', 1, false],
    ['"1.2.2"', '0', 1, false],
  ]) {
    fixture(({ root, shell }) => {
      const result = shell(script, { NPM_RESPONSE: response, NPM_STATUS: status })
      assert.equal(result.status === 0 ? 0 : 1, expected, `${response}: ${result.stderr}`)
      if (writes) assert.equal(readFileSync(join(root, 'published'), 'utf8'), 'published\n')
      else assert.throws(() => readFileSync(join(root, 'published')))
    })
  }
})

// Catch GitHub's loose equality treating a skipped step's empty output as zero.
test('pending changesets or an open version PR never offer publication', () => {
  const offer = workflow.jobs['version-prepare'].steps.find(step => step.id === 'check').run
  for (const [pending, open] of [['true', ''], ['false', '1']]) {
    fixture(({ root, shell }) => {
      const output = join(root, 'output')
      const result = shell(offer, { PENDING: pending, OPEN_VERSION_PRS: open, GITHUB_OUTPUT: output })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(readFileSync(output, 'utf8'), 'publish=false\n')
    })
  }
})
