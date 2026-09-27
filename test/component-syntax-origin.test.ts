// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import { Transform } from '@tiptap/pm/transform'
import { describe, expect, it } from 'vitest'
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'
import { createDocumentExtensions } from '../src/lib/config/documentConfig'
import { convertTiptapDocToMarkdown } from '../src/lib/conversionPipeline'
import { applyCollaborationSteps, createCollaborationSnapshot, decodeCollaborationDocument } from '../src/runtime'

function editor() {
  return new Editor({ extensions: createDocumentExtensions(), content: '<p></p>' })
}

const policy: PortableComponentPolicyV2 = { version: 2, components: {
  note: { kind: 'block', props: {}, slots: ['default'], allowedParents: null, allowedChildren: null, media: null },
} }

async function markdown(value: Editor) {
  const result = await convertTiptapDocToMarkdown(value.getJSON())
  expect(result.ok).toBe(true)
  return result.value
}

describe('component source origin', () => {
  it('retains colon output for an accepted metadata-less room through an unrelated edit', async () => {
    const options = { epoch: 'legacy-room', policyRevision: 'notes-1', policy }
    const seeded = await createCollaborationSnapshot('::note\nBody\n::\n\nAfter', options)
    const schema = decodeCollaborationDocument(seeded.snapshot.document).type.schema
    // Old setElement() wrote this shape. Parsing its Markdown here would add
    // origin metadata and hide the persisted-room compatibility regression.
    const stored = schema.nodeFromJSON({ type: 'doc', content: [
      { type: 'element', attrs: { tag: 'note', props: {} }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      ] },
      { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
    ] })
    const snapshot = { ...seeded.snapshot, document: JSON.stringify(stored.toJSON()) }
    const loaded = decodeCollaborationDocument(snapshot.document)
    const change = new Transform(loaded)
      .insert(loaded.firstChild!.nodeSize + 1, loaded.type.schema.text('Unrelated '))
    const accepted = await applyCollaborationSteps(snapshot, { ...snapshot, clientId: 'principal/session',
      steps: change.steps.map(step => JSON.stringify(step.toJSON())),
    }, options)
    expect(accepted.markdown).toBe('::note\nBody\n::\n\nUnrelated After\n')
    expect(JSON.parse(accepted.snapshot.document)).toEqual(change.doc.toJSON())
    expect(JSON.parse(accepted.snapshot.document).content[0].attrs.props).toEqual({})
    expect(snapshot.document).toBe(JSON.stringify(stored.toJSON()))
  })

  it('records angle origin for new block and inline command insertions', async () => {
    for (const inline of [false, true]) {
      const value = editor()
      try {
        if (inline) value.commands.setInlineElement('badge')
        else value.commands.setElement('note')
        let props: unknown
        value.state.doc.descendants(node => { if (node.type.name === (inline ? 'inline-element' : 'element')) props = node.attrs.props })
        expect(props).toEqual({ $: { syntax: 'angle', sourceName: inline ? 'Badge' : 'Note', block: inline ? 0 : 1 } })
        expect(await markdown(value)).toContain(inline ? '<Badge' : '<Note')
      } finally { value.destroy() }
    }
  })

  it.each([
    ['::note', 'element', 'note', 1],
    [':badge[Label]', 'inline-element', 'badge', 0],
  ] as const)('records explicit colon input %s as colon origin', async (input, type, tag, block) => {
    const value = editor()
    try {
      value.commands.insertContent(block ? input : `Before ${input}`)
      const { from, to } = value.state.selection
      const handled = value.view.someProp('handleTextInput', handler => handler(value.view, from, to, ' ', () => value.state.tr.insertText(' ')))
      expect(handled).toBe(true)
      let props: unknown
      value.state.doc.descendants(node => { if (node.type.name === type) props = node.attrs.props })
      expect(props).toEqual({ $: { syntax: 'colon', sourceName: tag, block } })
      expect(await markdown(value)).toContain(block ? '::note' : ':badge[Label]')
    } finally { value.destroy() }
  })
})
