import type { CommandProps } from '@tiptap/core'
import { mergeAttributes, Node } from '@tiptap/core'

import type { JsonRecord } from '../../types'
import { readStoredMediaProps, sanitizeAssetUrl, sanitizeResolvedAssetUrl } from '../props'

export interface FileOptions {
  HTMLAttributes: JsonRecord
  inline: boolean
  resolveSrc?: (props: JsonRecord) => string | null | undefined
}

export interface SetFileOptions {
  filename?: string
  id?: string
  size?: number
  src?: string
  title?: string
  type?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    File: {
      addFile: () => ReturnType
      setFile: (options: SetFileOptions) => ReturnType
    }
  }
}

export const File = Node.create<FileOptions>({
  name: 'file',
  draggable: true,

  addAttributes() {
    return {
      props: {
        default: {},
        parseHTML: (element) => readStoredMediaProps(element) ?? ({
          filename: element.getAttribute('data-filename') || '',
          id: element.getAttribute('data-file-id') || '',
          size: element.getAttribute('data-size') || '',
          src: element.getAttribute('href') || '',
          title: element.getAttribute('title') || '',
          type: element.getAttribute('data-file-type') || '',
        }),
      },
    }
  },

  addCommands() {
    return {
      addFile:
        () =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            attrs: { props: {} },
            type: this.name,
          }),
      setFile:
        (options: SetFileOptions) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            attrs: { props: options },
            type: this.name,
          }),
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {},
      inline: false,
    }
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  inline() {
    return this.options.inline
  },

  parseHTML() {
    // Recognize our file node before the generic anchor mark on paste without
    // changing the schema's default block type.
    return [{ tag: 'a[data-type="file"]', priority: 1100 }]
  },

  renderHTML({ node }) {
    const props = node.attrs.props || {}
    const attrs: Record<string, string> = { 'data-type': 'file' }
    const rawSrc = String(props.src || '')
    const displaySrc = sanitizeAssetUrl(rawSrc) ?? sanitizeResolvedAssetUrl(this.options.resolveSrc?.(props) || '')
    if (displaySrc) attrs.href = displaySrc
    attrs['data-ginko-props'] = JSON.stringify(props)
    if (props.title) attrs.title = String(props.title)
    if (props.id) attrs['data-file-id'] = String(props.id)
    if (props.filename) attrs['data-filename'] = String(props.filename)
    if (props.type) attrs['data-file-type'] = String(props.type)
    if (props.size) attrs['data-size'] = String(props.size)
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, attrs),
      props.title || props.filename || props.src || 'File',
    ]
  },
})
