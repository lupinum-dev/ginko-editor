import { describe, expect, it } from 'vitest'
import { AttrStep, Transform, type Step } from '@tiptap/pm/transform'
import {
  applyCollaborationSteps, createCollaborationSnapshot, decodeCollaborationDocument, decodeCollaborationSteps,
  SetNodePropertyStep, SetNodeAttributeStep, SetComponentVariantStep, collaborationLimits, collaborationProtocolVersion,
  type CollaborationSnapshot, type CollaborationSteps,
} from '../src/runtime'
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'

const policy: PortableComponentPolicyV2 = { version: 2, components: {
  note: { kind: 'block', props: {
    title: { types: ['string'], required: true, allowedValues: null },
    tone: { types: ['string'], required: false, allowedValues: ['info', 'warning'] },
  }, slots: ['default'], allowedParents: null, allowedChildren: null, media: null },
} }
const options = { epoch: 'test-epoch', policyRevision: 'notes-1', policy }

function batch(snapshot: CollaborationSnapshot, steps: CollaborationSteps['steps']): CollaborationSteps {
  return { epoch: snapshot.epoch, schemaRevision: snapshot.schemaRevision,
    policyRevision: snapshot.policyRevision, version: snapshot.version, clientId: 'user-a/session-1', steps }
}

describe('collaboration server boundary', () => {
  it('derives a versioned source checkpoint from accepted text and property steps', async () => {
    const seeded = await createCollaborationSnapshot('<note title="Original">\nBody.\n</note>', options)
    const doc = decodeCollaborationDocument(seeded.snapshot.document)
    const change = new Transform(doc).step(new SetNodePropertyStep(0, 'title', 'Updated')).insert(2, doc.type.schema.text('New '))
    const accepted = await applyCollaborationSteps(seeded.snapshot,
      batch(seeded.snapshot, change.steps.map(step => JSON.stringify(step.toJSON()))), options)
    expect(accepted.snapshot.version).toBe(2)
    expect(accepted.markdown).toContain('Updated')
    expect(accepted.markdown).toContain('New Body.')
    expect(JSON.parse(accepted.snapshot.document)).toEqual(change.doc.toJSON())
    expect(decodeCollaborationDocument(seeded.snapshot.document).firstChild?.attrs.props.title).toBe('Original')
  })

  it('rejects past and future versions and incompatible document generations', async () => {
    const { snapshot } = await createCollaborationSnapshot('Body.', options)
    const doc = decodeCollaborationDocument(snapshot.document)
    const change = new Transform(doc).insert(1, doc.type.schema.text('New '))
    const valid = batch(snapshot, change.steps.map(step => JSON.stringify(step.toJSON())))
    for (const [override, code] of [
      [{ version: 1 }, 'version'], [{ version: -1 }, 'invalid'], [{ version: 0.5 }, 'invalid'],
      [{ epoch: 'another' }, 'epoch'], [{ schemaRevision: 'old' }, 'schema'], [{ policyRevision: 'old' }, 'policy'],
    ] as const) {
      await expect(applyCollaborationSteps(snapshot, { ...valid, ...override }, options)).rejects.toMatchObject({ code })
    }
    const accepted = await applyCollaborationSteps(snapshot, valid, options)
    await expect(applyCollaborationSteps(accepted.snapshot, valid, options)).rejects.toMatchObject({ code: 'version' })
  })

  it('rejects an entire batch if any step violates content policy', async () => {
    const { snapshot } = await createCollaborationSnapshot('<note title="Original">\nBody.\n</note>', options)
    const steps = [new SetNodePropertyStep(0, 'title', 'Valid'), new SetNodePropertyStep(0, 'tone', 'not-allowed')]
    await expect(applyCollaborationSteps(snapshot, batch(snapshot, steps.map(step => JSON.stringify(step.toJSON()))), options))
      .rejects.toMatchObject({ code: 'content' })
    expect(decodeCollaborationDocument(snapshot.document).firstChild?.attrs.props.title).toBe('Original')
  })

  it('refuses source-only content instead of creating a truncated room', async () => {
    await expect(createCollaborationSnapshot('<!-- Keep this -->\n\nBody.', options)).rejects.toMatchObject({ code: 'content' })
  })

  it('rejects image properties that would be silently discarded from Content', async () => {
    const { snapshot } = await createCollaborationSnapshot('![Original](/image.png)', options)
    for (const [key, value] of [['secretUnsupported', 'discarded'], ['width', 'not-a-number'], ['$', { hidden: true }]] as const) {
      const step = new SetNodePropertyStep(0, key, value)
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [JSON.stringify(step.toJSON())]), options))
        .rejects.toMatchObject({ code: 'content' })
    }
    const step = new SetNodePropertyStep(0, 'alt', 'A supported description')
    const accepted = await applyCollaborationSteps(snapshot, batch(snapshot, [JSON.stringify(step.toJSON())]), options)
    expect(accepted.markdown).toContain('A supported description')
  })

  it('rejects unknown node attributes that ProseMirror normally discards', async () => {
    const { snapshot } = await createCollaborationSnapshot('Body.', options)
    const doc = JSON.parse(snapshot.document)
    doc.content[0].attrs = { secretUnknown: 'Would vanish' }
    expect(() => decodeCollaborationDocument(JSON.stringify(doc))).toThrow(/schema/)
    expect(() => decodeCollaborationSteps([JSON.stringify({ stepType: 'replace', from: 1, to: 1,
      slice: { content: [{ type: 'text', text: 'New', attrs: { secretUnknown: 'Would vanish' } }] } })]))
      .toThrow(/lose data/)
    expect(() => decodeCollaborationSteps(['{"stepType":"ginkoSetNodePropertyV1","pos":0,"key":"title","value":1e999}']))
      .toThrow(/finite/)
  })

  it('rejects table attributes that Markdown cannot preserve', async () => {
    const { snapshot } = await createCollaborationSnapshot('| Name | Value |\n| --- | --- |\n| One | Two |', options)
    for (const [key, value] of [['colspan', 2], ['rowspan', 2], ['colwidth', [100]], ['align', 'justify']] satisfies [string, number | number[] | string][]) {
      const step = new SetNodeAttributeStep(2, key, value)
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [JSON.stringify(step.toJSON())]), options))
        .rejects.toMatchObject({ code: 'content' })
    }
  })

  it('bounds batches, nesting and document size before applying them', async () => {
    expect(() => decodeCollaborationSteps([])).toThrow(/number of steps/)
    expect(() => decodeCollaborationSteps(Array(collaborationLimits.stepsPerBatch + 1).fill('{}'))).toThrow(/number of steps/)
    expect(() => decodeCollaborationSteps([' '.repeat(collaborationLimits.batchBytes + 1)])).toThrow(/too large/)
    expect(() => decodeCollaborationDocument('['.repeat(70) + '0' + ']'.repeat(70))).toThrow(/deeply nested/)
    const { snapshot } = await createCollaborationSnapshot('Body.', options)
    const doc = decodeCollaborationDocument(snapshot.document)
    const oversized = new Transform(doc).insert(1, doc.type.schema.text('x'.repeat(100_000)))
    const oneStep = JSON.stringify(oversized.steps[0]!.toJSON())
    expect(() => decodeCollaborationSteps([oneStep, oneStep, oneStep])).toThrow(/too large/)
  })

  it('rejects fractional native step positions before ProseMirror can round them', () => {
    for (const step of [
      { stepType: 'replace', from: 2.5, to: 3.5, slice: { content: [{ type: 'text', text: 'X' }] } },
      { stepType: 'addMark', from: 1.5, to: 3, mark: { type: 'bold' } },
      { stepType: 'replaceAround', from: 0, to: 4, gapFrom: 1, gapTo: 3, insert: 0.5 },
      { stepType: 'replace', from: 1, to: 1, slice: { content: [{ type: 'paragraph' }], openStart: 0.5 } },
    ]) expect(() => decodeCollaborationSteps([JSON.stringify(step)])).toThrow(/safe integers/)
  })

  it('rejects schema attribute values that the editor cannot represent', async () => {
    const { snapshot } = await createCollaborationSnapshot('## Title\n\n```ts [a.ts]\nx\n```\n\n1. One', options)
    const doc = decodeCollaborationDocument(snapshot.document)
    const code = doc.child(0).nodeSize, list = code + doc.child(1).nodeSize
    const hostile: Step[] = [
      new SetNodeAttributeStep(0, 'level', 9), new SetNodeAttributeStep(0, 'level', '2'), new SetNodeAttributeStep(0, 'level', 0),
      new AttrStep(0, 'level', 7),
      new SetNodeAttributeStep(code, 'language', { script: true }), new SetNodeAttributeStep(code, 'filename', 'a.ts\nsecond line'),
      new SetNodeAttributeStep(code, 'language', 'x'.repeat(101)),
      new SetNodeAttributeStep(list, 'start', -1), new SetNodeAttributeStep(list, 'type', 'disc'),
    ]
    for (const step of hostile) {
      // The value check runs before Markdown conversion, which could otherwise normalize the value.
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [JSON.stringify(step.toJSON())]), options))
        .rejects.toMatchObject({ code: 'content', message: expect.stringMatching(/heading level|Code metadata|numbered list/) })
    }
    const valid = [new SetNodeAttributeStep(0, 'level', 3), new SetNodeAttributeStep(code, 'language', 'js')]
    const accepted = await applyCollaborationSteps(snapshot, batch(snapshot, valid.map(step => JSON.stringify(step.toJSON()))), options)
    expect(accepted.markdown).toContain('### Title')
    expect(accepted.markdown).toContain('```js [a.ts]')
  })

  it('rejects unknown marks and unsafe or malformed links', async () => {
    const { snapshot } = await createCollaborationSnapshot('Body text.', options)
    const link = (attrs: Record<string, unknown>) => JSON.stringify({ stepType: 'addMark', from: 1, to: 5, mark: { type: 'link', attrs } })
    expect(() => decodeCollaborationSteps([JSON.stringify({ stepType: 'addMark', from: 1, to: 5, mark: { type: 'underline' } })])).toThrow()
    for (const href of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x', '//evil.test/x', 'https://user:secret@evil.test/']) {
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [link({ href, target: null, rel: null, class: null, title: null })]), options))
        .rejects.toMatchObject({ code: 'content', message: 'A link must use a safe URL.' })
    }
    for (const attrs of [{ href: null }, { href: 42 }, { href: 'https://ok.test', target: '_top' }, { href: 'https://ok.test', title: { x: 1 } }]) {
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [link({ target: null, rel: null, class: null, title: null, ...attrs })]), options))
        .rejects.toMatchObject({ code: 'content' })
    }
    const accepted = await applyCollaborationSteps(snapshot,
      batch(snapshot, [link({ href: 'https://example.com/a', target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null })]), options)
    expect(accepted.markdown).toContain('[Body](https://example.com/a)')
  })

  it('rejects hostile component names, oversized steps and other protocol versions', async () => {
    const { snapshot } = await createCollaborationSnapshot('<note title="Original">\nBody.\n</note>', options)
    for (const step of [new SetNodeAttributeStep(0, 'tag', 'script onload=x'), new SetNodeAttributeStep(0, 'tag', 42)]) {
      await expect(applyCollaborationSteps(snapshot, batch(snapshot, [JSON.stringify(step.toJSON())]), options))
        .rejects.toMatchObject({ code: 'content' })
    }
    expect(() => new SetComponentVariantStep(0, '<script>', undefined)).toThrow()
    const huge = JSON.stringify(new SetNodePropertyStep(0, 'title', 'x'.repeat(collaborationLimits.batchBytes)).toJSON())
    await expect(applyCollaborationSteps(snapshot, batch(snapshot, [huge]), options)).rejects.toMatchObject({ code: 'limit' })
    const title = [JSON.stringify(new SetNodePropertyStep(0, 'title', 'Updated').toJSON())]
    await expect(applyCollaborationSteps(snapshot, { ...batch(snapshot, title), protocolVersion: 2 as never }, options))
      .rejects.toMatchObject({ code: 'protocol' })
    const accepted = await applyCollaborationSteps(snapshot, { ...batch(snapshot, title), protocolVersion: collaborationProtocolVersion }, options)
    expect(accepted.markdown).toContain('Updated')
  })

  it('checks a seeded document against the schema before storing it', async () => {
    const seeded = await createCollaborationSnapshot('# Heading\n\nText with [a link](https://example.com).', options)
    expect(() => decodeCollaborationDocument(seeded.snapshot.document).check()).not.toThrow()
    const unsafe = await createCollaborationSnapshot('[a](javascript:alert(1))', options)
    expect(unsafe.snapshot.document).not.toContain('"link"')
  })
})
