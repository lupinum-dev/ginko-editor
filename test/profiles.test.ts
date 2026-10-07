// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DOMParser as ProseMirrorDOMParser, Fragment, Slice } from '@tiptap/pm/model'

import { createEditorSchema } from '../src/lib/config/documentConfig'
import {
  countProfileViolations,
  editorProfiles,
  findProfileViolations,
  sanitizeFragment,
  sanitizeSlice,
} from '../src/lib/profiles'
import { germanMessages } from '../src/ui/messages.de'
import { defaultMessages } from '../src/ui/messages'

const schema = createEditorSchema()

function parse(html: string) {
  const element = document.createElement('div')
  element.innerHTML = html
  return ProseMirrorDOMParser.fromSchema(schema).parse(element)
}

describe('content profiles', () => {
  it('lists disallowed nodes, heading levels, and marks in ProseMirror and JSON documents', () => {
    const doc = parse('<h1>Title</h1><h2>Sub</h2><p><strong>a</strong> <s>b</s> <a href="https://x.test">c</a></p><ul><li><p>d</p></li></ul>')
    expect(findProfileViolations(doc, 'article')).toEqual([
      { kind: 'node', type: 'heading', level: 1 },
      { kind: 'mark', type: 'strike' },
    ])
    expect(findProfileViolations(doc.toJSON(), 'article')).toEqual(findProfileViolations(doc, 'article'))
    expect(findProfileViolations(doc, 'inline').map(violation => violation.type)).toEqual([
      'heading', 'heading', 'strike', 'bulletList', 'listItem',
    ])
    expect(findProfileViolations(doc, 'plain').filter(violation => violation.kind === 'mark')).toHaveLength(3)
    expect(findProfileViolations(doc, 'full')).toEqual([])
    expect(countProfileViolations(doc, editorProfiles.inline)).toBe(5)
  })

  it('reduces a pasted table and headings to allowed paragraphs and marks for inline text', () => {
    const doc = parse(
      '<h2>Opening <em>hours</em></h2>'
      + '<table><tr><th><p>Day</p></th><th><p>Time</p></th></tr>'
      + '<tr><td><p><strong>Mon</strong></p></td><td><p><code>9–5</code></p></td></tr></table>'
      + '<pre><code>line 1\nline 2</code></pre>',
    )
    const clean = sanitizeFragment(doc.content, schema, editorProfiles.inline)
    const result = schema.nodes.doc!.create(null, clean)
    expect(findProfileViolations(result, 'inline')).toEqual([])
    expect(result.toJSON().content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Opening ' }, { type: 'text', text: 'hours', marks: [{ type: 'italic' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Day' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Time' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Mon', marks: [{ type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '9–5' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'line 1' }, { type: 'hardBreak' }, { type: 'text', text: 'line 2' }] },
    ])
  })

  it('keeps plain text and removes all formatting and images for plain text', () => {
    const doc = parse('<p><strong>Big</strong> <a href="https://x.test">news</a><img src="/a.png" alt="A"></p><blockquote><p>Quote</p></blockquote>')
    const result = schema.nodes.doc!.create(null, sanitizeFragment(doc.content, schema, editorProfiles.plain))
    expect(findProfileViolations(result, 'plain')).toEqual([])
    expect(result.textBetween(0, result.content.size, '\n')).toBe('Big news\nQuote')
  })

  it('moves headings to the nearest allowed level and keeps article structure', () => {
    const doc = parse('<h1>A</h1><h6>B</h6><ol><li><p>One</p></li></ol><blockquote><h1>Q</h1></blockquote><hr>')
    const result = schema.nodes.doc!.create(null, sanitizeFragment(doc.content, schema, editorProfiles.article))
    expect(findProfileViolations(result, 'article')).toEqual([])
    expect(result.toJSON().content.map((node: { type: string; attrs?: { level?: number } }) =>
      node.attrs?.level ? `${node.type}${node.attrs.level}` : node.type)).toEqual([
      'heading2', 'heading4', 'orderedList', 'blockquote', 'horizontalRule',
    ])
    expect(result.child(3).firstChild?.attrs.level).toBe(2)
  })

  it('keeps inline slices open so pasted words join the current paragraph', () => {
    const paragraph = schema.nodes.paragraph!.create(null, schema.text('bold', [schema.marks.bold!.create(), schema.marks.strike!.create()]))
    const slice = sanitizeSlice(new Slice(Fragment.from(paragraph), 1, 1), schema, editorProfiles.inline)
    expect(slice.openStart).toBe(1)
    expect(slice.content.firstChild?.firstChild?.marks.map(mark => mark.type.name)).toEqual(['bold'])
    const untouched = new Slice(Fragment.from(paragraph), 1, 1)
    expect(sanitizeSlice(untouched, schema, editorProfiles.full)).toBe(untouched)
  })
})

describe('German messages', () => {
  it('translates every English message and keeps its placeholders', () => {
    expect(Object.keys(germanMessages).sort()).toEqual(Object.keys(defaultMessages).sort())
    for (const [key, english] of Object.entries(defaultMessages)) {
      const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
      expect(placeholders(germanMessages[key as keyof typeof defaultMessages]), key).toEqual(placeholders(english))
    }
  })
})
