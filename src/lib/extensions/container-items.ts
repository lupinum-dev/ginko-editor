import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import type { AuthoringKit } from '../../authoring'
import { containerLayout, itemsConfig, type ContainerLayout } from '../container-items'
import { nodeViewRefreshMeta } from '../nodeviews/lifecycle'

/**
 * View state of container items. It belongs to one editor view: the selected
 * tab and collapsed accordion items are never part of the document, history,
 * or collaboration steps.
 */
export interface ContainerItemsState {
  /** Container position to the start position of its selected item. */
  active: ReadonlyMap<number, number>
  /** Start positions of collapsed items. */
  collapsed: ReadonlySet<number>
  decorations: DecorationSet
}

type ContainerItemsMeta =
  | { select: { container: number; item: number } }
  | { toggle: number }

export const containerItemsKey = new PluginKey<ContainerItemsState>('ginkoContainerItems')

/** Select one item of a container. The change is view state only. */
export function selectContainerItem(tr: Transaction, container: number, item: number) {
  return tr.setMeta(containerItemsKey, { select: { container, item } } satisfies ContainerItemsMeta)
    .setMeta('addToHistory', false)
}

/** Collapse or expand one item in this editor view. */
export function toggleContainerItem(tr: Transaction, item: number) {
  return tr.setMeta(containerItemsKey, { toggle: item } satisfies ContainerItemsMeta).setMeta('addToHistory', false)
}

function containers(doc: ProseMirrorNode, kit: AuthoringKit | undefined) {
  const result: ContainerLayout[] = []
  if (!kit || !Object.values(kit.authoring).some(meta => meta.canvas?.items)) return result
  doc.descendants((node, pos) => {
    if (node.type.name === 'element' && itemsConfig(kit, node.attrs.tag)) {
      const layout = containerLayout(doc, pos, kit)
      if (layout) result.push(layout)
    }
    return node.isBlock
  })
  return result
}

/** The selected item index of a container, in this view. */
export function activeItemIndex(state: EditorState, layout: ContainerLayout) {
  const active = containerItemsKey.getState(state)?.active.get(layout.pos)
  const index = layout.items.findIndex(item => item.from === active)
  return index < 0 ? 0 : index
}

export function isItemCollapsed(state: EditorState, pos: number) {
  return containerItemsKey.getState(state)?.collapsed.has(pos) ?? false
}

function decorate(doc: ProseMirrorNode, kit: AuthoringKit | undefined, active: Map<number, number>, collapsed: Set<number>) {
  const decorations: Decoration[] = []
  for (const layout of containers(doc, kit)) {
    const presentation = layout.config.presentation
    const selected = layout.items.findIndex(item => item.from === active.get(layout.pos))
    layout.items.forEach((item, index) => {
      const hidden = presentation === 'tabs' && index !== Math.max(0, selected)
      item.nodes.forEach(({ node, pos }, part) => {
        const attrs: Record<string, string> = {
          'data-ginko-item': presentation,
          'data-ginko-item-index': String(index + 1),
        }
        if (part === 0) attrs['data-ginko-item-start'] = 'true'
        if (hidden) attrs['data-ginko-item-hidden'] = 'true'
        if (collapsed.has(item.from)) attrs['data-ginko-item-collapsed'] = 'true'
        decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs))
      })
    })
  }
  return DecorationSet.create(doc, decorations)
}

/** Select the item that contains the selection, so hidden tabs never hold the caret. */
function followSelection(state: EditorState, kit: AuthoringKit | undefined, active: Map<number, number>) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'element' || itemsConfig(kit, node.attrs.tag)?.presentation !== 'tabs') continue
    const layout = containerLayout(state.doc, $from.before(depth), kit)
    const item = layout?.items.find(entry => $from.pos > entry.from && $from.pos < entry.to)
    if (layout && item) active.set(layout.pos, item.from)
  }
}

export interface ContainerItemsOptions {
  getAuthoringKit?: () => AuthoringKit | undefined
}

export const ContainerItems = Extension.create<ContainerItemsOptions>({
  name: 'ginkoContainerItems',
  addOptions() {
    return { getAuthoringKit: undefined }
  },
  addProseMirrorPlugins() {
    const getKit = () => this.options.getAuthoringKit?.()
    let decoratedKit: AuthoringKit | undefined
    return [new Plugin<ContainerItemsState>({
      key: containerItemsKey,
      state: {
        init: (_, state) => {
          decoratedKit = getKit()
          return { active: new Map(), collapsed: new Set(), decorations: decorate(state.doc, decoratedKit, new Map(), new Set()) }
        },
        apply(tr, previous, _oldState, state) {
          const meta = tr.getMeta(containerItemsKey) as ContainerItemsMeta | undefined
          const kit = getKit()
          const kitChanged = kit !== decoratedKit
          if (!tr.docChanged && !tr.selectionSet && !meta && !kitChanged && !tr.getMeta(nodeViewRefreshMeta)) {
            return previous
          }
          const active = new Map<number, number>()
          for (const [container, item] of previous.active) {
            const mappedContainer = tr.mapping.mapResult(container, 1)
            const mappedItem = tr.mapping.mapResult(item, 1)
            if (!mappedContainer.deleted && !mappedItem.deleted) active.set(mappedContainer.pos, mappedItem.pos)
          }
          const collapsed = new Set<number>()
          for (const item of previous.collapsed) {
            const mapped = tr.mapping.mapResult(item, 1)
            if (!mapped.deleted) collapsed.add(mapped.pos)
          }
          if (tr.selectionSet || tr.docChanged) followSelection(state, kit, active)
          if (meta && 'select' in meta) active.set(meta.select.container, meta.select.item)
          if (meta && 'toggle' in meta) {
            if (collapsed.has(meta.toggle)) collapsed.delete(meta.toggle)
            else collapsed.add(meta.toggle)
          }
          const same = !tr.docChanged && !kitChanged
            && active.size === previous.active.size
            && [...active].every(([key, value]) => previous.active.get(key) === value)
            && collapsed.size === previous.collapsed.size
            && [...collapsed].every(value => previous.collapsed.has(value))
          if (same) return previous
          decoratedKit = kit
          return { active, collapsed, decorations: decorate(state.doc, kit, active, collapsed) }
        },
      },
      props: {
        decorations: state => containerItemsKey.getState(state)?.decorations,
      },
    })]
  },
})
