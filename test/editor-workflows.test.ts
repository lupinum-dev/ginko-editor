// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
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

afterEach(() => {
  document.body.innerHTML = ''
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
  await flushPromises()
  await waitFor(() => Boolean(wrapper.vm.editor))
  return wrapper
}

async function clickButton(wrapper: Awaited<ReturnType<typeof mountEditor>>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`Button "${label}" is not available.`)
  await button.trigger('click')
}

async function requestImage(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
  await clickButton(wrapper, 'More')
  await clickButton(wrapper, 'Image')
}

describe('GinkoEditor browser journey', () => {
  it('opens, closes, and switches modes without changing source bytes', async () => {
    const source = '# Exact source\n\nParagraph.\n'
    const wrapper = await mountEditor(source)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.get('button[aria-pressed="false"]').trigger('click')
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
    const editor = wrapper.vm.editor!
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
    expect(wrapper.vm.editor?.getText()).toContain('Recovered')
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
    wrapper.vm.editor?.commands.insertContent(' stale')
    await wrapper.setProps({ modelValue: 'Second\n' })
    await wrapper.setProps({ modelValue: 'Third\n' })
    await flushPromises()
    await waitFor(() => wrapper.vm.editor?.getText().includes('Third') === true)
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80))
    expect(wrapper.vm.editor?.getText()).toContain('Third')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('flushes a pending edit before the host closes the component', async () => {
    const wrapper = await mountEditor('Original\n', 120)
    wrapper.vm.editor?.commands.insertContent(' pending')
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
    wrapper.vm.editor?.commands.insertContent(' first')
    const flushing = wrapper.vm.flush()
    wrapper.vm.editor?.commands.insertContent(' second')
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
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not restore a stale local emission after an external replacement', async () => {
    const wrapper = await mountEditor('First\n')
    wrapper.vm.editor?.commands.insertContent(' local')
    await waitFor(() => Boolean(wrapper.emitted('update:modelValue')))
    const staleEmission = wrapper.emitted('update:modelValue')!.at(-1)![0] as string

    await wrapper.setProps({ modelValue: 'Replacement\n' })
    await waitFor(() => wrapper.vm.editor?.getText().includes('Replacement') === true)
    await wrapper.setProps({ modelValue: staleEmission })
    await flushPromises()
    expect(wrapper.vm.editor?.getText()).toContain('Replacement')

    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').element.value).toBe('Replacement\n')
    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await waitFor(() => wrapper.attributes('data-mode') === 'visual')
    expect(wrapper.vm.editor?.getText()).toContain('Replacement')
  })

  it('keeps block separation when an image is inserted before a heading', async () => {
    const wrapper = await mountEditor('# Review document\n\nOriginal paragraph.\n')
    expect(wrapper.vm.insertImageAsset({ alt: 'Sample', url: '/sample.svg' })).toBe(true)
    const result = await wrapper.vm.flush()
    expect(result.ok).toBe(true)
    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(emitted).toContain('![Sample](/sample.svg)\n\n# Review document')

    await wrapper.setProps({ modelValue: emitted })
    await flushPromises()
    expect(wrapper.vm.editor?.getJSON().content?.some((node) => node.type === 'heading')).toBe(true)
  })

  it('keeps caller-supplied URLs when the default asset provider also receives an id', async () => {
    const wrapper = await mountEditor('')
    expect(
      wrapper.vm.insertImageAsset({
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
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.editor))
    expect(wrapper.vm.insertImageAsset({
      alt: 'Diagram',
      filename: 'diagram.png',
      id: 'asset_123456789012345',
      url: '/resolved.png',
    })).toBe(true)
    let imagePosition = -1
    wrapper.vm.editor!.state.doc.descendants((node, position) => {
      if (imagePosition < 0 && node.type.name === 'image') imagePosition = position
    })
    wrapper.vm.editor!.chain().setNodeSelection(imagePosition).run()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[aria-label="Selected image actions"]').text()).toContain('diagram.png')
    await clickButton(wrapper, 'Metadata')
    expect(wrapper.emitted('request-image-metadata')).toEqual([['asset_123456789012345']])

    await clickButton(wrapper, 'Replace')
    const request = wrapper.emitted('request-image')?.at(-1)?.[0] as EditorAssetRequest<Partial<AssetInfo>>
    expect(request.complete({ alt: 'Replacement', id: 'asset_456', url: '/replacement.png' })).toBe(true)
    await wrapper.vm.flush()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('asset_456')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).not.toContain('/replacement.png')
  })

  it('hides image metadata when the host does not support that action', async () => {
    const wrapper = await mountEditor('')
    expect(wrapper.vm.insertImageAsset({ id: 'asset_123', filename: 'diagram.png' })).toBe(true)
    let imagePosition = -1
    wrapper.vm.editor!.state.doc.descendants((node, position) => {
      if (imagePosition < 0 && node.type.name === 'image') imagePosition = position
    })
    wrapper.vm.editor!.chain().setNodeSelection(imagePosition).run()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('button').some((button) => button.text() === 'Metadata')).toBe(false)
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
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.editor))
    expect(
      wrapper.vm.insertFileAsset({
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
    await waitFor(() => replacedWrapper.vm.editor?.getText().includes('New document') === true)
    expect(replacedRequest.complete(asset)).toBe(false)
    expect(replacedWrapper.vm.editor?.getText()).toContain('New document')

    const unmountedWrapper = await mountEditor('Unmount guard\n')
    await requestImage(unmountedWrapper)
    const unmountedRequest = unmountedWrapper.emitted('request-image')![0]![0] as EditorAssetRequest<Partial<AssetInfo>>
    unmountedWrapper.unmount()
    expect(unmountedRequest.complete(asset)).toBe(false)
  })

  it('guards direct media operations outside an editable visual document', async () => {
    const wrapper = await mountEditor('Direct guard\n')
    await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
    expect(wrapper.vm.insertImageAsset({ url: '/raw.png' })).toBe(false)
    expect(wrapper.vm.insertFileAsset({ url: '/raw.pdf' })).toBe(false)
    expect(wrapper.vm.insertVideo({ src: 'https://example.com/video' })).toBe(false)
    expect(wrapper.get('textarea').element.value).toBe('Direct guard\n')

    await wrapper.get('.ginko-editor__modes button:first-child').trigger('click')
    await waitFor(() => wrapper.attributes('data-mode') === 'visual')
    await wrapper.setProps({ disabled: true })
    expect(wrapper.vm.insertImageAsset({ url: '/disabled.png' })).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not offer disabled asset features', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { enableFiles: false, enableVideo: false, modelValue: 'Features\n', syncDebounceMs: 0 },
    })
    await flushPromises()
    await waitFor(() => Boolean(wrapper.vm.editor))
    await clickButton(wrapper, 'More')
    const actions = wrapper.findAll('button').map((button) => button.text())
    expect(actions).toContain('Image')
    expect(actions).not.toContain('File')
    expect(actions).not.toContain('Video')
    expect(wrapper.vm.insertFileAsset({ url: '/file.pdf' })).toBe(false)
    expect(wrapper.vm.insertVideo({ src: 'https://example.com/video' })).toBe(false)
  })

  it('reports a flush conversion failure and keeps recovery available', async () => {
    const wrapper = await mountEditor('<Badge>\nLast safe value\n</Badge>\n', 120)
    const editor = wrapper.vm.editor!
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
    expect(wrapper.attributes('data-mode')).toBe('raw')
    expect(wrapper.get('textarea').element.value).toBe('<Badge>\nLast safe value\n</Badge>\n')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({ modelValue: '# Recovered externally\n' })
    await waitFor(() => wrapper.vm.editor?.getText().includes('Recovered externally') === true)
    expect(wrapper.emitted('conversion-recovered')).toHaveLength(1)
  })
})
