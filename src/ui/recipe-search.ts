import type { AuthoringRecipe } from '../authoring'
import type { EditorMessageKey, EditorText } from './messages'

/** Match quality. A higher score ranks first; equal scores keep their source order. */
export const matchScore = {
  exact: 5,
  prefix: 4,
  wordPrefix: 3,
  keyword: 2,
  fuzzy: 1,
} as const

export interface RecipeMatch {
  recipe: AuthoringRecipe
  label: string
  description?: string
  score: number
  /** Source order, used to keep ranking stable. */
  order: number
  /** Matched label characters as `[start, end)` ranges. */
  ranges: readonly (readonly [number, number])[]
}

export interface RecipeGroup {
  key: string
  label: string
  matches: RecipeMatch[]
}

/** Built-in groups in their menu order. Host groups follow `callouts`. */
export const builtInGroups = ['text', 'lists', 'media', 'layout', 'callouts'] as const
const trailingGroups = ['components', 'advanced'] as const
const groupMessages: Record<string, EditorMessageKey> = {
  context: 'groupContext',
  recent: 'groupRecent',
  text: 'groupText',
  lists: 'groupLists',
  media: 'groupMedia',
  layout: 'groupLayout',
  callouts: 'groupCallouts',
  components: 'groupComponents',
  advanced: 'groupAdvanced',
}

/** Normalize by character and keep the source index of each normalized character. */
function normalize(value: string) {
  let text = ''
  const source: number[] = []
  Array.from(value).forEach((char, index, chars) => {
    const offset = chars.slice(0, index).join('').length
    const folded = char.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
    for (const part of folded) {
      text += part
      source.push(offset)
    }
  })
  return { text, source }
}

const fold = (value: string) => normalize(value).text.trim()

function toRanges(indexes: readonly number[], source: readonly number[], label: string) {
  const ranges: [number, number][] = []
  for (const index of indexes) {
    const start = source[index]
    if (start === undefined) continue
    const end = start + (label.codePointAt(start)! > 0xffff ? 2 : 1)
    const last = ranges[ranges.length - 1]
    if (last && last[1] >= start) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }
  return ranges
}

const span = (from: number, length: number) => Array.from({ length }, (_, index) => from + index)

/** Rank one recipe. Returns undefined when the recipe does not match. */
function rank(
  recipe: AuthoringRecipe,
  order: number,
  query: string,
  display: { label: string; description?: string },
): RecipeMatch | undefined {
  const base = { recipe, order, label: display.label, description: display.description }
  const label = normalize(display.label)
  const names = [display.label, recipe.label, ...(recipe.keywords ?? [])].map(fold)
  const tokens = query.split(/\s+/).filter(Boolean)
  if (label.text === query || names.includes(query)) {
    const ranges = label.text === query ? toRanges(span(0, query.length), label.source, display.label) : []
    return { ...base, score: matchScore.exact, ranges }
  }
  if (label.text.startsWith(query)) {
    return { ...base, score: matchScore.prefix, ranges: toRanges(span(0, query.length), label.source, display.label) }
  }
  // Every query word starts a label word, in order.
  const words = [...label.text.matchAll(/[\p{L}\p{N}]+/gu)]
  const wordHits: number[] = []
  let word = 0
  for (const token of tokens) {
    while (word < words.length && !words[word][0].startsWith(token)) word++
    if (word >= words.length) break
    wordHits.push(...span(words[word].index!, token.length))
    word++
  }
  if (wordHits.length === tokens.join('').length && tokens.length) {
    return { ...base, score: matchScore.wordPrefix, ranges: toRanges(wordHits, label.source, display.label) }
  }
  const searchable = [...names, fold(recipe.id), fold(display.description ?? '')].join(' ')
  if (tokens.every(token => searchable.includes(token))) return { ...base, score: matchScore.keyword, ranges: [] }
  // Characters of the query appear in the label, in order.
  if (query.length >= 2) {
    const compact = query.replace(/\s+/g, '')
    const hits: number[] = []
    let from = 0
    for (const char of compact) {
      const found = label.text.indexOf(char, from)
      if (found < 0) return undefined
      hits.push(found)
      from = found + 1
    }
    return { ...base, score: matchScore.fuzzy, ranges: toRanges(hits, label.source, display.label) }
  }
  return undefined
}

/** Rank recipes for a query. An empty query keeps every recipe in source order. */
export function rankRecipes(
  recipes: readonly AuthoringRecipe[],
  query: string,
  copy: (recipe: AuthoringRecipe) => { label: string; description?: string },
): RecipeMatch[] {
  const search = fold(query).replace(/\s+/g, ' ')
  const matches: RecipeMatch[] = []
  recipes.forEach((recipe, order) => {
    const display = copy(recipe)
    if (!search) {
      matches.push({ recipe, order, label: display.label, description: display.description, score: 0, ranges: [] })
      return
    }
    const match = rank(recipe, order, search, display)
    if (match) matches.push(match)
  })
  return matches.sort((a, b) => b.score - a.score || a.order - b.order)
}

/** Keep the old flat search for callers that need only the recipes. */
export function searchRecipes(
  recipes: readonly AuthoringRecipe[],
  query: string,
  copy: (recipe: AuthoringRecipe) => { label: string; description?: string },
) {
  return rankRecipes(recipes, query, copy).map(match => match.recipe)
}

export function groupKey(recipe: AuthoringRecipe) {
  return recipe.group?.trim() || 'components'
}

export function groupLabel(key: string, text: EditorText) {
  const message = groupMessages[key]
  return message ? text(message) : key
}

/**
 * Group ranked matches. With a query, groups follow their best match; with no
 * query, they follow the built-in order. Pinned groups always come first.
 */
export function groupMatches(
  matches: readonly RecipeMatch[],
  text: EditorText,
  options: { query: boolean; pinned?: readonly RecipeGroup[] },
): RecipeGroup[] {
  const groups = new Map<string, RecipeGroup>()
  for (const match of matches) {
    const key = groupKey(match.recipe)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: groupLabel(key, text), matches: [] }
      groups.set(key, group)
    }
    group.matches.push(match)
  }
  const position = (key: string, firstSeen: number) => {
    const builtIn = builtInGroups.indexOf(key as typeof builtInGroups[number])
    if (builtIn >= 0) return builtIn
    const trailing = trailingGroups.indexOf(key as typeof trailingGroups[number])
    if (trailing >= 0) return 1000 + trailing
    return builtInGroups.length + firstSeen / 1000
  }
  const ordered = [...groups.values()].map((group, firstSeen) => ({ group, rank: position(group.key, firstSeen) }))
  ordered.sort((a, b) => options.query
    ? b.group.matches[0].score - a.group.matches[0].score || a.rank - b.rank
    : a.rank - b.rank)
  return [...(options.pinned ?? []).filter(group => group.matches.length), ...ordered.map(entry => entry.group)]
}
