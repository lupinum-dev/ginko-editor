// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { TextSelection } from '@tiptap/pm/state'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  composeAuthoringKits,
  createAuthoringKit,
  createGinkoLayoutKit,
  ginkoLayoutKitSource,
  type AuthoringKit,
  type AuthoringKitSource,
} from '../src/authoring'
import GinkoEditor from '../src/GinkoEditor.vue'
import { containerItemsKey } from '../src/lib/extensions/container-items'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})

type Wrapper = ReturnType<typeof mount<typeof GinkoEditor>>
const wrappers: Wrapper[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

const tabs = '::tabs\n:::tab{label="First"}\nFirst body.\n:::\n\n:::tab{label="Second"}\nSecond body.\n:::\n::'

async function setup(modelValue: string, kit?: AuthoringKit) {
  const wrapper = mount(GinkoEditor, {
    attachTo: document.body,
    props: { modelValue, syncDebounceMs: 0, authoringKit: kit ?? await createGinkoLayoutKit() },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

async function saved(wrapper: Wrapper) {
  expect((await wrapper.vm.flush()).ok).toBe(true)
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string | undefined
}

function tabNames(wrapper: Wrapper) {
  return wrapper.findAll('[role="tab"]').map(tab => tab.text())
}

function items(wrapper: Wrapper, presentation: string) {
  return wrapper.findAll(`[data-ginko-item="${presentation}"][data-ginko-item-start="true"]`)
}

function caretIn(wrapper: Wrapper, text: string) {
  const editor = wrapper.vm.getEditor()!
  let target = -1
  editor.state.doc.descendants((node, pos) => {
    if (target < 0 && node.isText && node.text?.includes(text)) target = pos + 1
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, target)))
}

describe('tabs container', () => {
  it('shows one tab body and selects tabs without changing the document', async () => {
    const wrapper = await setup(tabs)
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
    const [first, second] = items(wrapper, 'tabs')
    expect(first.attributes('data-ginko-item-hidden')).toBeUndefined()
    expect(second.attributes('data-ginko-item-hidden')).toBe('true')
    const before = wrapper.vm.getEditor()!.state.doc
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(wrapper.vm.getEditor()!.state.doc).toBe(before)
    expect(items(wrapper, 'tabs')[0].attributes('data-ginko-item-hidden')).toBe('true')
    expect(items(wrapper, 'tabs')[1].attributes('data-ginko-item-hidden')).toBeUndefined()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Second')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('follows the caret into a hidden tab', async () => {
    const wrapper = await setup(tabs)
    caretIn(wrapper, 'Second body')
    await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Second')
  })

  it('moves between tabs with arrow keys and a roving tab stop', async () => {
    const wrapper = await setup(tabs)
    const strip = () => wrapper.findAll('[role="tab"]')
    expect(strip().map(tab => tab.attributes('tabindex'))).toEqual(['0', '-1'])
    await strip()[0].trigger('keydown', { key: 'ArrowRight' })
    expect(strip().map(tab => tab.attributes('aria-selected'))).toEqual(['false', 'true'])
    expect(strip().map(tab => tab.attributes('tabindex'))).toEqual(['-1', '0'])
    await strip()[1].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('First')
    await strip()[0].trigger('keydown', { key: 'End' })
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Second')
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Tabs items')
  })

  it('adds a tab after the selected tab in one undo step', async () => {
    const wrapper = await setup(tabs)
    await wrapper.get('.ginko-items__add--strip').trigger('click')
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'New tab', 'Second'])
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('New tab')
    const markdown = await saved(wrapper)
    expect(markdown?.match(/:::tab/g)).toHaveLength(3)
    wrapper.vm.getEditor()!.commands.undo()
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
  })

  it('renames a tab from the strip', async () => {
    const wrapper = await setup(tabs)
    await wrapper.findAll('[role="tab"]')[1].trigger('keydown', { key: 'F2' })
    const input = wrapper.get<HTMLInputElement>('.ginko-items__rename')
    await input.setValue('Renamed')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'Renamed'])
    expect(await saved(wrapper)).toContain(':::tab{label="Renamed"}')
    wrapper.vm.getEditor()!.commands.undo()
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
  })

  it('confirms before it removes a tab with content and keeps the last tab', async () => {
    const wrapper = await setup(tabs)
    const remove = () => wrapper.findAll('.ginko-items__remove')
    await remove()[0].trigger('click')
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
    expect(remove()[0].attributes('data-confirm')).toBe('true')
    expect(wrapper.text()).toContain('Select again to confirm.')
    await remove()[0].trigger('click')
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['Second'])
    expect(remove()).toHaveLength(0)
    await wrapper.get('[role="tab"]').trigger('keydown', { key: 'Delete' })
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['Second'])
    wrapper.vm.getEditor()!.commands.undo()
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
  })

  it('refuses a rename outside the label policy', async () => {
    const source = structuredClone(ginkoLayoutKitSource) as unknown as AuthoringKitSource
    source.policy.components.tab.props.label = {
      types: ['string'],
      required: false,
      allowedValues: ['First', 'Second', 'New tab'],
    }
    source.recipes = []
    const wrapper = await setup(tabs, await createAuthoringKit(source))
    await wrapper.findAll('[role="tab"]')[0].trigger('dblclick')
    const input = wrapper.get<HTMLInputElement>('.ginko-items__rename')
    await input.setValue('Not allowed')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
    expect(wrapper.text()).toContain('This change cannot be applied safely here.')
    expect((wrapper.get('[data-items="tabs"] > .ginko-items__footer').element as HTMLElement).hidden).toBe(false)
  })

  it('keeps the selected tab out of the document and collaboration steps', async () => {
    const wrapper = await setup(tabs)
    const editor = wrapper.vm.getEditor()!
    const json = JSON.stringify(editor.getJSON())
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(JSON.stringify(editor.getJSON())).toBe(json)
    expect(containerItemsKey.getState(editor.state)?.active.size).toBe(1)
    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON())).toBe(json)
  })
})

describe('other container presentations', () => {
  it('collapses accordion items in this view only', async () => {
    const wrapper = await setup(
      '::accordion\n:::accordion-item{title="One"}\nFirst answer.\n:::\n\n:::accordion-item{title="Two"}\nSecond answer.\n:::\n::',
    )
    const toggle = wrapper.findAll('.ginko-block__collapse').filter(button => !(button.element as HTMLElement).hidden)
    expect(toggle).toHaveLength(2)
    expect(toggle[0].attributes('aria-label')).toBe('Collapse One')
    await toggle[0].trigger('click')
    expect(items(wrapper, 'accordion')[0].attributes('data-ginko-item-collapsed')).toBe('true')
    expect(toggle[0].attributes('aria-expanded')).toBe('false')
    expect(toggle[0].attributes('aria-label')).toBe('Expand One')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('.ginko-items__add').trigger('click')
    await flushPromises()
    expect(items(wrapper, 'accordion')).toHaveLength(3)
    expect(await saved(wrapper)).toContain(':::accordion-item{title="New question"}')
  })

  it('numbers steps and adds a step at the end', async () => {
    const wrapper = await setup('::steps\n### One\n\nFirst.\n\n### Two\n\nSecond.\n::')
    expect(items(wrapper, 'steps').map(item => item.attributes('data-ginko-item-index'))).toEqual(['1', '2'])
    await wrapper.get('.ginko-items__add').trigger('click')
    await flushPromises()
    expect(items(wrapper, 'steps').map(item => item.text())).toEqual(['One', 'Two', 'New step'])
    expect(await saved(wrapper)).toContain('### New step')
    wrapper.vm.getEditor()!.commands.undo()
    await flushPromises()
    expect(items(wrapper, 'steps')).toHaveLength(2)
  })

  it('lays cards out in the configured columns', async () => {
    const wrapper = await setup('::cards{cols="3"}\n:::card{title="One"}\nText.\n:::\n::')
    const content = wrapper.get('[data-items="grid"] > .ginko-block__body > .ginko-block__content')
    expect((content.element as HTMLElement).style.getPropertyValue('--ginko-item-columns')).toBe('3')
    await wrapper.get('[data-items="grid"] .ginko-items__add').trigger('click')
    await flushPromises()
    expect(items(wrapper, 'grid')).toHaveLength(2)
  })

  it('marks timeline events and adds one', async () => {
    const wrapper = await setup('::timeline\n:::timeline-item{title="One"}\nText.\n:::\n::')
    expect(items(wrapper, 'timeline')).toHaveLength(1)
    await wrapper.get('.ginko-items__add').trigger('click')
    await flushPromises()
    expect(items(wrapper, 'timeline')).toHaveLength(2)
  })

  it('shows code group files as tabs', async () => {
    const wrapper = await setup('::code-group\n```ts [a.ts]\nconst a = 1\n```\n\n```js\nconst b = 2\n```\n::')
    expect(tabNames(wrapper)).toEqual(['a.ts', 'js'])
    await wrapper.get('.ginko-items__add--strip').trigger('click')
    await flushPromises()
    expect(tabNames(wrapper)).toEqual(['a.ts', 'example.ts', 'js'])
    expect(await saved(wrapper)).toContain('```ts [example.ts]')
  })

  it('keeps paired columns intact', async () => {
    const wrapper = await setup(ginkoLayoutKitSource.recipes.find(recipe => recipe.id === 'ginko.layout.two-columns')!.source)
    expect(wrapper.find('[data-columns="true"]').exists()).toBe(true)
    expect(wrapper.find('.ginko-items__strip:not([hidden])').exists()).toBe(false)
    expect(wrapper.find('.ginko-items__footer:not([hidden])').exists()).toBe(false)
  })
})

describe('json properties', () => {
  async function settings(wrapper: Wrapper) {
    const trigger = wrapper.get('.ginko-settings button')
    if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click')
    await flushPromises()
    return new DOMWrapper(document.getElementById(trigger.attributes('aria-controls')!)!)
  }

  it('applies valid JSON and rejects invalid JSON', async () => {
    const wrapper = await setup('::toc{title="Contents"}\n::')
    const panel = await settings(wrapper)
    const field = panel.get<HTMLTextAreaElement>('textarea[aria-label="Depth"]')
    await field.setValue('{ broken')
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(panel.text()).toContain('Enter valid JSON.')
    expect(wrapper.vm.getEditor()!.state.doc.firstChild?.attrs.props.depth).toBeUndefined()
    await field.setValue('3')
    expect(wrapper.vm.getEditor()!.state.doc.firstChild?.attrs.props.depth).toBe(3)
    // Colon syntax would store the number as text, so the component uses a typed binding.
    const markdown = await saved(wrapper)
    expect(markdown).toContain(':depth="3"')
    const kit = await createGinkoLayoutKit()
    const reopened = await setup(markdown!, kit)
    expect(reopened.vm.getEditor()!.state.doc.firstChild?.attrs.props.depth).toBe(3)
  })

  it('keeps a required JSON property when the field is cleared', async () => {
    const wrapper = await setup(ginkoLayoutKitSource.recipes.find(recipe => recipe.id === 'ginko.layout.read-more')!.source)
    const panel = await settings(wrapper)
    const field = panel.get<HTMLTextAreaElement>('textarea[aria-label="Links"]')
    expect(JSON.parse(field.element.value)).toEqual([{ title: 'Getting started', to: '/' }])
    await field.setValue('')
    expect(panel.text()).toContain('This property is required.')
    expect(wrapper.vm.getEditor()!.state.doc.firstChild?.attrs.props.links).toHaveLength(1)
  })
})

describe('composed host kits', () => {
  it('uses container hints from any kit', async () => {
    const kit = await composeAuthoringKits(ginkoLayoutKitSource)
    const wrapper = await setup(tabs, kit)
    expect(tabNames(wrapper)).toEqual(['First', 'Second'])
  })
})
