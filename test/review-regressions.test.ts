// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { parseMdcDocument } from '@lupinum/ginko-content/cms-contract'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'
import { convertTiptapDocToMarkdown } from '../src/lib/conversionPipeline'
import { hasSemanticHtml } from '../src/lib/extensions/markdown-clipboard'
import { writingRecipes, isImageRecipe } from '../src/ui/writingRecipes'
import type { AssetInfo, EditorAssetRequest } from '../src/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount() })
async function setup(props: InstanceType<typeof GinkoEditor>['$props'] = { modelValue: '' }) {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { syncDebounceMs: 10000, ...props } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
function paste(wrapper: Awaited<ReturnType<typeof setup>>, source: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { types: ['text/markdown'], getData: (type: string) => type === 'text/markdown' ? source : '' } })
  wrapper.get('.ProseMirror').element.dispatchEvent(event)
}
async function imageRequest(wrapper: Awaited<ReturnType<typeof setup>>) {
  await wrapper.get('button[aria-label="Insert block"]').trigger('click')
  await wrapper.get('[role="combobox"]').setValue('image')
  await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
  return wrapper.emitted('request-image')!.at(-1)![0] as EditorAssetRequest<Partial<AssetInfo>>
}

describe('deep review regressions', () => {
  it.each(['-\n', '1.\n', '>\n'])('reopens an unfinished native block in visual mode: %s', async (source) => {
    const wrapper = await setup({ modelValue: source })
    expect(wrapper.attributes('data-mode')).toBe('visual')
    let firstParagraph: number | undefined
    wrapper.vm.editor!.state.doc.descendants((node, pos) => {
      if (firstParagraph === undefined && node.type.name === 'paragraph') firstParagraph = pos + 1
    })
    wrapper.vm.editor!.commands.setTextSelection(firstParagraph!)
    wrapper.vm.editor!.commands.insertContent('Continue writing')
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true })
    const saved = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    const reloaded = await setup({ modelValue: saved })
    expect(reloaded.attributes('data-mode')).toBe('visual')
    expect(reloaded.vm.editor!.state.doc.textContent).toBe('Continue writing')
  })
  it.each(writingRecipes.filter(recipe => !isImageRecipe(recipe)))('inserts, saves, reloads and undoes $label', async (recipe) => {
    const wrapper = await setup()
    await wrapper.get('button[aria-label="Insert block"]').trigger('click')
    await wrapper.get('[role="combobox"]').setValue(recipe.id)
    await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    // Native commands format the current block without inserting sample copy.
    // Exercise the author's next keystrokes before saving that structure.
    wrapper.vm.editor!.commands.insertContent('Written content')
    expect((await wrapper.vm.flush()).ok).toBe(true)
    const source = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    const reloaded = await setup({ modelValue: source })
    expect(reloaded.attributes('data-mode')).toBe('visual')
    expect(reloaded.vm.editor!.getJSON()).toEqual(wrapper.vm.editor!.getJSON())
    wrapper.vm.editor!.commands.undo()
    wrapper.vm.editor!.commands.undo()
    expect(wrapper.vm.editor!.getText()).toBe('')
  })

  it('keeps alignment and separate paragraphs through the mounted schema', async () => {
    const source = '| Left | Right |\n| :--- | ---: |\n| A | B |\n\n- First\n\n  Second\n\n```\nNo language\n```'
    const wrapper = await setup({ modelValue: source })
    expect(wrapper.attributes('data-mode')).toBe('visual')
    expect(wrapper.get('th').attributes('style')).toContain('text-align: left')
    wrapper.vm.editor!.commands.insertContent('Edit ')
    expect((await wrapper.vm.flush()).ok).toBe(true)
    const output = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(output).toContain(':---')
    expect(output).toContain('---:')
    expect(output).toContain('First\n\n  Second')
    expect(output).toContain('```\nNo language')
  })

  it('rejects stale Markdown paste before it can target a replacement document', async () => {
    const wrapper = await setup({ modelValue: 'Original' })
    paste(wrapper, '# Pasted heading')
    wrapper.vm.editor!.commands.setContent('<p>Replacement document</p>')
    await flushPromises()
    expect(wrapper.vm.editor!.getText()).toBe('Replacement document')
  })

  it('rejects lossy paste visibly while preserving the document', async () => {
    const wrapper = await setup({ modelValue: 'Original' })
    paste(wrapper, '# Heading\n\n<style>.x { color: red }</style>')
    await flushPromises()
    expect(wrapper.vm.editor!.getText()).toBe('Original')
    expect(wrapper.get('[role="alert"]').text()).toContain('cannot be pasted safely')
    expect((await wrapper.vm.flush()).ok).toBe(true)
  })

  it('uses native rich clipboard structure for literal Markdown text', () => {
    expect(hasSemanticHtml('<p data-pm-slice="1 1 []"># Literal heading</p>')).toBe(true)
  })

  it('never silently serializes an unknown text mark', async () => {
    const result = await convertTiptapDocToMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep formatting', marks: [{ type: 'underline' }] }] }] })
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.code).toBe('unknown_mark_type')
  })

  it('rejects empty media and enables media actions after mount without losing existing content', async () => {
    const wrapper = await setup({ modelValue: 'Keep me', enableImages: false, enableFiles: false, enableVideo: false })
    expect(wrapper.vm.insertImageAsset({})).toBe(false)
    await wrapper.get('button[aria-label="Insert block"]').trigger('click')
    await wrapper.get('[role="combobox"]').setValue('image')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Escape' })
    await wrapper.setProps({ enableImages: true, enableFiles: true, enableVideo: true })
    expect(wrapper.vm.insertImageAsset({})).toBe(false)
    expect(wrapper.vm.insertFileAsset({})).toBe(false)
    expect(wrapper.vm.insertFileAsset({ url: '/file.pdf', filename: 'Document' })).toBe(true)
    expect(wrapper.vm.insertVideo({ src: 'https://example.com/video.mp4' })).toBe(true)
    expect(wrapper.vm.editor!.getText()).toContain('Keep me')
    expect((await wrapper.vm.flush()).ok).toBe(true)
  })

  it.each(['selection', 'disabled'] as const)('invalidates asset requests after a temporary %s change', async (change) => {
    const wrapper = await setup({ modelValue: 'Document' })
    const request = await imageRequest(wrapper)
    if (change === 'selection') {
      const selection = wrapper.vm.editor!.state.selection
      wrapper.vm.editor!.commands.setTextSelection(3)
      wrapper.vm.editor!.commands.setTextSelection(selection.from)
    } else {
      await wrapper.setProps({ disabled: true })
      await wrapper.setProps({ disabled: false })
    }
    expect(request.complete({ url: '/stale.png' })).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('dismisses the first menu when another editor opens its own', async () => {
    const first = await setup()
    const second = await setup()
    await first.get('button[aria-label="Insert block"]').trigger('click')
    const otherTrigger = second.get('button[aria-label="Insert block"]')
    await otherTrigger.trigger('pointerdown')
    await otherTrigger.trigger('click')
    expect(first.find('[role="combobox"]').exists()).toBe(false)
    expect(second.find('[role="combobox"]').exists()).toBe(true)
  })

  it('resolves current providers and preserves stored identities in native rich text', async () => {
    const wrapper = await setup({ modelValue: '', assetProvider: { buildUrl: () => '/old.png', parseUrl: () => null } })
    await wrapper.setProps({ assetProvider: { buildUrl: asset => `/resolved/${asset.id}`, parseUrl: () => null } })
    expect(wrapper.vm.insertImageAsset({ id: 'image-identity', alt: 'Image' })).toBe(true)
    wrapper.vm.editor!.commands.updateAttributes('image', { props: { id: 'image-identity', src: 'image-identity', alt: 'Image', fit: 'cover', focalX: 0.25, quality: 80 } })
    wrapper.vm.editor!.commands.setTextSelection(wrapper.vm.editor!.state.doc.content.size - 1)
    expect(wrapper.vm.insertFileAsset({ id: 'file-identity', filename: 'Document' })).toBe(true)
    expect(wrapper.get('img').attributes('src')).toBe('/resolved/image-identity')
    expect(wrapper.get('a[data-type="file"]').attributes('href')).toBe('/resolved/file-identity')
    wrapper.vm.editor!.commands.setContent(wrapper.vm.editor!.getHTML())
    expect(wrapper.vm.editor!.getJSON().content?.find(node => node.type === 'image')?.attrs?.props).toMatchObject({ fit: 'cover', focalX: 0.25, quality: 80 })
    expect((await wrapper.vm.flush()).ok).toBe(true)
    const source = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(source).toContain('image-identity')
    expect(source).toContain('file-identity')
    expect(source).not.toContain('/resolved/')
  })

  it.each(['javascript:alert(1)', 'data:text/html,unsafe', 'data:image/svg+xml,unsafe'])('keeps unsafe file destinations inert: %s', async (src) => {
    const wrapper = await setup()
    wrapper.vm.insertFileAsset({ url: src, filename: 'Untrusted file' })
    expect(wrapper.get('a[data-type="file"]').attributes('href')).toBeUndefined()
  })

  it('preserves unresolved image references through native rich text', async () => {
    const wrapper = await setup({ modelValue: '', assetProvider: { buildUrl: () => '', parseUrl: () => null } })
    wrapper.vm.insertImageAsset({ id: 'missing-image', alt: 'Awaiting resolution' })
    expect(wrapper.get('img').attributes('src')).toBeUndefined()
    wrapper.vm.editor!.commands.setContent(wrapper.vm.editor!.getHTML())
    expect(wrapper.vm.editor!.getJSON().content?.find(node => node.type === 'image')?.attrs?.props).toMatchObject({ src: 'missing-image', alt: 'Awaiting resolution' })
  })

  it('keeps attributed inline syntax literal instead of dropping its properties', async () => {
    const wrapper = await setup()
    const literal = ':badge[text]{title="hello"}'
    wrapper.vm.editor!.commands.insertContent({ type: 'text', text: literal })
    const view = wrapper.vm.editor!.view
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', handler => handler(view, from, to, ' ', () => view.state.tr.insertText(' ', from, to)))
    if (!handled) view.dispatch(view.state.tr.insertText(' ', from, to))
    expect(wrapper.vm.editor!.getText()).toBe(`${literal} `)
    expect(wrapper.find('[data-type="inline-element"]').exists()).toBe(false)
  })

  it('hides component editing controls in read-only mode', async () => {
    const kit = await createAuthoringKit({ version: 1, policy: { version: 2, components: { note: { kind: 'block', props: {}, slots: ['default'], allowedParents: null, allowedChildren: null, media: null } } }, implementation: { note: { componentName: 'Note', props: {}, slots: ['default'] } }, authoring: { note: { label: 'Note' } }, recipes: [] })
    const wrapper = await setup({ modelValue: '<note>\nText\n</note>', authoringKit: kit })
    wrapper.vm.editor!.commands.setTextSelection(2)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.ginko-settings').attributes('hidden')).toBeUndefined()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('.ginko-settings').attributes('hidden')).toBeDefined()
  })

  it('freezes nested data before asynchronous recipe validation even with a shallow-frozen source', async () => {
    const source: AuthoringKitSourceV1 = { version: 1, policy: { version: 2, components: {} }, implementation: {}, authoring: {}, recipes: [{ id: 'heading', label: 'Heading', source: '# Heading' }] }
    const pending = createAuthoringKit(Object.freeze(source))
    expect(() => { source.recipes[0]!.source = '<unknown />' }).toThrow()
    const kit = await pending
    expect(kit.recipes[0]!.source).toBe('# Heading')
  })

  it('represents typed select values and boolean defaults without rewriting omitted values', async () => {
    const kit = await createAuthoringKit({ version: 1, policy: { version: 2, components: { card: { kind: 'block', props: { choice: { types: ['string', 'number', 'boolean'], required: false, allowedValues: [1, '1', false, 'false', ''] }, visible: { types: ['boolean'], required: false, allowedValues: null } }, slots: ['default'], allowedParents: null, allowedChildren: null, media: null } } }, implementation: { card: { componentName: 'Card', props: { choice: { types: ['string', 'number', 'boolean'], required: false }, visible: { types: ['boolean'], required: false, default: true } }, slots: ['default'] } }, authoring: { card: { label: 'Card', props: { choice: { label: 'Choice', control: 'select' }, visible: { label: 'Visible', control: 'toggle' } } } }, recipes: [] })
    const wrapper = await setup({ modelValue: '<card>\nContent\n</card>', authoringKit: kit })
    wrapper.vm.editor!.commands.setNodeSelection(0)
    await wrapper.vm.$nextTick()
    const trigger = wrapper.get('.ginko-settings button')
    await trigger.trigger('click')
    await flushPromises()
    const panel = document.getElementById(trigger.attributes('aria-controls')!)
    expect(panel).not.toBeNull()
    const settings = new DOMWrapper(panel!)
    expect(settings.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
    for (const choice of [1, '1', false, 'false', '']) {
      await settings.get('select').setValue(JSON.stringify(choice))
      expect((await wrapper.vm.flush()).ok).toBe(true)
      const output = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
      const parsed = await parseMdcDocument(output)
      expect(parsed.nodes[0]).toEqual(expect.arrayContaining([expect.objectContaining({ choice })]))
    }
  })
})
