import { Extension } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { AssetInfo, EditorImage, ImagePicker, ImageUploadHandler } from '../../types'
import { createEditorText, type EditorMessages, type EditorText } from '../../ui/messages'
import type { EditorOverlayController } from '../../ui/context'
import { icon } from '../nodeviews/icons'

export interface UploadOptions {
  overlay?: EditorOverlayController
  getMessages?: () => EditorMessages | undefined
  dropTarget?: () => HTMLElement | undefined
  upload?: () => ImageUploadHandler | undefined
  picker?: () => ImagePicker | undefined
  enabled?: () => boolean
  insert?: (asset: Partial<AssetInfo>, pos: number, replaceSize?: number) => boolean
  onPendingChange?: (count: number) => void
}
export interface UploadStorage { add: () => boolean; clear: () => void }
interface UploadEntry {
  committing?: boolean
  target?: ProseMirrorNode
  id: string
  dom: HTMLElement
  offer: (file: File) => void
  cancel: (abort?: boolean) => void
  refresh: () => void
}
const key = new PluginKey<DecorationSet>('ginkoImageUploads')
const imageTextProperties = ['alt', 'title', 'fit'] as const
const imageNumberProperties = [
  'width',
  'height',
  'quality',
  'focalX',
  'focalY',
  'cropX',
  'cropY',
  'cropWidth',
  'cropHeight',
] as const

function validateImageResult(asset: Partial<AssetInfo>, text: EditorText) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error(text('imageReferenceRequired'))
  for (const field of ['id', 'url', ...imageTextProperties] as const) {
    if (asset[field] !== undefined && typeof asset[field] !== 'string')
      throw new Error(text('imageTextRequired', { field }))
  }
  if (!(asset.id?.trim() || asset.url?.trim())) throw new Error(text('imageReferenceRequired'))
  for (const field of imageNumberProperties) {
    if (
      asset[field] !== undefined &&
      (typeof asset[field] !== 'number' || !Number.isFinite(asset[field]))
    )
      throw new Error(text('imageNumberRequired', { field }))
  }
}

function currentImage(properties: Record<string, unknown> | undefined): EditorImage | undefined {
  if (!properties) return
  const id = typeof properties.id === 'string' && properties.id ? properties.id : undefined
  const src = typeof properties.src === 'string' ? properties.src : undefined
  if (!id && !src) return
  const image: EditorImage = id ? { id } : { url: src! }
  for (const field of imageTextProperties) if (typeof properties[field] === 'string') image[field] = properties[field]
  for (const field of imageNumberProperties)
    if (
      typeof properties[field] === 'number' &&
      Number.isFinite(properties[field])
    )
      image[field] = properties[field]
  return image
}
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
      insertImageUpload: () => ({ dispatch }) =>
        dispatch
          ? this.storage.add()
          : !!(this.options.upload?.() || this.options.picker?.()) &&
            this.options.enabled?.() !== false,
      clearImageUploads: () => ({ dispatch }) => {
        if (dispatch) this.storage.clear()
        return true
      },
    }
  },
  addProseMirrorPlugins() {
    const editor = this.editor,
      options = this.options,
      text = createEditorText(() => options.getMessages?.()),
      entries = new Map<string, UploadEntry>()
    let view: EditorView | undefined, sequence = 0, destroyed = false
    const decorations = () => view ? key.getState(view.state) ?? DecorationSet.empty : DecorationSet.empty
    const enabled = () => !destroyed && editor.isEditable && options.enabled?.() !== false
    const position = (id: string) => decorations().find(undefined, undefined, spec => spec.id === id)[0]?.from
    function remove(id: string, cancel = true) {
      const entry = entries.get(id)
      entry?.cancel(cancel)
      entries.delete(id)
      if (view && !destroyed) view.dispatch(view.state.tr.setMeta(key, { remove: id }))
    }
    this.storage.clear = () => { for (const id of [...entries.keys()]) remove(id) }
    this.storage.add = () => add()
    function add(drop?: { pos: number; target?: ProseMirrorNode; file: File }) {
      if (!view || !enabled() || !(options.upload?.() || options.picker?.())) return false
      const selection = view.state.selection
      // Insert a document-level image after the current block. Tables and
      // component-only child lists must not acquire an invalid image child.
      const target = drop
        ? drop.target
        : selection instanceof NodeSelection && selection.node.type.name === 'image'
          ? selection.node
          : undefined
      const pos = drop
        ? drop.pos
        : target
          ? selection.from
          : selection.$from.depth
            ? selection.$from.node(1).type.name === 'paragraph' &&
              selection.$from.node(1).content.size === 0
              ? selection.$from.before(1)
              : selection.$from.after(1)
            : selection.from
      const existing = [...entries.values()].find(entry => position(entry.id) === pos && entry.target === target)
      if (existing) {
        if (drop) existing.offer(drop.file)
        else existing.dom.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
        return true
      }
      const id = `image-upload-${++sequence}`
      const overlayOwner = {}
      const dom = document.createElement('div')
      dom.className = 'ginko-image-upload'
      dom.contentEditable = 'false'
      dom.setAttribute('role', target ? 'dialog' : 'group')
      dom.setAttribute(
        'aria-label',
        target ? text('replaceImage') : text('imageUpload'),
      )
      if (target) dom.dataset.replacement = 'true'
      const area = document.createElement('button')
      area.type = 'button'
      area.className = 'ginko-image-upload__dropzone'
      area.setAttribute('aria-label', text('uploadImage'))
      const symbol = document.createElement('span')
      symbol.className = 'ginko-image-upload__symbol'
      symbol.append(icon('imageUpload'))
      const label = document.createElement('span')
      label.className = 'ginko-image-upload__label'
      const hint = document.createElement('span')
      hint.className = 'ginko-image-upload__hint'
      hint.textContent = text('imageUploadHint')
      area.append(symbol, label, hint)
      const browse = document.createElement('button')
      browse.type = 'button'
      browse.className = 'ginko-image-upload__browse'
      browse.textContent = text('browseImages')
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.hidden = true
      input.setAttribute('aria-label', text('imageFile'))
      const error = document.createElement('p')
      error.className = 'ginko-image-upload__error'
      error.setAttribute('role', 'alert')
      error.hidden = true
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.className = 'ginko-image-upload__cancel'
      cancel.setAttribute('aria-label', text('removeImagePlaceholder'))
      cancel.title = text('removeImagePlaceholder')
      cancel.append(icon('close'))
      const confirmation = document.createElement('div')
      confirmation.className = 'ginko-image-upload__confirmation'
      confirmation.hidden = true
      const preview = document.createElement('img')
      preview.alt = ''
      preview.hidden = true
      const question = document.createElement('h3')
      question.textContent = target ? text('confirmReplaceImage') : text('confirmAddImage')
      const filename = document.createElement('p')
      const actions = document.createElement('div')
      actions.className = 'ginko-image-upload__actions'
      const confirm = document.createElement('button')
      confirm.type = 'button'
      confirm.textContent = target ? text('replaceImage') : text('image')
      const decline = document.createElement('button')
      decline.type = 'button'
      decline.textContent = text('cancel')
      actions.append(decline, confirm)
      confirmation.append(preview, question, filename, actions)
      dom.append(area, browse, input, confirmation, error, cancel)
      let controller: AbortController | undefined,
        busy = false,
        offered: File | undefined,
        previewUrl: string | undefined
      function clearPreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = undefined
        preview.removeAttribute('src')
        preview.hidden = true
      }
      function fileError(file: File) {
        return file.size > 10 * 1024 * 1024
          ? text('imageTooLarge')
          : !file.type.startsWith('image/') || !file.size
            ? text('invalidImageFile')
            : undefined
      }
      function offer(file: File) {
        if (busy || !enabled() || !options.upload?.()) return
        clearPreview()
        offered = undefined
        const issue = fileError(file)
        error.textContent = issue ?? ''
        error.hidden = !issue
        if (!issue) {
          offered = file
          filename.textContent = file.name
          if (URL.createObjectURL) {
            previewUrl = URL.createObjectURL(file)
            preview.src = previewUrl
            preview.hidden = false
          }
        }
        render()
        const focusTarget = offered ? confirm : area
        focusTarget.focus({ preventScroll: !!target })
        // A host may reveal its writing pane in response to pending-change.
        // Retry after that render only if nothing else has taken focus.
        if (document.activeElement !== focusTarget) {
          const previousFocus = document.activeElement
          queueMicrotask(() => {
            if (entries.has(id) && enabled() && document.activeElement === previousFocus)
              focusTarget.focus({ preventScroll: !!target })
          })
        }
      }
      function render() {
        dom.setAttribute('aria-label', text(target ? 'replaceImage' : 'imageUpload'))
        area.setAttribute('aria-label', text('uploadImage'))
        hint.textContent = text('imageUploadHint')
        input.setAttribute('aria-label', text('imageFile'))
        cancel.title = text('removeImagePlaceholder')
        cancel.setAttribute('aria-label', text('removeImagePlaceholder'))
        question.textContent = text(target ? 'confirmReplaceImage' : 'confirmAddImage')
        confirm.textContent = text(target ? 'replaceImage' : 'image')
        decline.textContent = text('cancel')
        area.hidden = !!offered || !options.upload?.()
        browse.hidden = !!offered || !options.picker?.()
        browse.disabled = busy || !enabled()
        browse.textContent = busy && !options.upload?.() ? text('choosingImage') : text('browseImages')
        confirmation.hidden = !offered
        confirm.disabled = busy || !enabled()
        area.disabled = busy || !enabled()
        label.textContent = busy
          ? text('uploadingImage')
          : !error.hidden
            ? text('retryImage')
            : target
              ? text('replaceImageDrop')
              : text('uploadImageDrop')
        dom.setAttribute('aria-busy', String(busy))
        dom.dataset.uploading = String(busy)
        positionReplacement()
      }
      async function completeOperation(operation: (signal: AbortSignal) => Promise<Partial<AssetInfo> | null>) {
        if (busy || !enabled() || position(id) === undefined) return
        error.hidden = true
        controller?.abort()
        const attempt = new AbortController()
        controller = attempt
        busy = true
        render()
        try {
          const asset = await operation(attempt.signal)
          const current = position(id)
          if (attempt.signal.aborted || !enabled() || current === undefined || !entries.has(id)) return
          if (asset === null) {
            remove(id)
            editor.view.focus()
            return
          }
          validateImageResult(asset, text)
          // The mapped anchor, rather than the current text selection, owns insertion.
          const focused = dom.contains(document.activeElement)
          if (target && view?.state.doc.nodeAt(current) !== target) return
          const entry = entries.get(id)!
          entry.committing = true
          let inserted: boolean | undefined
          try { inserted = options.insert?.(asset, current, target?.nodeSize) } finally { entry.committing = false }
          if (!inserted) throw new Error(text('imageInsertFailed'))
          clearPreview()
          remove(id, false)
          if (focused) editor.view.focus()
        } catch (cause) {
          if (attempt.signal.aborted || !entries.has(id)) return
          // A rejected result was never committed. Let storage adapters release
          // files from this attempt without touching successful undo history.
          attempt.abort()
          error.textContent = cause instanceof Error ? cause.message : text('imageUploadFailed')
          error.hidden = false
        } finally {
          busy = false
          render()
        }
      }
      async function upload(file: globalThis.File) {
        if (busy || !enabled()) return
        const issue = fileError(file)
        if (issue) {
          error.textContent = issue
          error.hidden = false
          render()
          return
        }
        const handler = options.upload?.()
        if (handler) await completeOperation(signal => handler(file, { signal }))
      }
      browse.addEventListener('click', () => {
        const handler = options.picker?.()
        if (!handler) return
        const current = currentImage(target?.attrs.props)
        void completeOperation(signal => handler({ signal, current }))
      })
      confirm.addEventListener('click', () => {
        const file = offered
        if (!file) return
        cancel.focus()
        offered = undefined
        clearPreview()
        void upload(file)
      })
      decline.addEventListener('click', () => {
        remove(id)
        editor.view.focus()
      })
      area.addEventListener('click', () => input.click())
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        input.value = ''
        if (file) void upload(file)
      })
      const drag = (event: DragEvent) => {
        if (
          !options.upload?.() ||
          !Array.from(event.dataTransfer?.types ?? []).includes('Files')
        )
          return
        event.preventDefault()
        event.stopPropagation()
        if (event.dataTransfer)
          event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
        dom.dataset.dragging = 'true'
      }
      dom.addEventListener('dragover', drag)
      dom.addEventListener('dragenter', drag)
      dom.addEventListener('dragleave', event => {
        if (
          !(event.relatedTarget instanceof globalThis.Node) ||
          !dom.contains(event.relatedTarget)
        )
          dom.dataset.dragging = 'false'
      })
      dom.addEventListener('drop', event => {
        if (!options.upload?.()) return
        event.preventDefault()
        event.stopPropagation()
        dom.dataset.dragging = 'false'
        const files = event.dataTransfer?.files
        if (!files?.length) return
        if (files.length > 1) {
          offered = undefined
          clearPreview()
          error.textContent = text('oneImagePlaceholder')
          error.hidden = false
          render()
          area.focus()
          return
        }
        offer(files[0])
      })
      cancel.addEventListener('click', () => {
        remove(id)
        editor.view.focus()
      })
      dom.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.isComposing) {
          event.preventDefault()
          remove(id)
          editor.view.focus()
        }
      })
      let anchoredImage: Element | undefined
      const resize = target && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => positionReplacement())
        : undefined
      function positionReplacement() {
        if (!target || !view || destroyed || !entries.has(id)) return
        const current = position(id)
        const image = current === undefined ? undefined : view.nodeDOM(current)
        if (!(image instanceof Element)) return
        if (anchoredImage !== image) {
          if (anchoredImage) resize?.unobserve(anchoredImage)
          anchoredImage = image
          resize?.observe(image)
        }
        const bounds = image.getBoundingClientRect(), gutter = 12
        const width = Math.min(300, window.innerWidth - gutter * 2)
        dom.style.width = `${width}px`
        dom.style.maxHeight = `${window.innerHeight - gutter * 2}px`
        const height = Math.min(dom.scrollHeight, window.innerHeight - gutter * 2)
        dom.style.left = `${Math.max(gutter, Math.min(bounds.right - width - 8, window.innerWidth - width - gutter))}px`
        dom.style.top = `${Math.max(gutter, Math.min(bounds.top + 8, window.innerHeight - height - gutter))}px`
        dom.style.visibility = bounds.bottom <= 0 || bounds.top >= window.innerHeight ? 'hidden' : ''
      }
      if (target) {
        resize?.observe(dom)
        window.addEventListener('scroll', positionReplacement, true)
        window.addEventListener('resize', positionReplacement)
      }
      entries.set(id, {
        target,
        id,
        dom,
        offer,
        cancel: (abort = true) => {
          if (abort) controller?.abort()
          options.overlay?.release(overlayOwner)
          clearPreview()
          resize?.disconnect()
          if (target) dom.remove()
          window.removeEventListener('scroll', positionReplacement, true)
          window.removeEventListener('resize', positionReplacement)
        },
        refresh: render,
      })
      render()
      view.dispatch(closeHistory(view.state.tr).setMeta(key, { add: { id, pos, dom } }))
      if (target)
        (options.overlay?.getContainer() ??
          view.dom.closest('.ginko-editor') ??
          view.dom.parentElement
        )?.append(dom)
      // The anchored replacement is a transient editing surface. New-image
      // placeholders stay independent so several uploads can run together.
      if (target) options.overlay?.open(overlayOwner, () => remove(id))
      render()
      if (drop) offer(drop.file)
      else (options.upload?.() ? area : browse).focus({ preventScroll: !!target })
      if (!target) dom.scrollIntoView?.({ block: 'nearest' })
      return true
    }
    let dropRoot: HTMLElement | undefined, highlighted: Element | undefined
    const hint = document.createElement('div')
    hint.className = 'ginko-image-drop-hint'
    hint.hidden = true
    hint.setAttribute('role', 'status')
    const owns = (event: DragEvent) => {
      const element = event.target instanceof Element ? event.target : undefined
      const nestedEditor = element?.closest('.ginko-editor')
      return (
        (!nestedEditor || nestedEditor.contains(view!.dom)) &&
        !!options.upload?.() &&
        Array.from(event.dataTransfer?.types ?? []).includes('Files')
      )
    }
    function clearDrag() {
      hint.hidden = true
      highlighted?.classList.remove('ginko-image--drop-target')
      highlighted = undefined
    }
    function destination(event: DragEvent) {
      const element = event.target instanceof Element ? event.target : undefined
      const picture = element?.closest('.ginko-image')
      if (picture && view!.dom.contains(picture)) {
        const pos = view!.posAtDOM(picture, 0), target = view!.state.doc.nodeAt(pos)
        if (target?.type.name === 'image') return { pos, target, picture }
      }
      const hit = element && view!.dom.contains(element)
        ? view!.posAtCoords({ left: event.clientX, top: event.clientY })
        : undefined
      if (!hit) return { pos: view!.state.doc.content.size }
      const at = view!.state.doc.resolve(hit.pos)
      if (!at.depth) return { pos: at.pos }
      const block = view!.nodeDOM(at.before(1))
      const bounds = block instanceof Element ? block.getBoundingClientRect() : undefined
      return { pos: bounds && event.clientY < (bounds.top + bounds.bottom) / 2 ? at.before(1) : at.after(1) }
    }
    const dragover = (event: DragEvent) => {
      if (!owns(event)) return
      if (event.target instanceof Element && event.target.closest('.ginko-image-upload')) {
        clearDrag()
        return
      }
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) event.dataTransfer.dropEffect = enabled() ? 'copy' : 'none'
      clearDrag()
      if (!enabled()) return
      const target = destination(event)
      highlighted = target.picture
      highlighted?.classList.add('ginko-image--drop-target')
      hint.textContent = target.target ? text('dropReplaceImage') : text('dropAddImage')
      hint.hidden = false
    }
    const leave = (event: DragEvent) => {
      if (
        !(event.relatedTarget instanceof globalThis.Node) ||
        !dropRoot?.contains(event.relatedTarget)
      )
        clearDrag()
    }
    const drop = (event: DragEvent) => {
      clearDrag()
      if (!owns(event)) return
      // The explicit placeholder owns its own drop and confirmation state.
      if (event.target instanceof Element && event.target.closest('.ginko-image-upload')) return
      event.preventDefault()
      event.stopPropagation()
      if (!enabled()) return
      const files = event.dataTransfer?.files
      if (!files?.length) return
      if (files.length > 1) {
        hint.textContent = text('oneImageDrop')
        hint.hidden = false
        return
      }
      add({ ...destination(event), file: files[0] })
    }
    function bindDropTarget() {
      const next = options.dropTarget?.() ?? view!.dom.closest<HTMLElement>('.ginko-editor') ?? view!.dom
      if (dropRoot === next) return
      unbindDropTarget()
      dropRoot = next
      dropRoot.addEventListener('dragover', dragover, true)
      dropRoot.addEventListener('dragenter', dragover, true)
      dropRoot.addEventListener('dragleave', leave)
      dropRoot.addEventListener('drop', drop, true)
      dropRoot.addEventListener('dragend', clearDrag)
      dropRoot.addEventListener('pointerdown', clearDrag)
      ;(view!.dom.closest('.ginko-editor') ?? view!.dom.parentElement)?.append(hint)
    }
    function unbindDropTarget() {
      dropRoot?.removeEventListener('dragover', dragover, true)
      dropRoot?.removeEventListener('dragenter', dragover, true)
      dropRoot?.removeEventListener('dragleave', leave)
      dropRoot?.removeEventListener('drop', drop, true)
      dropRoot?.removeEventListener('dragend', clearDrag)
      dropRoot?.removeEventListener('pointerdown', clearDrag)
      clearDrag()
      hint.remove()
      dropRoot = undefined
    }
    function disposeEntries() {
      entries.forEach(entry => entry.cancel())
      entries.clear()
      options.onPendingChange?.(0)
      editor.off('destroy', disposeEntries)
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
              next = next
                .remove([decoration])
                .add(tr.doc, [Decoration.widget(at.after(1), () => entry.dom, decoration.spec)])
            }
          }
          const change = tr.getMeta(key) as
            | { add?: { id: string; pos: number; dom: HTMLElement }; remove?: string }
            | undefined
          if (change?.remove) next = next.remove(next.find(undefined, undefined, spec => spec.id === change.remove))
          if (change?.add) {
            const { id, pos, dom } = change.add
            const target = entries.get(id)?.target
            // Replacement tracks the existing node without adding a DOM sibling.
            // Even a fixed widget would change :first-child document spacing.
            next = next.add(tr.doc, [
              target
                ? Decoration.node(
                    pos,
                    pos + target.nodeSize,
                    { class: 'ginko-image--replacing' },
                    { id, key: id },
                  )
                : Decoration.widget(pos, () => dom, {
                    id,
                    key: id,
                    side: -1,
                    stopEvent: () => true,
                    ignoreSelection: true,
                  }),
            ])
          }
          return next
        },
      },
      props: { decorations: state => key.getState(state) },
      view(instance) {
        view = instance
        destroyed = false
        editor.off('destroy', disposeEntries)
        editor.on('destroy', disposeEntries)
        bindDropTarget()
        return {
          update() {
            bindDropTarget()
            const unavailable = !enabled()
            if (unavailable) clearDrag()
            for (const [id, entry] of entries) {
              if (entry.committing) continue
              const current = position(id)
              if (
                unavailable ||
                current === undefined ||
                (entry.target && instance.state.doc.nodeAt(current) !== entry.target)
              ) {
                entry.cancel()
                entries.delete(id)
                // A changed replacement target invalidates only this upload.
                if (current !== undefined) queueMicrotask(() => remove(id))
              }
              else entry.refresh()
            }
            options.onPendingChange?.(entries.size)
          },
          destroy() {
            unbindDropTarget()
            destroyed = true
            // Registering another ProseMirror plugin recreates every plugin
            // view synchronously. Keep uploads alive if this view returns;
            // actual editor destruction still aborts immediately via its event.
            queueMicrotask(() => { if (destroyed) disposeEntries() })
          },
        }
      },
    })]
  },
})
