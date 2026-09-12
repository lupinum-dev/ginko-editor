// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import { parseMdcBody, validatePublicMarkdownAst } from '@lupinum/ginko-content/cms-contract'
import { createAuthoringKit, parseAuthoringSource, type AuthoringKitSourceV1 } from '../src/authoring'

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      disconnect() {}
      observe() {}
      unobserve() {}
    }
  }
  if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => new DOMRect()
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: function* () {},
    }) as DOMRectList
  }
})

const implementation = {
  componentName: 'HostBlock',
  props: {},
  slots: ['default'],
} as const

function sourceFor(tag: string): AuthoringKitSourceV1 {
  return {
    authoring: { [tag]: { label: tag } },
    implementation: { [tag]: implementation },
    policy: {
      version: 2,
      components: {
        [tag]: { kind: 'block', media: null, props: {}, slots: ['default'], allowedParents: null, allowedChildren: null },
      },
    },
    recipes: [{ id: tag, label: tag, source: `<${tag}>\nText\n</${tag}>` }],
    version: 1,
  }
}

function configurableSource(): AuthoringKitSourceV1 {
  return {
    authoring: {
      info: {
        label: 'Information',
        props: {
          appearance: { control: 'select', label: 'Appearance' },
          icon: { control: 'text', label: 'Icon' },
          visible: { control: 'toggle', label: 'Visible' },
        },
      },
    },
    implementation: {
      info: {
        componentName: 'Information',
        props: {
          appearance: { options: ['quiet', 'tint'], required: false, types: ['string'] },
          icon: { required: false, types: ['string'] },
          visible: { required: false, types: ['boolean'] },
        },
        slots: ['default'],
      },
    },
    policy: {
      version: 2,
      components: {
        info: {
          kind: 'block',
          media: null,
          props: {
            appearance: { required: false, types: ['string'], allowedValues: ['quiet', 'tint'] },
            icon: { required: false, types: ['string'], allowedValues: null },
            visible: { required: false, types: ['boolean'], allowedValues: null },
          },
          slots: ['default'],
          allowedParents: null,
          allowedChildren: null,
        },
      },
    },
    recipes: [],
    version: 1,
  }
}

describe('editor-specific authoring kits', () => {
  it('keeps natural form focus while selected-component properties update', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(configurableSource()),
        modelValue: '<info appearance="tint" visible>\nContext\n</info>',
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      wrapper.vm.editor!.chain().setNodeSelection(0).run()
      await wrapper.vm.$nextTick()

      const icon = wrapper.get('input[type="text"]')
      ;(icon.element as HTMLInputElement).focus()
      await icon.setValue('info')
      expect(document.activeElement).toBe(icon.element)
      expect(wrapper.find('.ginko-editor__inspector').exists()).toBe(true)

      const appearance = wrapper.get('select')
      ;(appearance.element as HTMLSelectElement).focus()
      await appearance.setValue('quiet')
      expect(document.activeElement).toBe(appearance.element)

      const visible = wrapper.get('input[type="checkbox"]')
      ;(visible.element as HTMLInputElement).focus()
      await visible.setValue(false)
      expect(document.activeElement).toBe(visible.element)
      expect(wrapper.find('.ginko-editor__inspector').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('inserts a real recipe through slash-keyword search and restores focus on cancel', async () => {
    const kit = await createAuthoringKit({
      ...sourceFor('info'),
      recipes: [{
        id: 'information',
        keywords: ['note', 'callout'],
        label: 'Information',
        source: '<info>\nUseful context.\n</info>',
      }],
    })
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: { authoringKit: kit, modelValue: '', syncDebounceMs: 0 },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const surface = wrapper.get('.ProseMirror')
      ;(surface.element as HTMLElement).focus()
      await surface.trigger('keydown', { key: '/' })
      for (const key of 'note') await surface.trigger('keydown', { key })
      expect(wrapper.text()).toContain('Information')
      expect(wrapper.text()).not.toContain('No matching blocks.')
      await surface.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('<info>')

      await surface.trigger('keydown', { key: '/' })
      await surface.trigger('keydown', { key: 'Escape' })
      expect(document.activeElement).toBe(surface.element)
    } finally {
      wrapper.unmount()
    }
  })

  it('preserves stored image identities and displays only the host-resolved URL', async () => {
    const source = '![Example](asset_123)\n'
    const kit = await createAuthoringKit({
      version: 1,
      policy: { version: 2, components: {} },
      implementation: {},
      authoring: {},
      recipes: [],
    })
    await expect(parseAuthoringSource(source, kit)).resolves.toBeDefined()
    const parsed = await parseMdcBody(source, { autoClose: false })
    expect(validatePublicMarkdownAst(parsed.body, kit.policy)).toMatchObject({ ok: false })

    const wrapper = mount(GinkoEditor, {
      props: {
        authoringKit: kit,
        modelValue: source,
        assetProvider: {
          buildUrl: () => 'https://assets.example.test/resolved.png',
          parseUrl: () => null,
        },
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const image = wrapper.get('img')
      expect(image.attributes('src')).toBe('https://assets.example.test/resolved.png')
      expect(image.attributes('src')).not.toContain('asset_123')
      wrapper.vm.editor!.chain()
        .setTextSelection(wrapper.vm.editor!.state.doc.content.size)
        .insertContent('Edited')
        .run()
      await wrapper.vm.flush()
      const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
      expect(emitted).toContain('asset_123')
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps component permissions isolated between two mounted editors', async () => {
    const [objectiveKit, noteKit] = await Promise.all([
      createAuthoringKit(sourceFor('learning-objective')),
      createAuthoringKit(sourceFor('host-note')),
    ])
    const source = '<learning-objective>\nKeep this source.\n</learning-objective>'
    const objectiveEditor = mount(GinkoEditor, {
      props: { authoringKit: objectiveKit, modelValue: source },
    })
    const noteEditor = mount(GinkoEditor, {
      props: { authoringKit: noteKit, modelValue: source },
    })
    await flushPromises()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 30))

    expect(objectiveEditor.attributes('data-mode')).toBe('visual')
    expect(noteEditor.attributes('data-mode')).toBe('raw')
    expect(noteEditor.get('textarea').element.value).toBe(source)
    expect(noteEditor.text()).toContain('Source only')
    expect(objectiveEditor.emitted('conversion-error')).toBeUndefined()

    objectiveEditor.unmount()
    noteEditor.unmount()
  })
})
