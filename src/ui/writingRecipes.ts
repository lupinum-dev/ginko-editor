import type { AuthoringRecipe } from '../authoring'
import type { EditorText, defaultMessages } from './messages'

const imageRecipe: AuthoringRecipe = {
  id: 'ginko.image',
  group: 'media',
  icon: 'image',
  label: 'Image',
  description: 'Add an image with a description.',
  keywords: ['photo', 'picture', 'media'],
  source: '',
}

export function isImageRecipe(recipe: AuthoringRecipe) {
  return recipe === imageRecipe
}

/** Sources illustrate the preview slot. Built-in insertion runs the matching
 * toolbar command on the current selection; it does not insert this sample text.
 * Host recipe sources are prepared and validated as document fragments instead.
 */
export const writingRecipes: readonly AuthoringRecipe[] = [
  {
    id: 'ginko.heading-1',
    group: 'text',
    icon: 'heading-1',
    label: 'Heading 1',
    description: 'A large section heading.',
    keywords: ['h1', 'title'],
    source: '# Heading',
  },
  {
    id: 'ginko.heading-2',
    group: 'text',
    icon: 'heading-2',
    label: 'Heading 2',
    description: 'A medium section heading.',
    keywords: ['h2', 'subtitle'],
    source: '## Heading',
  },
  {
    id: 'ginko.heading-3',
    group: 'text',
    icon: 'heading-3',
    label: 'Heading 3',
    description: 'A small section heading.',
    keywords: ['h3'],
    source: '### Heading',
  },
  {
    id: 'ginko.bullets',
    group: 'lists',
    icon: 'list',
    label: 'Bulleted list',
    description: 'A simple list of ideas.',
    keywords: ['ul', 'list', 'bullet'],
    source: '- List item',
  },
  {
    id: 'ginko.numbered',
    group: 'lists',
    icon: 'list-ordered',
    label: 'Numbered list',
    description: 'Steps in a clear order.',
    keywords: ['ol', 'list'],
    source: '1. List item',
  },
  {
    id: 'ginko.quote',
    group: 'text',
    icon: 'quote',
    label: 'Quote',
    description: 'Make a passage stand out.',
    keywords: ['blockquote'],
    source: '> A thought worth sharing.',
  },
  {
    id: 'ginko.code',
    group: 'advanced',
    icon: 'square-code',
    label: 'Code block',
    description: 'Code with its formatting intact.',
    keywords: ['snippet'],
    source: '```text\nYour code here\n```',
  },
  {
    id: 'ginko.divider',
    group: 'text',
    icon: 'minus',
    label: 'Divider',
    description: 'A quiet break between sections.',
    keywords: ['rule', 'line', 'hr'],
    source: '---',
  },
  imageRecipe,
  {
    id: 'ginko.table',
    group: 'advanced',
    icon: 'table-2',
    label: 'Table',
    description: 'Compare information side by side.',
    keywords: ['grid'],
    source: '| Name | Details | Status |\n'
      + '| --- | --- | --- |\n'
      + '| First item | Description | Draft |\n'
      + '| Second item | Description | Ready |',
  },
]

/** Preserve recipe identity: host IDs must not acquire built-in behavior. */
export function recipeCopy(recipe: AuthoringRecipe, text: EditorText) {
  if (!writingRecipes.includes(recipe)) return recipe
  const keys: Record<string, [keyof typeof defaultMessages, keyof typeof defaultMessages]> = {
    'ginko.heading-1': ['heading', 'heading1Description'],
    'ginko.heading-2': ['heading', 'heading2Description'],
    'ginko.heading-3': ['heading', 'heading3Description'],
    'ginko.bullets': ['bulletList', 'bulletListDescription'],
    'ginko.numbered': ['orderedList', 'orderedListDescription'],
    'ginko.quote': ['blockquote', 'blockquoteDescription'],
    'ginko.code': ['codeBlock', 'codeBlockDescription'],
    'ginko.divider': ['divider', 'dividerDescription'],
    'ginko.image': ['image', 'imageRecipeDescription'],
    'ginko.table': ['table', 'tableDescription'],
  }
  const entry = keys[recipe.id]
  if (!entry) return recipe
  const label = text(entry[0]) + (recipe.id.startsWith('ginko.heading-') ? ` ${recipe.id.slice(-1)}` : '')
  return { label, description: text(entry[1]) }
}
