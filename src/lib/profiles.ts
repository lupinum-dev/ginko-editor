import type { JSONContent } from '@tiptap/core'
import { Fragment, Slice, type Mark, type Node as ProseMirrorNode, type Schema } from '@tiptap/pm/model'

/**
 * A content profile limits what a writer can create. `full` keeps every
 * supported block and component. The other profiles are closed sets:
 *
 * - `plain`: paragraphs and line breaks, no formatting.
 * - `inline`: `plain` plus bold, italic, and links.
 * - `article`: `inline` plus headings 2–4, lists, quotes, dividers, and images.
 */
export type EditorProfileName = 'plain' | 'inline' | 'article' | 'full'

export interface EditorProfile {
  readonly name: EditorProfileName
  /** Allowed node type names. `undefined` allows every node. */
  readonly nodes?: ReadonlySet<string>
  /** Allowed mark type names. `undefined` allows every mark. */
  readonly marks?: ReadonlySet<string>
  /** Allowed heading levels. Empty when headings are not allowed. */
  readonly headingLevels: readonly number[]
}

/**
 * Set this transaction meta when trusted content is loaded, for example a
 * document from the host or steps from a collaboration server. The profile
 * guard does not check such a transaction.
 */
export const profileExemptMeta = 'ginkoProfileExempt'

const textNodes = ['doc', 'paragraph', 'text', 'hardBreak']
const inlineMarks = ['bold', 'italic', 'link']

export const editorProfiles: Readonly<Record<EditorProfileName, EditorProfile>> = {
  plain: {
    name: 'plain',
    nodes: new Set(textNodes),
    marks: new Set(),
    headingLevels: [],
  },
  inline: {
    name: 'inline',
    nodes: new Set(textNodes),
    marks: new Set(inlineMarks),
    headingLevels: [],
  },
  article: {
    name: 'article',
    nodes: new Set([
      ...textNodes,
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'blockquote',
      'horizontalRule',
      'image',
    ]),
    marks: new Set(inlineMarks),
    headingLevels: [2, 3, 4],
  },
  full: {
    name: 'full',
    headingLevels: [1, 2, 3, 4, 5, 6],
  },
}

export function resolveEditorProfile(profile: EditorProfileName | EditorProfile | undefined): EditorProfile {
  if (!profile) return editorProfiles.full
  return typeof profile === 'string' ? editorProfiles[profile] : profile
}

export function isRestrictedProfile(profile: EditorProfile) {
  return !!profile.nodes || !!profile.marks
}

export function profileAllowsNode(profile: EditorProfile, name: string, attrs?: Record<string, unknown>) {
  if (profile.nodes && !profile.nodes.has(name)) return false
  if (name === 'heading' && attrs && typeof attrs.level === 'number') {
    return profile.headingLevels.includes(attrs.level)
  }
  return true
}

export function profileAllowsMark(profile: EditorProfile, name: string) {
  return !profile.marks || profile.marks.has(name)
}

/** Whether the profile allows any block other than paragraphs. */
export function profileAllowsBlocks(profile: EditorProfile) {
  return !profile.nodes || [...profile.nodes].some(name => !textNodes.includes(name))
}

/**
 * TipTap extension names whose input and paste rules stay active. `true`
 * keeps every rule. Rules of other extensions would create content that the
 * profile rejects, so they are not registered.
 */
export function profileRuleExtensions(profile: EditorProfile): true | string[] {
  if (!profile.nodes) return true
  return [...profile.nodes, ...(profile.marks ?? [])]
}

export interface EditorProfileViolation {
  kind: 'node' | 'mark'
  type: string
  /** The heading level for a heading outside the allowed levels. */
  level?: number
}

/**
 * List every node and mark in a document that the profile does not allow.
 * Accepts a ProseMirror node or TipTap JSON, so servers can check stored
 * documents without an editor.
 */
export function findProfileViolations(
  doc: ProseMirrorNode | JSONContent,
  profile: EditorProfileName | EditorProfile,
): EditorProfileViolation[] {
  const resolved = resolveEditorProfile(profile)
  const violations: EditorProfileViolation[] = []
  if (!isRestrictedProfile(resolved)) return violations
  const visit = (type: string, attrs: Record<string, unknown> | undefined, marks: readonly { type: string }[]) => {
    if (!profileAllowsNode(resolved, type, attrs)) {
      violations.push(type === 'heading' && typeof attrs?.level === 'number'
        ? { kind: 'node', type, level: attrs.level }
        : { kind: 'node', type })
    }
    for (const mark of marks) {
      if (!profileAllowsMark(resolved, mark.type)) violations.push({ kind: 'mark', type: mark.type })
    }
  }
  if (isProseMirrorNode(doc)) {
    doc.descendants(node => visit(node.type.name, node.attrs, node.marks.map(mark => ({ type: mark.type.name }))))
  }
  else {
    const walk = (node: JSONContent) => {
      for (const child of node.content ?? []) {
        visit(child.type ?? '', child.attrs, child.marks ?? [])
        walk(child)
      }
    }
    walk(doc)
  }
  return violations
}

function isProseMirrorNode(value: ProseMirrorNode | JSONContent): value is ProseMirrorNode {
  return typeof (value as ProseMirrorNode).descendants === 'function'
}

/** The number of violations. A transaction may never raise it. */
export function countProfileViolations(doc: ProseMirrorNode, profile: EditorProfile) {
  if (!isRestrictedProfile(profile)) return 0
  let count = 0
  doc.descendants((node) => {
    if (!profileAllowsNode(profile, node.type.name, node.attrs)) count++
    for (const mark of node.marks) if (!profileAllowsMark(profile, mark.type.name)) count++
  })
  return count
}

/**
 * Reduce pasted or inserted content to what the profile allows. Text is never
 * dropped: disallowed blocks become paragraphs, containers such as lists and
 * tables are unwrapped, and disallowed marks are removed. Media and other
 * atoms that the profile does not allow are removed.
 */
export function sanitizeFragment(fragment: Fragment, schema: Schema, profile: EditorProfile): Fragment {
  if (!isRestrictedProfile(profile)) return fragment
  const blocks: ProseMirrorNode[] = []
  let inline: ProseMirrorNode[] = []
  const flushInline = () => {
    if (!inline.length) return
    blocks.push(schema.nodes.paragraph!.create(null, inline))
    inline = []
  }
  fragment.forEach((node) => {
    if (node.isInline) {
      inline.push(...sanitizeInline(node, schema, profile))
      return
    }
    flushInline()
    blocks.push(...sanitizeBlock(node, schema, profile))
  })
  // A fragment of only inline content stays inline so it joins the current paragraph.
  if (!blocks.length) return Fragment.fromArray(inline)
  flushInline()
  return Fragment.fromArray(blocks)
}

/** Sanitize a clipboard slice and keep it as open as its new structure allows. */
export function sanitizeSlice(slice: Slice, schema: Schema, profile: EditorProfile): Slice {
  if (!isRestrictedProfile(profile)) return slice
  const content = sanitizeFragment(slice.content, schema, profile)
  if (content.eq(slice.content)) return slice
  const open = Slice.maxOpen(content)
  return new Slice(content, Math.min(slice.openStart, open.openStart), Math.min(slice.openEnd, open.openEnd))
}

function filterMarks(marks: readonly Mark[], profile: EditorProfile) {
  return marks.filter(mark => profileAllowsMark(profile, mark.type.name))
}

function sanitizeInline(node: ProseMirrorNode, schema: Schema, profile: EditorProfile): ProseMirrorNode[] {
  if (node.isText) return [node.mark(filterMarks(node.marks, profile))]
  if (profileAllowsNode(profile, node.type.name, node.attrs)) {
    return [node.type.create(node.attrs, null, filterMarks(node.marks, profile))]
  }
  // Inline components keep their visible text; media and other atoms go.
  const text: ProseMirrorNode[] = []
  node.content.forEach(child => text.push(...sanitizeInline(child, schema, profile)))
  return text
}

function sanitizeBlock(node: ProseMirrorNode, schema: Schema, profile: EditorProfile): ProseMirrorNode[] {
  const paragraph = schema.nodes.paragraph!
  const name = node.type.name
  if (node.isTextblock) {
    const inline = textblockContent(node, schema, profile)
    if (profileAllowsNode(profile, name, node.attrs)) return [node.type.create(node.attrs, inline, node.marks)]
    if (name === 'heading' && profile.headingLevels.length) {
      const level = nearestLevel(profile.headingLevels, Number(node.attrs.level))
      return [node.type.create({ ...node.attrs, level }, inline, node.marks)]
    }
    return [paragraph.create(null, inline)]
  }
  if (node.isAtom || node.isLeaf) {
    return profileAllowsNode(profile, name, node.attrs) ? [node] : []
  }
  const children = sanitizeFragment(node.content, schema, profile)
  if (profileAllowsNode(profile, name, node.attrs)) {
    const rebuilt = node.type.createAndFill(node.attrs, children, node.marks)
    if (rebuilt) return [rebuilt]
  }
  const unwrapped: ProseMirrorNode[] = []
  children.forEach((child) => {
    unwrapped.push(child.isInline ? paragraph.create(null, child) : child)
  })
  return unwrapped
}

/** Code keeps its line breaks when it becomes a paragraph. */
function textblockContent(node: ProseMirrorNode, schema: Schema, profile: EditorProfile) {
  const result: ProseMirrorNode[] = []
  const hardBreak = schema.nodes.hardBreak
  const allowsBreak = !!hardBreak && profileAllowsNode(profile, 'hardBreak')
  node.content.forEach((child) => {
    if (!child.isText || !node.type.spec.code || !child.text?.includes('\n')) {
      result.push(...sanitizeInline(child, schema, profile))
      return
    }
    child.text.split('\n').forEach((line, index) => {
      if (index) result.push(allowsBreak ? hardBreak.create() : schema.text(' '))
      if (line) result.push(schema.text(line))
    })
  })
  return result
}

function nearestLevel(levels: readonly number[], level: number) {
  return levels.reduce((best, candidate) =>
    Math.abs(candidate - level) < Math.abs(best - level) ? candidate : best, levels[0]!)
}
