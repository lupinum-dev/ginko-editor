import { Extension, type Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
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

    return [
      new Plugin({
        key: markdownClipboardPluginKey,
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              return handleMarkdownPaste(this.editor, event, this.options)
            },
          },
        },
      }),
    ]
  },
})

function handleMarkdownPaste(editor: Editor, event: Event, options: MarkdownClipboardOptions) {
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
    /(?:^|\n)\|.*\|/.test(text)
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
