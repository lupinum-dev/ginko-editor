export const defaultMessages = {
  editingMode: 'Editing mode', availableBlocks: 'Available blocks', insertShort: 'Insert', navigate: 'navigate', insertHelp: 'insert', closeHelp: 'close', changesNeedAttention: 'Changes need attention', sourceOnly: 'Source only', convertingChanges: 'Converting changes', visualEditor: 'Visual editor', markdownSource: 'Markdown source', finishImageUpload: 'Finish or remove the image upload before leaving the editor.', visualRecovery: 'Your changes are still here. Correct the document or use Undo before switching modes.', sourceUnavailable: 'Visual editing is unavailable for this source.',

  undo: 'Undo', redo: 'Redo', paragraph: 'Paragraph', heading: 'Heading', textStyle: 'Text style', lists: 'Lists',
  bulletList: 'Bulleted list', orderedList: 'Numbered list', blockquote: 'Block quote', codeBlock: 'Code block',
  divider: 'Divider', bold: 'Bold', italic: 'Italic', strike: 'Strikethrough', code: 'Inline code', link: 'Link',
  image: 'Add image', file: 'Add file', video: 'Add video', insert: 'Insert block', table: 'Insert table',
  rows: 'Rows', columns: 'Columns', apply: 'Apply', removeLink: 'Remove link', linkAddress: 'Link address',
  invalidLink: 'Enter a valid link.', formatting: 'Text formatting', more: 'More formatting',
  visual: 'Visual', markdown: 'Markdown', searchBlocks: 'Search blocks', noBlocks: 'No matching blocks.',
  duplicate: 'Duplicate', delete: 'Delete',
  cancel: 'Cancel', loading: 'Loading…', loadMore: 'Load more', upload: 'Upload',
  blockSettings: 'Block settings', componentSettings: '{label} settings', calloutType: 'Callout type',
  defaultValue: 'Default', emptyText: 'Empty text', invalidNumber: 'Enter a valid number.',
  componentConversionFailed: 'The component could not be converted.',
  variantInvalid: 'Cannot switch with these properties. {reason}',
  variantFailed: 'The component could not be changed. Your document is unchanged.',
  columnWidths: 'Column widths', customWidths: 'Custom widths', resizeColumns: 'Columns (resize)',
  columnSize: '{label} ({size})', componentTitle: '{label} {field}', title: 'title',
  addTitle: 'Add a title…', resizeColumnsHint: '{label} · Drag or use arrow keys',
  tableEditing: 'Table editing', tableOptions: 'Table options', rowActions: 'Row actions', columnActions: 'Column actions',
  tableScope: '{rows} · {columns}', tableRow: 'Row {number}', tableRows: 'Rows {start}–{end}',
  tableColumn: 'Column {number}', tableColumns: 'Columns {start}–{end}', tableRangeActions: '{range} actions',
  tableActionScope: '{action} · {scope}', columnAlignment: 'Column alignment', addToTable: 'Add to table',
  alignColumnLeft: 'Align column left', alignColumnCenter: 'Align column center', alignColumnRight: 'Align column right',
  addRow: 'Add row', addColumn: 'Add column', addRowAbove: 'Add row above', addRowBelow: 'Add row below',
  addColumnLeft: 'Add column left', addColumnRight: 'Add column right',
  moveRowUp: 'Move row up', moveRowDown: 'Move row down', moveColumnLeft: 'Move column left', moveColumnRight: 'Move column right',
  duplicateRow: 'Duplicate row', duplicateColumn: 'Duplicate column', deleteRow: 'Delete row', deleteColumn: 'Delete column',
  moveRowToHeader: 'Move row to header', deleteTable: 'Delete table',
  tableHeaderHint: 'The first row is the header. Promote another row to change it.',
  imageSettings: 'Image settings', imageDescription: 'Image description', replaceImage: 'Replace image', imageMetadata: 'Image metadata', removeImage: 'Remove image',
  codeLanguage: 'Code language', plainText: 'Plain text', shellLanguage: 'Shell', codeFileName: 'Code file name', optionalFileName: 'File name (optional)',
  chooseImage: 'Choose an image', imagePickerDescription: 'Select an image from your library.', closeImagePicker: 'Close image picker',
  searchImages: 'Search images', searchImagesPlaceholder: 'Search images…', imageLibrary: 'Image library', chooseNamedImage: 'Choose {label}',
  loadingImages: 'Loading images…', noMatchingImages: 'No images match your search.', noImages: 'Your library has no images yet.',
  imageUpload: 'Image upload', uploadImage: 'Upload image', imageUploadHint: 'Choose an image file · up to 10 MB', browseImages: 'Browse images',
  imageFile: 'Image file', removeImagePlaceholder: 'Remove image placeholder', confirmReplaceImage: 'Replace this image?', confirmAddImage: 'Add this image?',
  imageTooLarge: 'Choose an image smaller than 10 MB.', invalidImageFile: 'Choose a non-empty image file.',
  choosingImage: 'Choosing image…', uploadingImage: 'Uploading image…', retryImage: 'Try another image or retry',
  replaceImageDrop: 'Click to replace or drag and drop', uploadImageDrop: 'Click to upload or drag and drop',
  imageInsertFailed: 'The image could not be inserted. Try again.', imageUploadFailed: 'The image could not be uploaded. Try again.',
  oneImagePlaceholder: 'Choose one image for this placeholder.', dropReplaceImage: 'Drop to replace this image', dropAddImage: 'Drop to add an image', oneImageDrop: 'Drop one image at a time.',
  imageReferenceRequired: 'Choose an image with a stored id or URL.', imageTextRequired: 'The image {field} must be text.', imageNumberRequired: 'The image {field} must be a finite number.',

}

export type EditorMessageKey = keyof typeof defaultMessages
export type EditorMessages = Partial<Record<EditorMessageKey, string>>
export type EditorMessageParams = Readonly<Record<string, string | number>>
export type EditorText = (key: EditorMessageKey, params?: EditorMessageParams) => string

export function translateEditorMessage(messages: EditorMessages | undefined, key: EditorMessageKey, params?: EditorMessageParams): string {
  return (messages?.[key] ?? defaultMessages[key]).replace(/\{(\w+)\}/g, (placeholder, name: string) => params?.[name] === undefined ? placeholder : String(params[name]))
}

/** Resolve UI copy at use time so changing a host's locale needs no new editor. */
export function createEditorText(getMessages: () => EditorMessages | undefined = () => undefined): EditorText {
  return (key, params) => translateEditorMessage(getMessages(), key, params)
}
