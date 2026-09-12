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
})
