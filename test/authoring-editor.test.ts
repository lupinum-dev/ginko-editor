// @vitest-environment jsdom

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'
import { insertAsset } from './helpers/assets'
import { parseMdcBody, validatePublicMarkdownAst } from '@lupinum/ginko-content/cms-contract'
import { createAuthoringKit, parseAuthoringSource, type AuthoringKitSource } from '../src/authoring'

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

function sourceFor(tag: string): AuthoringKitSource {
  return {
    authoring: { [tag]: { label: tag } },
    implementation: { [tag]: implementation },
    policy: {
      version: 2,
      components: {
        [tag]: {
          kind: 'block',
          media: null,
          props: {},
          slots: ['default'],
          allowedParents: null,
          allowedChildren: null,
        },
      },
    },
    recipes: [{ id: tag, label: tag, source: `<${tag}>\nText\n</${tag}>` }],
    version: 1,
  }
}

function configurableSource(): AuthoringKitSource {
  return {
    authoring: {
      info: {
        label: 'Information',
        props: {
          appearance: { control: 'select', label: 'Appearance' },
          count: { control: 'number', label: 'Count' },
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
          count: { required: false, types: ['number'] },
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
            count: { required: false, types: ['number'], allowedValues: null },
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

function layoutSource(): AuthoringKitSource {
  return {
    authoring: {
      column: { label: 'Column' },
      layout: { label: 'Layout' },
    },
    implementation: {
      column: { componentName: 'Column', props: {}, slots: ['default'] },
      layout: { componentName: 'Layout', props: {}, slots: ['default'] },
    },
    policy: {
      version: 2,
      components: {
        column: {
          kind: 'block',
          media: null,
          props: {},
          slots: ['default'],
          allowedParents: ['layout'],
          allowedChildren: null,
        },
        layout: {
          kind: 'block',
          media: null,
          props: {},
          slots: ['default'],
          allowedParents: null,
          allowedChildren: ['column'],
        },
      },
    },
    recipes: [{
      id: 'two-columns',
      label: 'Two columns',
      source: '<layout>\n<column>\nFirst\n</column>\n<column>\nSecond\n</column>\n</layout>',
    }],
    version: 1,
  }
}

async function openSettings(wrapper: ReturnType<typeof mount<typeof GinkoEditor>>) {
  const trigger = wrapper.get('.ProseMirror-selectednode .ginko-settings button')
  if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click')
  await flushPromises()
  const panel = document.getElementById(trigger.attributes('aria-controls')!)
  if (!panel) throw new Error('The selected component settings did not open.')
  return new DOMWrapper(panel)
}

function pasteMarkdown(element: Element, markdown: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => type === 'text/markdown' ? markdown : '',
      types: ['text/markdown'],
    },
  })
  element.dispatchEvent(event)
  return event
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
      wrapper.vm.getEditor()!.chain().setNodeSelection(0).run()
      await wrapper.vm.$nextTick()

      const settings = await openSettings(wrapper)
      const icon = settings.get('input[type="text"]')
      ;(icon.element as HTMLInputElement).focus()
      await icon.setValue('info')
      expect(document.activeElement).toBe(icon.element)
      expect(wrapper.find('.ginko-settings').exists()).toBe(true)

      const appearance = settings.get('select')
      ;(appearance.element as HTMLSelectElement).focus()
      await appearance.setValue(JSON.stringify('quiet'))
      expect(document.activeElement).toBe(appearance.element)

      const visible = settings.get('input[type="checkbox"]')
      ;(visible.element as HTMLInputElement).focus()
      await visible.setValue(false)
      expect(document.activeElement).toBe(visible.element)
      expect(wrapper.find('.ginko-settings').exists()).toBe(true)
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
      wrapper.vm.getEditor()!.view.dispatch(wrapper.vm.getEditor()!.state.tr.insertText('/note'))
      await flushPromises()
      expect(wrapper.text()).toContain('Information')
      expect(wrapper.text()).not.toContain('No matching blocks.')
      await surface.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('<info>')

      await surface.trigger('keydown', { key: '/' })
      await surface.trigger('keydown', { key: 'Escape' })
      expect(document.activeElement).toBe(surface.element)

      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(document.activeElement).toBe(wrapper.get('input[placeholder="Search blocks"]').element)
      await wrapper.get('input[placeholder="Search blocks"]').trigger('keydown', { key: 'Escape' })
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 10))
      expect(document.activeElement).toBe(surface.element)
    } finally {
      wrapper.unmount()
    }
  })

  it('does not open slash insertion during composition or inside code blocks', async () => {
    const kit = await createAuthoringKit(sourceFor('info'))
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: kit,
        modelValue: '~~~text\n/code\n~~~',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const surface = wrapper.get('.ProseMirror')
      wrapper.vm.getEditor()!.chain().setTextSelection(3).focus().run()
      await surface.trigger('keydown', { isComposing: true, key: '/' })
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(false)
      await surface.trigger('keydown', { key: '/' })
      expect(wrapper.find('.ginko-editor__insert-menu').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('duplicates, deletes, and undoes selected components as single history actions', async () => {
    const kit = await createAuthoringKit(sourceFor('info'))
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: kit,
        modelValue: '<info>\nFirst\n</info>\n\n<info>\nSecond\n</info>',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      wrapper.vm.getEditor()!.chain().setNodeSelection(0).run()
      await wrapper.vm.$nextTick()
      const actions = async () => (await openSettings(wrapper)).get('.ginko-editor__block-actions')

      await (await actions()).get('button[data-action="duplicate"]').trigger('click')
      await flushPromises()
      await wrapper.vm.flush()
      expect((wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string).match(/First/g)).toHaveLength(2)
      await (await actions()).get('button[data-action="delete"]').trigger('click')
      await flushPromises()
      await wrapper.vm.flush()
      expect((wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string).match(/First/g)).toHaveLength(1)
      wrapper.vm.getEditor()!.commands.undo()
      await wrapper.vm.flush()
      expect((wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string).match(/First/g)).toHaveLength(2)
    } finally {
      wrapper.unmount()
    }
  })

  it('preserves typed empty, zero, false, and omitted properties while invalid numbers stay local', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(configurableSource()),
        modelValue: '<info icon="" :count="0" :visible="false">\nContext\n</info>',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      wrapper.vm.getEditor()!.chain().setNodeSelection(0).run()
      await wrapper.vm.$nextTick()

      const settings = await openSettings(wrapper)
      const inputs = settings.findAll('.ginko-editor__fields input[type="text"]')
      const icon = inputs.find(input => input.attributes('inputmode') === undefined)
      const count = inputs.find(input => input.attributes('inputmode') === 'decimal')
      if (!icon || !count) throw new Error('Expected text and number authoring controls.')

      await icon.setValue('temporary')
      await icon.setValue('')
      await count.setValue('not-a-number')
      expect(wrapper.text()).toContain('Enter a valid number.')
      await wrapper.vm.flush()
      const invalidEmission = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string
      expect(invalidEmission).toContain('icon=""')
      expect(invalidEmission).toContain(':count="0"')
      expect(invalidEmission).toContain(':visible="false"')
      expect(invalidEmission).not.toContain('appearance=')

      await count.setValue('0')
      expect(wrapper.text()).not.toContain('Enter a valid number.')
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain(':count="0"')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the restored canonical number after undo', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(configurableSource()),
        modelValue: '<info :count="1">\nOriginal\n</info>',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      wrapper.vm.getEditor()!.commands.setNodeSelection(0)
      await wrapper.vm.$nextTick()
      const settings = await openSettings(wrapper)
      await settings.get('input[inputmode="decimal"]').setValue('5')
      await wrapper.vm.flush()
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(5)

      wrapper.vm.getEditor()!.commands.undo()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(1)
      expect((settings.get('input[inputmode="decimal"]').element as HTMLInputElement).value).toBe('1')
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps decimal and negative prefixes editable until they form complete numbers', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(configurableSource()),
        modelValue: '<info :count="0">\nOriginal\n</info>',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      wrapper.vm.getEditor()!.commands.setNodeSelection(0)
      await wrapper.vm.$nextTick()
      const input = (await openSettings(wrapper)).get('input[inputmode="decimal"]')

      await input.setValue('1.')
      expect((input.element as HTMLInputElement).value).toBe('1.')
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(0)
      await input.setValue('1.5')
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(1.5)

      await input.setValue('-')
      expect((input.element as HTMLInputElement).value).toBe('-')
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(1.5)
      await input.setValue('-2.5')
      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(-2.5)
      expect(wrapper.text()).not.toContain('Enter a valid number.')
    } finally {
      wrapper.unmount()
    }
  })

  it('discards an invalid number draft when the host replaces the document', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(configurableSource()),
        modelValue: '<info :count="1">\nOriginal\n</info>',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      wrapper.vm.getEditor()!.commands.setNodeSelection(0)
      await wrapper.vm.$nextTick()
      await (await openSettings(wrapper)).get('input[inputmode="decimal"]').setValue('bad')
      await wrapper.setProps({ modelValue: '<info :count="42">\nReplacement\n</info>' })
      await flushPromises()
      wrapper.vm.getEditor()!.commands.setNodeSelection(0)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.getEditor()!.state.doc.firstChild!.attrs.props.count).toBe(42)
      const restored = (await openSettings(wrapper)).get('input[inputmode="decimal"]')
      expect((restored.element as HTMLInputElement).value).toBe('42')
      expect(wrapper.text()).not.toContain('Enter a valid number.')
    } finally {
      wrapper.unmount()
    }
  })

  it('validates Markdown paste through the active authoring kit before insertion', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: await createAuthoringKit(sourceFor('info')),
        modelValue: 'Original',
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const surface = wrapper.get('.ProseMirror')
      wrapper.vm.getEditor()!.commands.focus('end')

      const rejected = pasteMarkdown(surface.element, '<unknown>\nUnsafe\n</unknown>')
      expect(rejected.defaultPrevented).toBe(true)
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      expect(wrapper.vm.getEditor()!.getText()).toBe('Original')

      const accepted = pasteMarkdown(surface.element, '<info>\nPasted safely\n</info>')
      expect(accepted.defaultPrevented).toBe(true)
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('<info>')
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('Pasted safely')
    } finally {
      wrapper.unmount()
    }
  })

  it('validates pasted components in their resulting parent context', async () => {
    const kit = await createAuthoringKit(layoutSource())
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: kit,
        modelValue: kit.recipes[0].source,
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const surface = wrapper.get('.ProseMirror')
      const positions: number[] = []
      wrapper.vm.getEditor()!.state.doc.descendants((node, pos) => {
        if (node.type.name === 'element' && node.attrs.tag === 'column') positions.push(pos)
      })
      wrapper.vm.getEditor()!.chain().setNodeSelection(positions[0]!).focus().run()
      pasteMarkdown(surface.element, '<column>\nReplacement\n</column>')
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      await wrapper.vm.flush()
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatch(/Replacement[\s\S]*Second/)

      wrapper.vm.getEditor()!.chain().setNodeSelection(0).focus().run()
      pasteMarkdown(surface.element, '<column>\nInvalid root\n</column>')
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      expect(wrapper.vm.getEditor()!.getText()).not.toContain('Invalid root')
      expect(wrapper.vm.getEditor()!.getJSON().content?.[0]).toMatchObject({
        attrs: { tag: 'layout' },
        type: 'element',
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps column boundaries valid through Enter, Backspace, parent deletion, and undo', async () => {
    const kit = await createAuthoringKit(layoutSource())
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: kit,
        modelValue: kit.recipes[0].source,
        syncDebounceMs: 0,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const surface = wrapper.get('.ProseMirror')
      const columnPositions = () => {
        const positions: number[] = []
        wrapper.vm.getEditor()!.state.doc.descendants((node, pos) => {
          if (node.type.name === 'element' && node.attrs.tag === 'column') positions.push(pos)
        })
        return positions
      }

      wrapper.vm.getEditor()!.chain().setTextSelection(columnPositions()[0]! + 2).focus().run()
      await surface.trigger('keydown', { key: 'Enter' })
      expect(columnPositions()).toHaveLength(2)

      wrapper.vm.getEditor()!.chain().setTextSelection(columnPositions()[1]! + 2).focus().run()
      await surface.trigger('keydown', { key: 'Backspace' })
      expect(columnPositions()).toHaveLength(2)
      const beforeDelete = wrapper.vm.getEditor()!.getText()

      wrapper.vm.getEditor()!.chain().setNodeSelection(0).run()
      await wrapper.vm.$nextTick()
      await (await openSettings(wrapper)).get('button[data-action="delete"]').trigger('click')
      await flushPromises()
      expect(columnPositions()).toHaveLength(0)
      wrapper.vm.getEditor()!.commands.undo()
      expect(columnPositions()).toHaveLength(2)
      expect(wrapper.vm.getEditor()!.getText()).toBe(beforeDelete)
      expect((await wrapper.vm.flush()).ok).toBe(true)
      await expect(parseAuthoringSource(
        wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string,
        kit,
      )).resolves.toBeDefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('checks recipe placement against the selected component parent', async () => {
    const kit = await createAuthoringKit(layoutSource())
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        authoringKit: kit,
        modelValue: kit.recipes[0].source,
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      let columnPosition = -1
      wrapper.vm.getEditor()!.state.doc.descendants((node, pos) => {
        if (columnPosition < 0 && node.type.name === 'element' && node.attrs.tag === 'column') {
          columnPosition = pos
        }
      })
      wrapper.vm.getEditor()!.chain().setNodeSelection(columnPosition).run()
      await wrapper.vm.$nextTick()
      await wrapper.get('button[aria-label="Insert block"]').trigger('click')
      await wrapper.get('input[placeholder="Search blocks"]').setValue('Two columns')
      await wrapper.get('input[placeholder="Search blocks"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.text()).toContain('This block cannot be inserted safely here.')
      let layouts = 0
      wrapper.vm.getEditor()!.state.doc.descendants((node) => {
        if (node.type.name === 'element' && node.attrs.tag === 'layout') layouts += 1
      })
      expect(layouts).toBe(1)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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
          buildUrl: () => 'blob:https://editor.example.test/resolved',
          parseUrl: () => null,
        },
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      const image = wrapper.get('img')
      expect(image.attributes('src')).toBe('blob:https://editor.example.test/resolved')
      expect(image.attributes('src')).not.toContain('asset_123')
      wrapper.vm.getEditor()!.chain()
        .setTextSelection(wrapper.vm.getEditor()!.state.doc.content.size)
        .insertContent('Edited')
        .run()
      await wrapper.vm.flush()
      const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
      expect(emitted).toContain('asset_123')
    } finally {
      wrapper.unmount()
    }
  })

  it('inserts a host image beside a custom component without leaving authoring mode', async () => {
    const kit = await createAuthoringKit(sourceFor('learning-objective'))
    const wrapper = mount(GinkoEditor, {
      props: {
        authoringKit: kit,
        imageOutput: 'markdown',
        modelValue:
          '<learning-objective>\nExplain Fourier.\n</learning-objective>\n\nAdditionally.\n',
        assetProvider: {
          buildUrl: () => 'blob:https://editor.example.test/resolved',
          parseUrl: () => null,
        },
      },
    })
    try {
      await flushPromises()
      await new Promise(resolve => globalThis.setTimeout(resolve, 30))
      let paragraphEnd = -1
      wrapper.vm.getEditor()!.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.textContent === 'Additionally.') {
          paragraphEnd = pos + node.nodeSize - 1
        }
      })
      expect(paragraphEnd).toBeGreaterThan(0)
      wrapper.vm.getEditor()!.commands.setTextSelection(paragraphEnd)
      expect(
        insertAsset(wrapper, 'image', {
          alt: 'Diagram',
          filename: 'diagram.png',
          id: 'asset_123',
        }),
      ).toBe(true)
      await expect(wrapper.vm.flush()).resolves.toMatchObject({ ok: true })
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain(
        '![Diagram](asset_123)',
      )
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
