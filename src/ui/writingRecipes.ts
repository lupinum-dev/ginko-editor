import type { AuthoringRecipe } from '../authoring'
import type { EditorText, defaultMessages } from './messages'

const imageRecipe: AuthoringRecipe = {
  id: 'ginko.image',
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
    label: 'Heading 1',
    description: 'A large section heading.',
    keywords: ['h1', 'title'],
    source: '# Heading',
  },
  {
    id: 'ginko.heading-2',
    label: 'Heading 2',
    description: 'A medium section heading.',
    keywords: ['h2', 'subtitle'],
    source: '## Heading',
  },
  {
    id: 'ginko.heading-3',
    label: 'Heading 3',
    description: 'A small section heading.',
    keywords: ['h3'],
    source: '### Heading',
  },
  {
    id: 'ginko.bullets',
    label: 'Bulleted list',
    description: 'A simple list of ideas.',
    keywords: ['ul', 'list', 'bullet'],
    source: '- List item',
  },
  {
    id: 'ginko.numbered',
    label: 'Numbered list',
    description: 'Steps in a clear order.',
    keywords: ['ol', 'list'],
    source: '1. List item',
  },
  {
    id: 'ginko.quote',
    label: 'Quote',
    description: 'Make a passage stand out.',
    keywords: ['blockquote'],
    source: '> A thought worth sharing.',
  },
  {
    id: 'ginko.code',
    label: 'Code block',
    description: 'Code with its formatting intact.',
    keywords: ['snippet'],
    source: '```text\nYour code here\n```',
  },
  {
    id: 'ginko.divider',
    label: 'Divider',
    description: 'A quiet break between sections.',
    keywords: ['rule', 'line', 'hr'],
    source: '---',
  },
  imageRecipe,
  {
    id: 'ginko.table',
    label: 'Table',
    description: 'Compare information side by side.',
    keywords: ['grid'],
    source: '| Name | Details | Status |\n'
      + '| --- | --- | --- |\n'
      + '| First item | Description | Draft |\n'
      + '| Second item | Description | Ready |',
  },
]

export function recipeSymbol(recipe: AuthoringRecipe): string {
  const symbols: Record<string, string> = {
    'ginko.heading-1': 'H₁',
    'ginko.heading-2': 'H₂',
    'ginko.heading-3': 'H₃',
    'ginko.bullets': '• ≡',
    'ginko.numbered': '1.',
    'ginko.quote': '“',
    'ginko.code': '</>',
    'ginko.divider': '—',
    'ginko.table': '▦',
  }

  return symbols[recipe.id] ?? '◇'
}

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

export function searchRecipes(
  recipes: readonly AuthoringRecipe[],
  query: string,
  copy: (recipe: AuthoringRecipe) => { label: string; description?: string },
) {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
  const search = normalize(query)
  if (!search) return recipes
  const tokens = search.split(/\s+/)
  return recipes.map((recipe, index) => {
    const display = copy(recipe)
    const names = [display.label, recipe.label, ...(recipe.keywords ?? [])].map(normalize)
    const searchable = [...names, normalize(recipe.id), normalize(display.description ?? '')].join(' ')
    const rank = names.includes(search) ? 0 : names.some(name => name.startsWith(search)) ? 1 : 2
    return { recipe, index, rank, matches: tokens.every(token => searchable.includes(token)) }
  }).filter(item => item.matches).sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.recipe)
}
