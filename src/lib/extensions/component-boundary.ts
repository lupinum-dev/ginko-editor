import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'

const componentBoundaryKey = new PluginKey('ginkoComponentBoundary')

/** True when an empty caret is at the first or last text position of a component. */
export function isAtComponentBoundary(state: EditorState, direction: 'end' | 'start') {
  const selection = state.selection
  if (!selection.empty) return false
  const resolved = selection.$from
  for (let depth = resolved.depth - 1; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name !== 'element') continue
    for (let childDepth = depth + 1; childDepth <= resolved.depth; childDepth += 1) {
      const parent = resolved.node(childDepth - 1)
      const index = resolved.index(childDepth - 1)
      if (direction === 'start' && index !== 0) return false
      if (direction === 'end' && index !== parent.childCount - 1) return false
    }
    return direction === 'start'
      ? resolved.parentOffset === 0
      : resolved.parentOffset === resolved.parent.content.size
  }
  return false
}

/**
 * Backspace at a component start and Delete at its end must not join the
 * component with its neighbor. Joining would merge two component identities.
 */
export const ComponentBoundary = Extension.create({
  name: 'ginkoComponentBoundary',
  // Run before the default Backspace and Delete keymaps.
  priority: 1000,
  addProseMirrorPlugins() {
    return [new Plugin({
      key: componentBoundaryKey,
      props: {
        handleKeyDown(view, event) {
          if (event.isComposing) return false
          const direction = event.key === 'Backspace'
            ? 'start'
            : event.key === 'Delete'
              ? 'end'
              : undefined
          return !!direction && isAtComponentBoundary(view.state, direction)
        },
      },
    })]
  },
})
