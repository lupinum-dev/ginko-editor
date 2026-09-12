// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { createAuthoringKit } from '../src/authoring'
import GinkoEditor from '../src/GinkoEditor.vue'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})

async function setup() {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: '', syncDebounceMs: 0 } })
  await flushPromises()
  return wrapper
}

describe('writing block menu', () => {
  it('works without a component kit and announces the keyboard-selected result', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      const search = wrapper.get('[role="combobox"]')
      await search.setValue('heading')
      expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
      await search.trigger('keydown', { key: 'ArrowDown' })
      expect(search.attributes('aria-activedescendant')).toBe(wrapper.get('[aria-selected="true"]').attributes('id'))
      await search.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.get('.ProseMirror h2').text()).toBe('Heading')
      expect(document.activeElement).toBe(wrapper.get('.ProseMirror').element)
      expect((await wrapper.vm.flush()).ok).toBe(true)
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('## Heading')
      wrapper.vm.editor!.commands.undo()
      expect(wrapper.vm.editor!.getText()).toBe('')
    } finally { wrapper.unmount() }
  })

  it('keeps the document unchanged on no results, escape, and an outside click', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('.ProseMirror').trigger('keydown', { key: '/' })
      const search = wrapper.get('[role="combobox"]')
      await search.setValue('there-is-no-such-block')
      await search.trigger('keydown', { key: 'Enter' })
      expect(wrapper.text()).toContain('No matching blocks.')
      expect(wrapper.vm.editor!.getText()).toBe('')
      await search.trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
      expect(document.activeElement).toBe(wrapper.get('.ProseMirror').element)
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('closes a menu when its document is replaced and preserves IME search input', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter', isComposing: true })
      expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
      expect(wrapper.vm.editor!.getText()).toBe('')
      await wrapper.setProps({ modelValue: 'A different document' })
      await flushPromises()
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
      expect(wrapper.vm.editor!.getText()).toBe('A different document')
    } finally { wrapper.unmount() }
  })

  it('does not reserve consumer recipe identifiers for built-in actions', async () => {
    const kit = await createAuthoringKit({ version: 1, policy: { version: 2, components: {} }, implementation: {}, authoring: {}, recipes: [{ id: 'ginko.image', label: 'Host guide', source: '# Host guide' }] })
    const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: '', authoringKit: kit } })
    try {
      await flushPromises()
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('Host guide')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.get('.ProseMirror h1').text()).toBe('Host guide')
      expect(wrapper.emitted('request-image')).toBeUndefined()
    } finally { wrapper.unmount() }
  })

  it('routes the image command through the host-owned picker', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('image')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('request-image')).toHaveLength(1)
      expect(wrapper.vm.editor!.getText()).toBe('')
    } finally { wrapper.unmount() }
  })
})
