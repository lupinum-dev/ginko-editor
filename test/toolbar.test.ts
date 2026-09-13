// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import GinkoToolbar from '../src/ui/GinkoToolbar.vue'
import * as conversion from '../src/lib/conversionPipeline'
import { captureBlock, performBlockAction } from '../src/lib/editor-operations'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })
async function setup(source = 'Hello world') {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: source, syncDebounceMs: 10000, enableImages: true, enableFiles: true, enableVideo: true } })
  wrappers.push(wrapper); await flushPromises()
  return { wrapper, editor: wrapper.vm.editor!, toolbar: wrapper.getComponent(GinkoToolbar) }
}

async function settle() { await flushPromises(); await new Promise(resolve => setTimeout(resolve, 10)); await flushPromises() }

const modKey = (key: string, options: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, [/Mac|iPhone|iPad/.test(navigator.platform) ? 'metaKey' : 'ctrlKey']: true, ...options })

describe('writing toolbar', () => {
  it('keeps selected text and exposes active formatting and undo/redo', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 }); await settle()
    const bold = toolbar.get('button[aria-label="Bold"]')
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); bold.element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await bold.trigger('click'); await settle()
    expect(editor.getJSON().content?.[0].content).toMatchObject([{ text: 'Hello', marks: [{ type: 'bold' }] }, { text: ' world' }])
    expect(bold.attributes('aria-pressed')).toBe('true')
    await toolbar.get('button[aria-label="Undo"]').trigger('click'); await settle()
    expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined()
    await toolbar.get('button[aria-label="Redo"]').trigger('click'); await settle()
    expect(editor.getJSON().content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }])
  })

  it('sets marks for subsequent typing at an empty caret', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection(6)
    await toolbar.get('button[aria-label="Bold"]').trigger('click'); await settle()
    expect(editor.state.storedMarks?.map(mark => mark.type.name)).toContain('bold')
    editor.view.dispatch(editor.state.tr.insertText('!'))
    expect(editor.getJSON().content?.[0].content).toMatchObject([{ text: 'Hello' }, { text: '!', marks: [{ type: 'bold' }] }, { text: ' world' }])
  })

  it('honors configured table sizes and keeps repeated picker instances separate', async () => {
    const { wrapper, toolbar } = await setup()
    await wrapper.setProps({ toolbarItems: [[{ kind: 'table', rows: 2, columns: 4 }, { kind: 'table', rows: 5, columns: 1 }]] })
    const buttons = toolbar.findAll('button[aria-label="Insert table"]')
    await buttons[0].trigger('click'); await settle()
    expect(wrapper.findAll('form')).toHaveLength(1)
    expect(wrapper.findAll('input[type="number"]').map(input => (input.element as HTMLInputElement).value)).toEqual(['2', '4'])
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' }); await settle()
    await buttons[1].trigger('click'); await settle()
    expect(wrapper.findAll('form')).toHaveLength(1)
    expect(wrapper.findAll('input[type="number"]').map(input => (input.element as HTMLInputElement).value)).toEqual(['5', '1'])
  })

  it('flushes a formatting operation started immediately before closing', async () => {
    const { wrapper, editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    toolbar.get('button[aria-label="Bold"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const result = await wrapper.vm.flush()
    expect(result.ok).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('**Hello** world\n')
  })

  it('prioritizes explicit shortcut overrides over conflicting defaults', async () => {
    const { wrapper, editor, toolbar } = await setup()
    await wrapper.setProps({ shortcuts: { italic: 'Mod-b' } })
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const event = modKey('b')
    editor.view.dom.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect((await wrapper.vm.flush()).ok).toBe(true)
    expect(editor.getJSON().content?.[0].content?.[0].marks).toEqual([{ type: 'italic' }])
    expect(toolbar.get('button[aria-label="Italic"]').attributes('title')).toContain(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘B' : 'Ctrl+B')
    const previous = editor.state.doc
    editor.view.dom.dispatchEvent(modKey('i'))
    await settle()
    expect(editor.state.doc).toBe(previous)
  })

  it('disables native mark shortcuts and runs their custom replacement', async () => {
    const { wrapper, editor } = await setup()
    await wrapper.setProps({ shortcuts: { bold: false } })
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const before = editor.state.doc, disabled = modKey('b')
    editor.view.dom.dispatchEvent(disabled)
    await settle()
    expect(disabled.defaultPrevented).toBe(true)
    expect(editor.state.doc).toBe(before)
    await wrapper.setProps({ shortcuts: { bold: 'Alt-b' } })
    editor.view.dom.dispatchEvent(modKey('b')); await settle()
    expect(editor.state.doc).toBe(before)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', altKey: true, bubbles: true, cancelable: true }))
    await wrapper.vm.flush()
    expect(editor.getJSON().content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }])
  })

  it('honors disabled and remapped history shortcuts including native aliases', async () => {
    const { wrapper, editor } = await setup()
    editor.commands.insertContent('Changed')
    const changed = editor.state.doc
    await wrapper.setProps({ shortcuts: { undo: false, redo: false } })
    for (const event of [modKey('z'), modKey('я')]) {
      editor.view.dom.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(editor.state.doc).toBe(changed)
    }
    editor.commands.undo()
    const restored = editor.state.doc
    for (const event of [modKey('z', { shiftKey: true }), modKey('y'), modKey('я', { shiftKey: true })]) {
      editor.view.dom.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(editor.state.doc).toBe(restored)
    }
    await wrapper.setProps({ shortcuts: { redo: 'Alt-r' } })
    editor.view.dom.dispatchEvent(modKey('y'))
    expect(editor.state.doc).toBe(restored)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true, cancelable: true }))
    expect(editor.state.doc.eq(changed)).toBe(true)
  })

  it('shows pending validation and keeps immediate flush waiting until the accepted edit is emitted', async () => {
    const { wrapper, editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const convert = conversion.convertTiptapDocToMarkdown
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementationOnce(async (...args) => { await gate; return convert(...args) })
    toolbar.get('button[aria-label="Bold"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    let finished = false
    const flushing = wrapper.vm.flush().then(result => { finished = true; return result })
    await flushPromises()
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    expect(toolbar.get('button[aria-label="Bold"]').attributes('aria-busy')).toBe('true')
    expect(toolbar.get('button[aria-label="Italic"]').attributes('disabled')).toBeDefined()
    expect(finished).toBe(false)
    release()
    expect((await flushing).ok).toBe(true)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('**Hello** world\n')
    expect(wrapper.vm.hasPendingChanges()).toBe(false)
    expect(toolbar.get('button[aria-label="Bold"]').attributes('aria-busy')).toBeUndefined()
  })

  it('keeps saving open for a node-view operation started during source conversion', async () => {
    const { wrapper, editor } = await setup('First\n\nSecond')
    editor.commands.insertContent('Edited ')
    const convert = conversion.convertTiptapDocToMarkdown
    let releaseSource!: () => void, releaseDuplicate!: () => void
    const sourceGate = new Promise<void>(resolve => { releaseSource = resolve })
    const duplicateGate = new Promise<void>(resolve => { releaseDuplicate = resolve })
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown')
      .mockImplementationOnce(async (...args) => { await sourceGate; return convert(...args) })
      .mockImplementationOnce(async (...args) => { await duplicateGate; return convert(...args) })
    let finished = false
    const saving = wrapper.vm.flush().then(result => { finished = true; return result })
    await flushPromises()
    // Node views invoke the same operation without a root-specific callback.
    const duplicating = performBlockAction(editor, captureBlock(editor, 0)!, 'duplicate')
    releaseSource(); await flushPromises()
    expect(finished).toBe(false)
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    releaseDuplicate()
    expect(await duplicating).toEqual({ ok: true })
    expect((await saving).ok).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('Edited First\n\nEdited First\n\nSecond\n')
    expect(wrapper.vm.hasPendingChanges()).toBe(false)
  })

  it('owns its themed popup and cleanup when the exported toolbar is mounted independently', async () => {
    const { editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const standalone = mount(GinkoToolbar, { attachTo: document.body, props: { actions: toolbar.props('actions'), items: [[{ kind: 'link' }]] }, attrs: { style: '--accent: rgb(12, 34, 56); font-family: serif' } })
    let portal: Element | null
    try {
      await standalone.get('button[aria-label="Link"]').trigger('click'); await settle()
      portal = standalone.element.querySelector('.ginko-overlay')
      expect(portal).not.toBeNull()
      expect((portal as HTMLElement).style.getPropertyValue('--accent')).toBe('rgb(12, 34, 56)')
      expect(standalone.findAll('[role="dialog"]')).toHaveLength(1)
      await standalone.get('input').setValue('/standalone')
      await standalone.get('form').trigger('submit'); await settle()
      expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ text: 'Hello', marks: [{ type: 'link', attrs: { href: '/standalone' } }] })
    } finally { standalone.unmount(); await flushPromises() }
    expect(portal?.isConnected).toBe(false)
    expect(editor.isDestroyed).toBe(false)
  })

  it('offers every heading level and restores focus on Escape', async () => {
    const { wrapper, editor, toolbar } = await setup()
    const trigger = toolbar.get('button[aria-label="Text style"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' }); await settle()
    const menu = wrapper.get('[role="menu"]')
    expect(menu.findAll('[role="menuitem"]')).toHaveLength(7)
    await menu.findAll('[role="menuitem"]').at(-1)!.trigger('click'); await settle()
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 6 } })
    await trigger.trigger('keydown', { key: 'ArrowDown' }); await settle()
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' }); await settle()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('changes lists without losing text', async () => {
    const { wrapper, editor, toolbar } = await setup()
    await toolbar.get('button[aria-label="Lists"]').trigger('keydown', { key: 'ArrowDown' }); await settle()
    await wrapper.get('[role="menuitem"]').trigger('click'); await settle()
    expect(editor.isActive('bulletList')).toBe(true)
    await toolbar.get('button[aria-label="Lists"]').trigger('keydown', { key: 'ArrowDown' }); await settle()
    await wrapper.findAll('[role="menuitem"]')[1].trigger('click'); await settle()
    expect(editor.isActive('orderedList')).toBe(true)
    expect(editor.getText().trim()).toBe('Hello world')
  })

  it('adds, updates and removes a link on the original selection', async () => {
    const { wrapper, editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    await toolbar.get('button[aria-label="Link"]').trigger('click'); await settle()
    const input = wrapper.get('input[aria-label="Link address"]')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('https://example.com/first')
    await wrapper.get('form').trigger('submit'); await settle()
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ text: 'Hello', marks: [{ type: 'link', attrs: { href: 'https://example.com/first' } }] })
    editor.commands.setTextSelection(3)
    await toolbar.get('button[aria-label="Link"]').trigger('click'); await settle()
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('https://example.com/first')
    await wrapper.get('input').setValue('/second'); await wrapper.get('form').trigger('submit'); await settle()
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ marks: [{ type: 'link', attrs: { href: '/second' } }] })
    await toolbar.get('button[aria-label="Link"]').trigger('click'); await settle()
    await wrapper.findAll('button').find(button => button.text() === 'Remove link')!.trigger('click'); await settle()
    expect(editor.getText().trim()).toBe('Hello world')
    expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined()
  })

  it('rejects unsafe links and cancels stale selection targets', async () => {
    const { wrapper, editor, toolbar } = await setup()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const before = editor.state.doc
    await toolbar.get('button[aria-label="Link"]').trigger('click'); await settle()
    await wrapper.get('input').setValue('javascript:alert(1)'); await wrapper.get('form').trigger('submit'); await settle()
    expect(wrapper.get('[role="alert"]').text()).toBe('Enter a valid link.')
    expect(editor.state.doc).toBe(before)
    editor.commands.setTextSelection(1); await settle()
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('inserts a URL at an empty caret', async () => {
    const { wrapper, editor, toolbar } = await setup()
    editor.commands.setTextSelection(6)
    await toolbar.get('button[aria-label="Link"]').trigger('click'); await settle()
    await wrapper.get('input').setValue('https://example.com'); await wrapper.get('form').trigger('submit'); await settle()
    expect(editor.getText()).toBe('Hellohttps://example.com world')
  })

  it('inserts a table with the requested size and one header row', async () => {
    const { wrapper, editor, toolbar } = await setup()
    await toolbar.get('button[aria-label="Insert table"]').trigger('click'); await settle()
    const dimensions = wrapper.findAll('input[type="number"]')
    await dimensions[0].setValue(4); await dimensions[1].setValue(2)
    await wrapper.get('form').trigger('submit'); await settle()
    const table = editor.state.doc.content.content.find(node => node.type.name === 'table')
    expect(table?.childCount).toBe(4)
    expect(table?.child(0).content.content.map(cell => cell.type.name)).toEqual(['tableHeader', 'tableHeader'])
    expect(table?.child(1).content.content.map(cell => cell.type.name)).toEqual(['tableCell', 'tableCell'])
    editor.commands.undo(); expect(editor.getJSON().content?.some(node => node.type === 'table')).toBe(false)
  })

  it('uses host events, configurable groups and translated labels without unsupported marks', async () => {
    const { wrapper, toolbar } = await setup()
    await toolbar.get('button[aria-label="Add image"]').trigger('click'); await settle()
    expect(wrapper.emitted('request-image')).toHaveLength(1)
    await wrapper.setProps({ toolbarItems: [[{ kind: 'mark', mark: 'bold' }, { kind: 'file' }]], messages: { bold: 'Fett' } })
    expect(toolbar.find('button[aria-label="Fett"]').exists()).toBe(true)
    await toolbar.get('button[aria-label="Add file"]').trigger('click'); await settle()
    expect(wrapper.emitted('request-file')).toHaveLength(1)
    expect(toolbar.find('[aria-label="Underline"]').exists()).toBe(false)
    await wrapper.setProps({ disabled: true })
    expect(wrapper.findComponent(GinkoToolbar).exists()).toBe(false)
  })
})
