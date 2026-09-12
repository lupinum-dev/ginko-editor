import { describe, expect, it } from 'vitest'

import { composeAuthoringKits, createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'

const learningObjective = {
  authoring: {
    'learning-objective': {
      label: 'Learning objective',
      props: {
        assessed: { control: 'toggle', label: 'Assessed' },
        level: { control: 'select', label: 'Level' },
      },
      slots: {
        default: { label: 'Objective' },
        tip: { label: 'Tip' },
      },
    },
  },
  implementation: {
    'learning-objective': {
      componentName: 'LearningObjective',
      props: {
        assessed: { default: false, required: false, types: ['boolean'] },
        class: { required: false, types: ['complex'] },
        level: { options: ['intro', 'advanced'], required: true, types: ['string', 'object'] },
      },
      slots: ['default', 'tip'],
    },
  },
  policy: {
    version: 2,
    components: {
      'learning-objective': {
        kind: 'block',
        media: null,
        props: {
          assessed: { required: false, types: ['boolean'], allowedValues: null },
          level: { required: true, types: ['string'], allowedValues: ['intro', 'advanced'] },
        },
        slots: ['default', 'tip'],
        allowedParents: null,
        allowedChildren: null,
      },
    },
  },
  recipes: [{
    id: 'advanced-objective',
    keywords: ['goal', 'lesson'],
    label: 'Advanced objective',
    source:
      '<learning-objective level="advanced" assessed>\nGoal\n\n<template #tip>\nHint\n</template>\n</learning-objective>',
  }],
  version: 1,
} as const satisfies AuthoringKitSourceV1

describe('authoring kits', () => {
  it('validates and freezes a custom component with union, boolean, and named-slot metadata', async () => {
    const kit = await createAuthoringKit(learningObjective)

    expect(kit).toBe(learningObjective)
    expect(Object.isFrozen(kit)).toBe(true)
    expect(Object.isFrozen(kit.policy.components['learning-objective'].props)).toBe(true)
    expect(kit.recipes[0].keywords).toEqual(['goal', 'lesson'])
    expect(Object.isFrozen(kit.recipes[0].keywords)).toBe(true)
  })

  it('creates isolated kits without a mutable global registry', async () => {
    const first = await createAuthoringKit(structuredClone(learningObjective))
    const secondSource = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    secondSource.recipes[0].label = 'Second label'
    const second = await createAuthoringKit(secondSource)

    expect(first).not.toBe(second)
    expect(first.recipes[0].label).toBe('Advanced objective')
    expect(second.recipes[0].label).toBe('Second label')
  })

  it('rejects duplicate recipes', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    source.recipes = [...source.recipes, { ...source.recipes[0] }]
    await expect(createAuthoringKit(source)).rejects.toThrow('duplicate "advanced-objective"')
  })

  it('rejects empty and duplicate recipe search keywords', async () => {
    const empty = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    empty.recipes[0].keywords = ['goal', '  ']
    await expect(createAuthoringKit(empty)).rejects.toThrow('contains an empty value')

    const duplicate = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    duplicate.recipes[0].keywords = ['goal', 'goal']
    await expect(createAuthoringKit(duplicate)).rejects.toThrow('contains duplicate "goal"')
  })

  it('rejects duplicate component tags while composing independent sources', async () => {
    await expect(composeAuthoringKits(learningObjective, learningObjective)).rejects.toThrow(
      'component tag "learning-objective" is registered more than once',
    )
  })

  it('rejects policy exposure of an unsupported complex prop', async () => {
    const source = structuredClone(learningObjective) as AuthoringKitSourceV1
    source.policy.components['learning-objective'].props.class = {
      required: false,
      types: ['string', 'number', 'boolean', 'json'],
      allowedValues: null,
    }
    await expect(createAuthoringKit(source)).rejects.toThrow('unsupported complex type')
  })

  it('rejects recipes outside the explicit Content policy', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    source.recipes[0].source = '<unknown-widget>Unsafe</unknown-widget>'
    await expect(createAuthoringKit(source)).rejects.toThrow('outside policy')
  })

  it('validates controls against the narrower policy type', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    const authoring = source.authoring['learning-objective']
    const level = authoring.props?.level
    if (!level) throw new Error('Expected level authoring metadata.')
    authoring.props = {
      ...authoring.props,
      level: { ...level, control: 'number' },
    }
    await expect(createAuthoringKit(source)).rejects.toThrow('incompatible number control')
  })

  it('rejects required implementation props that policy cannot provide', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    const implementation = source.implementation['learning-objective']
    source.implementation['learning-objective'] = {
      ...implementation,
      props: {
        ...implementation.props,
        rendererKey: { required: true, types: ['string'] },
      },
    }
    await expect(createAuthoringKit(source)).rejects.toThrow('required but optional or unavailable in policy')
  })

  it('rejects recipe values outside the policy allow-list', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    source.recipes[0].source = '<learning-objective level="unsupported">\nGoal\n</learning-objective>'
    await expect(createAuthoringKit(source)).rejects.toThrow('outside policy')
  })

  it('rejects recipe component nesting outside authoring constraints', async () => {
    const source = structuredClone(learningObjective) as unknown as AuthoringKitSourceV1
    source.policy.components['learning-objective'].allowedParents = ['learning-objective']
    await expect(createAuthoringKit(source)).rejects.toThrow('invalid_nesting')
  })
})
