import { componentView } from '../nodeviews/component'
import type { Content } from '@tiptap/core'
import { InputRule, mergeAttributes, Node } from '@tiptap/core'

import type { TiptapToMDCOptions } from '../tiptapToMdc'
import type { AuthoringKitV1 } from '../../authoring'
import type { JsonRecord } from '../../types'

export interface ElementOptions {
  getOutputOptions?: () => TiptapToMDCOptions
  getAuthoringKit?: () => AuthoringKitV1 | undefined
  HTMLAttributes: JsonRecord
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Element: {
      setElement: (tag: string, slot?: string) => ReturnType
    }
  }
}

const ELEMENT_BLOCK_TRIGGER = /^::([a-z-]+)\s$/i

export const Element = Node.create<ElementOptions>({
  name: 'element',
  group: 'block',
  content: 'block*',
  inline: false,
  // Generic component nodes carry distinct tags and properties. Joining them
  // at a text boundary would silently discard one component’s metadata.
  isolating: true,
  selectable: true,
  priority: 1000,

  addAttributes() {
    return {
      props: {
        default: {},
        parseHTML(element) {
          return JSON.parse(element.getAttribute('props') || '{}')
        },
      },
      tag: {
        default: 'div',
      },
    }
  },

  addCommands() {
    return {
      setElement:
        (tag: string, slot?: string) =>
        ({ chain, state }) => {
          const { from } = state.selection
          const value: Content = {
            attrs: { tag },
            type: 'element',
          }

          if (slot) {
            value.content = [
              {
                attrs: { name: slot },
                content: [{ content: [], type: 'paragraph' }],
                type: 'slot',
              },
            ]
          }

          const command = chain().insertContentAt(from, value)
          if (!slot) {
            command.insertContentAt(from + 1, [{ content: [], type: 'paragraph' }])
          }
          return command.run()
        },
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: ELEMENT_BLOCK_TRIGGER,
        handler: ({ chain, match, range }) => {
          const value: Content = {
            attrs: { tag: match[1] },
            content: [
              {
                attrs: { name: 'default' },
                content: [{ content: [], type: 'paragraph' }],
                type: 'slot',
              },
            ],
            type: 'element',
          }

          chain().deleteRange(range).insertContentAt(range.from, value).run()
        },
      }),
    ]
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="element"]' }]
  },

  addNodeView() {
    return props => componentView(props, () => this.options.getAuthoringKit?.(), () => this.options.getOutputOptions?.() ?? {})
  },

  renderHTML({ HTMLAttributes }) {
    const mergedAttributes = mergeAttributes(HTMLAttributes, { 'data-type': 'element' })
    const tag = typeof mergedAttributes.tag === 'string' ? mergedAttributes.tag : ''
    const metadata = this.options.getAuthoringKit?.()?.authoring[tag]
    mergedAttributes['data-label'] = metadata?.label ?? tag
    const title = mergedAttributes.props?.title
    if (typeof title === 'string' && title.trim()) mergedAttributes['data-title'] = title
    mergedAttributes.props = JSON.stringify(mergedAttributes.props || {})
    return ['div', mergedAttributes, 0]
  },
})
