import type { Editor } from '@tiptap/core'
import TiptapHeading from '@tiptap/extension-heading'
import type { ResolvedPos } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state'

export interface HeadingOptions {
  levels: number[]
  showMarkers: boolean
}

export const Heading = TiptapHeading.extend<HeadingOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      levels: [1, 2, 3, 4, 5, 6],
      showMarkers: false,
    }
  },

  // Parse every level, so a profile with fewer levels can still move pasted
  // headings to its nearest level instead of losing them as paragraphs.
  parseHTML() {
    return [1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level } }))
  },

  addStorage() {
    return {
      showMarkers: this.options.showMarkers,
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => handleBackspace(editor),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('ginkoUniqueHeadingIds'),
        // Split, paste and duplicate can copy a custom anchor. Keep only its first use.
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some(transaction => transaction.docChanged)) return null
          const seen = new Set<string>()
          const tr = state.tr
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading' || !node.attrs.id) return
            if (seen.has(node.attrs.id)) tr.setNodeAttribute(pos, 'id', null)
            else seen.add(node.attrs.id)
          })
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null
        },
      }),
    ]
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      /** A custom anchor id. Null when the parser's generated id applies. */
      id: {
        default: null,
        // Splitting a heading must not create a second anchor with the same id.
        keepOnSplit: false,
        parseHTML: element => element.getAttribute('data-ginko-heading-id'),
        renderHTML: attributes => attributes.id ? { 'data-ginko-heading-id': attributes.id } : {},
      },
    }
  },
})

function handleBackspace(editor: Editor): boolean {
  const { state } = editor
  const { selection } = state
  const { $from, empty } = selection

  if ($from.parent.type.name !== 'heading') {
    return false
  }

  const headingText = $from.parent.textContent
  const isAtStart = $from.parentOffset === 0
  const textLength = headingText.length

  if (textLength === 1 && $from.parentOffset === 1 && empty) {
    return handleSingleCharDeletion(editor, state, $from)
  }

  if (textLength === 0 && isAtStart) {
    return handleEmptyHeadingAtStart(editor, state, $from)
  }

  return false
}

function handleSingleCharDeletion(editor: Editor, state: EditorState, $from: ResolvedPos): boolean {
  const headingPos = $from.before($from.depth)
  const headingNode = $from.parent
  const tr = state.tr
  const headingType = state.schema.nodes.heading
  if (!headingType) {
    return false
  }
  const level = headingNode.attrs.level
  const emptyHeading = headingType.create({ level, id: headingNode.attrs.id })

  tr.replaceWith(headingPos, headingPos + headingNode.nodeSize, emptyHeading)
  tr.setSelection(TextSelection.near(tr.doc.resolve(headingPos + 1)))

  editor.view.dispatch(tr)
  return true
}

function handleEmptyHeadingAtStart(
  editor: Editor,
  state: EditorState,
  $from: ResolvedPos,
): boolean {
  const headingPos = $from.before($from.depth)
  const headingNode = $from.parent
  const tr = state.tr
  const paragraphType = state.schema.nodes.paragraph
  if (!paragraphType) {
    return false
  }
  const emptyParagraph = paragraphType.create()

  tr.replaceWith(headingPos, headingPos + headingNode.nodeSize, emptyParagraph)
  tr.setSelection(TextSelection.near(tr.doc.resolve(headingPos + 1)))

  editor.view.dispatch(tr)
  return true
}
