import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { AuthoringKit } from '../../authoring'

/** Return direct columns, including the parser's explicit default-slot form. */
export function columnChildren(node: ProseMirrorNode, childTag: string) {
  const result: { node: ProseMirrorNode; offset: number }[] = []
  const content = node.childCount === 1
    && node.firstChild?.type.name === 'slot'
    && node.firstChild.attrs.name === 'default'
    ? node.firstChild
    : node
  content.forEach((child, offset) => {
    if (child.type.name === 'element' && child.attrs.tag === childTag) {
      result.push({ node: child, offset: offset + (content === node ? 1 : 2) })
    }
  })
  return result.length === content.childCount ? result : []
}

/** Paired column membership is shared by pointer controls and block shortcuts. */
export function parentColumnConfig(doc: ProseMirrorNode, pos: number, kit: AuthoringKit | undefined) {
  const resolved = doc.resolve(pos), node = doc.nodeAt(pos)
  if (!node) return undefined
  for (let depth = resolved.depth; depth > 0; depth--) {
    const parent = resolved.node(depth), config = kit?.authoring[parent.attrs.tag]?.canvas?.columns
    if (config && config.childTag === node.attrs.tag) {
      const children = columnChildren(parent, config.childTag)
      if (children.length === 2 && children.some(child => resolved.before(depth) + child.offset === pos)) {
        return config
      }
    }
  }
  return undefined
}
