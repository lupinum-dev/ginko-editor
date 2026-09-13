// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { joinBackward, joinForward } from '@tiptap/pm/commands'
import { TextSelection } from '@tiptap/pm/state'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'
import * as conversion from '../src/lib/conversionPipeline'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })
function kitSource(): AuthoringKitSourceV1 {
  const source: AuthoringKitSourceV1 = { version: 1, implementation: {}, policy: { version: 2, components: {} }, authoring: {}, recipes: [] }
  for (const tag of ['info', 'warning', 'success']) {
    source.implementation[tag] = { componentName: tag, props: { title: { required: false, types: ['string'] }, icon: { required: false, types: ['string'] } }, slots: ['default'] }
    source.policy.components[tag] = { kind: 'block', media: null, props: { title: { required: false, types: ['string'], allowedValues: null }, icon: { required: false, types: ['string'], allowedValues: null } }, slots: ['default'], allowedParents: null, allowedChildren: null }
    source.authoring[tag] = { label: tag, props: { title: { control: 'text', label: 'Title' }, icon: { control: 'text', label: 'Icon' } }, canvas: { titleProp: 'title', switchGroup: 'callout' } }
  }
  return source
}
async function setup(source = '<info title="Keep this title" icon="before">\nBody text\n</info>', kit = kitSource()) {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: source, syncDebounceMs: 10000, authoringKit: await createAuthoringKit(kit) } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
async function settings(wrapper: ReturnType<typeof mount<typeof GinkoEditor>>) {
  const trigger = wrapper.get('.ginko-settings button')
  if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click')
  await flushPromises()
  const panel = document.getElementById(trigger.attributes('aria-controls')!)
  if (!panel) throw new Error('The component settings did not open.')
  return new DOMWrapper(panel)
}
function delayedConversion() {
  const original = conversion.convertTiptapDocToMarkdown
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementationOnce(async (...args) => { await gate; return original(...args) })
  return release
}

describe('nodeview review regressions', () => {
  it.each(['Backspace', 'Delete'])('keeps both callout identities at a %s boundary', async key => {
    const wrapper = await setup('<info title="First title">\nFirst body\n</info>\n\n<warning title="Second title">\nSecond body\n</warning>')
    const editor = wrapper.vm.editor!, before = editor.state.doc
    const pos = key === 'Backspace' ? before.firstChild!.nodeSize + 2 : before.firstChild!.nodeSize - 2
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)))
    const command = key === 'Backspace' ? joinBackward : joinForward
    expect(command(editor.state, tr => editor.view.dispatch(tr))).toBe(false)
    expect(editor.state.doc).toBe(before)
    expect(editor.getJSON().content?.filter(node => node.type === 'element').map(node => node.attrs?.props.title)).toEqual(['First title', 'Second title'])
  })

  it('applies the latest variant choice even when an earlier conversion finishes last', async () => {
    const wrapper = await setup(), release = delayedConversion()
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning')
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('success')
    await flushPromises()
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('success')
    release(); await flushPromises()
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('success')
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.props.title).toBe('Keep this title')
  })

  it('cancels a pending change when the user chooses the current variant again', async () => {
    const wrapper = await setup(), release = delayedConversion()
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning')
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('info')
    release(); await flushPromises()
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('info')
  })

  it('rejects a pending variant after a temporary read-only transition', async () => {
    const wrapper = await setup(), release = delayedConversion()
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning')
    await wrapper.setProps({ disabled: true }); await wrapper.setProps({ disabled: false })
    release(); await flushPromises()
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('info')
  })

  it('rejects a pending variant after output settings change', async () => {
    const wrapper = await setup(), release = delayedConversion()
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning')
    await wrapper.setProps({ fileOutput: 'markdown' })
    release(); await flushPromises()
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('info')
  })

  it('refreshes sibling variant options when the kit changes without changing the current tag', async () => {
    const first = kitSource()
    delete first.authoring.success; delete first.implementation.success; delete first.policy.components.success
    const wrapper = await setup(undefined, first)
    expect((await settings(wrapper)).get('select[aria-label="Callout type"]').findAll('option').map(option => option.attributes('value'))).toEqual(['info', 'warning'])
    const next = kitSource(); next.authoring.warning.label = 'Caution'
    await wrapper.setProps({ authoringKit: await createAuthoringKit(next) }); await flushPromises()
    expect((await settings(wrapper)).get('select[aria-label="Callout type"]').findAll('option').map(option => option.text())).toEqual(['info', 'Caution', 'success'])
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.tag).toBe('info')
  })

  it('shows a readable rejection without changing the document', async () => {
    const kit = kitSource()
    kit.policy.components.warning.props.title.allowedValues = ['A different title']
    const wrapper = await setup(undefined, kit), before = wrapper.vm.editor!.state.doc
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning'); await flushPromises()
    expect(wrapper.vm.editor!.state.doc).toBe(before)
    expect((await settings(wrapper)).get('.ginko-editor__field-error').text()).toContain('This document violates the editor authoring kit.')
    expect(wrapper.text()).not.toContain('[object Object]')
  })

  it('handles a conversion exception visibly without changing the component', async () => {
    const wrapper = await setup(), before = wrapper.vm.editor!.state.doc
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockRejectedValueOnce(new Error('Controlled failure'))
    await (await settings(wrapper)).get('select[aria-label="Callout type"]').setValue('warning'); await flushPromises()
    expect(wrapper.vm.editor!.state.doc).toBe(before)
    expect((await settings(wrapper)).get('.ginko-editor__field-error').text()).toContain('Your document is unchanged.')
  })

  it('undoes and redoes a property edit while its settings input has focus', async () => {
    const wrapper = await setup(), input = (await settings(wrapper)).get('input[aria-label="Icon"]')
    await input.setValue('after')
    await input.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.props.icon).toBe('before')
    await input.trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.vm.editor!.getJSON().content?.[0].attrs?.props.icon).toBe('after')
  })
})
