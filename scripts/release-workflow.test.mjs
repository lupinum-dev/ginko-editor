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
const guardIndex = publish.steps.findIndex(step => step.run?.includes('check-runs?check_name=ci'))
const guard = publish.steps[guardIndex].run
const publication = publish.steps[guardIndex + 1]
const script = publication.run

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'release-publish-'))
  try {
    mkdirSync(join(root, 'bin'))
    mkdirSync(join(root, 'release'))
    mkdirSync(join(root, 'package'))
    writeFileSync(join(root, 'package/package.json'), JSON.stringify({ name: '@scope/example', version: '1.2.3' }))
    execFileSync('tar', ['-czf', 'release/example-1.2.3.tgz', 'package/package.json'], { cwd: root })
    for (const [name, body] of Object.entries({
      gh: '#!/bin/sh\nif [ "$GH_FAIL" = yes ]; then exit 1; fi\nprintf "%s\\n" "$GH_RESPONSE"\n',
      npm: '#!/bin/sh\nif [ "$1" = view ]; then if [ "$3" = version ]; then printf "%s\\n" "$NPM_RESPONSE"; printf "%s" "$NPM_ERROR" >&2; exit "$NPM_STATUS"; else printf "%s\\n" "$NPM_TAG"; exit 0; fi; fi\necho published >> "$RUNNER_TEMP/published"\n',
    })) {
      const path = join(root, 'bin', name)
      writeFileSync(path, body)
      chmodSync(path, 0o755)
    }
    const shell = (source, env = {}) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', source], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: root, GITHUB_REPOSITORY: 'scope/example', GITHUB_SHA: 'original', GH_RESPONSE: 'completed success', ...publication.env, ...env },
    })
    run({ root, shell })
  } finally { rmSync(root, { recursive: true, force: true }) }
}

test('publication requires successful CI on the released commit before npm', () => {
  assert.equal(publish.environment, 'npm')
  assert.ok(guardIndex > publish.steps.findIndex(step => step.uses?.startsWith('actions/download-artifact@')))
  assert.equal(publish.steps.some(step => step.uses?.startsWith('actions/checkout@')), false)
  assert.equal(publish.steps.some(step => /pnpm install|npm install/.test(step.run ?? '')), false)
  fixture(({ shell }) => {
    assert.equal(shell(guard).status, 0)
    assert.equal(shell(guard, { GH_RESPONSE: 'completed failure' }).status, 1)
    assert.equal(shell(guard, { GH_RESPONSE: 'completed cancelled' }).status, 1)
    assert.equal(shell(guard, { GH_FAIL: 'yes' }).status, 1)
  })
})

test('publication rejects registry failures and versions older than the dist-tag', () => {
  for (const [response, status, error, tag, expected, writes] of [
    ['1.2.3', '0', '', '', 0, false],
    ['', '1', 'E404', '', 0, true],
    ['', '1', 'E500', '', 1, false],
    ['', '1', 'E401', '', 1, false],
    ['', '0', '', '', 0, true],
    ['', '1', 'E404', '2.0.0', 1, false],
    ['', '1', 'E404', '1.0.0', 0, true],
  ]) {
    fixture(({ root, shell }) => {
      const result = shell(script, { NPM_RESPONSE: response, NPM_STATUS: status, NPM_ERROR: error, NPM_TAG: tag })
      assert.equal(result.status === 0 ? 0 : 1, expected, `${response}/${tag}: ${result.stderr}`)
      if (writes) assert.equal(readFileSync(join(root, 'published'), 'utf8'), 'published\n')
      else assert.throws(() => readFileSync(join(root, 'published')))
    })
  }
})
