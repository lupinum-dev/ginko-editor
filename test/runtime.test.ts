import { describe, expect, it } from 'vitest'
import {
  createEditorSchema,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
} from '../src/runtime'
import { createAuthoringKit } from '../src/authoring'

describe('runtime document boundary', () => {
  it('round-trips structured content without a browser or an editor instance', async () => {
    expect(typeof document).toBe('undefined')
    const schema = createEditorSchema()
    const source = '# Heading\n\nA **bold** thought.\n\n'
      + '| Name | Value |\n| --- | ---: |\n| First | 42 |\n\n'
      + '```ts [example.ts]\nconst answer = 42\n```'
    const prepared = await prepareMarkdownForVisualEditing(source, undefined, schema)
    expect(prepared.ok, JSON.stringify(prepared.issues)).toBe(true)
    const node = schema.nodeFromJSON(prepared.value)
    expect(() => node.check()).not.toThrow()
    expect(node.textContent).toContain('answer = 42')
    const serialized = await convertTiptapDocToMarkdown(node.toJSON())
    expect(serialized.ok, JSON.stringify(serialized.issues)).toBe(true)
    const reopened = await prepareMarkdownForVisualEditing(serialized.value!, undefined, schema)
    expect(reopened.ok, JSON.stringify(reopened.issues)).toBe(true)
    expect(reopened.value).toEqual(prepared.value)
  })

  it('preserves declared component properties and named slots', async () => {
    const kit = await createAuthoringKit({
      version: 1,
      policy: { version: 2, components: {
        note: {
          kind: 'block',
          props: { title: { types: ['string'], required: true, allowedValues: null } },
          slots: ['default', 'tip'], allowedParents: null, allowedChildren: null, media: null,
        },
      } },
      implementation: { note: { componentName: 'Note', props: {
        title: { types: ['string'], required: true },
      }, slots: ['default', 'tip'] } },
      authoring: { note: { label: 'Note', props: { title: { label: 'Title', control: 'text' } } } },
      recipes: [],
    })
    const source = '<note title="Original">\nBody.\n\n<template #tip>\nA tip.\n</template>\n</note>'
    const schema = createEditorSchema()
    const prepared = await prepareMarkdownForVisualEditing(source, undefined, schema, kit)
    expect(prepared.ok, JSON.stringify(prepared.issues)).toBe(true)
    const node = schema.nodeFromJSON(prepared.value)
    expect(node.firstChild?.attrs.props.title).toBe('Original')
    expect(node.textContent).toContain('A tip.')
    const serialized = await convertTiptapDocToMarkdown(node.toJSON())
    expect(serialized.ok).toBe(true)
    const reopened = await prepareMarkdownForVisualEditing(serialized.value!, undefined, schema, kit)
    expect(reopened.ok, JSON.stringify(reopened.issues)).toBe(true)
    expect(reopened.value).toEqual(prepared.value)
  })

  it('rejects source that the schema cannot preserve instead of truncating it', async () => {
    const source = '<!-- retain this comment -->\n\nParagraph.'
    const prepared = await prepareMarkdownForVisualEditing(source, undefined, createEditorSchema())
    expect(prepared.ok).toBe(false)
    expect(prepared.issues.map(issue => issue.code)).toContain('visual_schema_unsupported')
  })
})
