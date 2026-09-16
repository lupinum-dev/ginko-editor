// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit } from '../src/authoring'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})

describe('editing without block movement', () => {
  it('has no handle or move shortcuts and cancels content drag before native movement', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        modelValue: 'First\n\n![Image](https://example.com/image.png)\n\nLast',
      },
    })
    try {
      await flushPromises()
      const editor = wrapper.vm.editor!
      const before = editor.getJSON()
      editor.commands.setNodeSelection(editor.state.doc.firstChild!.nodeSize)
      for (const key of ['ArrowUp', 'ArrowDown']) {
        const modifierSets = [
          { altKey: true },
          { metaKey: true, shiftKey: true },
          { ctrlKey: true, shiftKey: true },
        ]
        for (const modifiers of modifierSets) {
          editor.view.dom.dispatchEvent(
            new KeyboardEvent('keydown', { key, ...modifiers, bubbles: true, cancelable: true }),
          )
          expect(editor.getJSON()).toEqual(before)
        }
      }
      expect(wrapper.find('.ginko-block-handle').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Block actions"]').exists()).toBe(false)
      const drag = new Event('dragstart', { bubbles: true, cancelable: true })
      wrapper.get('.ProseMirror img').element.dispatchEvent(drag)
      expect(drag.defaultPrevented).toBe(true)
      expect(editor.view.dragging).toBeNull()
      expect(editor.getJSON()).toEqual(before)
      expect(editor.schema.nodes.image.spec.draggable).toBe(false)
      expect(editor.schema.nodes.file.spec.draggable).toBe(false)
      expect((await wrapper.vm.flush()).ok).toBe(true)
    } finally { wrapper.unmount() }
  })

  it('keeps component duplication and deletion with no reorder actions in settings', async () => {
    const kit = await createAuthoringKit({
      version: 1,
      policy: {
        version: 2,
        components: {
          note: {
            kind: 'block',
            props: {},
            slots: ['default'],
            allowedParents: null,
            allowedChildren: null,
            media: null,
          },
        },
      },
      implementation: {
        note: { componentName: 'Note', props: {}, slots: ['default'] },
      },
      authoring: { note: { label: 'Note' } },
      recipes: [],
    })
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        modelValue: '<note>\nKeep this text\n</note>\n\nAfter',
        authoringKit: kit,
      },
    })
    try {
      await flushPromises()
      const editor = wrapper.vm.editor!
      editor.commands.setTextSelection(2)
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'D', altKey: true, shiftKey: true, bubbles: true, cancelable: true }),
      )
      expect((await wrapper.vm.flush()).ok).toBe(true)
      expect(editor.state.doc.content.content.filter(node => node.type.name === 'element')).toHaveLength(2)
      editor.commands.undo()
      await wrapper.get('button[aria-label="Note settings"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-action="up"]').exists()).toBe(false)
      expect(wrapper.find('[data-action="down"]').exists()).toBe(false)
      expect(wrapper.find('[data-action="duplicate"]').exists()).toBe(true)
      await wrapper.get('[data-action="delete"]').trigger('click')
      expect((await wrapper.vm.flush()).ok).toBe(true)
      expect(editor.getText()).toBe('After')
      editor.commands.undo()
      expect(editor.getText()).toContain('Keep this text')
    } finally { wrapper.unmount() }
  })
})
