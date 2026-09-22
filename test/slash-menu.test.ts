// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthoringKit } from '../src/authoring'
import GinkoEditor from '../src/GinkoEditor.vue'
import * as conversion from '../src/lib/conversionPipeline'
import type { EditorAssetRequest, AssetInfo, EditorImage } from '../src/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})

async function setup(modelValue = '') {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue, syncDebounceMs: 0 } })
  await flushPromises()
  return wrapper
}

describe('writing block menu', () => {
  it.each([false, true])('replaces /image only when a host request succeeds: %s', async accept => {
    const wrapper = await setup()
    try {
      const editor = wrapper.vm.editor!
      editor.view.dispatch(editor.state.tr.insertText('/image'))
      await flushPromises()
      await wrapper.get('.ProseMirror').trigger('keydown', { key: 'Enter' })
      const request = wrapper.emitted('request-image')?.[0]?.[0] as EditorAssetRequest<Partial<AssetInfo>>
      expect(editor.getText()).toBe('/image')
      expect(request.complete(accept ? { url: '/photo.png' } : null)).toBe(accept)
      expect(editor.getText().trim()).toBe(accept ? '' : '/image')
      if (accept) {
        editor.commands.undo()
        expect(editor.getText()).toBe('/image')
        expect(editor.getJSON().content?.some(node => node.type === 'image')).toBe(false)
      }
    } finally { wrapper.unmount() }
  })

  it.each(['accept', 'cancel', 'stale'] as const)('keeps a mapped slash range through the built-in picker: %s', async outcome => {
    let finish!: (image: EditorImage | null) => void
    const wrapper = mount(GinkoEditor, { attachTo: document.body, props: {
      modelValue: 'Before\n\n/image',
      imagePicker: () => new Promise(resolve => { finish = resolve }),
    } })
    try {
      await flushPromises()
      const editor = wrapper.vm.editor!
      editor.commands.setTextSelection(editor.state.doc.content.size - 1)
      // A typing transaction opens the command; merely loading source does not.
      editor.view.dispatch(editor.state.tr.insertText('s'))
      editor.view.dispatch(editor.state.tr.delete(editor.state.selection.from - 1, editor.state.selection.from))
      await flushPromises()
      await wrapper.get('.ProseMirror').trigger('keydown', { key: 'Enter' })
      await wrapper.get('.ginko-image-upload__browse').trigger('click')
      editor.view.dispatch(editor.state.tr.insertText('Arrived ', 1))
      if (outcome === 'stale') editor.view.dispatch(editor.state.tr.insertText('changed', editor.state.doc.content.size - 2))
      finish(outcome === 'cancel' ? null : { url: '/photo.png' })
      await flushPromises()
      expect(editor.getText()).toContain('Arrived Before')
      if (outcome === 'accept') {
        expect(editor.getText()).not.toContain('/image')
        editor.commands.undo()
        expect(editor.getText()).toContain('/image')
      } else expect(editor.getText()).toContain('/imag')
      expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('dismisses a captured selection when an independent operation changes the document', async () => {
    const wrapper = await setup('Original')
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
      wrapper.vm.editor!.commands.insertContentAt(1, 'Arrived ')
      await flushPromises()
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
      await wrapper.get('.ProseMirror').trigger('keydown', { key: 'Escape' })
      expect(wrapper.vm.editor!.getText()).toBe('Arrived Original')
      expect((await wrapper.vm.flush()).ok).toBe(true)
    } finally { wrapper.unmount() }
  })
  it('uses the host overlay container and removes its menu on teardown', async () => {
    const overlay = document.body.appendChild(document.createElement('div'))
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { modelValue: 'Original', overlayContainer: overlay },
    })
    try {
      await flushPromises()
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      const menu = new DOMWrapper(overlay)
      expect(menu.find('[role="combobox"]').exists()).toBe(true)
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
      await menu.get('[role="combobox"]').setValue('heading 2')
      await menu.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.get('.ProseMirror h2').text()).toBe('Original')
    } finally { wrapper.unmount(); await flushPromises(); expect(overlay.children).toHaveLength(0); overlay.remove() }
  })
  it('works without a component kit and announces the keyboard-selected result', async () => {
    const wrapper = await setup('My heading')
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      const search = wrapper.get('[role="combobox"]')
      await search.setValue('heading')
      expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
      await search.trigger('keydown', { key: 'ArrowDown' })
      expect(search.attributes('aria-activedescendant')).toBe(wrapper.get('[aria-selected="true"]').attributes('id'))
      await search.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.get('.ProseMirror h2').text()).toBe('My heading')
      expect(document.activeElement).toBe(wrapper.get('.ProseMirror').element)
      expect((await wrapper.vm.flush()).ok).toBe(true)
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('## My heading')
      wrapper.vm.editor!.commands.undo()
      expect(wrapper.get('.ProseMirror p').text()).toBe('My heading')
    } finally { wrapper.unmount() }
  })

  it('inserts the same blank 3 by 3 table as the toolbar in one undo step', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('table')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      expect((await wrapper.vm.flush()).ok).toBe(true)
      const table = wrapper.vm.editor!.getJSON().content?.find(node => node.type === 'table')
      expect(table?.content).toHaveLength(3)
      expect(table?.content?.every(row => 'content' in row && row.content?.length === 3)).toBe(true)
      expect(wrapper.vm.editor!.getText()).not.toContain('Description')
      wrapper.vm.editor!.commands.undo()
      expect(wrapper.vm.editor!.getJSON().content?.some(node => node.type === 'table')).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('rejects a nested component forbidden by its surrounding component policy', async () => {
    const block = {
      kind: 'block',
      media: null,
      props: {},
      slots: ['default'],
      allowedParents: null,
      allowedChildren: null,
    } as const
    const kit = await createAuthoringKit({
      version: 1,
      policy: {
        version: 2,
        components: {
          note: { ...block, allowedChildren: ['note'] },
          other: block,
        },
      },
      implementation: {
        note: { componentName: 'Note', props: {}, slots: ['default'] },
        other: { componentName: 'Other', props: {}, slots: ['default'] },
      },
      authoring: { note: { label: 'Note' }, other: { label: 'Other' } },
      recipes: [{ id: 'nested', label: 'Nested example', source: '> <other>\n> Inside\n> </other>' }],
    })
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { modelValue: '<note>\nKeep\n</note>', authoringKit: kit },
    })
    try {
      await flushPromises()
      const editor = wrapper.vm.editor!
      let position = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.textContent === 'Keep') position = pos + 1
      })
      editor.commands.setTextSelection(position)
      const before = editor.getJSON()
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('Nested example')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(editor.getJSON()).toEqual(before)
      expect(wrapper.text()).toContain('This block cannot be inserted safely here.')
    } finally { wrapper.unmount() }
  })

  it.each([false, true])('tracks recipe preparation in flush and cancels closed menus: %s', async cancel => {
    const kit = await createAuthoringKit({
      version: 1,
      policy: { version: 2, components: {} },
      implementation: {},
      authoring: {},
      recipes: [{ id: 'example', label: 'Example', source: '# Example' }],
    })
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { modelValue: '', authoringKit: kit, syncDebounceMs: 10000 },
    })
    let release!: () => void
    try {
      await flushPromises()
      const original = conversion.prepareMarkdownForVisualEditing
      const gate = new Promise<void>(resolve => { release = resolve })
      vi.spyOn(conversion, 'prepareMarkdownForVisualEditing').mockImplementationOnce(async (...args) => {
        await gate
        return original(...args)
      })
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('[role="combobox"]').setValue('Example')
      await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
      let flushed = false
      const pending = wrapper.vm.flush().then(result => { flushed = true; return result })
      await flushPromises()
      expect(flushed).toBe(false)
      if (cancel) await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Escape' })
      release()
      expect((await pending).ok).toBe(true)
      await flushPromises()
      expect(wrapper.vm.editor!.getText().trim()).toBe(cancel ? '' : 'Example')
      if (!cancel) expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('# Example')
    } finally { release?.(); wrapper.unmount(); vi.restoreAllMocks() }
  })

  it('keeps slash text on no results and escape, and dismisses on an outside click', async () => {
    const wrapper = await setup()
    try {
      wrapper.vm.editor!.view.dispatch(wrapper.vm.editor!.state.tr.insertText('/there-is-no-such-block'))
      await flushPromises()
      const search = wrapper.get('.ProseMirror')
      await search.trigger('keydown', { key: 'Enter' })
      expect(wrapper.text()).toContain('No matching blocks.')
      expect(wrapper.vm.editor!.getText()).toBe('/there-is-no-such-block')
      await search.trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
      expect(document.activeElement).toBe(wrapper.get('.ProseMirror').element)
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('types at the caret, maps its command through independent edits, and undoes insertion atomically', async () => {
    const wrapper = await setup('First\n\nSecond')
    try {
      const editor = wrapper.vm.editor!
      editor.commands.setTextSelection(editor.state.doc.content.size - 1)
      editor.view.dispatch(editor.state.tr.insertText(' /h2'))
      await flushPromises()
      const surface = wrapper.get('.ProseMirror')
      ;(surface.element as HTMLElement).focus()
      expect(surface.attributes('role')).toBe('combobox')
      expect(wrapper.find('input[role="combobox"]').exists()).toBe(false)
      expect(document.activeElement).toBe(surface.element)
      editor.view.dispatch(editor.state.tr.insertText('Arrived ', 1))
      await flushPromises()
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(true)
      await surface.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.get('.ProseMirror h2').text()).toBe('Second')
      expect(editor.getText()).toContain('Arrived First')
      expect(editor.getText()).not.toContain('/h2')
      editor.commands.undo()
      expect(editor.getText()).toContain('Second /h2')
      expect(editor.getText()).toContain('Arrived First')
    } finally { wrapper.unmount() }
  })

  it('dismisses when the caret moves away, the slash is deleted, or the host disables editing', async () => {
    for (const action of ['move', 'delete', 'disable'] as const) {
      const wrapper = await setup()
      try {
        const editor = wrapper.vm.editor!
        editor.view.dispatch(editor.state.tr.insertText('/head'))
        await flushPromises()
        expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(true)
        if (action === 'move') editor.commands.setTextSelection(3)
        if (action === 'delete') editor.view.dispatch(editor.state.tr.delete(1, 2))
        if (action === 'disable') await wrapper.setProps({ disabled: true })
        await flushPromises()
        expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(false)
        expect(editor.getText()).toBe(action === 'delete' ? 'head' : '/head')
      } finally { wrapper.unmount() }
    }
  })

  it('does not reopen a dismissed command during continued typing or parse URLs as commands', async () => {
    const wrapper = await setup()
    try {
      const editor = wrapper.vm.editor!
      editor.view.dispatch(editor.state.tr.insertText('/head'))
      await flushPromises()
      await wrapper.get('.ProseMirror').trigger('keydown', { key: 'Escape' })
      editor.view.dispatch(editor.state.tr.insertText('ing'))
      await flushPromises()
      expect(editor.getText()).toBe('/heading')
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(false)
      editor.commands.selectAll()
      editor.view.dispatch(editor.state.tr.insertText('https://example.com/path'))
      await flushPromises()
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('searches translated built-in labels while retaining host recipe identity', async () => {
    const wrapper = await setup()
    try {
      await wrapper.setProps({ messages: { heading: 'Überschrift', heading2Description: 'Ein Abschnitt.' } })
      wrapper.vm.editor!.view.dispatch(wrapper.vm.editor!.state.tr.insertText('/uberschrift'))
      await flushPromises()
      expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
      expect(wrapper.text()).toContain('Überschrift 2')
      expect(wrapper.text()).toContain('Ein Abschnitt.')
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
    const kit = await createAuthoringKit({
      version: 1,
      policy: { version: 2, components: {} },
      implementation: {},
      authoring: {},
      recipes: [{ id: 'ginko.image', label: 'Host guide', source: '# Host guide' }],
    })
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
