import type { VueWrapper } from '@vue/test-utils'

import type { EditorAssetRequest, GinkoEditorHandle } from '../../src/types'
import GinkoToolbar from '../../src/ui/GinkoToolbar.vue'
import type { EditorActions } from '../../src/ui/commands'

type AssetKind = 'image' | 'file' | 'video'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorWrapper = VueWrapper<any>

/**
 * Insert an asset through the public host flow: run the toolbar action, then
 * complete the emitted request. Returns false when the editor emits no request
 * or the request refuses the value.
 */
export function insertAsset(wrapper: EditorWrapper, kind: AssetKind, value: unknown): boolean {
  const toolbar = wrapper.findComponent(GinkoToolbar)
  if (!toolbar.exists()) return false
  const event = `request-${kind}`
  const before = wrapper.emitted(event)?.length ?? 0
  void (toolbar.props('actions') as EditorActions).get({ kind }).run()
  const events = wrapper.emitted(event) ?? []
  if (events.length === before) return false
  const request = events.at(-1)![0] as EditorAssetRequest<unknown>
  return request.complete(value)
}

/** Put an image node at the selection without the host request flow. */
export function insertImageNode(wrapper: EditorWrapper, asset: { id?: string; url?: string; alt?: string }) {
  const editor = (wrapper.vm as GinkoEditorHandle).getEditor()!
  return editor.chain().focus().setImage({ id: asset.id, src: asset.url ?? asset.id, alt: asset.alt }).run()
}
