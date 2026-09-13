import { icon, type IconName } from './icons'

/** Native disclosure semantics with viewport-aware placement and dismissal. */
export function inlinePopover(label: string, symbol: IconName) {
  const dom = document.createElement('details')
  dom.className = 'ginko-popover'; dom.contentEditable = 'false'
  const toggle = document.createElement('summary')
  toggle.className = 'ginko-icon-button'; toggle.append(icon(symbol))
  const panel = document.createElement('div')
  panel.className = 'ginko-popover__panel'; panel.setAttribute('role', 'group')
  dom.append(toggle, panel)
  const setLabel = (text: string) => { toggle.title = text; toggle.setAttribute('aria-label', text); panel.setAttribute('aria-label', text) }
  const close = (focus = false) => { dom.open = false; if (focus) toggle.focus() }
  const position = () => {
    if (!dom.open) return
    const bounds = toggle.getBoundingClientRect(), width = Math.min(260, window.innerWidth - 24)
    panel.style.width = `${width}px`
    panel.style.left = `${Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12))}px`
    const below = window.innerHeight - bounds.bottom - 20, above = bounds.top - 20
    const height = Math.min(panel.scrollHeight, window.innerHeight - 24)
    const upward = height > below && above > below
    const available = Math.max(80, upward ? above : below)
    panel.style.maxHeight = `${available}px`
    panel.style.top = `${upward ? Math.max(12, bounds.top - Math.min(height, available) - 8) : bounds.bottom + 8}px`
  }
  dom.addEventListener('toggle', position)
  dom.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) } })
  const outside = (event: Event) => { if (event.target instanceof globalThis.Node && !dom.contains(event.target)) close() }
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('focusin', outside)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  setLabel(label)
  return { dom, toggle, panel, close, position, setLabel, destroy() { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) } }
}
