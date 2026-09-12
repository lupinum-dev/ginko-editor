// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions } from '../src/lib/config/editorConfig.js'
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
      enableDebug: false,
      enableFiles: true,
      enableVideo: true,
      fileOutput: 'mdc',
      imageOutput: 'mdc',
      showMarkdownMarkers: false,
      videoOutput: 'mdc',
    }),
  })
}

describe('editor conversion contract', () => {
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
})
