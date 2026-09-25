import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import {
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
} from '../src/lib/conversionPipeline.js'

function paragraph(content: JSONContent[]): JSONContent {
  return { content: [{ content, type: 'paragraph' }], type: 'doc' }
}

function textOf(doc: JSONContent | undefined): string {
  if (!doc) return ''
  if (doc.type === 'text') return doc.text ?? ''
  return (doc.content ?? []).map(textOf).join('')
}

async function saveAndReopen(doc: JSONContent) {
  const saved = await convertTiptapDocToMarkdown(doc)
  expect(saved.ok).toBe(true)
  const reopened = await prepareMarkdownForVisualEditing(saved.value!)
  expect(reopened.ok).toBe(true)
  return { markdown: saved.value!, doc: reopened.value! }
}

describe('typed text fidelity', () => {
  it('keeps template braces as literal text', async () => {
    const { doc } = await saveAndReopen(paragraph([{ text: 'Hi {{ name }} and {{ a || b }}', type: 'text' }]))
    expect(textOf(doc)).toBe('Hi {{ name }} and {{ a || b }}')
    expect(JSON.stringify(doc)).not.toContain('binding')
  })

  it('keeps template braces inside inline code', async () => {
    const { doc } = await saveAndReopen(paragraph([
      { text: 'Use ', type: 'text' },
      { marks: [{ type: 'code' }], text: '{{ x }}', type: 'text' },
      { text: ' here', type: 'text' },
    ]))
    expect(textOf(doc)).toBe('Use {{ x }} here')
  })

  it('keeps colons in times and ratios', async () => {
    const { doc } = await saveAndReopen(paragraph([{ text: 'Meet at 10:30:45, ratio 16:9.', type: 'text' }]))
    expect(textOf(doc)).toBe('Meet at 10:30:45, ratio 16:9.')
  })

  it('opens template braces from source as text', async () => {
    const reopened = await prepareMarkdownForVisualEditing('Hello {{ user.name }}.\n\n```js\nconst t = `{{ x }}`\n```\n')
    expect(reopened.ok).toBe(true)
    expect(textOf(reopened.value)).toContain('Hello {{ user.name }}.')
    expect(textOf(reopened.value)).toContain('const t = `{{ x }}`')
  })
})

describe('heading id fidelity', () => {
  it.each([
    '# Hello\n\n## Ünïcode héading\n\n### 1st step\n',
    '## Custom {#my-id}\n\nText\n',
    '## Same\n\n## Same\n\n### Same\n',
  ])('opens and saves %j without changes', async (source) => {
    const opened = await prepareMarkdownForVisualEditing(source)
    expect(opened.ok).toBe(true)
    const saved = await convertTiptapDocToMarkdown(opened.value!)
    expect(saved.value).toBe(source)
  })
})

describe('syntax-like text fidelity', () => {
  it.each([
    'Meet at 10:30:45 :fire: done',
    '::card',
    'a{.b}',
    'Visit example.com or mail a@b.co',
  ])('keeps %j as plain text', async (text) => {
    const { doc } = await saveAndReopen(paragraph([{ text, type: 'text' }]))
    expect(textOf(doc)).toBe(text)
    expect(JSON.stringify(doc)).not.toMatch(/inline-element|"element"|"link"/)
  })
})
