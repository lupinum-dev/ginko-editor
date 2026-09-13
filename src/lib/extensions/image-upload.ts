import { Extension } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { AssetInfo, ImageUploadHandler } from '../../types'
import { icon } from '../nodeviews/icons'

export interface UploadOptions {
  dropTarget?: () => HTMLElement | undefined
  upload?: () => ImageUploadHandler | undefined
  enabled?: () => boolean
  insert?: (asset: Partial<AssetInfo>, pos: number, replaceSize?: number) => boolean
  onPendingChange?: (count: number) => void
}
export interface UploadStorage { add: () => boolean; clear: () => void }
interface UploadEntry { committing?: boolean; target?: ProseMirrorNode; id: string; dom: HTMLElement; offer: (file: File) => void; cancel: () => void; refresh: () => void }
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
    this.storage.add = () => add()
    function add(drop?: { pos: number; target?: ProseMirrorNode; file: File }) {
      if (!view || !enabled() || !options.upload?.()) return false
      const selection = view.state.selection
      // Insert a document-level image after the current block. Tables and
      // component-only child lists must not acquire an invalid image child.
      const target = drop ? drop.target : selection instanceof NodeSelection && selection.node.type.name === 'image' ? selection.node : undefined
      const pos = drop ? drop.pos : target ? selection.from : selection.$from.depth ? selection.$from.node(1).type.name === 'paragraph' && selection.$from.node(1).content.size === 0 ? selection.$from.before(1) : selection.$from.after(1) : selection.from
      const existing = [...entries.values()].find(entry => position(entry.id) === pos && entry.target === target)
      if (existing) { if (drop) existing.offer(drop.file); else existing.dom.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); return true }
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
      const confirmation = document.createElement('div'); confirmation.className = 'ginko-image-upload__confirmation'; confirmation.hidden = true
      const preview = document.createElement('img'); preview.alt = ''; preview.hidden = true
      const question = document.createElement('h3'); question.textContent = target ? 'Replace this image?' : 'Add this image?'
      const filename = document.createElement('p')
      const actions = document.createElement('div'); actions.className = 'ginko-image-upload__actions'
      const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = target ? 'Replace image' : 'Add image'
      const decline = document.createElement('button'); decline.type = 'button'; decline.textContent = 'Cancel'
      actions.append(decline, confirm); confirmation.append(preview, question, filename, actions)
      dom.append(area, input, confirmation, error, cancel)
      let controller: AbortController | undefined, busy = false, offered: File | undefined, previewUrl: string | undefined
      function clearPreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = undefined; preview.removeAttribute('src'); preview.hidden = true }
      function fileError(file: File) {
        return file.size > 10 * 1024 * 1024 ? 'Choose an image smaller than 10 MB.' : !file.type.startsWith('image/') || !file.size ? 'Choose a non-empty image file.' : undefined
      }
      function offer(file: File) {
        if (busy || !enabled()) return
        clearPreview(); offered = undefined
        const issue = fileError(file)
        error.textContent = issue ?? ''; error.hidden = !issue
        if (!issue) {
          offered = file; filename.textContent = file.name
          if (URL.createObjectURL) { previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.hidden = false }
        }
        render()
        const focusTarget = offered ? confirm : area
        focusTarget.focus()
        // A host may reveal its writing pane in response to pending-change.
        // Retry after that render only if nothing else has taken focus.
        if (document.activeElement !== focusTarget) {
          const previousFocus = document.activeElement
          queueMicrotask(() => { if (entries.has(id) && enabled() && document.activeElement === previousFocus) focusTarget.focus() })
        }
      }
      function render() {
        area.hidden = !!offered
        confirmation.hidden = !offered
        confirm.disabled = busy || !enabled()
        area.disabled = busy || !enabled()
        label.textContent = busy ? 'Uploading image…' : !error.hidden ? 'Try another image or retry' : target ? 'Click to replace or drag and drop' : 'Click to upload or drag and drop'
        dom.setAttribute('aria-busy', String(busy)); dom.dataset.uploading = String(busy)
      }
      async function upload(file: globalThis.File) {
        if (busy || !enabled() || position(id) === undefined) return
        error.hidden = true
        const issue = fileError(file)
        if (issue) { error.textContent = issue; error.hidden = false; render(); return }
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
          clearPreview(); remove(id, false)
          if (focused) editor.view.focus()
        } catch (cause) {
          if (controller.signal.aborted || !entries.has(id)) return
          error.textContent = cause instanceof Error ? cause.message : 'The image could not be uploaded. Try again.'; error.hidden = false
        } finally { busy = false; render() }
      }
      confirm.addEventListener('click', () => { const file = offered; if (!file) return; cancel.focus(); offered = undefined; clearPreview(); void upload(file) })
      decline.addEventListener('click', () => { remove(id); editor.view.focus() })
      area.addEventListener('click', () => input.click())
      input.addEventListener('change', () => { const file = input.files?.[0]; input.value = ''; if (file) void upload(file) })
      const drag = (event: DragEvent) => { if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return; event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; dom.dataset.dragging = 'true' }
      dom.addEventListener('dragover', drag)
      dom.addEventListener('dragenter', drag)
      dom.addEventListener('dragleave', event => { if (!(event.relatedTarget instanceof globalThis.Node) || !dom.contains(event.relatedTarget)) dom.dataset.dragging = 'false' })
      dom.addEventListener('drop', event => { event.preventDefault(); event.stopPropagation(); dom.dataset.dragging = 'false'; const files = event.dataTransfer?.files; if (!files?.length) return; if (files.length > 1) { offered = undefined; clearPreview(); error.textContent = 'Choose one image for this placeholder.'; error.hidden = false; render(); area.focus(); return } offer(files[0]) })
      cancel.addEventListener('click', () => { remove(id); editor.view.focus() })
      dom.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); remove(id); editor.view.focus() } })
      entries.set(id, { target, id, dom, offer, cancel: () => { controller?.abort(); clearPreview() }, refresh: render })
      render()
      view.dispatch(closeHistory(view.state.tr).setMeta(key, { add: { id, pos, dom } }))
      if (drop) offer(drop.file); else area.focus()
      dom.scrollIntoView?.({ block: 'nearest' })
      return true
    }
    let dropRoot: HTMLElement | undefined, highlighted: Element | undefined
    const hint = document.createElement('div'); hint.className = 'ginko-image-drop-hint'; hint.hidden = true; hint.setAttribute('role', 'status')
    const owns = (event: DragEvent) => {
      const element = event.target instanceof Element ? event.target : undefined
      const nestedEditor = element?.closest('.ginko-editor')
      return (!nestedEditor || nestedEditor.contains(view!.dom)) && !!options.upload?.() && Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }
    function clearDrag() { hint.hidden = true; highlighted?.classList.remove('ginko-image--drop-target'); highlighted = undefined }
    function destination(event: DragEvent) {
      const element = event.target instanceof Element ? event.target : undefined
      const picture = element?.closest('.ginko-image')
      if (picture && view!.dom.contains(picture)) {
        const pos = view!.posAtDOM(picture, 0), target = view!.state.doc.nodeAt(pos)
        if (target?.type.name === 'image') return { pos, target, picture }
      }
      const hit = element && view!.dom.contains(element) ? view!.posAtCoords({ left: event.clientX, top: event.clientY }) : undefined
      if (!hit) return { pos: view!.state.doc.content.size }
      const at = view!.state.doc.resolve(hit.pos)
      if (!at.depth) return { pos: at.pos }
      const block = view!.nodeDOM(at.before(1))
      const bounds = block instanceof Element ? block.getBoundingClientRect() : undefined
      return { pos: bounds && event.clientY < (bounds.top + bounds.bottom) / 2 ? at.before(1) : at.after(1) }
    }
    const dragover = (event: DragEvent) => {
      if (!owns(event)) return
      if (event.target instanceof Element && event.target.closest('.ginko-image-upload')) { clearDrag(); return }
      event.preventDefault(); event.stopPropagation()
      if (event.dataTransfer) event.dataTransfer.dropEffect = enabled() ? 'copy' : 'none'
      clearDrag()
      if (!enabled()) return
      const target = destination(event)
      highlighted = target.picture; highlighted?.classList.add('ginko-image--drop-target')
      hint.textContent = target.target ? 'Drop to replace this image' : 'Drop to add an image'
      hint.hidden = false
    }
    const leave = (event: DragEvent) => { if (!(event.relatedTarget instanceof globalThis.Node) || !dropRoot?.contains(event.relatedTarget)) clearDrag() }
    const drop = (event: DragEvent) => {
      clearDrag()
      if (!owns(event)) return
      // The explicit placeholder owns its own drop and confirmation state.
      if (event.target instanceof Element && event.target.closest('.ginko-image-upload')) return
      event.preventDefault(); event.stopPropagation()
      if (!enabled()) return
      const files = event.dataTransfer?.files
      if (!files?.length) return
      if (files.length > 1) { hint.textContent = 'Drop one image at a time.'; hint.hidden = false; return }
      add({ ...destination(event), file: files[0] })
    }
    function bindDropTarget() {
      const next = options.dropTarget?.() ?? view!.dom.closest<HTMLElement>('.ginko-editor') ?? view!.dom
      if (dropRoot === next) return
      unbindDropTarget(); dropRoot = next
      dropRoot.addEventListener('dragover', dragover, true); dropRoot.addEventListener('dragenter', dragover, true)
      dropRoot.addEventListener('dragleave', leave); dropRoot.addEventListener('drop', drop, true)
      dropRoot.addEventListener('dragend', clearDrag); dropRoot.addEventListener('pointerdown', clearDrag)
      ;(view!.dom.closest('.ginko-editor') ?? view!.dom.parentElement)?.append(hint)
    }
    function unbindDropTarget() {
      dropRoot?.removeEventListener('dragover', dragover, true); dropRoot?.removeEventListener('dragenter', dragover, true)
      dropRoot?.removeEventListener('dragleave', leave); dropRoot?.removeEventListener('drop', drop, true)
      dropRoot?.removeEventListener('dragend', clearDrag); dropRoot?.removeEventListener('pointerdown', clearDrag); clearDrag(); hint.remove()
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
        bindDropTarget()
        return {
          update() {
            bindDropTarget()
            if (!enabled()) clearDrag()
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
          destroy() { unbindDropTarget(); destroyed = true; entries.forEach(entry => entry.cancel()); entries.clear(); options.onPendingChange?.(0) },
        }
      },
    })]
  },
})
