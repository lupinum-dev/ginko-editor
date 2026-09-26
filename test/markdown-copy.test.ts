// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { AllSelection, NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import * as conversion from '../src/lib/conversionPipeline'
import { isProbablyMarkdown } from '../src/lib/extensions/markdown-clipboard'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup(source: string) {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: source, syncDebounceMs: 10000 } })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.vm.getEditor()).toBeDefined()
  return wrapper
}
function copy(
  wrapper: Awaited<ReturnType<typeof setup>>,
  type = 'copy',
  target: Element = wrapper.vm.getEditor()!.view.dom,
) {
  const data = new Map<string, string>()
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { setData: (flavor: string, value: string) => data.set(flavor, value) },
  })
  target.dispatchEvent(event)
  return { data, event }
}
function asyncClipboard() {
  let representations: Record<string, Promise<Blob>> | undefined
  const items: Record<string, Promise<Blob>>[] = []
  class TestItem {
    constructor(data: Record<string, Promise<Blob>>) { representations = data; items.push(data) }
    static supports(type: string) { return type === 'text/plain' }
  }
  const write = vi.fn(async () => { await Promise.all(Object.values(representations ?? {})) })
  vi.stubGlobal('ClipboardItem', TestItem)
  vi.stubGlobal('navigator', { clipboard: { write } })
  return { write, items, data: () => representations }
}
function blobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

describe('canonical Markdown clipboard', () => {
  it('keeps canonical copy and cut working when plugins mount and unmount', async () => {
    const wrapper = await setup('Keep **formatting**')
    const editor = wrapper.vm.getEditor()!
    const key = new PluginKey('clipboard-lifecycle-test')
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    editor.registerPlugin(new Plugin({ key }))
    await flushPromises()
    expect(copy(wrapper).data.get('text/plain')?.trim()).toBe('Keep **formatting**')
    editor.unregisterPlugin(key)
    await flushPromises()
    expect(copy(wrapper, 'cut').data.get('text/plain')?.trim()).toBe('Keep **formatting**')
    expect(editor.getText()).toBe('')
  })

  it('cancels old pending cuts while a recreated plugin view supports new copies', async () => {
    const wrapper = await setup('Keep **this**')
    const editor = wrapper.vm.getEditor()!
    const clipboard = asyncClipboard()
    const original = conversion.convertTiptapDocToMarkdown
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementationOnce(async (...args) => {
      await gate
      return original(...args)
    })
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    copy(wrapper, 'cut')
    editor.registerPlugin(new Plugin({ key: new PluginKey('pending-clipboard-lifecycle-test') }))
    await flushPromises()
    expect(copy(wrapper).data.get('text/plain')?.trim()).toBe('Keep **this**')
    release()
    await expect(clipboard.items[0]['text/plain']).rejects.toThrow('superseded')
    await flushPromises()
    expect(editor.getText()).toBe('Keep this')
    expect(wrapper.text()).not.toContain('could not be copied as Markdown')
  })

  it('copies formatted selection as raw Markdown in both text flavors', async () => {
    const wrapper = await setup('Before **important** after.')
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 8, 17)))
    await flushPromises()
    const { data, event } = copy(wrapper)
    expect(event.defaultPrevented).toBe(true)
    expect(data.get('text/plain')?.trim()).toBe('**important**')
    expect(data.get('text/markdown')).toBe(data.get('text/plain'))
    expect(data.has('text/html')).toBe(false)
  })

  it('copies the component contract and pastes plain-text Markdown back into structure', async () => {
    const wrapper = await setup('<info title="Remember">\nA **useful** detail.\n</info>')
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    await flushPromises()
    const source = copy(wrapper).data.get('text/plain')!
    expect(source).toContain('info')
    expect(source).toContain('title="Remember"')
    expect(source).toContain('**useful**')
    const target = await setup('')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        types: ['text/plain'],
        getData: (type: string) => (type === 'text/plain' ? source : ''),
      },
    })
    target.vm.getEditor()!.view.dom.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(target.vm.getEditor()!.getJSON().content?.[0]).toMatchObject({
      type: 'element',
      attrs: { tag: 'info', props: { title: 'Remember' } },
    })
    expect(target.vm.getEditor()!.getText()).toContain('A useful detail.')
  })

  it('serializes a rectangular table selection with its table wrapper', async () => {
    const wrapper = await setup('| A | B |\n| --- | ---: |\n| C | D |')
    const editor = wrapper.vm.getEditor()!
    const cells: number[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') cells.push(pos)
    })
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[1], cells[3])))
    await flushPromises()
    const source = copy(wrapper).data.get('text/plain')!
    expect(source).toMatch(/\| B\s+\|/)
    expect(source).toMatch(/\| D\s+\|/)
    expect(source).toMatch(/\| -+: \|/)
    expect(source).not.toContain('| A |')
  })

  it('starts an activation-safe asynchronous copy before serialization finishes', async () => {
    const wrapper = await setup('A **new** selection')
    const clipboard = asyncClipboard()
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    const { data, event } = copy(wrapper)
    expect(event.defaultPrevented).toBe(true)
    expect(clipboard.write).toHaveBeenCalledTimes(1)
    expect(data.size).toBe(0)
    await flushPromises()
    expect(await blobText(await clipboard.data()!['text/plain'])).toContain('**new**')
  })

  it('invalidates cached text when the selection changes', async () => {
    const wrapper = await setup('First and second')
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 6)))
    await flushPromises()
    expect(copy(wrapper).data.get('text/plain')?.trim()).toBe('First')
    const clipboard = asyncClipboard()
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 11, 17)))
    expect(copy(wrapper).data.size).toBe(0)
    await flushPromises()
    expect(await blobText(await clipboard.data()!['text/plain'])).toBe('second\n')
  })

  it('leaves native input selection copying alone', async () => {
    const wrapper = await setup('Document body')
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    await flushPromises()
    const input = document.createElement('input')
    input.value = 'Native title'
    editor.view.dom.append(input)
    const { event, data } = copy(wrapper, 'copy', input)
    expect(event.defaultPrevented).toBe(false)
    expect(data.size).toBe(0)
    input.remove()
  })

  it('deletes a cut selection only after its async clipboard write succeeds', async () => {
    const wrapper = await setup('Keep until copied')
    const clipboard = asyncClipboard()
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    copy(wrapper, 'cut')
    expect(editor.getText()).toBe('Keep until copied')
    await flushPromises()
    expect(clipboard.write).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('')
  })

  it('does not cut a document changed while copying', async () => {
    const wrapper = await setup('Keep me')
    asyncClipboard()
    const original = conversion.convertTiptapDocToMarkdown
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementation(async (...args) => {
      await gate
      return original(...args)
    })
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    copy(wrapper, 'cut')
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)))
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    release()
    await flushPromises()
    expect(editor.getText()).toBe('Keep me')
  })

  it('rejects an older pending write when a later copy supersedes it', async () => {
    const wrapper = await setup('First and second')
    const editor = wrapper.vm.getEditor()!
    const clipboard = asyncClipboard()
    const original = conversion.convertTiptapDocToMarkdown
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementationOnce(async (...args) => {
      await gate
      return original(...args)
    })
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 6)))
    copy(wrapper)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 11, 17)))
    copy(wrapper)
    await flushPromises()
    expect(clipboard.write).toHaveBeenCalledTimes(2)
    expect(await blobText(await clipboard.items[1]['text/plain'])).toBe('second\n')
    release()
    await expect(clipboard.items[0]['text/plain']).rejects.toThrow('superseded')
    await flushPromises()
    expect(wrapper.text()).not.toContain('could not be copied as Markdown')
  })

  it('reports an unavailable immediate copy and never falls back to stale text', async () => {
    const wrapper = await setup('First and second')
    const editor = wrapper.vm.getEditor()!
    vi.stubGlobal('ClipboardItem', undefined)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 6)))
    await flushPromises()
    expect(copy(wrapper).data.get('text/plain')?.trim()).toBe('First')
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 11, 17)))
    const result = copy(wrapper, 'cut')
    expect(result.event.defaultPrevented).toBe(true)
    expect(result.data.size).toBe(0)
    await flushPromises()
    expect(wrapper.text()).toContain('could not be copied as Markdown')
    expect(editor.getText()).toBe('First and second')
  })

  it('invalidates cached serialization when output options change without a transaction', async () => {
    const wrapper = await setup('<file src="/guide.pdf" title="Guide" />')
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    await flushPromises()
    expect(copy(wrapper).data.get('text/plain')).toContain('file')
    const before = editor.state
    await wrapper.setProps({ fileOutput: 'markdown' })
    expect(editor.state.doc).toBe(before.doc)
    expect(editor.state.selection.eq(before.selection)).toBe(true)
    const clipboard = asyncClipboard()
    const result = copy(wrapper)
    await flushPromises()
    const markdown = result.data.get('text/plain') ?? await blobText(await clipboard.data()!['text/plain'])
    expect(markdown).toContain('[Guide](/guide.pdf')
    expect(markdown).not.toContain('<file')
  })

  it('reports conversion failure and preserves the cut document', async () => {
    const wrapper = await setup('Keep this document')
    const editor = wrapper.vm.getEditor()!
    asyncClipboard()
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockRejectedValue(new Error('Controlled serialization failure'))
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    copy(wrapper, 'cut')
    await flushPromises()
    await flushPromises()
    expect(wrapper.text()).toContain('could not be copied as Markdown')
    expect(editor.getText()).toBe('Keep this document')
  })

  it.each([
    '<info title="Hello">\nBody\n</info>',
    '::note{title="Hello"}\nBody\n::',
    '**bold**',
    '_italic_',
    '~~deleted~~',
    '`code`',
    ':kbd[Ctrl]',
  ])('recognizes raw source from an external plain-text clipboard: %s', source => {
    expect(isProbablyMarkdown(source)).toBe(true)
  })
})
