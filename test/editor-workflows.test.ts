// @vitest-environment jsdom

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import { insertAsset } from './helpers/assets'
import type { AssetInfo, EditorAssetRequest } from '../src/types'

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      disconnect() {}
      observe() {}
      unobserve() {}
    }
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect()
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: function* () {},
    }) as DOMRectList
  }
})

const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

async function waitFor(condition: () => boolean, timeoutMs = 1000) {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for editor state.')
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
  }
}

async function mountEditor(modelValue: string, syncDebounceMs = 0) {
  const wrapper = mount(GinkoEditor, {
    attachTo: document.body,
    props: { modelValue, syncDebounceMs },
  })
  wrappers.push(wrapper)
  await flushPromises()
  await waitFor(() => Boolean(wrapper.vm.getEditor()))
  return wrapper
}

async function imageSettings(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
  // TipTap restores caret focus on the next animation frame after asset insertion.
  await new Promise(resolve => globalThis.requestAnimationFrame(resolve))
  const trigger = wrapper.get('button[aria-label="Image settings"]')
  if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click')
  await flushPromises()
  const panel = document.getElementById(trigger.attributes('aria-controls')!)
  if (!panel) throw new Error('The image settings did not open.')
  return new DOMWrapper(panel)
}

async function clickButton(wrapper: Awaited<ReturnType<typeof mountEditor>>, label: string) {
  const button = (await imageSettings(wrapper)).findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`Button "${label}" is not available.`)
  await button.trigger('click')
}

async function requestImage(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
  await wrapper.get('button[aria-label="Add image"]').trigger('click')
}

describe('GinkoEditor browser journey', () => {
  it('opens, closes, and switches modes without changing source bytes', async () => {
    const source = '# Exact source\n\nParagraph.\n'
    const wrapper = await mountEditor(source)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').element.value).toBe(source)
    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('edits, emits markdown, and supports undo', async () => {
    const wrapper = await mountEditor('Start\n')
    const editor = wrapper.vm.getEditor()!
    editor.commands.insertContent(' changed')
    await waitFor(() => Boolean(wrapper.emitted('update:modelValue')))
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('changed')

    editor.commands.undo()
    await waitFor(() => wrapper.emitted('update:modelValue')!.length >= 2)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).not.toContain('changed')
  })

  it('keeps invalid source intact and recovers after a valid raw edit', async () => {
    const invalid = 'Before <Badge'
    const wrapper = await mountEditor(invalid)
    expect(wrapper.attributes('data-mode')).toBe('raw')
    expect(wrapper.get('textarea').element.value).toBe(invalid)
    expect(wrapper.text()).toContain('Source only')

    await wrapper.get('textarea').setValue('# Recovered\n')
    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await flushPromises()
    await waitFor(() => wrapper.attributes('data-mode') === 'visual')
    expect(wrapper.vm.getEditor()?.getText()).toContain('Recovered')
  })

  it('falls back to source mode for unsupported content', async () => {
    const source = '<style>.card { color: red; }</style>'
    const wrapper = await mountEditor(source)
    expect(wrapper.attributes('data-mode')).toBe('raw')
    expect(wrapper.get('textarea').element.value).toBe(source)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('applies only the newest external document and cancels a pending local edit', async () => {
    const wrapper = await mountEditor('First\n', 50)
    wrapper.vm.getEditor()?.commands.insertContent(' stale')
    await wrapper.setProps({ modelValue: 'Second\n' })
    await wrapper.setProps({ modelValue: 'Third\n' })
    await flushPromises()
    await waitFor(() => wrapper.vm.getEditor()?.getText().includes('Third') === true)
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80))
    expect(wrapper.vm.getEditor()?.getText()).toContain('Third')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('flushes a pending edit before the host closes the component', async () => {
    const wrapper = await mountEditor('Original\n', 120)
    wrapper.vm.getEditor()?.commands.insertContent(' pending')
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    expect(wrapper.emitted('pending-change')?.at(-1)).toEqual([true])
    const result = await wrapper.vm.flush()
    expect(result).toEqual({ emitted: true, ok: true })
    expect(wrapper.vm.hasPendingChanges()).toBe(false)
    expect(wrapper.emitted('pending-change')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('pending')
    const emissions = wrapper.emitted('update:modelValue')!
    wrapper.unmount()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 140))
    expect(emissions).toHaveLength(1)
  })

  it('includes an edit made while a flush is converting', async () => {
    const wrapper = await mountEditor('Original\n', 120)
    wrapper.vm.getEditor()?.commands.insertContent(' first')
    const flushing = wrapper.vm.flush()
    wrapper.vm.getEditor()?.commands.insertContent(' second')
    const result = await flushing
    expect(result.ok).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('first second')
  })

  it('leaves source unchanged when the host cancels an asset request', async () => {
    const wrapper = await mountEditor('No asset\n')
    await requestImage(wrapper)
    expect(wrapper.emitted('request-image')).toHaveLength(1)
    const request = wrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    expect(request.complete(null)).toBe(false)
    expect(request.complete({ url: '/too-late.png' })).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not restore a stale local emission after an external replacement', async () => {
    const wrapper = await mountEditor('First\n')
    wrapper.vm.getEditor()?.commands.insertContent(' local')
    await waitFor(() => Boolean(wrapper.emitted('update:modelValue')))
    const staleEmission = wrapper.emitted('update:modelValue')!.at(-1)![0] as string

    await wrapper.setProps({ modelValue: 'Replacement\n' })
    await waitFor(() => wrapper.vm.getEditor()?.getText().includes('Replacement') === true)
    await wrapper.setProps({ modelValue: staleEmission })
    await flushPromises()
    expect(wrapper.vm.getEditor()?.getText()).toContain('Replacement')

    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').element.value).toBe('Replacement\n')
    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await waitFor(() => wrapper.attributes('data-mode') === 'visual')
    expect(wrapper.vm.getEditor()?.getText()).toContain('Replacement')
  })

  it('keeps block separation when an image is inserted before a heading', async () => {
    const wrapper = await mountEditor('# Review document\n\nOriginal paragraph.\n')
    expect(insertAsset(wrapper, 'image', { alt: 'Sample', url: '/sample.svg' })).toBe(true)
    const result = await wrapper.vm.flush()
    expect(result.ok).toBe(true)
    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(emitted).toContain('![Sample](/sample.svg)\n\n# Review document')

    await wrapper.setProps({ modelValue: emitted })
    await flushPromises()
    expect(wrapper.vm.getEditor()?.getJSON().content?.some((node) => node.type === 'heading')).toBe(true)
  })

  it('keeps caller-supplied URLs when the default asset provider also receives an id', async () => {
    const wrapper = await mountEditor('')
    expect(
      insertAsset(wrapper, 'image', {
        alt: 'Example',
        id: 'asset-id',
        url: 'https://example.com/image.png',
      }),
    ).toBe(true)
    await expect(wrapper.vm.flush()).resolves.toMatchObject({ ok: true })
    expect(wrapper.get('img').attributes('src')).toBe(
      'https://example.com/image.png',
    )
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain(
      'src="https://example.com/image.png"',
    )
  })

  it('exposes host-owned replacement and metadata actions for a selected stored image', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        enableImageMetadata: true,
        assetProvider: {
          buildUrl: () => '/resolved.png',
          parseUrl: () => null,
        },
        modelValue: '',
        syncDebounceMs: 0,
      },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.getEditor()))
    expect(insertAsset(wrapper, 'image', {
      alt: 'Diagram',
      filename: 'diagram.png',
      id: 'asset_123456789012345',
      url: '/resolved.png',
    })).toBe(true)
    let imagePosition = -1
    wrapper.vm.getEditor()!.state.doc.descendants((node, position) => {
      if (imagePosition < 0 && node.type.name === 'image') imagePosition = position
    })
    wrapper.vm.getEditor()!.chain().setNodeSelection(imagePosition).run()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.ginko-image img').attributes('data-filename')).toBe('diagram.png')
    await clickButton(wrapper, 'Image metadata')
    expect(wrapper.emitted('request-image-metadata')).toEqual([['asset_123456789012345']])

    await clickButton(wrapper, 'Replace image')
    const request = wrapper.emitted('request-image')?.at(-1)?.[0] as EditorAssetRequest<Partial<AssetInfo>>
    expect(request.complete({ alt: 'Replacement', id: 'asset_456', url: '/replacement.png' })).toBe(true)
    await wrapper.vm.flush()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('asset_456')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).not.toContain('/replacement.png')
  })

  it('hides image metadata when the host does not support that action', async () => {
    const wrapper = await mountEditor('')
    expect(insertAsset(wrapper, 'image', { id: 'asset_123', filename: 'diagram.png' })).toBe(true)
    let imagePosition = -1
    wrapper.vm.getEditor()!.state.doc.descendants((node, position) => {
      if (imagePosition < 0 && node.type.name === 'image') imagePosition = position
    })
    wrapper.vm.getEditor()!.chain().setNodeSelection(imagePosition).run()
    await wrapper.vm.$nextTick()
    expect((await imageSettings(wrapper)).get('button[aria-label="Image metadata"]').attributes('hidden')).toBeDefined()
  })

  it('keeps block separation when a markdown file is inserted before a heading', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        fileOutput: 'markdown',
        modelValue: '# File review\n\nOriginal paragraph.\n',
        syncDebounceMs: 120,
      },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.getEditor()))
    expect(
      insertAsset(wrapper, 'file', {
        filename: 'Guide.pdf',
        id: 'guide-id',
        url: '/guide.pdf',
      }),
    ).toBe(true)
    const result = await wrapper.vm.flush()
    expect(result.ok).toBe(true)
    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(emitted).toMatch(/\[Guide\.pdf\]\(\/guide\.pdf\)(?:\{[^\n]+\})?\n\n# File review/)
  })

  it('rejects asset completion after mode, editability, document, or lifetime changes', async () => {
    const asset = { alt: 'Diagram', url: '/diagram.png' }

    const rawWrapper = await mountEditor('Raw guard\n')
    await requestImage(rawWrapper)
    const rawRequest = rawWrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    await rawWrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    expect(rawRequest.complete(asset)).toBe(false)
    expect(rawWrapper.get('textarea').element.value).toBe('Raw guard\n')

    const disabledWrapper = await mountEditor('Disabled guard\n')
    await requestImage(disabledWrapper)
    const disabledRequest = disabledWrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    await disabledWrapper.setProps({ disabled: true })
    expect(disabledRequest.complete(asset)).toBe(false)
    expect(disabledWrapper.emitted('update:modelValue')).toBeUndefined()

    const replacedWrapper = await mountEditor('Old document\n')
    await requestImage(replacedWrapper)
    const replacedRequest = replacedWrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    await replacedWrapper.setProps({ modelValue: 'New document\n' })
    await waitFor(() => replacedWrapper.vm.getEditor()?.getText().includes('New document') === true)
    expect(replacedRequest.complete(asset)).toBe(false)
    expect(replacedWrapper.vm.getEditor()?.getText()).toContain('New document')

    const unmountedWrapper = await mountEditor('Unmount guard\n')
    await requestImage(unmountedWrapper)
    const unmountedRequest = unmountedWrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    unmountedWrapper.unmount()
    expect(unmountedRequest.complete(asset)).toBe(false)
  })

  it('guards direct media operations outside an editable visual document', async () => {
    const wrapper = await mountEditor('Direct guard\n')
    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    expect(insertAsset(wrapper, 'image', { url: '/raw.png' })).toBe(false)
    expect(insertAsset(wrapper, 'file', { url: '/raw.pdf' })).toBe(false)
    expect(insertAsset(wrapper, 'video', { src: 'https://example.com/video' })).toBe(false)
    expect(wrapper.get('textarea').element.value).toBe('Direct guard\n')

    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await waitFor(() => wrapper.attributes('data-mode') === 'visual')
    await wrapper.setProps({ disabled: true })
    expect(insertAsset(wrapper, 'image', { url: '/disabled.png' })).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not offer disabled asset features', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { enableFiles: false, enableVideo: false, modelValue: 'Features\n', syncDebounceMs: 0 },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.getEditor()))
    expect(wrapper.find('button[aria-label="Add image"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Add file"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Add video"]').exists()).toBe(false)
    expect(insertAsset(wrapper, 'file', { url: '/file.pdf' })).toBe(false)
    expect(insertAsset(wrapper, 'video', { src: 'https://example.com/video' })).toBe(false)
  })

  it('reports a flush conversion failure and keeps recovery available', async () => {
    const wrapper = await mountEditor('<Badge>\nLast safe value\n</Badge>\n', 120)
    const editor = wrapper.vm.getEditor()!
    editor.view.dispatch(editor.state.tr.setNodeMarkup(0, undefined, {
      ...editor.state.doc.firstChild?.attrs,
      props: { unsupported: () => 'not cloneable' },
    }))

    const result = await wrapper.vm.flush()
    expect(result.ok).toBe(false)
    expect((await wrapper.vm.flush()).ok).toBe(false)
    expect(wrapper.emitted('conversion-error')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.attributes('data-mode')).toBe('visual')

    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(wrapper.attributes('data-mode')).toBe('visual')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(editor.state.doc.firstChild?.attrs.props.unsupported).toBeTypeOf('function')
    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    expect(editor.state.doc.firstChild?.attrs.props.unsupported).toBeTypeOf('function')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    editor.commands.undo()
    expect((await wrapper.vm.flush()).ok).toBe(true)
    expect(wrapper.vm.hasPendingChanges()).toBe(false)
    expect(editor.state.doc.firstChild?.attrs.props.unsupported).toBeUndefined()

    await wrapper.setProps({ modelValue: '# Recovered externally\n' })
    await waitFor(() => wrapper.vm.getEditor()?.getText().includes('Recovered externally') === true)
    expect(wrapper.emitted('conversion-recovered')).toHaveLength(1)
  })
})
