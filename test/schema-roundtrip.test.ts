// @vitest-environment jsdom

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import GinkoEditor from '../src/GinkoEditor.vue'

const fixturesDirectory = join(process.cwd(), 'test', 'fixtures', 'editor-conversion')
const fixtures = (await readdir(fixturesDirectory)).filter((name) => name.endsWith('.mdc')).sort()

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

async function waitFor(condition: () => boolean, timeoutMs = 1000) {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for editor state.')
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
  }
}

describe('accepted corpus through the mounted editor schema', () => {
  for (const fixture of fixtures) {
    it(`opens ${fixture} without rewriting or dropping source`, async () => {
      const source = await readFile(join(fixturesDirectory, fixture), 'utf8')
      const wrapper = mount(GinkoEditor, {
        attachTo: document.body,
        props: { modelValue: source, syncDebounceMs: 0 },
      })
      await flushPromises()
      await waitFor(() => Boolean(wrapper.vm.getEditor()))
      await new Promise((resolve) => globalThis.setTimeout(resolve, 50))

      if (fixture === 'angle-components.mdc') {
        expect(wrapper.get('textarea').element.value).toBe(source)
        expect(wrapper.text()).toContain('Source only')
      } else {
        expect(wrapper.emitted('conversion-error')).toBeUndefined()
        expect(wrapper.attributes('data-mode')).toBe('visual')
        await wrapper.get('.ginko-editor__modes button:nth-child(2)').trigger('click')
        expect(wrapper.get('textarea').element.value).toBe(source)
      }
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      wrapper.unmount()
    })
  }
})
