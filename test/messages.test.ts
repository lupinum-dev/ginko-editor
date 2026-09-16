// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import GinkoImagePicker from '../src/GinkoImagePicker.vue'
import { createAuthoringKit } from '../src/authoring'
import { createEditorText, translateEditorMessage, type EditorMessages } from '../src/ui/messages'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { disconnect() {} observe() {} unobserve() {} }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList
})
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); document.body.replaceChildren() })
const german: EditorMessages = {
  componentSettings: 'Einstellungen für {label}', addTitle: 'Titel hinzufügen…', defaultValue: 'Standard',
  delete: 'Löschen', tableEditing: 'Tabelle bearbeiten', tableRow: 'Zeile {number}', tableRows: 'Zeilen {start}–{end}',
  tableColumn: 'Spalte {number}', tableColumns: 'Spalten {start}–{end}', tableRangeActions: '{range} bearbeiten',
  addRow: 'Zeile hinzufügen', duplicateRow: 'Zeile duplizieren', alignColumnCenter: 'Spalte zentrieren',
  chooseImage: 'Bild auswählen', chooseNamedImage: '{label} auswählen', searchImages: 'Bilder suchen',
  cancel: 'Abbrechen', noMatchingImages: 'Keine passenden Bilder.', loadingImages: 'Bilder werden geladen…',
  uploadImage: 'Bild hochladen',
  imageUploadHint: 'Bilddatei bis 10 MB auswählen',
  invalidImageFile: 'Eine gültige Bilddatei auswählen.',
}

describe('interface messages', () => {
  it('resolves named values once and falls back to English per missing key', () => {
    let messages: EditorMessages | undefined = german
    const text = createEditorText(() => messages)
    expect(text('tableRows', { start: 2, end: 4 })).toBe('Zeilen 2–4')
    expect(text('chooseNamedImage', { label: '{cancel}<photo>' })).toBe('{cancel}<photo> auswählen')
    expect(text('removeImage')).toBe('Remove image')
    messages = undefined
    expect(text('tableRows', { start: 2, end: 4 })).toBe('Rows 2–4')
    expect(translateEditorMessage({ tableRow: 'Zeile {number}' }, 'tableRow')).toBe('Zeile {number}')
  })

  it('translates native component and table controls without translating stored content or kit labels', async () => {
    const authoringKit = await createAuthoringKit({
      version: 1,
      implementation: {
        notice: {
          componentName: 'Notice',
          props: {
            title: { types: ['string'], required: false },
            tone: { types: ['string'], required: false },
          },
          slots: ['default'],
        },
      },
      policy: {
        version: 2,
        components: {
          notice: {
            kind: 'block',
            media: null,
            props: {
              title: { types: ['string'], required: false, allowedValues: null },
              tone: { types: ['string'], required: false, allowedValues: ['soft', 'strong'] },
            },
            slots: ['default'],
            allowedParents: null,
            allowedChildren: null,
          },
        },
      },
      authoring: {
        notice: {
          label: 'Hinweis',
          props: {
            title: { label: 'Titel', control: 'text' },
            tone: { label: 'Appearance', control: 'select' },
          },
          canvas: { titleProp: 'title' },
        },
      },
      recipes: [],
    })
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        messages: german,
        authoringKit,
        syncDebounceMs: 10000,
        modelValue:
          '<notice title="Do not translate">\nOriginal content\n</notice>\n\n'
            + '| Name | Value |\n| --- | --- |\n| Apple | 10 |',
      },
    })
    cleanup.push(() => wrapper.unmount()); await flushPromises()
    const editor = wrapper.vm.editor!, before = editor.state.doc
    expect(wrapper.get('input[aria-label="Hinweis Titel"]').attributes('placeholder')).toBe('Titel hinzufügen…')
    await wrapper.get('button[aria-label="Einstellungen für Hinweis"]').trigger('click'); await flushPromises()
    expect(wrapper.get('select[aria-label="Appearance"]').findAll('option')[0].text()).toBe('Standard')
    expect(
      (wrapper.get('input[aria-label="Hinweis Titel"]').element as HTMLInputElement).value,
    ).toBe('Do not translate')
    expect(editor.state.doc).toBe(before)
    let pos = 0
    editor.state.doc.descendants((node, offset) => { if (!pos && node.type.name === 'tableCell') pos = offset + 2 })
    editor.commands.setTextSelection(pos); await flushPromises()
    expect(wrapper.get('.ginko-table__scope').text()).toBe('Zeile 2 · Spalte 1')
    expect(wrapper.get('button[aria-label="Zeile hinzufügen"]').text()).toBe('Zeile hinzufügen')
    await wrapper.get('.ginko-table__row-handle button').trigger('click'); await flushPromises()
    await wrapper.get('button[aria-label="Zeile duplizieren"]').trigger('click'); await flushPromises()
    expect(editor.getText().match(/Apple/g)).toHaveLength(2)
    editor.commands.undo(); expect(editor.state.doc.eq(before)).toBe(true)
    await wrapper.setProps({ messages: { ...german, addRow: 'Neue Zeile' } }); await flushPromises()
    // Message updates repaint the controls, never the document.
    expect(wrapper.get('button[aria-label="Neue Zeile"]').text()).toBe('Neue Zeile')
    expect(editor.state.doc.eq(before)).toBe(true)
  })

  it('translates the controlled picker while keeping asset labels and payloads intact', async () => {
    const image = { id: 'asset-one', alt: 'Original alternative text' }
    const wrapper = mount(GinkoImagePicker, {
      attachTo: document.body,
      props: {
        messages: german,
        open: true,
        images: [{ key: 'one', label: '<Forest>.jpg', image }],
      },
    })
    cleanup.push(() => wrapper.unmount()); await flushPromises()
    expect(document.querySelector('.ginko-image-picker__title')?.textContent?.trim()).toBe('Bild auswählen')
    expect(document.querySelector('[aria-label="Bilder suchen"]')).not.toBeNull()
    const choice = document.querySelector<HTMLButtonElement>('[aria-label="<Forest>.jpg auswählen"]')!
    expect(choice.textContent).toContain('<Forest>.jpg'); expect(choice.querySelector('forest')).toBeNull()
    choice.click(); expect(wrapper.emitted('select')?.[0]).toEqual([image])
    await wrapper.setProps({ images: [], query: 'none' }); await flushPromises()
    expect(document.querySelector('.ginko-image-picker__empty')?.textContent?.trim()).toBe('Keine passenden Bilder.')
    await wrapper.setProps({ loading: true }); await flushPromises()
    expect(document.querySelector('.ginko-image-picker__empty')?.textContent?.trim()).toBe('Bilder werden geladen…')
  })

  it('translates upload controls and local validation without changing the document', async () => {
    const wrapper = mount(GinkoEditor, {
      attachTo: document.body,
      props: {
        messages: german,
        modelValue: 'Keep this content',
        imageUpload: async () => ({ url: '/uploaded.png' }),
      },
    })
    cleanup.push(() => wrapper.unmount()); await flushPromises()
    const editor = wrapper.vm.editor!, before = editor.state.doc
    editor.commands.insertImageUpload(); await flushPromises()
    expect(wrapper.get('button[aria-label="Bild hochladen"]').text()).toContain('Bilddatei bis 10 MB auswählen')
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File([], 'empty.png', { type: 'image/png' })] })
    await input.trigger('change'); await flushPromises()
    expect(wrapper.get('.ginko-image-upload__error').text()).toBe('Eine gültige Bilddatei auswählen.')
    expect(editor.state.doc).toBe(before)
  })
})
