import { describe, expect, it } from 'vitest'

import type { AuthoringRecipe } from '../src/authoring'
import { createEditorText } from '../src/ui/messages'
import { groupMatches, matchScore, rankRecipes } from '../src/ui/recipe-search'

const recipe = (id: string, label: string, extra: Partial<AuthoringRecipe> = {}): AuthoringRecipe =>
  ({ id, label, source: '', ...extra })
const copy = (entry: AuthoringRecipe) => ({ label: entry.label, description: entry.description })
const text = createEditorText()

describe('recipe ranking', () => {
  const recipes = [
    recipe('fuzzy', 'Table of contents'),
    recipe('keyword', 'Accordion', { keywords: ['faq', 'tabular'] }),
    recipe('word', 'Code tabs'),
    recipe('prefix', 'Tabulator'),
    recipe('exact', 'Tab'),
    recipe('alias', 'Panels', { keywords: ['tab'] }),
  ]

  it('ranks exact, prefix, word prefix, keyword, then fuzzy matches', () => {
    const ranked = rankRecipes(recipes, 'tab', copy)
    expect(ranked.map(match => [match.recipe.id, match.score])).toEqual([
      ['exact', matchScore.exact],
      ['alias', matchScore.exact],
      ['fuzzy', matchScore.prefix],
      ['prefix', matchScore.prefix],
      ['word', matchScore.wordPrefix],
      ['keyword', matchScore.keyword],
    ])
  })

  it('keeps the source order within one score', () => {
    const same = [recipe('b', 'Beta note'), recipe('a', 'Alpha note'), recipe('c', 'Gamma note')]
    expect(rankRecipes(same, 'note', copy).map(match => match.recipe.id)).toEqual(['b', 'a', 'c'])
  })

  it('finds a subsequence and reports the matched characters', () => {
    const [match] = rankRecipes([recipe('toc', 'Table of contents')], 'tbc', copy)
    expect(match.score).toBe(matchScore.fuzzy)
    expect(match.ranges).toEqual([[0, 1], [2, 3], [9, 10]])
    const [prefix] = rankRecipes([recipe('h', 'Heading 2')], 'head', copy)
    expect(prefix.ranges).toEqual([[0, 4]])
    const [words] = rankRecipes([recipe('c', 'Code group')], 'co gr', copy)
    expect(words.score).toBe(matchScore.wordPrefix)
    expect(words.ranges).toEqual([[0, 2], [5, 7]])
  })

  it('ignores accents and case and keeps highlight positions in the original label', () => {
    const [match] = rankRecipes([recipe('u', 'Überschrift 1')], 'uber', copy)
    expect(match.score).toBe(matchScore.prefix)
    expect(match.ranges).toEqual([[0, 4]])
  })

  it('does not match unrelated labels', () => {
    expect(rankRecipes(recipes, 'zzz', copy)).toEqual([])
  })
})

describe('recipe groups', () => {
  const recipes = [
    recipe('host', 'Learning objective'),
    recipe('tabs', 'Tabs', { group: 'layout' }),
    recipe('custom', 'Quiz card', { group: 'Training' }),
    recipe('h1', 'Heading 1', { group: 'text' }),
    recipe('code', 'Code block', { group: 'advanced' }),
    recipe('note', 'Note', { group: 'callouts' }),
  ]

  it('orders built-in groups, host groups, components, and advanced without a query', () => {
    const groups = groupMatches(rankRecipes(recipes, '', copy), text, { query: false })
    expect(groups.map(group => group.label)).toEqual([
      'Text', 'Layout', 'Callouts', 'Training', 'Components', 'Advanced',
    ])
  })

  it('orders groups by their best match with a query and keeps pinned groups first', () => {
    const pinned = [{ key: 'context', label: 'In this block', matches: rankRecipes([recipe('add', 'Add tab')], 'co', copy) }]
    const groups = groupMatches(rankRecipes(recipes, 'co', copy), text, { query: true, pinned })
    expect(groups[0].key).toBe('advanced')
    expect(groups.map(group => group.matches[0].score)).toEqual(
      [...groups.map(group => group.matches[0].score)].sort((a, b) => b - a),
    )
    const withContext = groupMatches(rankRecipes(recipes, 'ta', copy), text, {
      query: true,
      pinned: [{ key: 'context', label: 'In this block', matches: rankRecipes([recipe('add', 'Add tab')], 'ta', copy) }],
    })
    expect(withContext[0].key).toBe('context')
  })
})
