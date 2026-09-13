// @vitest-environment jsdom
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { Element as ComponentNode } from '../src/lib/extensions/element'
import { Slot } from '../src/lib/extensions/slot'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { NodeSelection } from '@tiptap/pm/state'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoBlockControls from '../src/ui/GinkoBlockControls.vue'
import GinkoEditor from '../src/GinkoEditor.vue'
import { blockKeyboardIntent, blockDestinations, blockDropTarget } from '../src/ui/block-controls'
import { captureBlock } from '../src/lib/block-movement'
import { defaultMessages, type EditorActions } from '../src/ui/commands'
import { createEditorOverlayController, editorOverlayKey } from '../src/ui/context'
import type { EditorMessages } from '../src/ui/messages'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
  HTMLElement.prototype.scrollIntoView ??= () => {}
})
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(run => run()); vi.restoreAllMocks() })
const actions: EditorActions = { text: key => defaultMessages[key], get: () => { throw new Error('Not used by block controls') }, capture: () => actions, isCurrent: () => true }
async function setup(content = '<p>First</p><p>Second</p><p>Third</p>', messages?: EditorMessages) {
  const root = document.body.appendChild(document.createElement('div'))
  const element = root.appendChild(document.createElement('div'))
  const editor = new Editor({ element, extensions: [StarterKit, Table, TableRow, TableCell, TableHeader, ComponentNode, Slot], content })
  const overlay = createEditorOverlayController({ getContainer: () => root, getMessages: () => messages })
  const wrapper = mount(GinkoBlockControls, { attachTo: root, props: { editor, actions, context: {} }, global: { provide: { [editorOverlayKey as symbol]: overlay } } })
  await flushPromises()
  cleanup.push(() => { wrapper.unmount(); editor.destroy(); root.remove() })
  return { editor, wrapper, root }
}
const key = (value: string, options: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })
function modKey(value: string, options: KeyboardEventInit = {}) { return key(value, { [/Mac|iPhone|iPad/.test(navigator.platform) ? 'metaKey' : 'ctrlKey']: true, ...options }) }

describe('block controls', () => {
  it('routes direct image dragging through guarded movement and preserves source on cancellation', async () => {
    const root = document.body.appendChild(document.createElement('div'))
    const wrapper = mount(GinkoEditor, { attachTo: root, props: { modelValue: '![Image](/image.png)\n\nKeep text' } })
    cleanup.push(() => { wrapper.unmount(); root.remove() })
    await flushPromises()
    const editor = wrapper.vm.editor!, before = editor.state.doc
    const transfer = { setData: vi.fn(), effectAllowed: '' }
    const event = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    wrapper.get('.ProseMirror img').element.dispatchEvent(event)
    expect(transfer.setData).toHaveBeenCalledWith('application/x-ginko-block', 'internal')
    expect(editor.view.dragging).toBeNull()
    document.dispatchEvent(key('Escape'))
    document.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    expect(editor.state.doc).toBe(before)
  })
  it('translates native block labels, destinations and move announcements without changing content', async () => {
    const { editor, wrapper, root } = await setup('<p>Original content</p><h2>Target heading</h2>', {
      blockActions: 'Blockaktionen', paragraph: 'Absatz', headingLevel: 'Überschrift {level}',
      moveTo: 'Verschieben nach…', findDestination: 'Ziel suchen', noDestinations: 'Keine Ziele verfügbar.',
      after: 'Nach', blockMoved: 'Block verschoben.',
    })
    expect(root.querySelector('[aria-label="Blockaktionen"]')).not.toBeNull()
    editor.view.dispatch(editor.state.tr)
    expect(wrapper.vm.handleKeydown(modKey('/'))).toBe(true); await flushPromises()
    expect(root.querySelector('.ginko-block-menu__title')?.textContent).toBe('Absatz · Original content')
    Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Verschieben nach…')!.click(); await flushPromises()
    const search = root.querySelector<HTMLInputElement>('[aria-label="Ziel suchen"]')!
    expect(search).not.toBeNull()
    search.value = 'absent'; search.dispatchEvent(new Event('input', { bubbles: true })); await flushPromises()
    expect(root.textContent).toContain('Keine Ziele verfügbar.')
    search.value = 'Target'; search.dispatchEvent(new Event('input', { bubbles: true })); await flushPromises()
    const after = root.querySelector<HTMLButtonElement>('[aria-label="Nach Überschrift 2 · Target heading"]')!
    expect(after).not.toBeNull(); after.click(); await flushPromises()
    expect(editor.state.doc.firstChild?.textContent).toBe('Target heading')
    expect(editor.state.doc.child(1).textContent).toBe('Original content')
    expect(root.querySelector('.ginko-editor__sr-only')?.textContent).toBe('Block verschoben.')
  })
  it('keeps selected-only shortcuts out of ordinary typing and respects host overrides', async () => {
    const { editor } = await setup()
    expect(blockKeyboardIntent(editor, modKey('ArrowUp', { shiftKey: true }))).toBeUndefined()
    expect(blockKeyboardIntent(editor, modKey('d'))).toBeUndefined()
    expect(blockKeyboardIntent(editor, key('ArrowUp', { altKey: true }))).toBe('up')
    expect(blockKeyboardIntent(editor, key('ArrowUp', { altKey: true }), { moveUp: false })).toBeUndefined()
    expect(blockKeyboardIntent(editor, key('k', { altKey: true }), { moveUp: 'Alt-k' })).toBe('up')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    expect(blockKeyboardIntent(editor, modKey('ArrowDown', { shiftKey: true }))).toBe('down')
    expect(blockKeyboardIntent(editor, modKey('ArrowDown', { shiftKey: true }), { moveDown: false })).toBeUndefined()
    expect(blockKeyboardIntent(editor, modKey('ArrowUp', { shiftKey: true }), { moveUp: false })).toBeUndefined()
    expect(blockKeyboardIntent(editor, modKey('ArrowUp', { shiftKey: true }), { moveUp: 'Alt-k' })).toBeUndefined()
    expect(blockKeyboardIntent(editor, key('k', { altKey: true }), { moveUp: 'Alt-k' })).toBe('up')
    expect(blockKeyboardIntent(editor, modKey('d'))).toBe('duplicate')
    expect(blockKeyboardIntent(editor, modKey('d'), { duplicate: false })).toBeUndefined()
    expect(blockKeyboardIntent(editor, key('ArrowUp', { altKey: true, isComposing: true }))).toBeUndefined()
  })

  it('keeps Alt Shift D duplicating the enclosing component while typing', async () => {
    const { editor, wrapper } = await setup()
    const paragraph = editor.schema.nodes.paragraph.create(null, editor.schema.text('Note text'))
    const component = editor.schema.nodes.element.create({ tag: 'note', props: {} }, paragraph)
    editor.commands.setContent({ type: 'doc', content: [component.toJSON()] })
    editor.commands.setTextSelection(3)
    expect(wrapper.vm.handleKeydown(key('D', { altKey: true, shiftKey: true }))).toBe(true)
    await flushPromises()
    expect(editor.state.doc.content.content.filter(node => node.type.name === 'element')).toHaveLength(2)
    expect(editor.state.doc.child(1).type.name).toBe('element')
    expect(blockKeyboardIntent(editor, key('D', { altKey: true, shiftKey: true }), { duplicate: false })).toBeUndefined()
  })

  it('integrates block keyboard commands and exclusive slash menus in the public editor', async () => {
    const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: 'First\n\nSecond', shortcuts: { moveUp: false } } })
    cleanup.push(() => wrapper.unmount())
    await flushPromises()
    const editor = wrapper.vm.editor!, second = editor.state.doc.firstChild!.nodeSize
    editor.commands.setNodeSelection(second)
    const surface = wrapper.get('.ProseMirror').element
    surface.dispatchEvent(modKey('ArrowUp', { shiftKey: true }))
    await flushPromises()
    expect(editor.state.doc.firstChild?.textContent).toBe('First')
    await wrapper.setProps({ shortcuts: { moveUp: 'Alt-k' } })
    surface.dispatchEvent(key('k', { altKey: true }))
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    expect((await wrapper.vm.flush()).ok).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatch(/Second[\s\S]*First/)
    expect(editor.state.doc.firstChild?.textContent).toBe('Second')
    surface.dispatchEvent(modKey('/')); await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Insert block"]').trigger('click'); await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
  })

  it('does not consume native field shortcuts or table text navigation', async () => {
    const { editor, root } = await setup('<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>')
    editor.commands.setTextSelection(4)
    expect(blockKeyboardIntent(editor, key('ArrowUp', { altKey: true }))).toBeUndefined()
    expect(blockKeyboardIntent(editor, modKey('ArrowDown', { shiftKey: true }))).toBeUndefined()
    const input = root.appendChild(document.createElement('input')), event = modKey('/')
    Object.defineProperty(event, 'target', { value: input })
    expect(blockKeyboardIntent(editor, event)).toBeUndefined()
  })

  it('cancels a drag without allowing a native fallback drop', async () => {
    const { editor, root } = await setup()
    const before = editor.getJSON(), button = root.querySelector<HTMLButtonElement>('[aria-label="Block actions"]')!
    button.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true }))
    document.dispatchEvent(key('Escape'))
    const nativeDrop = vi.fn(); editor.view.dom.addEventListener('drop', nativeDrop)
    editor.view.dom.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(nativeDrop).not.toHaveBeenCalled()
    expect(editor.getJSON()).toEqual(before)
  })

  it('opens a keyboard menu, moves through validation and keeps the move one undo step', async () => {
    const { editor, wrapper, root } = await setup()
    expect(wrapper.vm.handleKeydown(modKey('/'))).toBe(true)
    await flushPromises()
    expect(root.querySelector('[role="dialog"]')?.textContent).toContain('Paragraph · First')
    const button = Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Move down')!
    button.click(); await flushPromises()
    expect(editor.state.doc.firstChild?.textContent).toBe('Second')
    editor.commands.undo()
    expect(editor.state.doc.firstChild?.textContent).toBe('First')
  })

  it.each(['start', 'end'] as const)('targets the %s of an empty component instead of moving outside it', async placement => {
    const { editor } = await setup()
    const paragraph = editor.schema.nodes.paragraph.create(null, editor.schema.text('Move me'))
    const empty = editor.schema.nodes.element.create({ tag: 'note', props: {} })
    editor.commands.setContent({ type: 'doc', content: [paragraph.toJSON(), empty.toJSON()] })
    const source = captureBlock(editor, 0)!, pos = paragraph.nodeSize
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: pos + 1, inside: pos })
    const element = editor.view.nodeDOM(pos) as HTMLElement
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 80, 300, 100))
    const result = blockDropTarget(editor, source, 100, placement === 'start' ? 110 : 150, {})
    expect(result?.target.block.pos).toBe(pos)
    expect(result?.target.placement).toBe(placement)
    vi.mocked(editor.view.posAtCoords).mockReturnValue({ pos, inside: pos })
    expect(blockDropTarget(editor, source, 100, placement === 'start' ? 110 : 150, {})?.target.placement).toBe(placement)
  })

  it('returns focus to the selected block after menu Escape', async () => {
    const { editor, wrapper, root } = await setup()
    wrapper.vm.handleKeydown(modKey('/')); await flushPromises()
    root.querySelector('[role="dialog"]')!.dispatchEvent(key('Escape'))
    await flushPromises()
    expect(root.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(editor.view.dom)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
  })

  it('offers valid nested destinations and a pointer alternative to drag', async () => {
    const { editor, wrapper, root } = await setup('<p>First</p><blockquote><p>Inside</p></blockquote><p>Last</p>')
    const destinations = blockDestinations(editor, captureBlock(editor, 0)!, {})
    expect(destinations.some(item => item.targets.some(target => target.placement === 'start' && target.block.node.type.name === 'blockquote'))).toBe(true)
    wrapper.vm.handleKeydown(modKey('/')); await flushPromises()
    Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Move to…')!.click()
    await flushPromises()
    expect(root.querySelector('input[aria-label="Find a destination"]')).not.toBeNull()
    expect(root.textContent).toContain('Inside, first')
  })

  it('consumes its drag before native PM handlers and commits only the captured destination', async () => {
    const { editor, root } = await setup()
    const first = editor.view.dom.querySelector('p')!, second = editor.view.dom.querySelectorAll('p')[1]!
    vi.spyOn(editor.view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 300))
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 50))
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, 300, 50))
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: editor.state.doc.firstChild!.nodeSize + 1, inside: editor.state.doc.firstChild!.nodeSize })
    const button = root.querySelector<HTMLButtonElement>('[aria-label="Block actions"]')!
    button.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true, clientX: 0, clientY: 20 }))
    expect(editor.view.dragging).toBeNull()
    const nativeDrop = vi.fn(); editor.view.dom.addEventListener('drop', nativeDrop)
    second.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
    second.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
    await flushPromises()
    expect(nativeDrop).not.toHaveBeenCalled()
    expect(editor.state.doc.firstChild?.textContent).toBe('Second')
  })
})
