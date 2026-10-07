import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditFailures } from './audit.mjs'

// Catch an approved dev advisory leaking into production, a new path, or an expired waiver.
test('audit exceptions permit only their exact dev paths before expiry', () => {
  const id = 'GHSA-86w9-cpqp-85rv'
  const path = 'docs>nuxt>node-forge'
  const maintaining = `### ${id} (node-forge)\nExpires: 2026-11-06T00:00:00Z.\n- \`${path}\`\n`
  const manifest = { name: '@lupinum/ginko-editor', dependencies: { runtime: '1' } }
  const report = path => ({ advisories: { advisory: {
    github_advisory_id: id, severity: 'high', findings: [{ paths: [path] }],
  } } })
  const now = Date.parse('2026-10-07T00:00:00Z')
  assert.deepEqual(auditFailures(report(path), manifest, maintaining, now), [])
  assert.deepEqual(auditFailures(report('.>runtime>node-forge'), manifest, maintaining, now),
    [`${id}: published dependency path .>runtime>node-forge`])
  assert.deepEqual(auditFailures(report('docs>other>node-forge'), manifest, maintaining, now),
    [`${id}: unapproved dev/build path docs>other>node-forge`])
  assert.deepEqual(auditFailures(report(path), manifest, maintaining, Date.parse('2026-11-06T00:00:00Z')),
    [`${id}: exception expired`])
})
