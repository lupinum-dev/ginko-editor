// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'

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

  it('cancels a pending edit when the component unmounts', async () => {
    const wrapper = await mountEditor('Original\n', 50)
    wrapper.vm.editor?.commands.insertContent(' pending')
    wrapper.unmount()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('leaves source unchanged when the host cancels an asset request', async () => {
    const wrapper = await mountEditor('No asset\n')
    await wrapper.get('button[title="Image"], button:nth-last-child(3)').trigger('click')
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20))
    expect(wrapper.emitted('request-image')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
