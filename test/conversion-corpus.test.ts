import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  convertMarkdownToTiptapDoc,
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
} from '../src/lib/conversionPipeline.js'

const fixturesDirectory = join(process.cwd(), 'test', 'fixtures', 'editor-conversion')
const fixtures = (await readdir(fixturesDirectory)).filter((name) => name.endsWith('.mdc')).sort()

describe('accepted CMS conversion corpus', () => {
  for (const fixture of fixtures) {
    it(`keeps ${fixture} semantically stable`, async () => {
      const source = await readFile(join(fixturesDirectory, fixture), 'utf8')
      const prepared = await prepareMarkdownForVisualEditing(source)
      expect(prepared.ok).toBe(true)

      const first = await convertMarkdownToTiptapDoc(source)
      expect(first.ok).toBe(true)
      if (!first.ok || !first.value) throw new Error(`Could not parse ${fixture}.`)
      const normalized = await convertTiptapDocToMarkdown(first.value)
      expect(normalized.ok).toBe(true)
      if (!normalized.ok || normalized.value === undefined) {
        throw new Error(`Could not serialize ${fixture}.`)
      }
      const second = await convertMarkdownToTiptapDoc(normalized.value)
      expect(second.value).toEqual(first.value)
    })
  }
})
