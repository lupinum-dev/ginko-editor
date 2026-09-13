// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import type { AssetInfo, ImageUploadHandler } from '../src/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.innerHTML = '' })
async function mountEditor(imageUpload: ImageUploadHandler = async () => ({ url: '/saved.png' })) {
  const wrapper = mount(GinkoEditor, { attachTo: document.body, props: { modelValue: 'First\n\nSecond\n', syncDebounceMs: 0, imageUpload } })
  await flushPromises()
  cleanups.push(() => wrapper.unmount())
  return wrapper
}
function deferred() {
  let resolve!: (asset: Partial<AssetInfo>) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Partial<AssetInfo>>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const file = () => new File(['image data'], 'photo.png', { type: 'image/png' })
async function choose(wrapper: Awaited<ReturnType<typeof mountEditor>>, selected = file(), index = 0) {
  const input = wrapper.findAll('input[type="file"]')[index]
  Object.defineProperty(input.element, 'files', { configurable: true, value: [selected] })
  await input.trigger('change'); await flushPromises()
}
async function add(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
  await wrapper.get('button[aria-label="Add image"]').trigger('click')
}

describe('inline image uploads', () => {
  it('keeps unfinished UI out of source and blocks leaving until it is removed', async () => {
    const wrapper = await mountEditor()
    await add(wrapper)
    expect(wrapper.find('[aria-label="Upload image"]').exists()).toBe(true)
    expect(wrapper.vm.editor!.can().clearImageUploads()).toBe(true)
    await add(wrapper)
    expect(wrapper.findAll('.ginko-image-upload')).toHaveLength(1)
    expect(wrapper.emitted('request-image')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    expect(await wrapper.vm.flush()).toMatchObject({ ok: false, error: { code: 'image_upload_pending' } })
    await wrapper.get('.ginko-editor__modes button:last-child').trigger('click')
    expect(wrapper.attributes('data-mode')).toBe('visual')
    await wrapper.get('[aria-label="Remove image placeholder"]').trigger('click')
    expect(wrapper.vm.hasPendingChanges()).toBe(false)
    expect(await wrapper.vm.flush()).toEqual({ ok: true, emitted: false })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('maps the placeholder while typing, preserves selection, and undoes only the completed upload', async () => {
    const task = deferred(), upload = vi.fn<ImageUploadHandler>(() => task.promise)
    const wrapper = await mountEditor(upload), editor = wrapper.vm.editor!
    await add(wrapper); await choose(wrapper)
    editor.commands.setTextSelection(1)
    editor.commands.insertContent('New ')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.view.focus()
    const before = editor.state.selection.from
    task.resolve({ url: '/saved.png', alt: 'Photo' }); await flushPromises()
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(editor.state.doc.child(0).textContent).toBe('New First')
    expect(editor.state.doc.child(1).type.name).toBe('image')
    expect(editor.state.doc.child(2).textContent).toBe('Second')
    expect(editor.state.selection.from).toBe(before + 1)
    expect(document.activeElement).toBe(editor.view.dom)
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true })
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('![Photo](/saved.png)')
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('New FirstSecond')
    expect(editor.state.doc.childCount).toBe(2)
  })

  it('stores a stable provider id rather than its temporary display URL', async () => {
    const wrapper = await mountEditor(async () => ({ id: '/saved-photo', url: 'https://cdn.test/photo.png', alt: 'Photo' }))
    await wrapper.setProps({ assetProvider: { buildUrl: () => 'blob:display-only', parseUrl: () => null } })
    await add(wrapper); await choose(wrapper); await wrapper.vm.flush()
    const source = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
    expect(wrapper.get('.ginko-image img').attributes('src')).toBe('blob:display-only')
    expect(source).toContain('/saved-photo'); expect(source).not.toContain('blob:'); expect(source).not.toContain('cdn.test')
  })

  it('validates dropped files and allows retry after a host failure', async () => {
    const upload = vi.fn<ImageUploadHandler>().mockRejectedValueOnce(new Error('Storage is full.')).mockResolvedValue({ url: '/retried.png' })
    const wrapper = await mountEditor(upload); await add(wrapper)
    const area = wrapper.get('[aria-label="Upload image"]')
    await area.trigger('drop', { dataTransfer: { files: [file(), file()] } })
    expect(wrapper.text()).toContain('Choose one image')
    await choose(wrapper, new File(['text'], 'note.txt', { type: 'text/plain' }))
    expect(wrapper.text()).toContain('Choose a non-empty image file')
    await choose(wrapper, new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
    expect(wrapper.text()).toContain('smaller than 10 MB'); expect(upload).not.toHaveBeenCalled()
    await area.trigger('drop', { dataTransfer: { files: [file()] } }); await wrapper.get('.ginko-image-upload__actions button:last-child').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Storage is full.')
    await choose(wrapper)
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(wrapper.vm.editor!.state.doc.child(1).attrs.props.src).toBe('/retried.png')
  })

  it.each(['remove', 'disable', 'images', 'handler', 'document', 'unmount'] as const)('aborts upload on %s and ignores late completion', async change => {
    const task = deferred(); let signal: AbortSignal | undefined
    const wrapper = await mountEditor((_file, context) => { signal = context.signal; return task.promise })
    await add(wrapper); await choose(wrapper)
    if (change === 'remove') await wrapper.get('[aria-label="Remove image placeholder"]').trigger('click')
    if (change === 'disable') await wrapper.setProps({ disabled: true })
    if (change === 'images') await wrapper.setProps({ enableImages: false })
    if (change === 'handler') await wrapper.setProps({ imageUpload: async () => ({ url: '/new.png' }) })
    if (change === 'document') await wrapper.setProps({ modelValue: 'Replacement\n' })
    if (change === 'unmount') wrapper.unmount()
    expect(signal?.aborted).toBe(true)
    task.resolve({ url: '/stale.png' }); await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    if (change !== 'unmount') expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
  })

  it('keeps the pending anchor outside a block that is wrapped while uploading', async () => {
    const task = deferred(), wrapper = await mountEditor(() => task.promise), editor = wrapper.vm.editor!
    await add(wrapper); await choose(wrapper)
    editor.commands.toggleBlockquote()
    task.resolve({ url: '/outside.png' }); await flushPromises()
    expect(editor.state.doc.child(0).type.name).toBe('blockquote')
    expect(editor.state.doc.child(1).type.name).toBe('image')
  })

  it('replaces an image through the upload handler, keeps the original until success, and supports undo', async () => {
    const task = deferred(); let signal: AbortSignal | undefined
    const wrapper = await mountEditor((_file, context) => { signal = context.signal; return task.promise }), editor = wrapper.vm.editor!
    wrapper.vm.insertImageAsset({ url: '/original.png', alt: 'Original' })
    editor.commands.setNodeSelection(0)
    await add(wrapper); await choose(wrapper)
    expect(editor.state.doc.firstChild!.attrs.props.src).toBe('/original.png')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    task.resolve({ url: '/replacement.png', alt: 'Replacement' }); await flushPromises()
    expect(editor.state.doc.firstChild!.attrs.props.src).toBe('/replacement.png')
    expect(signal?.aborted).toBe(false)
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(wrapper.emitted('request-image')).toBeUndefined()
    editor.commands.undo()
    expect(editor.state.doc.firstChild!.attrs.props.src).toBe('/original.png')
  })

  it('aborts replacement if the target image is removed', async () => {
    const task = deferred(); let signal: AbortSignal | undefined
    const wrapper = await mountEditor((_file, context) => { signal = context.signal; return task.promise }), editor = wrapper.vm.editor!
    wrapper.vm.insertImageAsset({ url: '/original.png' }); editor.commands.setNodeSelection(0)
    await add(wrapper); await choose(wrapper)
    editor.commands.deleteSelection(); await flushPromises()
    expect(signal?.aborted).toBe(true)
    task.resolve({ url: '/stale.png' }); await flushPromises()
    expect(editor.state.doc.firstChild!.type.name).toBe('paragraph')
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
  })

  it('keeps Add and Replace distinct at the same document boundary', async () => {
    const replacement = deferred(), addition = deferred()
    const upload = vi.fn<ImageUploadHandler>().mockReturnValueOnce(replacement.promise).mockReturnValueOnce(addition.promise)
    const wrapper = await mountEditor(upload), editor = wrapper.vm.editor!
    editor.commands.insertContentAt(7, { type: 'image', attrs: { props: { src: '/original.png' } } })
    editor.commands.setNodeSelection(7)
    await add(wrapper); await choose(wrapper)
    editor.commands.setTextSelection(1)
    await add(wrapper)
    expect(wrapper.findAll('.ginko-image-upload')).toHaveLength(2)
    // A new-image widget sorts before a replacement widget at the same boundary.
    await choose(wrapper, file(), 0)
    addition.resolve({ url: '/added.png' }); await flushPromises()
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/added.png')
    expect(editor.state.doc.child(2).attrs.props.src).toBe('/original.png')
    replacement.resolve({ url: '/replaced.png' }); await flushPromises()
    expect(editor.state.doc.child(2).attrs.props.src).toBe('/replaced.png')
  })

  it('preserves host image transforms in MDC output', async () => {
    const wrapper = await mountEditor(async () => ({ url: '/cropped.png', fit: 'cover', focalX: 0.25, focalY: 0.75, cropWidth: 300, cropHeight: 200 }))
    await add(wrapper); await choose(wrapper)
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true })
    expect(wrapper.vm.editor!.state.doc.child(1).attrs.props).toMatchObject({ fit: 'cover', focalX: 0.25, focalY: 0.75, cropWidth: 300, cropHeight: 200 })
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('focalX')
  })

  it('asks before adding a file dropped into an empty editor', async () => {
    const upload = vi.fn<ImageUploadHandler>().mockResolvedValue({ url: '/dropped.png' })
    const wrapper = await mountEditor(upload)
    await wrapper.setProps({ modelValue: '' })
    await wrapper.get('.ginko-editor').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    expect(wrapper.text()).toContain('Add this image?')
    expect(upload).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(await wrapper.vm.flush()).toMatchObject({ ok: false })
    await wrapper.get('.ginko-image-upload__actions button:last-child').trigger('click'); await flushPromises()
    expect(upload).toHaveBeenCalledOnce()
    expect(wrapper.get('.ginko-image img').attributes('src')).toBe('/dropped.png')
  })

  it('asks before replacing the image under the drop, independently of the text selection', async () => {
    const upload = vi.fn<ImageUploadHandler>().mockResolvedValue({ url: '/dropped.png' })
    const wrapper = await mountEditor(upload), editor = wrapper.vm.editor!
    editor.commands.insertContentAt(7, { type: 'image', attrs: { props: { src: '/original.png' } } })
    editor.commands.setTextSelection(1)
    await wrapper.get('.ginko-image img').trigger('dragover', { dataTransfer: { types: ['Files'] } })
    expect(wrapper.get('.ginko-image').classes()).toContain('ginko-image--drop-target')
    await wrapper.get('.ginko-image img').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    expect(wrapper.text()).toContain('Replace this image?')
    expect(upload).not.toHaveBeenCalled()
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/original.png')
    await wrapper.get('.ginko-image-upload__actions button:first-child').trigger('click')
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/original.png')
    expect(upload).not.toHaveBeenCalled()
    await wrapper.get('.ginko-image img').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    await wrapper.get('.ginko-image-upload__actions button:last-child').trigger('click'); await flushPromises()
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/dropped.png')
  })

  it('maps a confirmed drop across typing and prevents confirmation after target removal', async () => {
    const upload = vi.fn<ImageUploadHandler>().mockResolvedValue({ url: '/dropped.png' })
    const wrapper = await mountEditor(upload), editor = wrapper.vm.editor!
    await wrapper.get('.ginko-editor').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    editor.commands.insertContent('Changed ')
    await wrapper.get('.ginko-image-upload__actions button:last-child').trigger('click'); await flushPromises()
    expect(wrapper.get('.ginko-image img').attributes('src')).toBe('/dropped.png')
    await wrapper.get('.ginko-image img').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    const imagePos = editor.view.posAtDOM(wrapper.get('.ginko-image').element, 0)
    editor.commands.deleteRange({ from: imagePos, to: imagePos + 1 })
    await flushPromises()
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(upload).toHaveBeenCalledOnce()
  })

  it('supports an outer workspace drop target without intercepting another editor', async () => {
    const upload = vi.fn<ImageUploadHandler>().mockResolvedValue({ url: '/dropped.png' })
    const wrapper = await mountEditor(upload), other = await mountEditor()
    await wrapper.setProps({ imageDropTarget: document.body })
    await other.get('.ginko-editor').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(other.text()).toContain('Add this image?')
    document.body.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: { types: ['Files'], files: [file()] } }))
    await flushPromises()
    expect(wrapper.text()).toContain('Add this image?')
    expect(upload).not.toHaveBeenCalled()
  })

  it('accepts a new file over confirmation, revokes previews, and restores focus after approval', async () => {
    const create = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second'), revoke = vi.fn()
    const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = create; URL.revokeObjectURL = revoke
    try {
      const task = deferred(), wrapper = await mountEditor(() => task.promise)
      await wrapper.get('.ginko-editor').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
      const preview = wrapper.get('.ginko-image-upload__confirmation img')
      const drag = new Event('dragover', { bubbles: true, cancelable: true })
      Object.defineProperty(drag, 'dataTransfer', { value: { types: ['Files'] } })
      preview.element.dispatchEvent(drag)
      expect(drag.defaultPrevented).toBe(true)
      await preview.trigger('drop', { dataTransfer: { types: ['Files'], files: [new File(['second'], 'second.png', { type: 'image/png' })] } })
      expect(wrapper.text()).toContain('second.png')
      expect(revoke).toHaveBeenCalledWith('blob:first')
      await wrapper.get('.ginko-image-upload__actions button:last-child').trigger('click')
      expect(document.activeElement).toBe(wrapper.get('[aria-label="Remove image placeholder"]').element)
      task.resolve({ url: '/confirmed.png' }); await flushPromises()
      expect(document.activeElement).toBe(wrapper.vm.editor!.view.dom)
      expect(revoke).toHaveBeenCalledWith('blob:second')
    } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke }
  })

  it('does not intercept ordinary drags or accept files in a disabled editor', async () => {
    const upload = vi.fn<ImageUploadHandler>()
    const wrapper = await mountEditor(upload)
    const textDrop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(textDrop, 'dataTransfer', { value: { types: ['text/html'], files: [] } })
    wrapper.element.dispatchEvent(textDrop)
    expect(textDrop.defaultPrevented).toBe(false)
    await wrapper.setProps({ disabled: true })
    await wrapper.get('.ginko-editor').trigger('drop', { dataTransfer: { types: ['Files'], files: [file()] } })
    expect(wrapper.find('.ginko-image-upload').exists()).toBe(false)
    expect(upload).not.toHaveBeenCalled()
  })

  it('resolves concurrent placeholders independently', async () => {
    const first = deferred(), second = deferred()
    const upload = vi.fn<ImageUploadHandler>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = await mountEditor(upload), editor = wrapper.vm.editor!
    await add(wrapper); await choose(wrapper)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    await add(wrapper); await choose(wrapper, file(), 1)
    second.resolve({ url: '/second.png' }); await flushPromises()
    expect(wrapper.vm.hasPendingChanges()).toBe(true)
    first.resolve({ url: '/first.png' }); await flushPromises()
    expect(editor.state.doc.child(1).attrs.props.src).toBe('/first.png')
    expect(editor.state.doc.child(3).attrs.props.src).toBe('/second.png')
    expect(await wrapper.vm.flush()).toMatchObject({ ok: true })
  })
})
