import { computed, shallowReactive, type InjectionKey } from 'vue'
import type { AssetProvider, ImageUploadHandler, EditorImagePickerItem } from '@lupinum/ginko-editor'

export const playgroundImageSource: InjectionKey<(source: string) => string> = Symbol('playgroundImageSource')

/** The playground owns local persistence; the Editor only receives saved references. */
export function createPlaygroundAssets() {
  const urls = shallowReactive(new Map<string, string>())
  const names = shallowReactive(new Map<string, string>())
  const images = computed<EditorImagePickerItem[]>(() => [...urls].map(([id, thumbnailUrl]) => ({ key: id, label: names.get(id) ?? 'Saved image', image: { id }, thumbnailUrl })))
  let database: Promise<IDBDatabase> | undefined
  let disposed = false
  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ginko-editor-playground', 1)
      request.onupgradeneeded = () => { request.result.createObjectStore('images') }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Browser image storage is unavailable.'))
      request.onblocked = () => reject(new Error('Close other playground tabs and try again.'))
    }).catch(cause => { database = undefined; throw cause })
    return database
  }
  const resolve = (source: string) => urls.get(source) ?? source
  const provider: AssetProvider = {
    buildUrl: asset => resolve(asset.id || asset.url || ''),
    parseUrl: source => urls.has(source) ? { id: source } : null,
  }
  async function load() {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly')
      const request = transaction.objectStore('images').openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor || disposed) return
        if (typeof cursor.key === 'string' && cursor.value instanceof Blob) { urls.set(cursor.key, URL.createObjectURL(cursor.value)); names.set(cursor.key, cursor.value instanceof File ? cursor.value.name : 'Saved image') }
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(new Error('Saved images could not be loaded.'))
    })
  }
  const upload: ImageUploadHandler = async (file, { signal }) => {
    const db = await open()
    signal.throwIfAborted()
    if (disposed) throw new Error('The playground was closed.')
    const id = `/playground-images/${crypto.randomUUID()}`
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite')
      const abort = () => { try { transaction.abort() } catch { /* Already complete. */ } }
      signal.addEventListener('abort', abort, { once: true })
      transaction.objectStore('images').put(file, id)
      const cleanup = () => signal.removeEventListener('abort', abort)
      transaction.oncomplete = () => { cleanup(); resolve() }
      transaction.onerror = () => { cleanup(); reject(new Error('The image could not be saved. Browser storage may be full.')) }
      transaction.onabort = () => { cleanup(); reject(new Error('Image upload cancelled.')) }
    })
    signal.throwIfAborted()
    if (disposed) throw new Error('The playground was closed.')
    urls.set(id, URL.createObjectURL(file))
    names.set(id, file.name)
    return { id, filename: file.name, alt: file.name, mimeType: file.type, size: file.size }
  }
  function dispose() {
    disposed = true
    urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); names.clear()
    void database?.then(db => db.close(), () => {})
  }
  return { load, upload, provider, resolve, dispose, images }
}
