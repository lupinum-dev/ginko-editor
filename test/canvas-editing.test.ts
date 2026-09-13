// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })
const block = { kind: 'block', media: null, slots: ['default'], allowedParents: null, allowedChildren: null } as const
function source(): AuthoringKitSourceV1 {
  return {
    version: 1,
    implementation: {
      notice: { componentName: 'Notice', props: { heading: { required: false, types: ['string'] } }, slots: ['default'] },
      split: { componentName: 'Split', props: {}, slots: ['default'] },
      pane: { componentName: 'Pane', props: { width: { required: false, types: ['string'], default: 'medium' } }, slots: ['default'] },
    },
    policy: { version: 2, components: {
      notice: { ...block, props: { heading: { types: ['string'], required: false, allowedValues: null } } },
      split: { ...block, props: {}, allowedChildren: ['pane'] },
      pane: { ...block, props: { width: { types: ['string'], required: false, allowedValues: ['small', 'medium', 'large'] } }, allowedParents: ['split'] },
    } },
    authoring: {
      notice: { label: 'Notice', props: { heading: { label: 'Heading', control: 'text' } }, canvas: { titleProp: 'heading' } },
      split: { label: 'Columns', canvas: { columns: { childTag: 'pane', sizeProp: 'width', presets: [
        { label: 'Small / Large', values: ['small', 'large'], ratio: 1 / 3 },
        { label: 'Equal', values: ['medium', 'medium'], ratio: .5 },
        { label: 'Large / Small', values: ['large', 'small'], ratio: 2 / 3 },
      ] } } },
      pane: { label: 'Column', props: { width: { label: 'Width', control: 'select' } } },
    }, recipes: [],
  }
}
async function setup(modelValue: string, kit?: AuthoringKitSourceV1) {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue, syncDebounceMs: 10000, ...(kit ? { authoringKit: await createAuthoringKit(kit) } : {}) } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const columns = '<split>\n<pane width="small">\nFirst\n</pane>\n<pane width="large">\nSecond\n</pane>\n</split>'
async function saved(wrapper: Awaited<ReturnType<typeof setup>>) {
  const result = await wrapper.vm.flush()
  expect(result).toMatchObject({ ok: true })
  return wrapper.emitted('update:modelValue')!.at(-1)![0] as string
}

describe('direct canvas editing', () => {
  it('edits a declared heading directly, preserving body and quoted values after reload', async () => {
    const wrapper = await setup('<notice heading="Before">\nBody\n</notice>', source())
    await wrapper.get('input[aria-label="Notice Heading"]').setValue('A "better" heading')
    const output = await saved(wrapper)
    const reloaded = await setup(output, source())
    expect((reloaded.get('input[aria-label="Notice Heading"]').element as HTMLInputElement).value).toBe('A "better" heading')
    expect(reloaded.vm.editor!.getText().trim()).toBe('Body')
    expect(wrapper.find('.ginko-editor__fields input').exists()).toBe(false)
  })
  it('changes both widths together and restores both with one Undo', async () => {
    const wrapper = await setup(columns, source())
    await wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').trigger('keydown', { key: 'ArrowRight' })
    const output = await saved(wrapper)
    expect(output.match(/width="medium"/g)).toHaveLength(2)
    const reloaded = await setup(output, source())
    expect(reloaded.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes('aria-valuetext')).toBe('Equal')
    wrapper.vm.editor!.commands.undo(); await flushPromises()
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes('aria-valuetext')).toBe('Small / Large')
  })
  it('preserves imported custom pairs until the user chooses a legal pair', async () => {
    const wrapper = await setup(columns.replace('large', 'small'), source())
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes('aria-valuetext')).toBe('Custom widths')
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true, emitted: false })
    await wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').trigger('keydown', { key: 'End' })
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes('aria-valuetext')).toBe('Large / Small')
  })
  it('does not rewrite source when selecting the existing column ratio', async () => {
    const wrapper = await setup(columns, source())
    await wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').trigger('keydown', { key: 'Home' })
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true, emitted: false })
  })
  it('keeps larger layouts intact and does not offer the two-column divider', async () => {
    const wrapper = await setup(columns.replace('</split>', '<pane>\nThird\n</pane>\n</split>'), source())
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes()).toHaveProperty('hidden')
    expect(wrapper.vm.editor!.getText()).toContain('Third')
  })
  it('disables title and layout editing when read-only changes at runtime', async () => {
    const wrapper = await setup(columns + '\n<notice heading="Before">\nBody\n</notice>', source())
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes()).toHaveProperty('hidden')
    expect(wrapper.get('input[aria-label="Notice Heading"]').attributes()).toHaveProperty('disabled')
    await wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').trigger('keydown', { key: 'End' })
    expect(wrapper.get('[tag="split"] > .ginko-block__body > [role="separator"]').attributes('aria-valuetext')).toBe('Small / Large')
  })
  it('rejects canvas instructions that contradict placement policy', async () => {
    const kit = source(); kit.policy.components.split.allowedChildren = ['notice']
    await expect(createAuthoringKit(kit)).rejects.toThrow('placement policy')
  })
  it('keeps paired columns intact when the block duplication shortcut is used', async () => {
    const wrapper = await setup(columns, source())
    const editor = wrapper.vm.editor!
    let pos = 0
    editor.state.doc.descendants((node, offset) => { if (!pos && node.attrs.tag === 'pane') pos = offset })
    editor.commands.setNodeSelection(pos)
    await wrapper.get('.ProseMirror').trigger('keydown', { key: 'D', altKey: true, shiftKey: true })
    let count = 0
    editor.state.doc.descendants(node => { if (node.attrs.tag === 'pane') count++ })
    expect(count).toBe(2)
  })
  it.each(['duplicate', 'nonfinite'])('rejects %s column presets', async invalid => {
    const kit = source(), presets = kit.authoring.split.canvas!.columns!.presets
    if (invalid === 'duplicate') presets[1].values = presets[0].values
    else presets[1].ratio = Number.NaN
    await expect(createAuthoringKit(kit)).rejects.toThrow('presets')
  })
  it('edits code language and file name through the existing document contract', async () => {
    const wrapper = await setup('```\nconst answer = 42\n```')
    await wrapper.get('select[aria-label="Code language"]').setValue('ts')
    await wrapper.get('input[aria-label="Code file name"]').setValue('answer.ts')
    const reloaded = await setup(await saved(wrapper))
    expect(reloaded.vm.editor!.getJSON().content?.[0].attrs).toMatchObject({ language: 'ts', filename: 'answer.ts' })
  })
  it('edits image description inline and preserves the asset reference after reload', async () => {
    const wrapper = await setup('')
    wrapper.vm.insertImageAsset({ id: 'stable-image', alt: 'Before' })
    await wrapper.get('input[aria-label="Image description"]').setValue('A clear description')
    const output = await saved(wrapper), reloaded = await setup(output)
    expect(reloaded.vm.editor!.getJSON().content?.find(node => node.type === 'image')?.attrs?.props).toMatchObject({ id: 'stable-image', alt: 'A clear description' })
    await wrapper.get('button[aria-label="Remove image"]').trigger('click')
    expect(wrapper.vm.editor!.getJSON().content?.some(node => node.type === 'image')).toBe(false)
    wrapper.vm.editor!.commands.undo()
    expect(wrapper.vm.editor!.getJSON().content?.find(node => node.type === 'image')?.attrs?.props.alt).toBe('A clear description')
  })
  it('refreshes resolved image URLs without rewriting or replacing the stored image', async () => {
    const wrapper = await setup('')
    wrapper.vm.insertImageAsset({ id: 'stable-image', alt: 'Keep this' })
    await wrapper.setProps({ assetProvider: { buildUrl: () => '/before.png', parseUrl: () => null } })
    const image = wrapper.get('.ginko-image img').element
    const document = wrapper.vm.editor!.state.doc
    await wrapper.setProps({ assetProvider: { buildUrl: () => '/after.png', parseUrl: () => null } })
    expect(wrapper.get('.ginko-image img').element).toBe(image)
    expect(wrapper.get('.ginko-image img').attributes('src')).toBe('/after.png')
    expect(wrapper.vm.editor!.state.doc).toBe(document)
  })
  it.each(['Add row above', 'Add row below', 'Add column left', 'Add column right', 'Delete column', 'Delete row', 'Use selected row as header'])('preserves tables after %s', async action => {
    const wrapper = await setup('| Name | Details |\n| --- | --- |\n| Item | Description |\n| Other | Detail |')
    const editor = wrapper.vm.editor!
    let firstCell = 0
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'tableCell' && !firstCell) firstCell = pos + 2 })
    editor.commands.setTextSelection(firstCell); await flushPromises()
    await wrapper.get(`button[aria-label="${action}"]`).trigger('click')
    const output = await saved(wrapper)
    const reloaded = await setup(output)
    expect(reloaded.vm.editor!.getJSON()).toEqual(editor.getJSON())
  })
  it('aligns the whole selected column and preserves its content after reload', async () => {
    const wrapper = await setup('| Name | Details |\n| --- | --- |\n| Item | Description |')
    const editor = wrapper.vm.editor!
    editor.commands.setTextSelection(4); await flushPromises()
    await wrapper.get('button[aria-label="Align column center"]').trigger('click')
    const output = await saved(wrapper)
    expect(output).toMatch(/:-+:/)
    const reloaded = await setup(output)
    expect(reloaded.get('th').attributes('style')).toContain('center')
    expect(reloaded.vm.editor!.getText()).toContain('Description')
  })
})
