// @vitest-environment jsdom
import type { Editor } from '@tiptap/core'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import type { GinkoEditorProps } from '../src/editorProps'
import { findProfileViolations } from '../src/lib/profiles'
import { germanMessages } from '../src/ui/messages.de'
import GinkoKeyboardDock from '../src/ui/GinkoKeyboardDock.vue'
import GinkoSelectionToolbar from '../src/ui/GinkoSelectionToolbar.vue'
import GinkoToolbar from '../src/ui/GinkoToolbar.vue'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
  globalThis.ClipboardEvent ??= class extends Event {} as unknown as typeof ClipboardEvent
})

const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

async function setup(props: Partial<GinkoEditorProps> = {}) {
  const wrapper = mount(GinkoEditor, {
    attachTo: document.body,
    props: { modelValue: 'Hello world', syncDebounceMs: 10000, ...props },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, editor: wrapper.vm.getEditor()! }
}

/** Type like a keyboard: each character first reaches the input rules. */
function type(editor: Editor, text: string) {
  for (const character of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', handler =>
      handler(editor.view, from, to, character, () => editor.state.tr.insertText(character, from, to)))
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(character, from, to))
  }
}

function markedText(editor: Editor, mark: string) {
  let text = ''
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some(candidate => candidate.type.name === mark)) text += node.text
  })
  return text
}

function pasteMarkdown(editor: Editor, markdown: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { types: ['text/markdown'], getData: (kind: string) => (kind === 'text/markdown' ? markdown : '') },
  })
  editor.view.dom.dispatchEvent(event)
}

const modKey = (key: string, options: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    [/Mac|iPhone|iPad/.test(navigator.platform) ? 'metaKey' : 'ctrlKey']: true,
    ...options,
  })

/** Floating toolbars render into the editor's overlay root. */
function teleportedLabels(selector: string) {
  return [...document.querySelectorAll(`${selector} button[aria-label]`)].map(button => button.getAttribute('aria-label'))
}

function stubTouch(touch: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: touch && query.includes('pointer: coarse'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe('content profiles in the editor', () => {
  it('offers only bold, italic, and link for inline text', async () => {
    const { wrapper } = await setup({ profile: 'inline' })
    const labels = wrapper.getComponent(GinkoToolbar).findAll('button[aria-label]').map(button => button.attributes('aria-label'))
    expect(labels).toEqual(['Undo', 'Redo', 'Bold', 'Italic', 'Link'])
    expect(wrapper.find('.ginko-editor__insert-trigger').exists()).toBe(false)
    expect(wrapper.get('.ginko-editor').attributes('data-profile')).toBe('inline')
  })

  it('shows no formatting controls for plain text and ignores formatting shortcuts', async () => {
    const { wrapper, editor } = await setup({ profile: 'plain' })
    const labels = wrapper.getComponent(GinkoToolbar).findAll('button[aria-label]').map(button => button.attributes('aria-label'))
    expect(labels).toEqual(['Undo', 'Redo'])
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const bold = modKey('b')
    editor.view.dom.dispatchEvent(bold)
    await flushPromises()
    expect(bold.defaultPrevented).toBe(true)
    expect(findProfileViolations(editor.state.doc, 'plain')).toEqual([])
  })

  it('applies allowed shortcuts and blocks structural shortcuts outside the profile', async () => {
    const { editor } = await setup({ profile: 'inline' })
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.view.dom.dispatchEvent(modKey('b'))
    await flushPromises()
    expect(editor.isActive('bold')).toBe(true)
    editor.view.dom.dispatchEvent(modKey('s', { shiftKey: true }))
    await flushPromises()
    expect(editor.isActive('strike')).toBe(false)
    // TipTap's own block shortcuts and commands cannot bypass the profile either.
    expect(editor.commands.toggleHeading({ level: 2 })).toBe(false)
    editor.view.dispatch(editor.state.tr.setBlockType(1, 1, editor.schema.nodes.heading!, { level: 2 }))
    editor.commands.toggleBulletList()
    editor.view.dom.dispatchEvent(modKey('8', { shiftKey: true }))
    expect(editor.getJSON().content?.map(node => node.type)).toEqual(['paragraph'])
  })

  it('keeps Markdown input rules out of inline text but allows allowed marks', async () => {
    const { editor } = await setup({ profile: 'inline', modelValue: '' })
    editor.commands.focus('end')
    type(editor, '## Title')
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'paragraph', content: [{ text: '## Title' }] })
    editor.commands.setContent('')
    type(editor, '- item **strong** ')
    const json = editor.getJSON().content
    expect(json).toHaveLength(1)
    expect(json?.[0]?.type).toBe('paragraph')
    expect(markedText(editor, 'bold')).toBe('strong')
  })

  it('keeps article input rules and moves the typed heading to an allowed level', async () => {
    const { editor } = await setup({ profile: 'article', modelValue: '' })
    editor.commands.focus('end')
    type(editor, '## Section')
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    editor.commands.setContent('')
    type(editor, '# Big')
    expect(findProfileViolations(editor.state.doc, 'article')).toEqual([])
  })

  it('reduces pasted HTML tables and headings to inline text with allowed marks', async () => {
    const { editor } = await setup({ profile: 'inline', modelValue: 'Start' })
    editor.commands.focus('end')
    editor.view.pasteHTML('<h1>Menu <em>today</em></h1><table><tr><td><strong>Soup</strong></td><td><s>7 €</s></td></tr></table>')
    expect(findProfileViolations(editor.state.doc, 'inline')).toEqual([])
    expect(editor.getText({ blockSeparator: '\n' })).toBe('StartMenu today\nSoup\n7 €')
    expect(markedText(editor, 'italic')).toBe('today')
  })

  it('reduces pasted Markdown to the profile before it is inserted', async () => {
    const { wrapper, editor } = await setup({ profile: 'inline', modelValue: 'Intro' })
    editor.commands.focus('end')
    pasteMarkdown(editor, '## Heading\n\n| A | B |\n| --- | --- |\n| **x** | ~~y~~ |')
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(findProfileViolations(editor.state.doc, 'inline')).toEqual([])
    expect(editor.getText({ blockSeparator: '\n' })).toContain('IntroHeading')
    expect(editor.getText()).toContain('x')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('keeps loaded content outside the profile and still allows editing around it', async () => {
    const { editor } = await setup({ profile: 'inline', modelValue: '# Legacy title\n\nBody' })
    expect(editor.getJSON().content?.[0]?.type).toBe('heading')
    editor.commands.focus('end')
    type(editor, '!')
    expect(editor.getText()).toContain('Body!')
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
    editor.commands.deleteSelection()
    editor.commands.undo()
    expect(editor.getJSON().content?.[0]?.type).toBe('heading')
  })

  it('limits the slash menu to article blocks and turns it off for inline text', async () => {
    const article = await setup({ profile: 'article', modelValue: '' })
    await article.wrapper.get('button[aria-label="Insert block"]').trigger('click')
    const options = article.wrapper.findAll('[role="option"]').map(option => option.text())
    expect(options.some(text => text.includes('Heading 2'))).toBe(true)
    expect(options.some(text => text.includes('Heading 1'))).toBe(false)
    expect(options.some(text => /Table|Code block/.test(text))).toBe(false)

    const inline = await setup({ profile: 'inline', modelValue: '' })
    inline.editor.view.dispatch(inline.editor.state.tr.insertText('/head'))
    await flushPromises()
    expect(inline.wrapper.find('[role="listbox"]').exists()).toBe(false)
  })
})

describe('inline variant', () => {
  it('drops the frame, header, and source switch', async () => {
    const { wrapper } = await setup({ variant: 'inline' })
    expect(wrapper.get('.ginko-editor').attributes('data-variant')).toBe('inline')
    expect(wrapper.find('.ginko-editor__header').exists()).toBe(false)
    expect(wrapper.find('.ginko-editor__modes').exists()).toBe(false)
    expect(wrapper.findComponent(GinkoToolbar).exists()).toBe(true) // inside the selection toolbar
    expect(wrapper.find('.ginko-editor > .ginko-toolbar').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('lets hosts show the header without the source switch', async () => {
    const { wrapper } = await setup({ header: true, sourceToggle: false })
    expect(wrapper.find('.ginko-editor__header').exists()).toBe(true)
    expect(wrapper.find('.ginko-editor__modes').exists()).toBe(false)
  })

  it('turns the selection toolbar off on touch devices and docks the formatting row instead', async () => {
    stubTouch(true)
    const { wrapper, editor } = await setup({ variant: 'inline', profile: 'inline' })
    expect(wrapper.findComponent(GinkoSelectionToolbar).exists()).toBe(false)
    const dock = wrapper.getComponent(GinkoKeyboardDock)
    expect(dock.props('visible')).toBe(false)
    editor.commands.focus()
    editor.view.dom.dispatchEvent(new FocusEvent('focus'))
    await flushPromises()
    expect(dock.props('visible')).toBe(true)
    expect(teleportedLabels('.ginko-keyboard-dock')).toEqual(['Undo', 'Redo', 'Bold', 'Italic', 'Link'])
  })

  it('keeps the selection toolbar on precise pointers and allows turning it off or configuring it', async () => {
    stubTouch(false)
    const shown = await setup({ variant: 'inline', selectionToolbarItems: [[{ kind: 'mark', mark: 'bold' }]] })
    expect(shown.wrapper.findComponent(GinkoKeyboardDock).exists()).toBe(false)
    expect(shown.wrapper.findComponent(GinkoSelectionToolbar).exists()).toBe(true)
    expect(teleportedLabels('.ginko-selection-toolbar')).toEqual(['Bold'])
    const hidden = await setup({ selectionToolbar: false })
    expect(hidden.wrapper.findComponent(GinkoSelectionToolbar).exists()).toBe(false)
  })

  it('uses the German message set', async () => {
    const { wrapper } = await setup({ messages: germanMessages, profile: 'inline' })
    const labels = wrapper.getComponent(GinkoToolbar).findAll('button[aria-label]').map(button => button.attributes('aria-label'))
    expect(labels).toEqual(['Rückgängig', 'Wiederholen', 'Fett', 'Kursiv', 'Link'])
  })
})
