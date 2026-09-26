import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { createGinkoLayoutKit, ginkoLayoutKitSource } from '../src/authoring'
import {
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
} from '../src/lib/conversionPipeline'
import { createEditorSchema } from '../src/runtime'

/**
 * Visual edits must save Markdown that reopens as the same document. Start from
 * every layout recipe, replace its text and string properties with risky values,
 * then save, reopen and compare.
 */
const alphabet = [
  'a', 'Z', '0', ' ', ' ', ':', '::', '{', '}', '{{', '}}', '[', ']', '(', ')', '<', '>', '#', '-', '*', '_',
  '`', '"', "'", '=', '|', '\\', '!', '.', '@', '/', 'https://a.com', 'a.com', '&amp;', 'ü', '日', '\n',
]

function random(seed: number) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

/** Whole values that a parser could read as another JSON type. */
const typedLooking = ['[1, 2]', '{"a":1}', 'true', 'false', 'null', '3', '-0.5', '[]', '{}']

function riskyText(next: () => number, allowNewline: boolean) {
  if (allowNewline && next() < 0.2) return typedLooking[Math.floor(next() * typedLooking.length)]!
  const length = 1 + Math.floor(next() * 12)
  let value = ''
  for (let index = 0; index < length; index += 1) {
    const token = alphabet[Math.floor(next() * alphabet.length)]!
    value += token === '\n' && !allowNewline ? ' ' : token
  }
  // Text nodes cannot start or end with collapsible whitespace in Markdown.
  return value.trim() || 'x'
}

/** Replace text and string properties. Keep structure, marks and code intact. */
type FreeText = (tag: string, prop: string) => boolean

function mutate(node: JSONContent, next: () => number, freeText: FreeText, inCode = false): JSONContent {
  const copy: JSONContent = { ...node }
  const code = inCode || node.type === 'codeBlock'
  if (copy.type === 'text' && !code && !copy.marks?.some(mark => mark.type === 'code')) {
    copy.text = riskyText(next, false)
  }
  const props = copy.attrs?.props as Record<string, unknown> | undefined
  if (props) {
    const nextProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      nextProps[key] = typeof value === 'string' && freeText(String(copy.attrs?.tag), key)
        ? riskyText(next, true)
        : value
    }
    copy.attrs = { ...copy.attrs, props: nextProps }
  }
  if (copy.content) copy.content = copy.content.map(child => mutate(child, next, freeText, code))
  return copy
}

/** Text and component values in document order. */
function meaning(node: JSONContent, out: unknown[] = []): unknown[] {
  if (node.type === 'text') out.push(node.text)
  const props = node.attrs?.props as Record<string, unknown> | undefined
  if (node.attrs?.tag) out.push([node.attrs.tag, Object.fromEntries(Object.entries(props ?? {}).filter(([key]) => key !== '$'))])
  node.content?.forEach(child => meaning(child, out))
  return out
}

function joinedText(values: unknown[]) {
  // Adjacent text nodes may merge or split; compare their joined text between values.
  const result: unknown[] = []
  for (const value of values) {
    if (typeof value === 'string' && typeof result.at(-1) === 'string') result[result.length - 1] += value
    else result.push(value)
  }
  return result
}

const seeds = Array.from({ length: Number(process.env.SAVE_PATH_SEEDS ?? 8) }, (_, index) => index + 1)

describe('save path property', () => {
  it.each(ginkoLayoutKitSource.recipes.map(recipe => [recipe.id, recipe] as const))(
    'reopens mutated %s documents unchanged',
    async (_id, recipe) => {
      const kit = await createGinkoLayoutKit()
      const schema = createEditorSchema()
      const opened = await prepareMarkdownForVisualEditing(recipe.source, {}, schema, kit)
      expect(opened.ok).toBe(true)
      // Only properties that accept any text: no choices, links, assets or icons.
      const freeText: FreeText = (tag, prop) => {
        const definition = (kit.policy.components as Record<string, { props: Record<string, { allowedValues: unknown; types: readonly string[] }> } | undefined>)[tag]?.props[prop]
        return !!definition && !definition.allowedValues && definition.types.includes('string')
          && !definition.types.includes('asset') && !/^(to|href|icon|target)$/.test(prop)
      }
      let saves = 0
      for (const seed of seeds) {
        const mutated = mutate(opened.value!, random(seed * 7919 + recipe.id.length), freeText)
        // Odd seeds place the block inside a quote, where property blocks carry a `>` prefix.
        const edited: JSONContent = seed % 2
          ? { type: 'doc', content: [{ type: 'blockquote', content: mutated.content }] }
          : mutated
        const saved = await convertTiptapDocToMarkdown(edited, {})
        if (!saved.ok) continue // Refusing to save is safe; writing different content is not.
        saves += 1
        const reopened = await prepareMarkdownForVisualEditing(saved.value!, {}, schema, kit)
        expect(reopened.ok, `seed ${seed}: ${JSON.stringify(saved.value)}`).toBe(true)
        const again = await convertTiptapDocToMarkdown(reopened.value!, {})
        expect(again.value, `seed ${seed}`).toBe(saved.value)
        expect(joinedText(meaning(reopened.value!)), `seed ${seed}: ${JSON.stringify(saved.value)}`)
          .toEqual(joinedText(meaning(edited)))
      }
      expect(saves).toBeGreaterThan(seeds.length / 2)
    },
  )
})
