// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { inlinePopover } from '../src/lib/nodeviews/popover'
import { createEditorOverlayController } from '../src/ui/context'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  HTMLElement.prototype.scrollIntoView ??= () => {}
})
const popovers: ReturnType<typeof inlinePopover>[] = []
const roots: HTMLElement[] = []
afterEach(async () => {
  popovers.splice(0).forEach(popover => popover.destroy())
  await flushPromises()
  roots.splice(0).forEach(root => root.remove())
})
function root() {
  const element = document.createElement('div')
  document.body.append(element); roots.push(element)
  return element
}
function setup(container: HTMLElement, controller = createEditorOverlayController({ getContainer: () => container })) {
  const popover = inlinePopover('Image settings', 'settings', controller)
  const input = document.createElement('input'); input.setAttribute('aria-label', 'Description')
  popover.panel.append(input); container.append(popover.dom); popovers.push(popover)
  return Object.assign(popover, { input })
}
async function open(popover: ReturnType<typeof setup>) {
  popover.toggle.click()
  await nextTick(); await flushPromises()
}

describe('node-view popovers', () => {
  it('coordinates one editor without closing another editor’s overlay', () => {
    const first = createEditorOverlayController(), second = createEditorOverlayController()
    const one = {}, two = {}, other = {}, closeOne = vi.fn(), closeOther = vi.fn()
    first.open(one, closeOne); second.open(other, closeOther)
    first.open(two, vi.fn())
    expect(closeOne).toHaveBeenCalledOnce()
    expect(closeOther).not.toHaveBeenCalled()
    expect(first.active.value).toBe(two)
    expect(second.active.value).toBe(other)
    first.release(one)
    expect(first.active.value).toBe(two)
    first.close(); second.close()
    expect(closeOther).toHaveBeenCalledOnce()
  })

  it('opens an accessible anchored dialog and restores trigger focus on Escape', async () => {
    const container = root(), popover = setup(container)
    await open(popover)
    expect(popover.toggle.tagName).toBe('BUTTON')
    expect(popover.toggle.getAttribute('aria-expanded')).toBe('true')
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.contains(popover.panel)).toBe(true)
    expect(popover.contains(popover.input)).toBe(true)
    expect(document.activeElement).toBe(popover.input)
    popover.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick(); await flushPromises()
    expect(popover.isOpen()).toBe(false)
    expect(document.activeElement).toBe(popover.toggle)
  })

  it('closes competing node popovers and keeps generated IDs unique', async () => {
    const container = root(), controller = createEditorOverlayController({ getContainer: () => container })
    const first = setup(container, controller), second = setup(container, controller)
    await open(first); await open(second)
    expect(first.isOpen()).toBe(false)
    expect(second.isOpen()).toBe(true)
    expect(document.activeElement).toBe(second.input)
    expect(first.toggle.id).not.toBe(second.toggle.id)
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  })

  it('dismisses on outside focus without taking focus back', async () => {
    const container = root(), popover = setup(container)
    const outside = document.createElement('button'); outside.textContent = 'Outside'; container.append(outside)
    await open(popover)
    outside.focus()
    await nextTick(); await flushPromises()
    expect(popover.isOpen()).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  it('ports into the host container, retains its own theme, and removes content on destruction', async () => {
    const editorRoot = root(), host = root()
    editorRoot.style.setProperty('--ginko-background', 'rgb(12, 23, 34)')
    const controller = createEditorOverlayController({ getContainer: () => host, getThemeElement: () => editorRoot })
    const popover = setup(editorRoot, controller)
    await open(popover)
    const content = host.querySelector<HTMLElement>('[role="dialog"]')!
    expect(content.contains(popover.panel)).toBe(true)
    expect(content.style.getPropertyValue('--ginko-background')).toBe('rgb(12, 23, 34)')
    editorRoot.style.setProperty('--ginko-background', 'rgb(45, 56, 67)')
    await flushPromises()
    expect(content.style.getPropertyValue('--ginko-background')).toBe('rgb(45, 56, 67)')
    expect(editorRoot.querySelector('[role="dialog"]')).toBeNull()
    popover.destroy(); popovers.splice(popovers.indexOf(popover), 1)
    await flushPromises()
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(controller.active.value).toBeUndefined()
  })
})
