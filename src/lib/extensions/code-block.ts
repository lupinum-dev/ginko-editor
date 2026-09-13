import type { EditorOverlayController } from '../../ui/context'
import { codeView } from '../nodeviews/code'
import TiptapCodeBlock from '@tiptap/extension-code-block'

export interface CodeBlockOptions {
  overlay?: EditorOverlayController
  theme: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeBlock: {
      setCodeBlock: (attributes?: { language: string }) => ReturnType
      toggleCodeBlock: (attributes?: { language: string }) => ReturnType
    }
  }
}

export const CodeBlock = TiptapCodeBlock.extend<CodeBlockOptions>({
  addNodeView() { return props => codeView(props, this.options.overlay) },

  addAttributes() {
    return {
      filename: {
        default: null,
      },
      language: {
        default: null,
      },
    }
  },

  addOptions() {
    return {
      ...this.parent?.(),
      theme: 'github-dark',
    }
  },

  addStorage() {
    return {
      theme: this.options.theme,
    }
  },
})
