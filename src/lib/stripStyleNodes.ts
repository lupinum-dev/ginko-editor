import type { MDCNode, MDCRoot } from './mdcTypes'

export function stripStyleNodes(root: MDCRoot): MDCRoot {

  const walk = (node: MDCNode | MDCRoot): MDCNode | MDCRoot | null => {
    if (node.type === 'element' && node.tag === 'style') {
      return null
    }

    if (node.type === 'element') {
      const children = (node.children || [])
        .map((child) => walk(child))
        .filter(Boolean) as MDCNode[]
      return { ...node, children }
    }

    if (node.type === 'root') {
      const children = (node.children || [])
        .map((child) => walk(child))
        .filter(Boolean) as MDCNode[]
      return { ...node, children }
    }

    return node
  }

  return walk(root) as MDCRoot
}
