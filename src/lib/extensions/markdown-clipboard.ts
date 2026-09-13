import { Extension, type Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import type { AuthoringKitV1 } from '../../authoring'
import {
  prepareMarkdownForVisualEditing,
  convertTiptapDocToMarkdown,
  validateMarkdownForAuthoring,
} from '../conversionPipeline'
import { editorDebug } from '../debug'
import type { TiptapToMDCOptions } from '../tiptapToMdc'

export interface MarkdownClipboardOptions extends TiptapToMDCOptions {
  enabled: boolean
  getAuthoringKit?: () => AuthoringKitV1 | undefined
  getOutputOptions?: () => TiptapToMDCOptions
  canPaste?: () => boolean
  onPasteError?: (message: string | undefined) => void
  onCopyError?: (message: string | undefined) => void
}

const markdownClipboardPluginKey = new PluginKey('markdownClipboard')

export const MarkdownClipboard = Extension.create<MarkdownClipboardOptions>({
  name: 'markdownClipboard',

  addOptions() {
    return {
      enableDebug: false,
      enabled: true,
      fileOutput: 'mdc',
      imageOutput: 'mdc',
      videoOutput: 'mdc',
    }
  },

  addProseMirrorPlugins() {
    if (!this.options.enabled) {
      return []
    }

    const copying = createMarkdownCopy(this.editor, this.options)
    return [
      new Plugin({
        view(view) {
          copying.prepare(view)
          return { update: copying.prepare, destroy: copying.destroy }
        },
        key: markdownClipboardPluginKey,
        props: {
          handleDOMEvents: {
            copy: (view, event) => copying.handle(view, event, false),
            cut: (view, event) => copying.handle(view, event, true),
            paste: (view, event) => {
              return handleMarkdownPaste(this.editor, event, this.options)
            },
          },
        },
      }),
    ]
  },
})

function isNativeTextField(target: EventTarget | null) {
  return target instanceof globalThis.Element && !!target.closest('input, textarea, select')
}

/** Copy the selected document through Content, never through a second serializer. */
function createMarkdownCopy(editor: Editor, options: MarkdownClipboardOptions) {
  type Snapshot = {
    doc: EditorView['state']['doc']
    selection: EditorView['state']['selection']
    key: string
    promise: Promise<string | null>
    text?: string
  }
  let cached: Snapshot | undefined
  let disposed = false
  let request = 0
  const output = () => {
    const source = options.getOutputOptions?.() ?? options
    return {
      enableDebug: source.enableDebug,
      fileOutput: source.fileOutput,
      imageOutput: source.imageOutput,
      videoOutput: source.videoOutput,
      highlightTheme: source.highlightTheme ? { ...source.highlightTheme } : undefined,
    }
  }
  function prepare(view: EditorView) {
    if (disposed || view.state.selection.empty) { cached = undefined; return undefined }
    const settings = output(), key = JSON.stringify(settings)
    const { doc, selection } = view.state
    if (cached?.doc === doc && cached.selection.eq(selection) && cached.key === key) return cached
    let content = selection.content().content
    // A rectangular cell selection returns bare rows. Restore its document
    // wrapper so Content receives a complete table, including cell alignment.
    if (content.firstChild?.type.name === 'tableRow') {
      content = Fragment.from(view.state.schema.nodes.table.create(null, content))
    } else if (['tableCell', 'tableHeader'].includes(content.firstChild?.type.name ?? '')) {
      content = Fragment.from(view.state.schema.nodes.table.create(null, view.state.schema.nodes.tableRow.create(null, content)))
    }
    const snapshot: Snapshot = { doc, selection, key, promise: Promise.resolve(null) }
    snapshot.promise = convertTiptapDocToMarkdown({ type: 'doc', content: content.toJSON() }, settings)
      .then(result => {
        if (!result.ok || result.value === undefined) return null
        snapshot.text = result.value
        return result.value
      }).catch(() => null)
    cached = snapshot
    return snapshot
  }
  function handle(view: EditorView, event: ClipboardEvent, cut: boolean) {
    // Stop ProseMirror's own handler, but leave the browser's input copy intact.
    if (isNativeTextField(event.target)) return true
    if (view.state.selection.empty || disposed) return false
    // A read-only document still supports copying, but never native cutting.
    if (cut && !editor.isEditable) { event.preventDefault(); return true }
    const snapshot = prepare(view)
    if (!snapshot) return false
    event.preventDefault()
    const currentRequest = ++request
    const before = view.state
    options.onCopyError?.(undefined)
    const fail = () => {
      if (!disposed && currentRequest === request) options.onCopyError?.('The selection could not be copied as Markdown. Keep it selected and copy again, or use Markdown mode.')
    }
    const removeCopiedSelection = () => {
      if (cut && !disposed && editor.isEditable && view.state === before && JSON.stringify(output()) === snapshot.key) {
        view.dispatch(view.state.tr.deleteSelection().scrollIntoView())
      }
    }
    if (snapshot.text !== undefined && event.clipboardData) {
      try {
        event.clipboardData.setData('text/plain', snapshot.text)
        event.clipboardData.setData('text/markdown', snapshot.text)
        removeCopiedSelection()
      } catch { fail() }
      return true
    }
    // Start write() during the copy gesture. Promise-backed ClipboardItems
    // retain browser user activation while Content serializes the selection.
    const clipboard = globalThis.navigator?.clipboard
    const Item = globalThis.ClipboardItem
    if (!clipboard?.write || !Item) { fail(); return true }
    try {
      const text = snapshot.promise.then(value => {
        if (value === null || disposed || currentRequest !== request) throw new Error('Markdown copy is unavailable or superseded.')
        return value
      })
      const data: Record<string, Promise<Blob>> = {
        'text/plain': text.then(value => new Blob([value], { type: 'text/plain' })),
      }
      if (Item.supports?.('text/markdown')) data['text/markdown'] = text.then(value => new Blob([value], { type: 'text/markdown' }))
      // Item construction or write() can throw synchronously. Observe each
      // representation promise as well so that cancellation never leaks a rejection.
      Object.values(data).forEach(promise => { void promise.catch(() => {}) })
      void clipboard.write([new Item(data)]).then(removeCopiedSelection, fail)
    } catch { fail() }
    return true
  }
  return { prepare, handle, destroy() { disposed = true; cached = undefined; request += 1 } }
}

function handleMarkdownPaste(editor: Editor, event: Event, options: MarkdownClipboardOptions) {
  if (isNativeTextField(event.target)) return true
  if (!editor.isEditable || options.canPaste?.() === false) return false
  const clipboardEvent = event as ClipboardEvent
  options.onPasteError?.(undefined)
  const markdown = extractMarkdownFromClipboard(clipboardEvent)
  if (!markdown) {
    return false
  }

  clipboardEvent.preventDefault()
  void applyMarkdownPaste(editor, markdown, clipboardEvent, options)
  return true
}

export function extractMarkdownFromClipboard(event: ClipboardEvent): null | string {
  const markdown = event.clipboardData?.getData('text/markdown')?.trim()
  if (markdown) {
    return markdown
  }

  // Rich HTML (Google Docs, Word, web pages) carries more structure than the
  // plain-text flavor, so defer to ProseMirror's native HTML paste instead of
  // re-parsing the flattened plain text as markdown.
  const html = event.clipboardData?.getData('text/html') ?? ''
  if (hasSemanticHtml(html)) {
    return null
  }

  const plainText = event.clipboardData?.getData('text/plain') ?? ''
  return isProbablyMarkdown(plainText) ? plainText : null
}

export function hasSemanticHtml(html: string): boolean {
  return /\bdata-pm-slice=/.test(html) || /<(?:h[1-6]|ul|ol|li|strong|em|blockquote|table|img|pre|code|[abi])[\s/>]/i.test(html)
}

export function isProbablyMarkdown(value: string): boolean {
  const text = value.trim()
  if (!text) {
    return false
  }

  return (
    /(?:^|\n)(?:#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~)/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /!\[[^\]]*\]\([^)]+\)/.test(text) ||
    /(?:^|\n)\|.*\|/.test(text) ||
    /(?:^|\n):{2,}[a-z][\w-]*(?:[\s{]|$)/i.test(text) ||
    /<([a-z][\w-]*)(?:\s[^<>]*?)?>[\s\S]*?<\/\1\s*>|<[a-z][\w-]*(?:\s[^<>]*?)?\/>/i.test(text) ||
    /:[a-z][\w-]*\[[^\]\n]*\]/i.test(text) ||
    /(?:\*\*|__)(?=\S)[\s\S]+?(?:\*\*|__)/.test(text) ||
    /(?:^|[\s(])(?:\*(?=\S)[^*\n]+\*|_(?=\S)[^_\n]+_)(?=$|[\s.,!?;)])/.test(text) ||
    /~~(?=\S)[^~\n]+~~|`[^`\n]+`/.test(text)
  )
}

function detectClipboardSource(event: ClipboardEvent) {
  return event.clipboardData?.types?.includes('text/markdown') ? 'text/markdown' : 'text/plain'
}

async function applyMarkdownPaste(
  editor: Editor,
  markdown: string,
  event: ClipboardEvent,
  options: MarkdownClipboardOptions,
) {
  const before = editor.state
  const authoringKit = options.getAuthoringKit?.()
  const outputOptions = options.getOutputOptions?.() ?? options
  let stale = false
  const invalidate = () => { stale = true }
  editor.on('transaction', invalidate)
  const isCurrent = () => !stale && !editor.isDestroyed && editor.isEditable && options.canPaste?.() !== false && options.getAuthoringKit?.() === authoringKit
  const reject = () => { if (isCurrent()) options.onPasteError?.('This content cannot be pasted safely here. Your document is unchanged. Use Markdown mode to keep the original source.') }
  try {
    const result = await prepareMarkdownForVisualEditing(markdown, outputOptions, editor.schema, authoringKit, 'fragment')
    if (!isCurrent()) return
    if (!result.ok || !result.value) {
      reject()
      editorDebug.warn('Markdown clipboard paste parse failed', {
        issues: result.issues,
      })
      return
    }

    const content = result.value.content ?? [{ type: 'paragraph' }]
    const fragment = Fragment.fromArray(content.map(node => editor.schema.nodeFromJSON(node)))
    const transaction = before.tr.replaceSelection(new Slice(fragment, 0, 0))
    if (authoringKit) {
      const candidate = await convertTiptapDocToMarkdown(transaction.doc.toJSON(), outputOptions)
      if (!candidate.ok || candidate.value === undefined) { reject(); return }
      const issue = await validateMarkdownForAuthoring(candidate.value, authoringKit)
      if (issue) {
        reject()
        editorDebug.warn('Markdown clipboard paste rejected by authoring policy', { issue })
        return
      }
    }
    if (!isCurrent()) return
    editor.view.dispatch(transaction.scrollIntoView())
    editorDebug.log('Markdown clipboard paste applied', {
      length: markdown.length,
      nodeCount: content.length,
      source: detectClipboardSource(event),
    })
  } catch (error) {
    reject()
    editorDebug.warn('Markdown clipboard paste failed unexpectedly', {
      error,
      length: markdown.length,
    })
  } finally {
    editor.off('transaction', invalidate)
  }
}
