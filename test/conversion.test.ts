// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import { parseMdcDocument } from '@lupinum/ginko-content/cms-contract'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions } from '../src/lib/config/editorConfig.js'
import { createAuthoringKit, type AuthoringKitSource } from '../src/authoring.js'
import {
  applyTiptapDocToEditor,
  convertMarkdownToTiptapDoc,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
} from '../src/lib/conversionPipeline.js'

function createEditor() {
  return new Editor({
    content: { content: [{ type: 'paragraph' }], type: 'doc' },
    extensions: createEditorExtensions({
      codeBlockTheme: 'github-dark',
      showMarkdownMarkers: false,
    }),
  })
}

describe('editor conversion contract', () => {
  it('uses authored angle and colon form metadata when enforcing component kind', async () => {
    const source: AuthoringKitSource = {
      version: 1,
      policy: {
        version: 2,
        components: {
          badge: {
            kind: 'inline',
            props: {},
            slots: ['default'],
            allowedParents: null,
            allowedChildren: null,
            media: null,
          },
          panel: {
            kind: 'block',
            props: {},
            slots: ['default'],
            allowedParents: null,
            allowedChildren: null,
            media: null,
          },
        },
      },
      implementation: {
        badge: { componentName: 'Badge', props: {}, slots: ['default'] },
        panel: { componentName: 'Panel', props: {}, slots: ['default'] },
      },
      authoring: { badge: { label: 'Badge' }, panel: { label: 'Panel' } },
      recipes: [],
    }
    const kit = await createAuthoringKit(source)

    for (const markdown of ['hello :badge[world]', 'hello <Badge>world</Badge>', '::panel\nBody\n::']) {
      expect((await prepareMarkdownForVisualEditing(markdown, undefined, undefined, kit)).ok).toBe(true)
    }
    for (const markdown of ['::badge\nWrong form\n::', 'hello :panel[Wrong form]']) {
      const result = await prepareMarkdownForVisualEditing(markdown, undefined, undefined, kit)
      expect(result.ok).toBe(false)
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'authoring_kit_rejected',
          detail: expect.objectContaining({ message: expect.stringMatching(/invalid_node/) }),
        }),
      ]))
    }
  })

  it('uses the actual TipTap schema for rich MDC documents', async () => {
    const source = [
      '# Title',
      '',
      'Paragraph with **bold** and <Badge>inline</Badge> content.',
      '',
      '- One',
      '- Two',
      '',
      '<Info>',
      '<template #actions>',
      '[Open](/guide)',
      '</template>',
      '</Info>',
    ].join('\n')
    const prepared = await prepareMarkdownForVisualEditing(source)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok || !prepared.value) throw new Error('Expected compatible source.')

    const editor = createEditor()
    expect(applyTiptapDocToEditor(editor, prepared.value).ok).toBe(true)
    expect(editor.schema.nodes['inline-element']).toBeTruthy()
    expect(editor.schema.nodes.slot).toBeTruthy()
    expect(editor.getText()).toContain('Title')
    editor.destroy()
  })

  it('preserves source semantics after a real edit', async () => {
    const source = '# Original\n\nA paragraph with **meaning**.\n'
    const parsed = await convertMarkdownToTiptapDoc(source)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || !parsed.value) throw new Error('Expected valid source.')

    const editor = createEditor()
    applyTiptapDocToEditor(editor, parsed.value)
    editor.commands.insertContentAt(editor.state.doc.content.size, ' Added')
    const output = await convertTiptapDocToMarkdown(editor.getJSON())
    expect(output.ok).toBe(true)
    expect(output.value).toContain('# Original')
    expect(output.value).toContain('**meaning**')
    expect(output.value).toContain('Added')
    editor.destroy()
  })

  it('round-trips host component props and named slots through a real edit', async () => {
    const source = [
      '<learning-objective level="advanced" assessed>',
      'Goal',
      '',
      '<template #tip>',
      'Hint',
      '</template>',
      '</learning-objective>',
    ].join('\n')
    const parsed = await convertMarkdownToTiptapDoc(source)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || !parsed.value) throw new Error('Expected valid custom component source.')

    const editor = createEditor()
    applyTiptapDocToEditor(editor, parsed.value)
    editor.commands.insertContentAt(editor.state.doc.content.size, 'After')
    const output = await convertTiptapDocToMarkdown(editor.getJSON())
    expect(output.ok).toBe(true)
    expect(output.value).toContain('<learning-objective level="advanced" assessed>')
    expect(output.value).toContain('<template #tip>')
    const reparsed = await parseMdcDocument(output.value!, { autoClose: false })
    expect(reparsed.nodes[0]?.[1]).toMatchObject({ assessed: true, level: 'advanced' })
    expect(JSON.stringify(reparsed.nodes[0])).toContain('"template"')
    editor.destroy()
  })

  it('requires source mode when visual conversion would discard content', async () => {
    const result = await prepareMarkdownForVisualEditing('<style>.card { color: red; }</style>')
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'source_only_required' })]),
    )
  })

  it('rejects invalid source without changing the current document', async () => {
    const editor = createEditor()
    editor.commands.setContent({
      content: [{ content: [{ text: 'Last good document', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
    })
    const before = editor.getJSON()
    const result = await prepareMarkdownForVisualEditing('Before <Badge')
    expect(result.ok).toBe(false)
    expect(editor.getJSON()).toEqual(before)
    editor.destroy()
  })

  it.each([
    '<Info><template #actions>Open **now**</template></Info>',
    '<Info><template #actions><Card>Nested</Card></template></Info>',
    '<Info><template #actions></template></Info>',
  ])('accepts schema-valid named slot content: %s', async (source) => {
    const editor = createEditor()
    const result = await prepareMarkdownForVisualEditing(source, undefined, editor.schema)
    expect(result.ok).toBe(true)
    if (!result.ok || !result.value) throw new Error('Expected schema-valid slot source.')
    expect(() => editor.schema.nodeFromJSON(result.value!).check()).not.toThrow()
    editor.destroy()
  })

  it('keeps nested markdown media separate from the following block', async () => {
    const editor = createEditor()
    const document = {
      content: [{
        attrs: { props: {}, tag: 'Info' },
        content: [{
          attrs: { name: 'default', props: {} },
          content: [
            { attrs: { props: { alt: 'Nested', src: '/nested.png' } }, type: 'image' },
            { attrs: { level: 2 }, content: [{ text: 'Nested heading', type: 'text' }], type: 'heading' },
          ],
          type: 'slot',
        }],
        type: 'element',
      }],
      type: 'doc',
    }
    expect(() => editor.schema.nodeFromJSON(document).check()).not.toThrow()
    const result = await convertTiptapDocToMarkdown(document, { imageOutput: 'markdown' })
    expect(result.ok).toBe(true)
    expect(result.value).toContain('![Nested](/nested.png)\n\n## Nested heading')
    editor.destroy()
  })

  it('writes a markdown image identity only as its destination', async () => {
    const document = {
      content: [
        {
          attrs: {
            props: {
              alt: 'Diagram',
              filename: 'diagram.png',
              id: 'asset_123',
              src: 'asset_123',
            },
          },
          type: 'image',
        },
      ],
      type: 'doc',
    }
    const result = await convertTiptapDocToMarkdown(document, { imageOutput: 'markdown' })
    expect(result).toMatchObject({ ok: true, value: '![Diagram](asset_123)\n' })
    expect(result.value).not.toContain('id=')
    expect(result.value).not.toContain('filename=')
  })
})
