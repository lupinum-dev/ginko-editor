// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthoringKit, type AuthoringKitV1 } from '../src/authoring'
import { createEditorExtensions } from '../src/lib/config/editorConfig'
import { applyTiptapDocToEditor, prepareMarkdownForVisualEditing } from '../src/lib/conversionPipeline'
import {
  canPerformBlockAction,
  captureBlock,
  commitEditorTransaction,
  observeEditorOperations,
  parentBlock,
  performBlockAction,
  selectedBlock,
  selectParentBlock,
  trackEditorOperation,
  waitForEditorOperations,
  type BlockReference,
} from '../src/lib/editor-operations'
import * as conversion from '../src/lib/conversionPipeline'
import { actOnBlock, canActOnBlock } from '../src/lib/nodeviews/block-actions'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})
const editors: Editor[] = []
afterEach(() => {
  editors.splice(0).forEach(editor => {
    const element = editor.options.element
    editor.destroy()
    if (element instanceof HTMLElement) element.remove()
  })
  vi.restoreAllMocks()
})
const block = { kind: 'block', media: null, slots: ['default'], allowedParents: null, allowedChildren: null } as const
async function kit() {
  return createAuthoringKit({ version: 1, recipes: [], policy: { version: 2, components: {
    note: { ...block, props: {} },
    split: { ...block, props: {}, allowedChildren: ['pane'] },
    pane: {
      ...block,
      props: {
        width: { types: ['string'], required: false, allowedValues: ['small', 'large'] },
      },
      allowedParents: ['split'],
    },
    restricted: { ...block, props: {}, allowedParents: ['note'] },
  } }, implementation: {
    note: { componentName: 'Note', props: {}, slots: ['default'] },
    split: { componentName: 'Split', props: {}, slots: ['default'] },
    pane: { componentName: 'Pane', props: { width: { types: ['string'], required: false } }, slots: ['default'] },
    restricted: { componentName: 'Restricted', props: {}, slots: ['default'] },
  }, authoring: {
    note: { label: 'Note' },
    split: {
      label: 'Split',
      canvas: {
        columns: {
          childTag: 'pane',
          sizeProp: 'width',
          presets: [
            { label: 'Narrow / wide', values: ['small', 'large'], ratio: 1 / 3 },
            { label: 'Wide / narrow', values: ['large', 'small'], ratio: 2 / 3 },
          ],
        },
      },
    },
    pane: { label: 'Pane' },
    restricted: { label: 'Restricted' },
  } })
}
async function setup(source: string, authoringKit?: AuthoringKitV1) {
  const editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    content: '<p></p>',
    extensions: createEditorExtensions({
      codeBlockTheme: 'github-dark',
      enableDebug: false,
      enableFiles: true,
      enableVideo: true,
      fileOutput: 'mdc',
      imageOutput: 'mdc',
      showMarkdownMarkers: false,
      videoOutput: 'mdc',
      getAuthoringKit: () => authoringKit,
    }),
  })
  editors.push(editor)
  const prepared = await prepareMarkdownForVisualEditing(source, undefined, editor.schema, authoringKit)
  expect(prepared.ok, JSON.stringify(prepared.issues)).toBe(true)
  expect(applyTiptapDocToEditor(editor, prepared.value!).ok).toBe(true)
  return editor
}
function find(editor: Editor, predicate: (block: BlockReference) => boolean): BlockReference {
  let found: BlockReference | undefined
  editor.state.doc.descendants((_node, pos) => {
    const block = captureBlock(editor, pos)
    if (!found && block && predicate(block)) found = block
  })
  if (!found) throw new Error('Block not found')
  return found
}
const paragraph = (editor: Editor, text: string) => find(
  editor,
  block => block.node.type.name === 'paragraph' && block.node.textContent === text,
)
const component = (editor: Editor, tag: string) => find(editor, block => block.node.attrs.tag === tag)
function wrapDefaultSlot(editor: Editor, block: BlockReference) {
  const slot = editor.schema.nodes.slot!.create({ name: 'default', props: {} }, block.node.content)
  const next = block.node.copy(Fragment.from(slot))
  editor.view.dispatch(
    editor.state.tr
      .replaceWith(block.pos, block.pos + block.node.nodeSize, next)
      .setMeta('addToHistory', false),
  )
}

describe('validated editor operations', () => {
  it('drains mixed-context operations with accurate pending counts, isolated by editor', async () => {
    const editor = await setup('First\n\nSecond'), other = await setup('Other')
    const convert = conversion.convertTiptapDocToMarkdown
    const releases: (() => void)[] = []
    vi.spyOn(conversion, 'convertTiptapDocToMarkdown').mockImplementation(async (...args) => {
      await new Promise<void>(resolve => { releases.push(resolve) })
      return convert(...args)
    })
    const counts: number[] = []
    const unsubscribe = observeEditorOperations(editor, count => counts.push(count))
    const source = paragraph(editor, 'First')
    const first = performBlockAction(editor, source, 'delete')
    const second = performBlockAction(editor, source, 'duplicate')
    expect(counts).toEqual([0, 1, 2])
    let settled = false
    const draining = waitForEditorOperations(editor).then(() => { settled = true })
    await waitForEditorOperations(other)
    expect(settled).toBe(false)
    releases[0]()
    expect(await first).toEqual({ ok: true })
    expect(counts).toEqual([0, 1, 2, 1])
    expect(settled).toBe(false)
    releases[1]()
    expect(await second).toEqual({ ok: false, reason: 'stale' })
    await draining
    expect(settled).toBe(true)
    expect(counts).toEqual([0, 1, 2, 1, 0])
    unsubscribe()
    expect(editor.state.doc.firstChild?.textContent).toBe('Second')
  })

  it('registers preparation synchronously and cleans up rejected operations without leaking observers', async () => {
    const editor = await setup('First')
    const counts: number[] = []
    const unsubscribe = observeEditorOperations(editor, count => counts.push(count))
    const operation = trackEditorOperation(editor, async () => {
      expect(counts).toEqual([0, 1])
      throw new Error('Preparation failed')
    })
    await expect(operation).rejects.toThrow('Preparation failed')
    await waitForEditorOperations(editor)
    expect(counts).toEqual([0, 1, 0])
    unsubscribe()
    expect(await trackEditorOperation(editor, async () => true)).toBe(true)
    expect(counts).toEqual([0, 1, 0])
  })

  it('includes an operation started while the previous operation finishes draining', async () => {
    const editor = await setup('First\n\nSecond')
    const first = performBlockAction(editor, paragraph(editor, 'Second'), 'delete')
    let second: ReturnType<typeof performBlockAction> | undefined
    void first.then(() => { second = performBlockAction(editor, paragraph(editor, 'First'), 'duplicate') })
    await waitForEditorOperations(editor)
    expect(second).toBeDefined()
    expect(await second).toEqual({ ok: true })
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['First', 'First'])
  })

  it('validates shared structural transactions and rejects a stale transaction', async () => {
    const editor = await setup('First\n\nSecond')
    const before = editor.getJSON()
    const transaction = editor.state.tr.insertText('Added ', 1)
    expect(await commitEditorTransaction(editor, transaction)).toEqual({ ok: true })
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
    const stale = editor.state.tr.insertText('Old ', 1)
    editor.commands.insertContent('Current ')
    expect(await commitEditorTransaction(editor, stale)).toEqual({ ok: false, reason: 'stale' })
  })

  it('runs Content policy validation for shared structural transactions before dispatch', async () => {
    const editor = await setup('<note>\nKeep\n</note>', await kit())
    const note = component(editor, 'note'), before = editor.getJSON()
    const transaction = editor.state.tr.setNodeMarkup(note.pos, undefined, {
      ...note.node.attrs,
      props: { ...note.node.attrs.props, unsupported: 'value' },
    })
    expect(await commitEditorTransaction(editor, transaction)).toEqual({
      ok: false,
      reason: 'invalid-content',
    })
    expect(editor.getJSON()).toEqual(before)
  })

  it('clears the last document block without detaching required nested structure', async () => {
    const editor = await setup('Only text')
    const heading = captureBlock(editor, 0)!
    expect(canPerformBlockAction(editor, heading, 'delete')).toBe(true)
    expect(await performBlockAction(editor, heading, 'delete')).toEqual({ ok: true })
    expect(editor.getJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(canPerformBlockAction(editor, captureBlock(editor, 0)!, 'delete')).toBe(false)
    editor.commands.undo()
    expect(editor.getText().trim()).toBe('Only text')
  })

  it('rejects in-flight changes in document, selection, editability, kit, and output options', async () => {
    for (const change of ['document', 'selection', 'disabled', 'kit', 'output'] as const) {
      const editor = await setup('First\n\nSecond')
      let authoringKit: AuthoringKitV1 | undefined, output: 'mdc' | 'markdown' = 'mdc'
      const nextKit = await kit()
      const pending = performBlockAction(editor, paragraph(editor, 'First'), 'duplicate', {
        getAuthoringKit: () => authoringKit,
        getOutputOptions: () => ({ imageOutput: output }),
      })
      if (change === 'document') editor.commands.setContent('<p>Replacement</p>')
      if (change === 'selection') editor.commands.setTextSelection(3)
      if (change === 'disabled') { editor.setEditable(false); editor.setEditable(true) }
      if (change === 'kit') authoringKit = nextKit
      if (change === 'output') output = 'markdown'
      const before = editor.getJSON()
      expect(await pending, change).toEqual({ ok: false, reason: 'stale' })
      expect(editor.getJSON()).toEqual(before)
    }
  })

  it('cancels a pending operation when the editor is destroyed', async () => {
    const editor = await setup('First\n\nSecond')
    const pending = performBlockAction(editor, paragraph(editor, 'First'), 'duplicate')
    editor.destroy()
    expect(await pending).toEqual({ ok: false, reason: 'stale' })
  })

  it('selects the parent component through a slot and exposes compatible node-view actions', async () => {
    const editor = await setup('<note>\nInside\n</note>\n\nOutside', await kit())
    wrapDefaultSlot(editor, component(editor, 'note'))
    editor.commands.setTextSelection(paragraph(editor, 'Inside').pos + 1)
    const selected = selectedBlock(editor)!
    expect(selected.node.type.name).toBe('paragraph')
    expect(parentBlock(editor, selected)?.node.attrs.tag).toBe('note')
    expect(selectParentBlock(editor)).toBe(true)
    const note = component(editor, 'note')
    expect(editor.state.selection.from).toBe(note.pos)
    expect(canActOnBlock(editor, note.pos, 'duplicate')).toBe(true)
    expect(await actOnBlock(editor, note.node, note.pos, 'duplicate')).toBe(true)
    expect(editor.state.doc.childCount).toBe(3)
    editor.commands.undo()
    expect(editor.state.doc.childCount).toBe(2)
    const staleNode = note.node.type.create(note.node.attrs, note.node.content, note.node.marks)
    expect(await actOnBlock(editor, staleNode, note.pos, 'delete')).toBe(false)
    const current = component(editor, 'note')
    expect(await actOnBlock(editor, current.node, current.pos, 'delete')).toBe(true)
    expect(editor.getText()).toBe('Outside')
  })
})
