import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { computed, watch, type Ref, type ShallowRef } from 'vue'

import { SetNodeAttributeStep, SetNodePropertyStep } from '../lib/property-step'
import type {
  AssetInfo,
  AssetProvider,
  EditorAssetRequest,
  EditorFile,
  EditorImage,
  EditorVideo,
  ImagePicker,
  ImageUploadHandler,
  JsonRecord,
  LegacyImageUploadResult,
} from '../types'

type MediaType = 'image' | 'file' | 'video'
type ImageInput = EditorImage | LegacyImageUploadResult
type FileInput = EditorFile | Partial<AssetInfo>

export interface AssetRequestProps {
  assetProvider?: AssetProvider
  disabled: boolean
  enableFiles: boolean
  enableImages: boolean
  enableVideo: boolean
  imagePicker?: ImagePicker
  imageUpload?: ImageUploadHandler
}

export interface AssetRequestOptions {
  props: AssetRequestProps
  editor: ShallowRef<Editor | undefined>
  /** True when the canvas accepts a change now, and the optional feature is on. */
  canMutate: (featureEnabled?: boolean) => boolean
  /** Changes when the canvas document is replaced or edited. */
  documentRevision: () => number
  selectionRevision: Ref<number>
  viewMode: Ref<string>
  /** Changes only when the authoring policy changes. */
  policyRevision: Ref<number>
  emitImage: (request: EditorAssetRequest<EditorImage>) => void
  emitFile: (request: EditorAssetRequest<EditorFile>) => void
  emitVideo: (request: EditorAssetRequest<EditorVideo>) => void
}

/**
 * Host-owned asset selection. Requests complete once and only while the document,
 * selection, mode, editability, and asset capabilities are unchanged.
 */
export function useAssetRequests(options: AssetRequestOptions) {
  const { props, editor, canMutate } = options
  // Declared before any watcher reads it.
  let assetContextRevision = 0

  const resolvedAssetProvider = computed<AssetProvider>(() => props.assetProvider ?? {
    buildUrl: asset => asset.url ?? '',
    parseUrl: () => null,
  })

  // Capabilities, not callback identities. Hosts often pass new inline
  // functions or objects on each render; those must not cancel a request.
  watch(() => [
    options.viewMode.value,
    props.disabled,
    props.enableImages,
    props.enableFiles,
    props.enableVideo,
    !!props.assetProvider,
  ].join('|'), () => {
    assetContextRevision += 1
  }, { flush: 'sync' })

  // An upload stays active while an upload or picker capability exists. The
  // extension calls the latest handler through a getter, and insertion reads
  // the latest asset provider when the upload finishes.
  watch(() => [
    options.viewMode.value,
    props.disabled,
    props.enableImages,
    !!props.imageUpload,
    !!props.imagePicker,
    options.policyRevision.value,
  ].join('|'), () => {
    editor.value?.commands.clearImageUploads()
  }, { flush: 'sync' })

  function storedAssetSource(asset: { id?: string; url?: string } & Partial<AssetInfo>) {
    // A host-owned provider uses the stable id as canonical source and resolves
    // display URLs separately. Without a provider, a supplied URL is already the
    // only durable source; do not discard it merely because metadata also has an id.
    if (props.assetProvider && asset.id) return asset.id
    return asset.url || asset.id || resolvedAssetProvider.value.buildUrl(asset)
  }

  function imagePayload(asset: ImageInput) {
    const src = storedAssetSource(asset)
    if (!src.trim()) return
    const legacy = asset as LegacyImageUploadResult
    return {
      alt: asset.alt,
      filename: legacy.filename,
      height: asset.height,
      id: asset.id,
      src,
      title: asset.title,
      width: asset.width,
      fit: asset.fit,
      quality: asset.quality,
      focalX: asset.focalX,
      focalY: asset.focalY,
      cropX: asset.cropX,
      cropY: asset.cropY,
      cropWidth: asset.cropWidth,
      cropHeight: asset.cropHeight,
    }
  }

  function replaceMediaAt(type: MediaType, pos: number, payload: JsonRecord): boolean {
    const instance = editor.value
    const node = instance?.state.doc.nodeAt(pos)
    if (!instance || node?.type.name !== type || !canMutate()) return false
    const transaction = closeHistory(instance.state.tr)
    for (const [key, value] of Object.entries(payload)) {
      // Description/title belong to this placement. A picker may supply an
      // explicit replacement, but missing asset metadata must not clear them.
      if (type === 'image' && ['alt', 'title'].includes(key) && value === undefined) continue
      if (node.attrs.props?.[key] !== value) transaction.step(new SetNodePropertyStep(pos, key, value))
      if (type === 'video' && ['src', 'title'].includes(key) && node.attrs[key] !== (value ?? null)) {
        transaction.step(new SetNodeAttributeStep(pos, key, value ?? null))
      }
    }
    if (transaction.docChanged) {
      instance.view.dispatch(transaction)
      const expected = transaction.doc.nodeAt(pos)
      if (!expected || !instance.state.doc.nodeAt(pos)?.eq(expected)) return false
      instance.view.dispatch(closeHistory(instance.state.tr).setMeta('addToHistory', false))
    }
    return true
  }

  function replaceSelectedMedia(type: MediaType, payload: JsonRecord): boolean {
    const instance = editor.value
    if (!instance) return false
    let pos: number | undefined
    const { from, to } = instance.state.selection
    instance.state.doc.nodesBetween(from, to, (node, offset) => {
      if (pos === undefined && node.type.name === type) pos = offset
    })
    if (pos === undefined && instance.state.doc.nodeAt(from)?.type.name === type) pos = from
    return pos !== undefined && replaceMediaAt(type, pos, payload)
  }

  function insertImageAsset(asset: ImageInput): boolean {
    const instance = editor.value
    if (!instance || !canMutate(props.enableImages)) return false
    const payload = imagePayload(asset)
    if (!payload) return false
    return instance.isActive('image')
      ? replaceSelectedMedia('image', payload)
      : instance.chain().focus().setImage(payload).run()
  }

  /** Insert an upload or picker result at its mapped placeholder position. */
  function insertUploadedImageAt(asset: ImageInput, pos: number, replaceSize = 0): boolean {
    const instance = editor.value
    if (!instance || !canMutate(props.enableImages)) return false
    const payload = imagePayload(asset)
    if (!payload) return false
    const target = instance.state.doc.nodeAt(pos)
    if (target?.type.name === 'image' && target.nodeSize === replaceSize) return replaceMediaAt('image', pos, payload)
    const inserted = instance.chain().command(({ tr }) => {
      closeHistory(tr)
      return true
    }).insertContentAt(
      { from: pos, to: pos + replaceSize },
      { type: 'image', attrs: { props: payload } },
      { updateSelection: false },
    ).run()
    if (inserted) instance.view.dispatch(closeHistory(instance.state.tr).setMeta('addToHistory', false))
    return inserted
  }

  function insertFileAsset(asset: FileInput): boolean {
    const instance = editor.value
    if (!instance || !canMutate(props.enableFiles)) return false
    const src = storedAssetSource(asset)
    if (!src.trim()) return false
    const payload = {
      filename: asset.filename,
      id: asset.id,
      size: asset.size,
      src,
      title: asset.title || asset.filename,
      type: asset.mimeType,
    }
    return instance.isActive('file')
      ? replaceSelectedMedia('file', payload)
      : instance.chain().focus().setFile(payload).run()
  }

  function insertVideo(value: EditorVideo): boolean {
    const instance = editor.value
    if (!instance || typeof value?.src !== 'string' || !value.src.trim() || !canMutate(props.enableVideo)) return false
    const payload = { src: value.src.trim(), title: value.title?.trim() || undefined }
    return instance.isActive('video')
      ? replaceSelectedMedia('video', payload)
      : instance.chain().focus().setVideo(payload).run()
  }

  function removeSelectedMedia(): boolean {
    const instance = editor.value
    if (
      !instance
      || !canMutate()
      || !['image', 'file', 'video'].some(name => instance.isActive(name))
    ) {
      return false
    }
    instance.view.dispatch(instance.state.tr.deleteSelection())
    return true
  }

  function createAssetRequest<T>(complete: (value: T) => boolean): EditorAssetRequest<T> {
    const instance = editor.value
    const requestRevision = options.documentRevision()
    const requestDocument = instance?.state.doc
    const requestSelection = instance?.state.selection
    const requestSelectionRevision = options.selectionRevision.value
    const requestContext = assetContextRevision
    let settled = false
    return {
      complete(value) {
        if (settled) return false
        settled = true
        if (
          value === null ||
          !instance ||
          editor.value !== instance ||
          options.documentRevision() !== requestRevision ||
          assetContextRevision !== requestContext ||
          options.selectionRevision.value !== requestSelectionRevision ||
          !requestDocument?.eq(instance.state.doc) ||
          !requestSelection?.eq(instance.state.selection)
        ) return false
        return complete(value)
      },
    }
  }

  function requestImage(range?: { from: number; to: number }) {
    if (!canMutate(props.enableImages)) return
    if (props.imageUpload || props.imagePicker) { editor.value?.commands.insertImageUpload(range); return }
    options.emitImage(createAssetRequest<EditorImage>(range
      ? asset => insertUploadedImageAt(asset, range.from, range.to - range.from)
      : insertImageAsset))
  }

  function requestFile() {
    if (!canMutate(props.enableFiles)) return
    options.emitFile(createAssetRequest<EditorFile>(insertFileAsset))
  }

  function requestVideo() {
    if (!canMutate(props.enableVideo)) return
    options.emitVideo(createAssetRequest<EditorVideo>(insertVideo))
  }

  return {
    resolvedAssetProvider,
    insertUploadedImageAt,
    removeSelectedMedia,
    requestImage,
    requestFile,
    requestVideo,
  }
}
