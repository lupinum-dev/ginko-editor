import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Read the unfiltered audit. An approved ID never permits a new dependency path.
export function auditFailures(report, manifest, maintaining, now = Date.now()) {
  const failures = []
  const approved = new Map()
  for (const section of maintaining.split(/^### /m).slice(1)) {
    const id = section.match(/^(GHSA-[\w-]+)/)?.[1]
    const expires = Date.parse(section.match(/Expires: ([^.\s]+)\./)?.[1] ?? '')
    if (!id || !Number.isFinite(expires) || expires > Date.parse('2026-11-06T00:00:00Z')) {
      failures.push('Invalid dev-only audit exception metadata')
      continue
    }
    if (expires <= now) failures.push(`${id}: exception expired`)
    approved.set(id, new Set([...section.matchAll(/^- `([^`]+)`$/gm)].map(match => match[1])))
  }
  const runtime = new Set(Object.keys(manifest.dependencies ?? {}))
  for (const advisory of Object.values(report.advisories)) {
    for (const finding of advisory.findings) {
      for (const path of finding.paths) {
        const parts = path.split('>')
        const editor = parts.indexOf(manifest.name)
        const production = (parts[0] === '.' && runtime.has(parts[1]))
          || (editor >= 0 && runtime.has(parts[editor + 1]))
        const id = advisory.github_advisory_id
        if (production) failures.push(`${id}: published dependency path ${path}`)
        else if (['high', 'critical'].includes(advisory.severity)
          && !approved.get(id)?.has(path)) failures.push(`${id}: unapproved dev/build path ${path}`)
      }
    }
  }
  return failures
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8' })
  const report = JSON.parse(result.stdout)
  if (![0, 1].includes(result.status) || !report.advisories || !report.metadata) {
    throw new Error(`Audit failed: ${result.stderr || result.stdout}`)
  }
  const failures = auditFailures(report, JSON.parse(readFileSync('package.json', 'utf8')),
    readFileSync('MAINTAINING.md', 'utf8'))
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else console.log('Published dependencies clean; high/critical dev/build advisories match approved exact paths.')
}
