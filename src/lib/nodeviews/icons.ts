/** Small stroke icons share one geometry and inherit the host's text color. */
const paths = {
  close: 'm6 6 12 12M6 18 18 6',
  imageUpload: 'M14 4H4v16h16V10M4 16l5-5 5 5 2-2 4 4M16 5h6M19 2v6M8 7h.01',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
    + 'M9 3l1-1h4l1 1 .5 2 2 1 2-.5 2 3-1.5 1.5v3L21.5 15l-2 3-2-.5-2 1L15 21h-6'
    + 'l-.5-2.5-2-1-2 .5-2-3L4 13v-3L2.5 8.5l2-3 2 .5 2-1L9 3Z',
  rows: 'M3 4h18v16H3zM3 9h18M3 15h18',
  columns: 'M3 4h18v16H3zM9 4v16M15 4v16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  up: 'm5 12 7-7 7 7M12 5v15',
  down: 'm5 12 7 7 7-7M12 19V4',
  alignLeft: 'M4 5h16M4 10h10M4 15h16M4 20h10',
  alignCenter: 'M4 5h16M7 10h10M4 15h16M7 20h10',
  alignRight: 'M4 5h16M10 10h10M4 15h16M10 20h10',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  info: 'M12 8h.01M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  warning: 'm12 3 10 18H2L12 3ZM12 9v5M12 17h.01',
  check: 'm6 12 4 4 8-8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  idea: 'M9 18h6M9 22h6M8 14a6 6 0 1 1 8 0l-1 3H9l-1-3',
} as const
export type IconName = keyof typeof paths
export function icon(name: IconName) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.6')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', paths[name])
  svg.append(path)
  return svg
}
export function iconButton(name: IconName, label: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ginko-icon-button'
  button.setAttribute('aria-label', label)
  button.title = label
  button.append(icon(name))
  return button
}
