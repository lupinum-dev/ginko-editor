// @vitest-environment jsdom
import { Extension } from '@tiptap/core'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSource } from '../src/authoring'
import type { EditorCollaborationSession } from '../src/collaboration'
import * as conversion from '../src/lib/conversionPipeline'
import type { EditorFlushResult, ImageUploadHandler } from '../src/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})

const wrappers: ReturnType<typeof mount<typeof GinkoEditor>>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

async function waitFor(condition: () => boolean, timeoutMs = 1000) {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for editor state.')
    await new Promise(resolve => globalThis.setTimeout(resolve, 10))
  }
}

async function setup(props: Record<string, unknown> = {}) {
  const wrapper = mount(GinkoEditor, {
    attachTo: document.body,
    props: { modelValue: 'Hello world\n', syncDebounceMs: 0, ...props },
  })
  wrappers.push(wrapper)
  await flushPromises()
  await waitFor(() => wrapper.attributes('data-mode') === 'visual')
  return wrapper
}

function kitSource(label = 'Note'): AuthoringKitSource {
  return {
    version: 1,
    implementation: {
      note: { componentName: 'Note', props: { title: { required: false, types: ['string'] } }, slots: ['default'] },
    },
    policy: {
      version: 2,
      components: {
        note: {
          kind: 'block',
          media: null,
          props: { title: { required: false, types: ['string'], allowedValues: null } },
          slots: ['default'],
          allowedParents: null,
          allowedChildren: null,
        },
      },
    },
    authoring: { note: { label, props: { title: { control: 'text', label: 'Title' } } } },
    recipes: [],
  }
}

function fakeSession(close = vi.fn()) {
  return {
    state: { status: 'synced', pendingSteps: 0 },
    subscribe: () => () => {},
    onPeersChange: () => () => {},
    extension: Extension.create({ name: 'fakeCollaboration' }),
    initialDocument: { type: 'doc', content: [{ type: 'paragraph' }] },
    canEdit: true,
    close,
    flush: async () => {},
    getRecovery: () => undefined,
    retry: () => {},
  } as unknown as EditorCollaborationSession
}

describe('public editor handle', () => {
  it('exposes exactly the documented handle', async () => {
    const wrapper = await setup()
    const exposed = (wrapper.vm.$ as unknown as { exposed: Record<string, unknown> }).exposed
    expect(Object.keys(exposed).sort()).toEqual(
      ['flush', 'focus', 'getEditor', 'hasPendingChanges', 'removeSelectedMedia'],
    )
    expect(wrapper.vm.getEditor()?.getText()).toBe('Hello world')
  })

  it('focuses the start or end of the visual and source editors', async () => {
    const wrapper = await setup()
    wrapper.vm.focus('end')
    const editor = wrapper.vm.getEditor()!
    await waitFor(() => editor.state.selection.from === editor.state.doc.content.size - 1)
    wrapper.vm.focus('start')
    await waitFor(() => editor.state.selection.from === 1)
    await wrapper.get('.ginko-editor__modes button:last-child').trigger('click')
    await flushPromises()
    const source = wrapper.get<HTMLTextAreaElement>('textarea').element
    wrapper.vm.focus('end')
    expect(document.activeElement).toBe(source)
    expect(source.selectionStart).toBe(source.value.length)
    wrapper.vm.focus('start')
    expect(source.selectionStart).toBe(0)
  })

  it('reports an unfinished image operation without a fake conversion payload', async () => {
    const upload: ImageUploadHandler = () => new Promise(() => {})
    const wrapper = await setup({ imageUpload: upload })
    wrapper.vm.getEditor()!.commands.insertImageUpload()
    await flushPromises()
    const result: EditorFlushResult = await wrapper.vm.flush()
    expect(result).toEqual({
      ok: false,
      error: { code: 'image_upload_pending', message: 'Finish or remove the image upload before leaving the editor.' },
    })
  })
})

describe('host option identity', () => {
  it('does not reload the document for an equal new authoring kit', async () => {
    const source = '::note{title="Keep"}\nBody\n::\n'
    const wrapper = await setup({ modelValue: source, authoringKit: await createAuthoringKit(kitSource()) })
    const prepare = vi.spyOn(conversion, 'prepareMarkdownForVisualEditing')
    const document = wrapper.vm.getEditor()!.state.doc
    for (let render = 0; render < 3; render += 1) {
      await wrapper.setProps({ authoringKit: await createAuthoringKit(kitSource()) })
      await flushPromises()
    }
    expect(prepare).not.toHaveBeenCalled()
    expect(wrapper.vm.getEditor()!.state.doc).toBe(document)
    await wrapper.setProps({ authoringKit: await createAuthoringKit(kitSource('Renamed note')) })
    await flushPromises()
    // A label change refreshes node views but keeps the document and its policy.
    expect(prepare).not.toHaveBeenCalled()
    expect(wrapper.find('.ginko-block').attributes('data-label')).toBe('Renamed note')
    const changed = kitSource()
    changed.policy.components.note.props.title.allowedValues = ['Keep']
    await wrapper.setProps({ authoringKit: await createAuthoringKit(changed) })
    await waitFor(() => prepare.mock.calls.length > 0)
  })

  it('warns once in development and invalidates the binding when the session changes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const close = vi.fn()
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { modelValue: '', collaboration: fakeSession(close) },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.setProps({ collaboration: fakeSession() })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('collaboration prop is read only when the editor mounts')
    expect(close).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Reopen this editor')
  })
})

describe('reactive presentation options', () => {
  it('updates the label, placeholder, and image limit without a new editor', async () => {
    const wrapper = await setup({ modelValue: '', ariaLabel: 'Article body', placeholder: 'Write here' })
    const editor = wrapper.vm.getEditor()!
    expect(editor.view.dom.getAttribute('aria-label')).toBe('Article body')
    expect(wrapper.find('[data-placeholder="Write here"]').exists()).toBe(true)
    await wrapper.setProps({ ariaLabel: 'Summary', placeholder: 'Start the summary' })
    await flushPromises()
    expect(wrapper.vm.getEditor()).toBe(editor)
    expect(editor.view.dom.getAttribute('aria-label')).toBe('Summary')
    expect(wrapper.find('[data-placeholder="Start the summary"]').exists()).toBe(true)
    await wrapper.get('.ginko-editor__modes button:last-child').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').attributes('aria-label')).toBe('Summary markdown source')
  })

  it('uses the image size limit in its hint and validation', async () => {
    const upload = vi.fn<ImageUploadHandler>(async () => ({ url: '/saved.png' }))
    const wrapper = await setup({ imageUpload: upload, imageMaxBytes: 512 * 1024 })
    wrapper.vm.getEditor()!.commands.insertImageUpload()
    await flushPromises()
    expect(wrapper.get('.ginko-image-upload__hint').text()).toBe('Choose an image file · up to 512 KB')
    const input = wrapper.get<HTMLInputElement>('.ginko-image-upload input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([new Uint8Array(512 * 1024 + 1)], 'large.png', { type: 'image/png' })],
    })
    await input.trigger('change')
    expect(wrapper.text()).toContain('Choose an image smaller than 512 KB.')
    expect(upload).not.toHaveBeenCalled()
  })

  it('translates the default labels through messages', async () => {
    const wrapper = await setup({
      messages: { contentLabel: 'Inhalt', markdownSourceLabel: '{label}: Markdown-Quelle' },
    })
    expect(wrapper.vm.getEditor()!.view.dom.getAttribute('aria-label')).toBe('Inhalt')
    await wrapper.get('.ginko-editor__modes button:last-child').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').attributes('aria-label')).toBe('Inhalt: Markdown-Quelle')
  })
})

describe('editor accessibility', () => {
  it('groups modes, links the insert trigger only while open, and announces no routine conversion', async () => {
    const wrapper = await setup({ syncDebounceMs: 10000 })
    expect(wrapper.get('.ginko-editor__modes').attributes('role')).toBe('group')
    const trigger = wrapper.get('.ginko-editor__insert-trigger')
    expect(trigger.attributes('aria-controls')).toBeUndefined()
    await trigger.trigger('click')
    await flushPromises()
    const controls = trigger.attributes('aria-controls')
    expect(controls && document.getElementById(controls)).toBeTruthy()
    await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Escape' })
    wrapper.vm.getEditor()!.commands.insertContent('More ')
    await flushPromises()
    expect(wrapper.get('.ginko-editor__status').text()).toBe('Converting changes')
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it('keeps table size cells out of the tab order', async () => {
    const wrapper = await setup()
    await wrapper.get('button[aria-label="Insert table"]').trigger('click')
    await flushPromises()
    const cells = document.querySelectorAll('.ginko-table-size button')
    expect(cells).toHaveLength(25)
    expect([...cells].every(cell => cell.getAttribute('tabindex') === '-1')).toBe(true)
  })
})
