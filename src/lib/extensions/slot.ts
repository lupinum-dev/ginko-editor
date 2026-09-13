import { mergeAttributes, Node } from '@tiptap/core'

import type { AuthoringKitV1 } from '../../authoring'
import type { JsonRecord } from '../../types'

export interface SlotOptions {
  getAuthoringKit?: () => AuthoringKitV1 | undefined
  HTMLAttributes: JsonRecord
  nestable: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Slot: {
      handleSlotBackspace: () => ReturnType
    }
  }
}

export const Slot = Node.create<SlotOptions>({
  name: 'slot',
  content: 'block*',
  group: 'block',
  inline: false,
  isolating: true,
  selectable: false,
  priority: 1000,

  addAttributes() {
    return {
      name: {
        default: 'default',
      },
      props: {
        default: {},
        parseHTML(element) {
          return JSON.parse(element.getAttribute('props') || '{}')
        },
      },
    }
  },

  addCommands() {
    return {
      handleSlotBackspace: () => () => false,
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => editor.commands.handleSlotBackspace(),
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {},
      nestable: false,
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="Slot"]' }]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.dataset.type = 'Slot'
      dom.setAttribute('name', node.attrs.name)
      const pos = getPos()
      const parent = pos === undefined ? undefined : editor.state.doc.resolve(pos).parent
      const label = this.options.getAuthoringKit?.()?.authoring[parent?.attrs.tag]?.slots?.[node.attrs.name]?.label
      dom.dataset.label = label ?? (node.attrs.name === 'default' ? 'Content' : node.attrs.name)
      return { dom, contentDOM: dom }
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'Slot' }), 0]
  },
})
