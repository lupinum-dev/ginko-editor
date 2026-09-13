import type { AuthoringRecipeV1 } from '../authoring'

const imageRecipe: AuthoringRecipeV1 = { id: 'ginko.image', label: 'Image', description: 'Add an image with a description.', keywords: ['photo', 'picture', 'media'], source: '' }

export function isImageRecipe(recipe: AuthoringRecipeV1) { return recipe === imageRecipe }

/** Sources illustrate the preview slot. Built-in insertion runs the matching
 * toolbar command on the current selection; it does not insert this sample text.
 * Host recipe sources are prepared and validated as document fragments instead.
 */
export const writingRecipes: readonly AuthoringRecipeV1[] = [
  { id: 'ginko.heading-1', label: 'Heading 1', description: 'A large section heading.', keywords: ['h1', 'title'], source: '# Heading' },
  { id: 'ginko.heading-2', label: 'Heading 2', description: 'A medium section heading.', keywords: ['h2', 'subtitle'], source: '## Heading' },
  { id: 'ginko.heading-3', label: 'Heading 3', description: 'A small section heading.', keywords: ['h3'], source: '### Heading' },
  { id: 'ginko.bullets', label: 'Bulleted list', description: 'A simple list of ideas.', keywords: ['ul', 'list', 'bullet'], source: '- List item' },
  { id: 'ginko.numbered', label: 'Numbered list', description: 'Steps in a clear order.', keywords: ['ol', 'list'], source: '1. List item' },
  { id: 'ginko.quote', label: 'Quote', description: 'Make a passage stand out.', keywords: ['blockquote'], source: '> A thought worth sharing.' },
  { id: 'ginko.code', label: 'Code block', description: 'Code with its formatting intact.', keywords: ['snippet'], source: '```text\nYour code here\n```' },
  { id: 'ginko.divider', label: 'Divider', description: 'A quiet break between sections.', keywords: ['rule', 'line', 'hr'], source: '---' },
  imageRecipe,
  { id: 'ginko.table', label: 'Table', description: 'Compare information side by side.', keywords: ['grid'], source: '| Name | Details | Status |\n| --- | --- | --- |\n| First item | Description | Draft |\n| Second item | Description | Ready |' },
]

export function recipeSymbol(recipe: AuthoringRecipeV1): string {
  const symbols: Record<string, string> = { 'ginko.heading-1': 'H₁', 'ginko.heading-2': 'H₂', 'ginko.heading-3': 'H₃', 'ginko.bullets': '• ≡', 'ginko.numbered': '1.', 'ginko.quote': '“', 'ginko.code': '</>', 'ginko.divider': '—', 'ginko.table': '▦' }
  return symbols[recipe.id] ?? '◇'
}
