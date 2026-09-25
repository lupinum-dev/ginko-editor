import { describe, expect, it } from 'vitest'

import {
  composeAuthoringKits,
  createAuthoringKit,
  createGinkoLayoutKit,
  ginkoLayoutComponentNames,
  ginkoLayoutKitSource,
  type AuthoringKitSource,
} from '../src/authoring'
import {
  convertTiptapDocToMarkdown,
  prepareMarkdownForVisualEditing,
  validateMarkdownForAuthoring,
} from '../src/lib/conversionPipeline'
import { createEditorSchema } from '../src/runtime'
import docs from './fixtures/ginko-docs-components.json'

/** A copy of the Ginko Docs policy source (`tags.ts`) from the accepted Docs authoring candidate. */
const docsPolicy = docs.policy as unknown as AuthoringKitSource['policy']

const block = { kind: 'block', media: null, slots: ['default'], allowedParents: null, allowedChildren: null } as const
function containerSource(): AuthoringKitSource {
  return {
    version: 1,
    policy: {
      version: 2,
      components: {
        group: { ...block, props: { cols: { types: ['string'], required: false, allowedValues: null } } },
        entry: {
          ...block,
          props: {
            name: { types: ['string'], required: false, allowedValues: null },
            count: { types: ['number'], required: false, allowedValues: null },
          },
        },
      },
    },
    implementation: {
      group: { componentName: 'Group', props: { cols: { required: false, types: ['string'] } }, slots: ['default'] },
      entry: {
        componentName: 'Entry',
        props: { name: { required: false, types: ['string'] }, count: { required: false, types: ['number'] } },
        slots: ['default'],
      },
    },
    authoring: {
      group: {
        label: 'Group',
        canvas: {
          items: {
            childTag: 'entry',
            labelProp: 'name',
            presentation: 'grid',
            columnsProp: 'cols',
            template: '::entry{name="New"}\nText.\n::',
          },
        },
      },
      entry: { label: 'Entry' },
    },
    recipes: [],
  }
}

describe('built-in layout kit', () => {
  it('uses the exact Ginko Docs policy and names the Docs Vue components', async () => {
    const kit = await createGinkoLayoutKit()
    expect(JSON.parse(JSON.stringify(kit.policy))).toEqual(docsPolicy)
    // `img` is the Markdown image. The editor's built-in image block writes it.
    const { img, ...components } = docs.tags
    expect(img).toBe('ProseImg')
    expect(ginkoLayoutComponentNames).toEqual(components)
    const implementation: Record<string, { componentName: string }> = kit.implementation
    const authoring: Record<string, { label: string }> = kit.authoring
    for (const [tag, name] of Object.entries(components)) {
      expect(implementation[tag]?.componentName).toBe(name)
      expect(authoring[tag]?.label).toBeTruthy()
    }
  })

  it('composes with host kits', async () => {
    const kit = await composeAuthoringKits(ginkoLayoutKitSource, containerSource())
    expect(kit.policy.components.tabs).toBeDefined()
    expect(kit.policy.components.entry).toBeDefined()
  })

  it('gives every recipe a group and a Lucide icon', () => {
    for (const recipe of ginkoLayoutKitSource.recipes) {
      expect(recipe.group, recipe.id).toMatch(/^(text|lists|media|layout|callouts|advanced)$/)
      expect(recipe.icon, recipe.id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it.each(ginkoLayoutKitSource.recipes.map(recipe => [recipe.id, recipe] as const))(
    'round-trips the %s recipe without changes',
    async (_id, recipe) => {
      const kit = await createGinkoLayoutKit()
      const schema = createEditorSchema()
      const opened = await prepareMarkdownForVisualEditing(recipe.source, {}, schema, kit)
      expect(opened.ok).toBe(true)
      const saved = await convertTiptapDocToMarkdown(opened.value!, {})
      expect(saved.ok).toBe(true)
      expect(await validateMarkdownForAuthoring(saved.value!, kit)).toBeUndefined()
      const reopened = await prepareMarkdownForVisualEditing(saved.value!, {}, schema, kit)
      expect(reopened.value).toEqual(opened.value)
      expect((await convertTiptapDocToMarkdown(reopened.value!, {})).value).toBe(saved.value)
    },
  )

  it.each(Object.entries(ginkoLayoutKitSource.authoring).filter(([, meta]) => meta.canvas?.items))(
    'inserts a valid %s item from its template',
    async (tag, meta) => {
      const kit = await createGinkoLayoutKit()
      const template = meta.canvas!.items!.template
      const opened = await prepareMarkdownForVisualEditing(`::${tag}\n${template}\n::`, {}, createEditorSchema(), kit)
      expect(opened.ok).toBe(true)
    },
  )
})

describe('authoring kit validation for layout blocks', () => {
  it('accepts a json control only for a json property', async () => {
    const source = containerSource()
    source.policy.components.entry.props.data = {
      types: ['string', 'number', 'boolean', 'json'],
      required: false,
      allowedValues: null,
    }
    source.implementation.entry = {
      ...source.implementation.entry,
      props: { ...source.implementation.entry.props, data: { required: false, types: ['object'] } },
    }
    source.authoring.entry.props = { data: { control: 'json', label: 'Data' } }
    await expect(createAuthoringKit(structuredClone(source))).resolves.toBeDefined()
    source.authoring.entry.props = { name: { control: 'json', label: 'Name' } }
    await expect(createAuthoringKit(source)).rejects.toThrow('json control without a policy json type')
  })

  it('lets a json property use a component that accepts one of its value types', async () => {
    const source = containerSource()
    source.policy.components.entry.props.data = {
      types: ['string', 'number', 'boolean', 'json'],
      required: false,
      allowedValues: null,
    }
    source.implementation.entry = {
      ...source.implementation.entry,
      props: { ...source.implementation.entry.props, data: { required: false, types: ['number'] } },
    }
    await expect(createAuthoringKit(source)).resolves.toBeDefined()
  })

  it('accepts a valid items hint', async () => {
    await expect(createAuthoringKit(containerSource())).resolves.toBeDefined()
  })

  it.each([
    ['an unknown child', (source: AuthoringKitSource) => { source.authoring.group.canvas!.items!.childTag = 'missing' }, 'childTag'],
    ['both child kinds', (source: AuthoringKitSource) => { source.authoring.group.canvas!.items!.childNode = 'codeBlock' }, 'exactly one'],
    ['a non-text label', (source: AuthoringKitSource) => { source.authoring.group.canvas!.items!.labelProp = 'count' }, 'labelProp'],
    ['an unknown columns property', (source: AuthoringKitSource) => { source.authoring.group.canvas!.items!.columnsProp = 'size' }, 'columnsProp'],
    ['an unknown presentation', (source: AuthoringKitSource) => {
      (source.authoring.group.canvas!.items as { presentation: string }).presentation = 'carousel'
    }, 'presentation'],
    ['two template items', (source: AuthoringKitSource) => {
      source.authoring.group.canvas!.items!.template = '::entry\nOne.\n::\n\n::entry\nTwo.\n::'
    }, 'exactly one "entry"'],
    ['another template component', (source: AuthoringKitSource) => {
      source.authoring.group.canvas!.items!.template = '::group\nOne.\n::'
    }, 'exactly one "entry"'],
    ['a forbidden placement', (source: AuthoringKitSource) => {
      source.policy.components.entry = { ...source.policy.components.entry, allowedParents: ['entry'] }
    }, 'placement'],
    ['a template outside policy', (source: AuthoringKitSource) => {
      source.authoring.group.canvas!.items!.template = '::entry{unknown="x"}\nText.\n::'
    }, 'outside policy'],
  ])('rejects an items hint with %s', async (_name, change, message) => {
    const source = containerSource()
    change(source)
    await expect(createAuthoringKit(source)).rejects.toThrow(message)
  })

  it('checks heading and code block templates', async () => {
    const source = containerSource()
    source.authoring.group.canvas!.items = { childNode: 'heading', presentation: 'steps', template: '### Step\n\nText.' }
    await expect(createAuthoringKit(structuredClone(source))).resolves.toBeDefined()
    source.authoring.group.canvas!.items.template = '### Step\n\n### Another'
    await expect(createAuthoringKit(structuredClone(source))).rejects.toThrow('only heading')
    source.authoring.group.canvas!.items = { childNode: 'codeBlock', presentation: 'tabs', template: 'Text.' }
    await expect(createAuthoringKit(source)).rejects.toThrow('one code block')
  })

  it('validates recipe groups and icons', async () => {
    const source = containerSource()
    source.recipes = [{ id: 'one', label: 'One', group: 'Host blocks', icon: 'panel-top', source: 'Text.' }]
    await expect(createAuthoringKit(structuredClone(source))).resolves.toBeDefined()
    source.recipes = [{ id: 'one', label: 'One', group: ' ', source: 'Text.' }]
    await expect(createAuthoringKit(structuredClone(source))).rejects.toThrow('group')
    source.recipes = [{ id: 'one', label: 'One', icon: 'PanelTop', source: 'Text.' }]
    await expect(createAuthoringKit(source)).rejects.toThrow('icon')
  })
})

describe('typed properties in colon syntax', () => {
  it('keeps number and boolean properties of a Docs example after a save', async () => {
    const kit = await createGinkoLayoutKit()
    const schema = createEditorSchema()
    const source = '::code-tree\n---\nexpandAll: true\n---\n```ts [a.ts]\nx\n```\n::\n\n::toc{title="Contents"}\n---\ndepth: 2\n---\n::'
    const opened = await prepareMarkdownForVisualEditing(source, {}, schema, kit)
    expect(opened.ok).toBe(true)
    const saved = (await convertTiptapDocToMarkdown(opened.value!, {})).value!
    expect(saved).toContain('<code-tree expandAll>')
    expect(saved).toContain('<Toc title="Contents" :depth="2" />')
    expect(await validateMarkdownForAuthoring(saved, kit)).toBeUndefined()
    const reopened = await prepareMarkdownForVisualEditing(saved, {}, schema, kit)
    expect(reopened.value?.content?.[0]?.attrs?.props.expandAll).toBe(true)
    expect(reopened.value?.content?.[1]?.attrs?.props.depth).toBe(2)
    expect((await convertTiptapDocToMarkdown(reopened.value!, {})).value).toBe(saved)
  })
})
