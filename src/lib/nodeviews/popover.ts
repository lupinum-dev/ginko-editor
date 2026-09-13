import { createApp, shallowReactive, type CSSProperties } from 'vue'
import GinkoNodePopover from '../../ui/GinkoNodePopover.vue'
import type { EditorOverlayController } from '../../ui/context'
import { icon, type IconName } from './icons'

let nextPopoverId = 0

/** Reka owns placement and dismissal; callers retain their native form controls. */
export function inlinePopover(label: string, symbol: IconName, controller?: EditorOverlayController) {
  const dom = document.createElement('div')
  dom.className = 'ginko-popover'; dom.contentEditable = 'false'
  const panel = document.createElement('div')
  panel.className = 'ginko-popover__panel'; panel.setAttribute('role', 'group')
  panel.contentEditable = 'false'
  const owner = {}
  const listeners = new Set<(open: boolean) => void>()
  const state = shallowReactive({ open: false, label, container: 'body' as HTMLElement | string, theme: {} as CSSProperties, restoreFocus: true })
  let destroyed = false
  let themeObserver: MutationObserver | undefined
  function position() {
    if (!state.open) return
    const themeElement = controller?.getThemeElement() ?? dom.closest<HTMLElement>('.ginko-editor')
    state.container = controller?.getContainer() ?? themeElement ?? 'body'
    if (!themeElement) return
    const computed = getComputedStyle(themeElement)
    const theme: Record<string, string> = {}
    // Portals can leave the editor's CSS inheritance tree. Carry its resolved
    // custom properties without copying layout or altering the host container.
    for (let index = 0; index < computed.length; index++) {
      const name = computed.item(index)
      if (name.startsWith('--')) theme[name] = computed.getPropertyValue(name)
    }
    theme.colorScheme = computed.colorScheme
    state.theme = theme
  }
  function setOpen(open: boolean) {
    if (destroyed || open === state.open) return
    if (open) {
      controller?.open(owner, () => close())
      state.restoreFocus = true
    } else {
      controller?.release(owner)
      themeObserver?.disconnect()
    }
    state.open = open
    dom.dataset.state = open ? 'open' : 'closed'
    position()
    if (open) {
      themeObserver ??= new MutationObserver(position)
      let ancestor = controller?.getThemeElement() ?? dom.closest<HTMLElement>('.ginko-editor')
      while (ancestor) {
        themeObserver.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style'] })
        ancestor = ancestor.parentElement
      }
    }
    listeners.forEach(listener => listener(open))
  }
  function close(focus = false) {
    state.restoreFocus = focus
    setOpen(false)
  }
  const app = createApp(GinkoNodePopover, { panel, state, 'onUpdate:open': setOpen, onRestoreFocus: (restore: boolean) => { state.restoreFocus = restore } })
  // Each node view is a small Vue root. Distinct prefixes keep Reka's generated
  // trigger/content IDs unique across nodes and editor instances.
  app.config.idPrefix = `ginko-node-${++nextPopoverId}`
  app.mount(dom)
  const toggle = dom.querySelector<HTMLButtonElement>('button')!
  toggle.append(icon(symbol))
  const setLabel = (text: string) => { state.label = text; panel.setAttribute('aria-label', text) }
  setLabel(label)
  return {
    dom, toggle, panel, close, position, setLabel,
    isOpen: () => state.open,
    contains: (target: globalThis.Node) => dom.contains(target) || panel.contains(target),
    onOpenChange(listener: (open: boolean) => void) { listeners.add(listener); return () => listeners.delete(listener) },
    destroy() {
      close(); destroyed = true; themeObserver?.disconnect(); controller?.release(owner); listeners.clear(); app.unmount()
    },
  }
}
