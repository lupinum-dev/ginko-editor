// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'

const state = vi.hoisted(() => ({ pause: undefined as undefined | (() => Promise<void>) }))

vi.mock('../src/lib/conversionPipeline', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/conversionPipeline')>()
  return {
    ...original,
    validateMarkdownForAuthoring: async (...args: Parameters<typeof original.validateMarkdownForAuthoring>) => {
      const result = await original.validateMarkdownForAuthoring(...args)
      const pause = state.pause
      state.pause = undefined
      if (pause) await pause()
      return result
    },
  }
})

function source(): AuthoringKitSourceV1 {
  return {
    version: 1,
    policy: {
      version: 2,
      components: {
        note: {
          kind: 'block',
          media: null,
          props: {
            title: {
              required: false,
              types: ['string'],
              allowedValues: null,
            },
          },
          slots: ['default'],
          allowedParents: null,
          allowedChildren: null,
        },
      },
    },
    implementation: {
      note: {
        componentName: 'Note',
        props: {
          title: {
            required: false,
            types: ['string'],
            options: ['one', 'two'],
          },
        },
        slots: ['default'],
      },
    },
    authoring: { note: { label: 'Note' } },
    recipes: [],
  }
}

describe('async authoring validation regressions', () => {
  for (const action of ['replace', 'unmount'] as const) {
    it(`does not emit a stale visual result when ${action} occurs during authoring validation`, async () => {
      const wrapper = mount(GinkoEditor, {
        props: {
          modelValue: 'Original\n',
          authoringKit: await createAuthoringKit(source()),
          syncDebounceMs: 10000,
        },
      })
      let unmounted = false
      try {
        await flushPromises()
        let signalStarted!: () => void
        let release!: () => void
        const started = new Promise<void>((resolve) => { signalStarted = resolve })
        const blocked = new Promise<void>((resolve) => { release = resolve })
        state.pause = () => {
          signalStarted()
          return blocked
        }
        wrapper.vm.editor!.commands.insertContent('Stale ')
        const flushing = wrapper.vm.flush()
        await started
        if (action === 'replace') await wrapper.setProps({ modelValue: 'Replacement\n' })
        else {
          wrapper.unmount()
          unmounted = true
        }
        await flushPromises()
        release()
        await flushing
        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
        if (action === 'replace') expect(wrapper.vm.rawContent).toBe('Replacement\n')
      } finally {
        state.pause = undefined
        if (!unmounted) wrapper.unmount()
      }
    })
  }

  it('blocks both active flush callers when an image placeholder is added during conversion', async () => {
    const wrapper = mount(GinkoEditor, {
      props: {
        modelValue: 'Original\n',
        authoringKit: await createAuthoringKit(source()),
        syncDebounceMs: 10000,
        imageUpload: async () => ({ url: '/image.png' }),
      },
    })
    let release!: () => void
    try {
      await flushPromises()
      let signalStarted!: () => void
      const started = new Promise<void>(resolve => { signalStarted = resolve })
      const blocked = new Promise<void>(resolve => { release = resolve })
      state.pause = () => { signalStarted(); return blocked }
      wrapper.vm.editor!.commands.insertContent('Edited ')
      const first = wrapper.vm.flush()
      await started
      const second = wrapper.vm.flush()
      wrapper.vm.editor!.commands.insertImageUpload()
      release()
      for (const result of await Promise.all([first, second])) {
        expect(result).toMatchObject({ ok: false, error: { code: 'image_upload_pending' } })
      }
    } finally { release?.(); state.pause = undefined; wrapper.unmount() }
  })

  it('emits only the newest local edit when another edit occurs during validation', async () => {
    const wrapper = mount(GinkoEditor, {
      props: {
        modelValue: 'Original\n',
        authoringKit: await createAuthoringKit(source()),
        syncDebounceMs: 10000,
      },
    })
    try {
      await flushPromises()
      let signalStarted!: () => void
      let release!: () => void
      const started = new Promise<void>((resolve) => { signalStarted = resolve })
      const blocked = new Promise<void>((resolve) => { release = resolve })
      state.pause = () => {
        signalStarted()
        return blocked
      }
      wrapper.vm.editor!.commands.insertContent('First ')
      const staleFlush = wrapper.vm.flush()
      await started
      wrapper.vm.editor!.commands.insertContent('Later ')
      release()
      await staleFlush
      const emissions = wrapper.emitted('update:modelValue')
      expect(emissions).toHaveLength(1)
      expect(emissions?.[0]?.[0]).toContain('First Later')
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    } finally {
      state.pause = undefined
      wrapper.unmount()
    }
  })

  it('finishes a pending edit against its original kit before loading a replacement kit', async () => {
    const kit = await createAuthoringKit(source())
    const replacementKit = await createAuthoringKit(source())
    const wrapper = mount(GinkoEditor, {
      props: {
        modelValue: 'Original\n',
        authoringKit: kit,
        syncDebounceMs: 10000,
      },
    })
    try {
      await flushPromises()
      let signalStarted!: () => void
      let release!: () => void
      const started = new Promise<void>((resolve) => { signalStarted = resolve })
      const blocked = new Promise<void>((resolve) => { release = resolve })
      state.pause = () => {
        signalStarted()
        return blocked
      }
      wrapper.vm.editor!.commands.insertContent('Pending ')
      const flushing = wrapper.vm.flush()
      await started
      const replacing = wrapper.setProps({ authoringKit: replacementKit })
      await flushPromises()
      release()
      await Promise.all([flushing, replacing])
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('Pending')
      expect(wrapper.vm.editor!.getText()).toContain('Pending')
    } finally {
      state.pause = undefined
      wrapper.unmount()
    }
  })
})
