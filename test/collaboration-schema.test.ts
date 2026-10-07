import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Step } from '@tiptap/pm/transform'
import { describe, expect, it } from 'vitest'
import { createEditorSchema, editorSchemaRevision } from '../src/runtime'
import { collaborationWireSteps } from '../src/lib/collaboration/validation'

const fixture = new URL('./fixtures/collaboration-schema.json', import.meta.url)

/** Everything that changes how stored documents and wire steps decode. */
function describeSchema() {
  const schema = createEditorSchema()
  const attrs = (spec: Record<string, { default?: unknown; validate?: unknown }> | undefined) =>
    Object.fromEntries(Object.entries(spec ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, attr]) => [name, {
      ...('default' in attr ? { default: attr.default ?? null } : { required: true }),
      ...(attr.validate ? { validate: typeof attr.validate === 'string' ? attr.validate : 'function' } : {}),
    }]))
  const nodes = Object.fromEntries(Object.entries(schema.nodes).map(([name, type]) => {
    const spec = type.spec
    return [name, { content: spec.content ?? '', group: spec.group ?? '', marks: spec.marks ?? null,
      inline: !!spec.inline, atom: !!spec.atom, code: !!spec.code, defining: !!spec.defining, isolating: !!spec.isolating,
      whitespace: spec.whitespace ?? 'normal', attrs: attrs(spec.attrs) }]
  }))
  const marks = Object.fromEntries(Object.entries(schema.marks).map(([name, type]) => [name, {
    excludes: type.spec.excludes ?? null, group: type.spec.group ?? '', inclusive: type.spec.inclusive ?? true,
    spanning: type.spec.spanning ?? true, attrs: attrs(type.spec.attrs),
  }]))
  return { topNode: schema.topNodeType.name, nodes, marks, steps: [...collaborationWireSteps].sort() }
}

describe('collaboration schema revision', () => {
  it('changes whenever the shared schema or wire steps change', () => {
    const description = describeSchema()
    const fingerprint = createHash('sha256').update(JSON.stringify(description)).digest('hex')
    if (process.env.UPDATE_COLLABORATION_SCHEMA === '1') {
      writeFileSync(fixture, JSON.stringify({ schemaRevision: editorSchemaRevision, fingerprint, schema: description }, null, 2) + '\n')
    }
    const recorded = JSON.parse(readFileSync(fixture, 'utf8')) as { schemaRevision: string; fingerprint: string }
    const instructions = [
      'The collaboration schema changed. Stored rooms and pending browser steps may not decode with the new editor.',
      '1. Increment `editorSchemaRevision` in src/lib/collaboration/protocol.ts.',
      '2. Run `UPDATE_COLLABORATION_SCHEMA=1 pnpm vitest run test/collaboration-schema.test.ts` and review the fixture diff.',
      '3. Add a CHANGELOG entry and follow the re-seed procedure in the collaboration guide.',
    ].join('\n')
    expect(recorded.schemaRevision === editorSchemaRevision && recorded.fingerprint !== fingerprint ? instructions : '').toBe('')
    expect(recorded.schemaRevision, 'Record the new revision with UPDATE_COLLABORATION_SCHEMA=1.').toBe(editorSchemaRevision)
    expect(recorded.fingerprint).toBe(fingerprint)
  })

  it('registers every custom wire step', () => {
    createEditorSchema()
    for (const stepType of collaborationWireSteps.filter(id => id.startsWith('ginko'))) {
      expect(() => Step.fromJSON(createEditorSchema(), { stepType })).not.toThrow(/No step type/)
    }
  })
})
