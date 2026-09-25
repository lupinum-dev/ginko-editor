// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { createGinkoLayoutKit } from '../src/authoring'
import GinkoEditor from '../src/GinkoEditor.vue'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})

type Wrapper = ReturnType<typeof mount<typeof GinkoEditor>>

async function setup(modelValue = '', withKit = false) {
  const wrapper = mount(GinkoEditor, {
    attachTo: document.body,
    props: {
      modelValue,
      syncDebounceMs: 0,
      ...(withKit ? { authoringKit: await createGinkoLayoutKit() } : {}),
    },
  })
  await flushPromises()
  return wrapper
}
const labels = (wrapper: Wrapper) => wrapper.findAll('.ginko-editor__insert-group-label').map(label => label.text())
const options = (wrapper: Wrapper) => wrapper.findAll('[role="option"]').map(option => option.get('strong').text())

describe('grouped block menu', () => {
  it('shows labelled groups with icons in a listbox', async () => {
    const wrapper = await setup('', true)
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      expect(labels(wrapper)).toEqual(['Text', 'Lists', 'Media', 'Layout', 'Callouts', 'Advanced'])
      const group = wrapper.get('[role="listbox"] > [role="group"]')
      expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('Text')
      expect(wrapper.findAll('[role="option"] .ginko-editor__recipe-symbol svg').length)
        .toBe(wrapper.findAll('[role="option"]').length)
    } finally { wrapper.unmount() }
  })

  it('ranks matches, highlights matched characters, and supports Home and End', async () => {
    const wrapper = await setup('', true)
    try {
      const editor = wrapper.vm.getEditor()!
      editor.view.dispatch(editor.state.tr.insertText('/tab'))
      await flushPromises()
      expect(options(wrapper).slice(0, 2)).toEqual(['Tabs', 'Table of contents'])
      expect(wrapper.get('[role="option"] mark').text()).toBe('Tab')
      const surface = wrapper.get('.ProseMirror')
      await surface.trigger('keydown', { key: 'End' })
      expect(wrapper.get('[aria-selected="true"]').attributes('id'))
        .toBe(wrapper.findAll('[role="option"]').at(-1)!.attributes('id'))
      await surface.trigger('keydown', { key: 'ArrowDown' })
      expect(wrapper.get('[aria-selected="true"]').attributes('id'))
        .toBe(wrapper.findAll('[role="option"]')[0].attributes('id'))
      await surface.trigger('keydown', { key: 'ArrowUp' })
      await surface.trigger('keydown', { key: 'Home' })
      expect(surface.attributes('aria-activedescendant')).toBe(wrapper.findAll('[role="option"]')[0].attributes('id'))
    } finally { wrapper.unmount() }
  })

  it('shows an empty state with a hint', async () => {
    const wrapper = await setup()
    try {
      wrapper.vm.getEditor()!.view.dispatch(wrapper.vm.getEditor()!.state.tr.insertText('/qqqq'))
      await flushPromises()
      expect(wrapper.text()).toContain('No matching blocks.')
      expect(wrapper.text()).toContain('Press Escape to keep your text.')
    } finally { wrapper.unmount() }
  })

  it('lists recent blocks first for an empty query', async () => {
    const wrapper = await setup('Text')
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('quote')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      expect(labels(wrapper)[0]).toBe('Recent')
      expect(options(wrapper)[0]).toBe('Block quote')
      expect(options(wrapper).filter(label => label === 'Block quote')).toHaveLength(1)
      await wrapper.get('[role="combobox"]').setValue('quo')
      expect(labels(wrapper)).not.toContain('Recent')
    } finally { wrapper.unmount() }
  })

  it('offers the add action of the surrounding container first', async () => {
    const wrapper = await setup('::tabs\n:::tab{label="One"}\nBody\n:::\n::', true)
    try {
      const editor = wrapper.vm.getEditor()!
      let end = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.textContent === 'Body') end = pos + node.nodeSize - 1
      })
      editor.commands.setTextSelection(end)
      editor.view.dispatch(editor.state.tr.insertText(' /'))
      await flushPromises()
      expect(labels(wrapper)[0]).toBe('In this block')
      expect(options(wrapper)[0]).toBe('Add tab')
      await wrapper.get('.ProseMirror').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['One', 'New tab'])
      expect(editor.getText()).not.toContain('/')
      editor.commands.undo()
      await flushPromises()
      expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['One'])
      expect(editor.getText()).toContain('Body /')
    } finally { wrapper.unmount() }
  })

  it('moves focus to the recipe preview with Tab and back', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { modelValue: '' },
      slots: { 'recipe-preview': '<p class="host-preview">Preview</p>' },
    })
    try {
      await flushPromises()
      const editor = wrapper.vm.getEditor()!
      editor.view.dispatch(editor.state.tr.insertText('/quote'))
      await flushPromises()
      const surface = wrapper.get('.ProseMirror')
      ;(surface.element as HTMLElement).focus()
      await surface.trigger('keydown', { key: 'Tab' })
      const preview = wrapper.get('.ginko-editor__recipe-preview')
      expect(document.activeElement).toBe(preview.element)
      await preview.trigger('keydown', { key: 'Tab' })
      expect(document.activeElement).toBe(surface.element)
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(true)
    } finally { wrapper.unmount() }
  })
})
