import { shallowReadonly, shallowRef, type InjectionKey } from 'vue'
import { translateEditorMessage, type EditorMessages, type EditorMessageKey } from './messages'

export interface EditorOverlayOptions {
  getContainer?: () => HTMLElement | undefined
  getThemeElement?: () => HTMLElement | undefined
  getMessages?: () => EditorMessages | undefined
}

/** One controller belongs to one editor, including its toolbar and node views. */
export function createEditorOverlayController(options: EditorOverlayOptions = {}) {
  const active = shallowRef<object>()
  let dismiss: (() => void) | undefined
  let portal: HTMLElement | undefined, themeObserver: MutationObserver | undefined
  function syncTheme() {
    const source = options.getThemeElement?.()
    if (!portal || !source) return
    const style = getComputedStyle(source)
    portal.removeAttribute('style')
    portal.style.display = 'contents'
    portal.style.fontFamily = style.fontFamily
    portal.style.colorScheme = style.colorScheme
    for (let index = 0; index < style.length; index++) {
      const name = style.item(index)
      if (name.startsWith('--')) portal.style.setProperty(name, style.getPropertyValue(name))
    }
  }
  function getContainer() {
    const container = options.getContainer?.(), source = options.getThemeElement?.()
    if (!container || typeof document === 'undefined') return container
    if (!portal) {
      portal = document.createElement('div')
      portal.className = 'ginko-editor ginko-overlay'
      themeObserver = new MutationObserver(syncTheme)
      let ancestor: HTMLElement | null = source ?? null
      while (ancestor) { themeObserver.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style'] }); ancestor = ancestor.parentElement }
    }
    if (portal.parentElement !== container) container.append(portal)
    syncTheme()
    return portal
  }
  return {
    active: shallowReadonly(active),
    open(owner: object, close: () => void) {
      if (active.value !== owner) {
        const previous = dismiss
        active.value = undefined
        dismiss = undefined
        previous?.()
      }
      active.value = owner
      dismiss = close
    },
    close(owner?: object) {
      if (owner && active.value !== owner) return
      const previous = dismiss
      active.value = undefined
      dismiss = undefined
      previous?.()
    },
    release(owner: object) {
      if (active.value !== owner) return
      active.value = undefined
      dismiss = undefined
    },
    getContainer,
    getThemeElement: () => options.getThemeElement?.(),
    text: (key: EditorMessageKey, parameters?: Readonly<Record<string, string | number>>) => translateEditorMessage(options.getMessages?.(), key, parameters),
    destroy() {
      dismiss?.(); dismiss = undefined; active.value = undefined
      themeObserver?.disconnect()
      const element = portal; portal = undefined
      queueMicrotask(() => element?.remove())
    },
  }
}

export type EditorOverlayController = ReturnType<typeof createEditorOverlayController>
export const editorOverlayKey: InjectionKey<EditorOverlayController> = Symbol('Ginko editor overlays')
