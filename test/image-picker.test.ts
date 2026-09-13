// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { closeHistory } from '@tiptap/pm/history'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoImagePicker from '../src/GinkoImagePicker.vue'
import { Image } from '../src/lib/extensions/image'
import { ImageUpload } from '../src/lib/extensions/image-upload'
import type { AssetInfo, EditorImage, ImagePicker, ImageUploadHandler } from '../src/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.innerHTML = '' })
function deferred() {
  let resolve!: (image: EditorImage | null) => void
  const promise = new Promise<EditorImage | null>(done => { resolve = done })
  return { promise, resolve }
}
function setup(picker: ImagePicker, upload?: ImageUploadHandler) {
  const element = document.createElement('div'); document.body.append(element)
  let pending = 0
  const editor: Editor = new Editor({ element, content: '<p>First</p><p>Second</p>', extensions: [
    StarterKit, Image, ImageUpload.configure({ picker: () => picker, upload: () => upload,
      onPendingChange: count => { pending = count },
      insert: (asset: Partial<AssetInfo>, from: number, size = 0) => editor.chain().command(({ tr }) => { closeHistory(tr); return true }).insertContentAt({ from, to: from + size }, { type: 'image', attrs: { props: { ...asset, src: asset.id || asset.url } } }, { updateSelection: false }).run(),
    }),
  ] })
  cleanups.push(() => editor.destroy())
  const browse = () => element.querySelector<HTMLButtonElement>('.ginko-image-upload__browse')!
  return { editor, element, browse, pending: () => pending }
}

describe('mapped image picker operation', () => {
  it('supports picker-only insertion, follows adjacent typing and gives completion its own undo step', async () => {
    const task = deferred(), picker = vi.fn<ImagePicker>(() => task.promise)
    const { editor, browse, element, pending } = setup(picker)
    expect(editor.can().insertImageUpload()).toBe(true)
    editor.commands.insertImageUpload()
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Upload image"]')!.hidden).toBe(true)
    expect(pending()).toBe(1)
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
    browse().dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(false)
    expect(element.querySelector<HTMLDivElement>('.ginko-image-upload__confirmation')!.hidden).toBe(true)
    browse().click()
    editor.commands.setTextSelection(1); editor.commands.insertContent('New ')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    const selection = editor.state.selection.from
    task.resolve({ url: '/picked.png', alt: 'Picked' }); await flushPromises()
    expect(editor.state.doc.child(0).textContent).toBe('New First')
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/picked.png')
    expect(editor.state.selection.from).toBe(selection + 1)
    expect(pending()).toBe(0)
    expect(picker).toHaveBeenCalledOnce()
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('New FirstSecond')
    expect(editor.state.doc.childCount).toBe(2)
  })

  it('keeps upload and browse together and prevents a second operation while browsing', async () => {
    const task = deferred(), picker = vi.fn<ImagePicker>(() => task.promise), upload = vi.fn<ImageUploadHandler>()
    const { editor, browse, element } = setup(picker, upload)
    editor.commands.insertImageUpload()
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Upload image"]')!.hidden).toBe(false)
    expect(browse().hidden).toBe(false)
    browse().click(); browse().click()
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [new File(['image'], 'photo.png', { type: 'image/png' })] })
    input.dispatchEvent(new Event('change'))
    expect(picker).toHaveBeenCalledOnce(); expect(upload).not.toHaveBeenCalled()
    task.resolve(null); await flushPromises()
    expect(editor.state.doc.childCount).toBe(2)
  })

  it('passes replacement metadata and cancels without changing the original image', async () => {
    const task = deferred(), picker = vi.fn<ImagePicker>(() => task.promise)
    const { editor, browse, pending } = setup(picker)
    editor.commands.insertContentAt(0, { type: 'image', attrs: { props: { id: 'existing', src: 'existing', alt: 'Original', focalX: .25 } } })
    editor.commands.setNodeSelection(0); editor.commands.insertImageUpload(); browse().click()
    expect(picker.mock.calls[0]?.[0].current).toEqual({ id: 'existing', alt: 'Original', focalX: .25 })
    task.resolve(null); await flushPromises()
    expect(editor.state.doc.firstChild?.attrs.props.id).toBe('existing')
    expect(pending()).toBe(0)
    expect(picker.mock.calls[0]?.[0].signal.aborted).toBe(true)
  })

  it('aborts stale replacement and ignores late picker completion', async () => {
    const task = deferred(), picker = vi.fn<ImagePicker>(() => task.promise)
    const { editor, browse } = setup(picker)
    editor.commands.insertContentAt(0, { type: 'image', attrs: { props: { src: '/original.png' } } })
    editor.commands.setNodeSelection(0); editor.commands.insertImageUpload(); browse().click()
    editor.commands.deleteSelection()
    expect(picker.mock.calls[0]?.[0].signal.aborted).toBe(true)
    task.resolve({ url: '/late.png' }); await flushPromises()
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
  })

  it('rejects invalid image metadata, aborts abandoned attempts, and permits retry', async () => {
    const picker = vi.fn<ImagePicker>().mockResolvedValueOnce({ url: '/bad.png', width: Infinity }).mockResolvedValueOnce({ url: '/good.png' })
    const { editor, browse, element, pending } = setup(picker)
    editor.commands.insertImageUpload(); browse().click(); await flushPromises()
    expect(element.textContent).toContain('finite number')
    expect(editor.state.doc.childCount).toBe(2)
    expect(picker.mock.calls[0]?.[0].signal.aborted).toBe(true)
    expect(pending()).toBe(1)
    browse().click(); await flushPromises()
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/good.png')
    expect(picker.mock.calls[1]?.[0].signal.aborted).toBe(false)
    expect(pending()).toBe(0)
  })

  it('rejects an empty result and aborts an in-flight picker when the entry is cleared', async () => {
    const task = deferred(), picker = vi.fn<ImagePicker>().mockResolvedValueOnce({ url: '' }).mockReturnValueOnce(task.promise)
    const { editor, browse, element } = setup(picker)
    editor.commands.insertImageUpload(); browse().click(); await flushPromises()
    expect(element.textContent).toContain('stored id or URL')
    expect(picker.mock.calls[0]?.[0].signal.aborted).toBe(true)
    browse().click(); editor.commands.clearImageUploads()
    expect(picker.mock.calls[1]?.[0].signal.aborted).toBe(true)
    task.resolve({ url: '/late.png' }); await flushPromises()
    expect(editor.state.doc.childCount).toBe(2)
  })
})

describe('controlled image library', () => {
  it('leaves search, pagination and uploads to the host and emits the exact selected image', async () => {
    const image: EditorImage = { id: 'asset-one', alt: 'Mountain' }
    const wrapper = mount(GinkoImagePicker, { attachTo: document.body, props: { open: true, images: [{ key: 'one', label: 'Mountain.jpg', image, thumbnailUrl: '/mountain.jpg' }], hasMore: true, enableUpload: true } })
    cleanups.push(() => wrapper.unmount()); await flushPromises()
    const search = document.querySelector<HTMLInputElement>('[aria-label="Search images"]')!
    expect(document.activeElement).toBe(search)
    search.value = 'forest'; search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrapper.emitted('update:query')?.at(-1)).toEqual(['forest'])
    expect(document.querySelector('[aria-label="Choose Mountain.jpg"]')).not.toBeNull()
    const button = (text: string) => [...document.querySelectorAll('button')].find(element => element.textContent?.trim() === text)!
    button('Load more').click(); button('Upload').click()
    expect(wrapper.emitted('load-more')).toHaveLength(1); expect(wrapper.emitted('upload')).toHaveLength(1)
    document.querySelector<HTMLButtonElement>('[aria-label="Choose Mountain.jpg"]')!.click()
    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual(image)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('makes unsafe thumbnails inert and exposes host errors without hiding cancel', async () => {
    const wrapper = mount(GinkoImagePicker, { attachTo: document.body, props: { open: true, images: [{ key: 'one', label: 'Unavailable', image: { id: 'one' }, thumbnailUrl: 'javascript:unsafe' }], error: 'Could not refresh images.' } })
    cleanups.push(() => wrapper.unmount()); await flushPromises()
    expect(document.querySelector('.ginko-image-picker img')).toBeNull()
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Could not refresh images.')
    document.querySelector<HTMLButtonElement>('[aria-label="Close image picker"]')!.click()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('returns focus to the editor when completing removes the original placeholder trigger', async () => {
    const surface = document.createElement('div'); surface.className = 'ginko-editor'
    const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.tabIndex = 0
    editor.setAttribute('contenteditable', 'true')
    const trigger = document.createElement('button'); trigger.textContent = 'Browse images'
    surface.append(editor, trigger); document.body.append(surface); trigger.focus()
    const wrapper = mount(GinkoImagePicker, { attachTo: document.body, props: { open: true, images: [] } })
    cleanups.push(() => wrapper.unmount()); await flushPromises()
    trigger.remove()
    await wrapper.setProps({ open: false }); await flushPromises()
    await vi.waitFor(() => expect(document.activeElement).toBe(editor))
  })
})
