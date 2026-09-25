import { shallowReadonly, shallowRef, type InjectionKey } from 'vue'
import {
  translateEditorMessage,
  type EditorMessages,
  type EditorMessageKey,
} from './messages'

export interface EditorOverlayOptions {
  getContainer?: () => HTMLElement | undefined
  getThemeElement?: () => HTMLElement | undefined
  getMessages?: () => EditorMessages | undefined
}

/** One controller belongs to one editor, including its toolbar and node views. */
export function createEditorOverlayController(options: EditorOverlayOptions = {}) {
  const active = shallowRef<object>()
  let dismiss: (() => void) | undefined
  let portal: HTMLElement | undefined
  let themeObserver: MutationObserver | undefined
  let observedTheme: HTMLElement | undefined
  let messagesRevision = 0

  /** Copy the editor's resolved custom properties, so ported overlays keep its theme. */
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
      if (name.startsWith('--')) {
        portal.style.setProperty(name, style.getPropertyValue(name))
      }
    }
  }

  /** One observer follows class and style changes on the theme element and its ancestors. */
  function observeTheme(source: HTMLElement | undefined) {
    if (source === observedTheme) return
    themeObserver?.disconnect()
    observedTheme = source
    if (!source || typeof MutationObserver === 'undefined') return
    themeObserver ??= new MutationObserver(syncTheme)
    for (let ancestor: HTMLElement | null = source; ancestor; ancestor = ancestor.parentElement) {
      themeObserver.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style'] })
    }
  }

  /**
   * Return the overlay root. The first call creates it; later calls only move it
   * when the host container changes, so render paths stay free of style work.
   */
  function getContainer() {
    const container = options.getContainer?.()
    if (!container || typeof document === 'undefined') return container
    let changed = false
    if (!portal) {
      portal = document.createElement('div')
      portal.className = 'ginko-editor ginko-overlay ginko-overlay-root'
      changed = true
    }
    if (portal.parentElement !== container) {
      container.append(portal)
      changed = true
    }
    const source = options.getThemeElement?.()
    if (source !== observedTheme) {
      observeTheme(source)
      changed = true
    }
    if (changed) syncTheme()
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
      // Media queries can change resolved tokens without an observed attribute change.
      syncTheme()
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
    text: (
      key: EditorMessageKey,
      parameters?: Readonly<Record<string, string | number>>,
    ) => translateEditorMessage(options.getMessages?.(), key, parameters),
    /** Changes when the host replaces or edits its messages. */
    messagesRevision: () => messagesRevision,
    notifyMessagesChanged() { messagesRevision += 1 },
    destroy() {
      dismiss?.()
      dismiss = undefined
      active.value = undefined
      themeObserver?.disconnect()
      themeObserver = undefined
      observedTheme = undefined

      const element = portal
      portal = undefined

      queueMicrotask(() => element?.remove())
    },
  }
}

export type EditorOverlayController = ReturnType<typeof createEditorOverlayController>
export const editorOverlayKey: InjectionKey<EditorOverlayController> = Symbol('Ginko editor overlays')
