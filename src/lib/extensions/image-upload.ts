import { Extension } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { AssetInfo, ImageUploadHandler } from '../../types'
import { icon } from '../nodeviews/icons'

export interface UploadOptions {
  upload?: () => ImageUploadHandler | undefined
  enabled?: () => boolean
  insert?: (asset: Partial<AssetInfo>, pos: number, replaceSize?: number) => boolean
  onPendingChange?: (count: number) => void
}
export interface UploadStorage { add: () => boolean; clear: () => void }
interface UploadEntry { committing?: boolean; target?: ProseMirrorNode; id: string; dom: HTMLElement; cancel: () => void; refresh: () => void }
const key = new PluginKey<DecorationSet>('ginkoImageUploads')
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: { insertImageUpload: () => ReturnType; clearImageUploads: () => ReturnType }
  }
}

/** Uploads are temporary view decorations, never an extra Markdown node type. */
export const ImageUpload = Extension.create<UploadOptions, UploadStorage>({
  name: 'imageUpload',
  addStorage() { return { add: () => false, clear: () => {} } },
  addCommands() {
    return {
      insertImageUpload: () => ({ dispatch }) => dispatch ? this.storage.add() : !!this.options.upload?.() && this.options.enabled?.() !== false,
      clearImageUploads: () => ({ dispatch }) => { if (dispatch) this.storage.clear(); return true },
    }
  },
  addProseMirrorPlugins() {
    const editor = this.editor, options = this.options, entries = new Map<string, UploadEntry>()
    let view: EditorView | undefined, sequence = 0, destroyed = false
    const decorations = () => view ? key.getState(view.state) ?? DecorationSet.empty : DecorationSet.empty
    const enabled = () => !destroyed && editor.isEditable && options.enabled?.() !== false
    const position = (id: string) => decorations().find(undefined, undefined, spec => spec.id === id)[0]?.from
    function remove(id: string, cancel = true) {
      const entry = entries.get(id)
      if (cancel) entry?.cancel()
      entries.delete(id)
      if (view && !destroyed) view.dispatch(view.state.tr.setMeta(key, { remove: id }))
    }
    this.storage.clear = () => { for (const id of [...entries.keys()]) remove(id) }
    this.storage.add = () => {
      if (!view || !enabled() || !options.upload?.()) return false
      const selection = view.state.selection
      // Insert a document-level image after the current block. Tables and
      // component-only child lists must not acquire an invalid image child.
      const target = selection instanceof NodeSelection && selection.node.type.name === 'image' ? selection.node : undefined
      const pos = target ? selection.from : selection.$from.depth ? selection.$from.node(1).type.name === 'paragraph' && selection.$from.node(1).content.size === 0 ? selection.$from.before(1) : selection.$from.after(1) : selection.from
      const existing = [...entries.values()].find(entry => position(entry.id) === pos && entry.target === target)
      if (existing) { existing.dom.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); return true }
      const id = `image-upload-${++sequence}`
      const dom = document.createElement('div'); dom.className = 'ginko-image-upload'; dom.contentEditable = 'false'
      dom.setAttribute('role', 'group'); dom.setAttribute('aria-label', 'Image upload')
      const area = document.createElement('button'); area.type = 'button'; area.className = 'ginko-image-upload__dropzone'
      area.setAttribute('aria-label', 'Upload image')
      const symbol = document.createElement('span'); symbol.className = 'ginko-image-upload__symbol'; symbol.append(icon('imageUpload'))
      const label = document.createElement('span'); label.className = 'ginko-image-upload__label'
      const hint = document.createElement('span'); hint.className = 'ginko-image-upload__hint'; hint.textContent = 'Choose an image file · up to 10 MB'
      area.append(symbol, label, hint)
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true; input.setAttribute('aria-label', 'Image file')
      const error = document.createElement('p'); error.className = 'ginko-image-upload__error'; error.setAttribute('role', 'alert'); error.hidden = true
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ginko-image-upload__cancel'; cancel.setAttribute('aria-label', 'Remove image placeholder'); cancel.title = 'Remove image placeholder'; cancel.append(icon('close'))
      dom.append(area, input, error, cancel)
      let controller: AbortController | undefined, busy = false
      function render() {
        area.disabled = busy || !enabled()
        label.textContent = busy ? 'Uploading image…' : !error.hidden ? 'Try another image or retry' : target ? 'Click to replace or drag and drop' : 'Click to upload or drag and drop'
        dom.setAttribute('aria-busy', String(busy)); dom.dataset.uploading = String(busy)
      }
      async function upload(file: globalThis.File) {
        if (busy || !enabled() || position(id) === undefined) return
        error.hidden = true
        if (!file.type.startsWith('image/') || file.size === 0 || file.size > 10 * 1024 * 1024) {
          error.textContent = file.size > 10 * 1024 * 1024 ? 'Choose an image smaller than 10 MB.' : 'Choose a non-empty image file.'; error.hidden = false; render(); return
        }
        const handler = options.upload?.()
        if (!handler) return
        controller = new AbortController(); busy = true; render()
        try {
          const asset = await handler(file, { signal: controller.signal })
          const current = position(id)
          if (controller.signal.aborted || !enabled() || current === undefined || !entries.has(id)) return
          // The mapped anchor, rather than the current text selection, owns insertion.
          const focused = dom.contains(document.activeElement)
          if (target && view?.state.doc.nodeAt(current) !== target) return
          const entry = entries.get(id)!
          entry.committing = true
          let inserted: boolean | undefined
          try { inserted = options.insert?.(asset, current, target?.nodeSize) } finally { entry.committing = false }
          if (!inserted) throw new Error('The image could not be inserted. Try again.')
          remove(id, false)
          if (focused) editor.view.focus()
        } catch (cause) {
          if (controller.signal.aborted || !entries.has(id)) return
          error.textContent = cause instanceof Error ? cause.message : 'The image could not be uploaded. Try again.'; error.hidden = false
        } finally { busy = false; render() }
      }
      area.addEventListener('click', () => input.click())
      input.addEventListener('change', () => { const file = input.files?.[0]; input.value = ''; if (file) void upload(file) })
      const drag = (event: DragEvent) => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; dom.dataset.dragging = 'true' }
      area.addEventListener('dragover', drag)
      area.addEventListener('dragenter', drag)
      area.addEventListener('dragleave', event => { if (!(event.relatedTarget instanceof globalThis.Node) || !area.contains(event.relatedTarget)) dom.dataset.dragging = 'false' })
      area.addEventListener('drop', event => { event.preventDefault(); event.stopPropagation(); dom.dataset.dragging = 'false'; const files = event.dataTransfer?.files; if (!files?.length) return; if (files.length > 1) { error.textContent = 'Choose one image for this placeholder.'; error.hidden = false; render(); return } void upload(files[0]) })
      cancel.addEventListener('click', () => { remove(id); editor.view.focus() })
      dom.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); remove(id); editor.view.focus() } })
      entries.set(id, { target, id, dom, cancel: () => controller?.abort(), refresh: render })
      render()
      view.dispatch(closeHistory(view.state.tr).setMeta(key, { add: { id, pos, dom } }))
      area.focus(); dom.scrollIntoView?.({ block: 'nearest' })
      return true
    }
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, previous) {
          let next = previous.map(tr.mapping, tr.doc)
          // Wrapping the adjacent block must not move a new image into a
          // component-only child list. Keep the visible anchor at document depth.
          for (const decoration of next.find()) {
            const entry = entries.get(decoration.spec.id)
            const at = tr.doc.resolve(decoration.from)
            if (entry && !entry.target && at.depth > 0) {
              next = next.remove([decoration]).add(tr.doc, [Decoration.widget(at.after(1), () => entry.dom, decoration.spec)])
            }
          }
          const change = tr.getMeta(key) as { add?: { id: string; pos: number; dom: HTMLElement }; remove?: string } | undefined
          if (change?.remove) next = next.remove(next.find(undefined, undefined, spec => spec.id === change.remove))
          if (change?.add) {
            const { id, pos, dom } = change.add
            next = next.add(tr.doc, [Decoration.widget(pos, () => dom, { id, key: id, side: entries.get(id)?.target ? 1 : -1, stopEvent: () => true, ignoreSelection: true })])
          }
          return next
        },
      },
      props: { decorations: state => key.getState(state) },
      view(instance) {
        view = instance
        return {
          update() {
            for (const [id, entry] of entries) {
              if (entry.committing) continue
              const current = position(id)
              if (current === undefined || (entry.target && instance.state.doc.nodeAt(current) !== entry.target)) {
                entry.cancel(); entries.delete(id)
                // A changed replacement target invalidates only this upload.
                if (current !== undefined) queueMicrotask(() => remove(id))
              }
              else entry.refresh()
            }
            options.onPendingChange?.(entries.size)
          },
          destroy() { destroyed = true; entries.forEach(entry => entry.cancel()); entries.clear(); options.onPendingChange?.(0) },
        }
      },
    })]
  },
})
