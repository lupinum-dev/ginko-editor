// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import GinkoToolbar from '../src/ui/GinkoToolbar.vue'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
async function setup(source = 'Hello world') {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: source, syncDebounceMs: 10000, enableImages: true, enableFiles: true, enableVideo: true } })
  wrappers.push(wrapper); await flushPromises()
  return { wrapper, editor: wrapper.vm.editor!, toolbar: wrapper.getComponent(GinkoToolbar) }
}

describe('writing toolbar', () => {
  it('keeps the selected text while applying a mark and exposes undo and redo state', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 }); await flushPromises()
    const bold = toolbar.get('button[aria-label="Bold"]')
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    bold.element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await bold.trigger('click'); await flushPromises()
    expect(editor.getJSON().content?.[0].content).toMatchObject([{ text: 'Hello', marks: [{ type: 'bold' }] }, { text: ' world' }])
    expect(bold.attributes('aria-pressed')).toBe('true')
    expect(toolbar.get('button[aria-label="Undo"]').attributes('disabled')).toBeUndefined()
    await toolbar.get('button[aria-label="Undo"]').trigger('click')
    expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined()
    await toolbar.get('button[aria-label="Redo"]').trigger('click')
    expect(editor.getJSON().content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }])
  })

  it('offers every supported heading level with arrow navigation and Escape focus restoration', async () => {
    const { editor, toolbar } = await setup()
    const trigger = toolbar.get('button[aria-label="Text style"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('Normal text')
    const menu = toolbar.get('[role="menu"]')
    expect(menu.findAll('[role="menuitemradio"]')).toHaveLength(7)
    await menu.trigger('keydown', { key: 'End' })
    expect(document.activeElement?.textContent).toContain('Heading 6')
    ;(document.activeElement as HTMLButtonElement).click(); await flushPromises()
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 6 } })
    await trigger.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('Heading 6')
    await toolbar.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(toolbar.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('switches between bullet and numbered lists without losing list text', async () => {
    const { editor, toolbar } = await setup()
    await toolbar.get('button[aria-label="Lists"]').trigger('click')
    await toolbar.get('[role="menuitemradio"]').trigger('click')
    expect(editor.isActive('bulletList')).toBe(true)
    await toolbar.get('button[aria-label="Lists"]').trigger('click')
    await toolbar.findAll('[role="menuitemradio"]')[1].trigger('click')
    expect(editor.isActive('orderedList')).toBe(true)
    expect(editor.getText().trim()).toBe('Hello world')
  })

  it('adds, updates and removes a link on the original selected text', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    expect(document.activeElement).toBe(toolbar.get('input').element)
    await toolbar.get('input').setValue('https://example.com/first')
    await toolbar.get('form').trigger('submit'); await flushPromises()
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ text: 'Hello', marks: [{ type: 'link', attrs: { href: 'https://example.com/first' } }] })
    editor.commands.setTextSelection(3)
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    expect((toolbar.get('input').element as HTMLInputElement).value).toBe('https://example.com/first')
    await toolbar.get('input').setValue('/second')
    await toolbar.get('form').trigger('submit'); await flushPromises()
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ text: 'Hello', marks: [{ type: 'link', attrs: { href: '/second' } }] })
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    await toolbar.findAll('button').find(button => button.text() === 'Remove link')!.trigger('click')
    expect(editor.getText().trim()).toBe('Hello world')
    expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined()
  })

  it('rejects unsafe destinations and lets Escape cancel without changing the document', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const before = editor.state.doc
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    await toolbar.get('input').setValue('javascript:alert(1)')
    await toolbar.get('form').trigger('submit')
    expect(toolbar.get('[role="alert"]').text()).toBe('Enter a valid link.')
    expect(editor.state.doc).toBe(before)
    await toolbar.get('input').trigger('keydown', { key: 'Escape' })
    expect(toolbar.find('form').exists()).toBe(false)
    expect(document.activeElement).toBe(toolbar.get('button[aria-label="Link"]').element)
  })

  it('inserts a URL at an empty caret and cancels an open link editor if its selection changes', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection(6)
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    await toolbar.get('input').setValue('https://example.com')
    await toolbar.get('form').trigger('submit'); await flushPromises()
    expect(editor.getText()).toBe('Hellohttps://example.com world')
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    editor.commands.setTextSelection(1); await flushPromises()
    expect(toolbar.find('form').exists()).toBe(false)
  })

  it('keeps host media events accessible and does not offer unsupported formatting', async () => {
    const { wrapper, toolbar } = await setup()
    for (const kind of ['image', 'file', 'video']) {
      await toolbar.get(`button[aria-label="Add ${kind}"]`).trigger('click')
      expect(toolbar.emitted(`request-${kind}`)).toHaveLength(1)
    }
    expect(toolbar.find('[aria-label="Underline"]').exists()).toBe(false)
    expect(toolbar.find('[aria-label="Highlight"]').exists()).toBe(false)
    await wrapper.setProps({ enableImages: false, enableFiles: false, enableVideo: false })
    expect(toolbar.find('[aria-label="Insert media"]').exists()).toBe(false)
  })

  it('dismisses menus on Tab and outside interaction, and closes editing controls when read-only', async () => {
    const { editor, toolbar } = await setup()
    const trigger = toolbar.get('button[aria-label="Lists"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await toolbar.get('[role="menu"]').trigger('keydown', { key: 'Tab' })
    expect(toolbar.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(toolbar.find('[role="menu"]').exists()).toBe(false)
    await toolbar.get('button[aria-label="Link"]').trigger('click')
    editor.setEditable(false); await flushPromises()
    expect(toolbar.find('form').exists()).toBe(false)
    expect(toolbar.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
  })
})
