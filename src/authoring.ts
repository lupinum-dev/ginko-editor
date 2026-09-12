import {
  assertPortableComponentPolicyV2,
  parseMdcBody,
  validatePublicMarkdownAst,
  validateStoredPortableMarkdownAst,
  type ParseMdcBodyResult,
  type PortableComponentPolicyV2,
} from '@lupinum/ginko-content/cms-contract'

import type { JsonValue } from './types'

export type AuthoringControl = 'number' | 'select' | 'text' | 'toggle'
export type ImplementationPropType = 'boolean' | 'complex' | 'number' | 'object' | 'string'

export interface ComponentImplementationPropV1 {
  default?: JsonValue
  options?: readonly (boolean | number | string)[]
  required: boolean
  types: readonly ImplementationPropType[]
}

export interface ComponentImplementationMetadataV1 {
  componentName: string
  props: Readonly<Record<string, ComponentImplementationPropV1>>
  slots: readonly string[]
}

export interface ComponentAuthoringFieldV1 {
  control: AuthoringControl
  help?: string
  label: string
}

type ComponentPolicy = PortableComponentPolicyV2['components'][string]

export type ComponentAuthoringMetadataV1<
  Definition extends ComponentPolicy = ComponentPolicy,
> = {
  description?: string
  label: string
  props?: Partial<Record<keyof Definition['props'] & string, ComponentAuthoringFieldV1>>
  slots?: Partial<Record<Definition['slots'][number], { label: string }>>
}

export interface AuthoringRecipeV1 {
  id: string
  keywords?: readonly string[]
  label: string
  source: string
}

type ComponentMap = PortableComponentPolicyV2['components']

export type AuthoringKitSourceV1<Components extends ComponentMap = ComponentMap> = {
  authoring: {
    [Tag in keyof Components]: ComponentAuthoringMetadataV1<Components[Tag]>
  }
  implementation: { [Tag in keyof Components]: ComponentImplementationMetadataV1 }
  policy: { version: 2; components: Components }
  recipes: readonly AuthoringRecipeV1[]
  version: 1
}

export type AuthoringKitV1<Components extends ComponentMap = ComponentMap> = Readonly<
  AuthoringKitSourceV1<Components>
>

const controlTypes: Record<AuthoringControl, readonly ImplementationPropType[]> = {
  number: ['number'],
  select: ['boolean', 'number', 'string'],
  text: ['string'],
  toggle: ['boolean'],
}

function fail(message: string): never {
  throw new TypeError(`Invalid authoring kit: ${message}`)
}

function assertJsonValue(value: unknown, path: string, ancestors = new WeakSet<object>()): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain only finite numbers.`)
    return
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) fail(`${path} must not contain a cycle.`)
    ancestors.add(value)
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, ancestors))
    ancestors.delete(value)
    return
  }
  if (typeof value !== 'object') fail(`${path} must be JSON-safe.`)
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    fail(`${path} must contain only plain JSON objects.`)
  }
  if (ancestors.has(value)) fail(`${path} must not contain a cycle.`)
  ancestors.add(value)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) fail(`${path}.${key} must not be undefined.`)
    assertJsonValue(child, `${path}.${key}`, ancestors)
  }
  ancestors.delete(value)
}

function assertUnique(values: readonly string[], path: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (!value.trim()) fail(`${path} contains an empty value.`)
    if (seen.has(value)) fail(`${path} contains duplicate "${value}".`)
    seen.add(value)
  }
}

function expectedImplementationType(type: ComponentPolicy['props'][string]['types'][number]) {
  if (type === 'asset') return 'string'
  if (type === 'json') return 'object'
  return type
}

function expectedImplementationTypes(types: ComponentPolicy['props'][string]['types']) {
  return [...new Set(types.map(expectedImplementationType))]
}

function validateComponent(
  tag: string,
  policy: ComponentPolicy,
  implementation: ComponentImplementationMetadataV1,
  authoring: ComponentAuthoringMetadataV1,
): void {
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) fail(`component tag "${tag}" is not canonical kebab-case.`)
  if (!implementation.componentName.trim()) fail(`${tag}.implementation.componentName is empty.`)
  assertUnique(implementation.slots, `${tag}.implementation.slots`)
  assertUnique(policy.slots, `${tag}.policy.slots`)

  for (const [prop, definition] of Object.entries(policy.props)) {
    const implemented = implementation.props[prop]
    if (!implemented) fail(`${tag}.policy.props.${prop} is not implemented.`)
    const expected = expectedImplementationTypes(definition.types)
    if (implemented.types.length === 0) fail(`${tag}.implementation.props.${prop} has no type.`)
    if (implemented.types.every((type) => type === 'complex')) {
      fail(`${tag}.implementation.props.${prop} has an unsupported complex type.`)
    }
    const missing = expected.filter(type => !implemented.types.includes(type))
    if (missing.length > 0) {
      fail(`${tag}.policy.props.${prop} expects ${missing.join(' | ')}, not ${implemented.types.join(' | ')}.`)
    }
    const implementationOptions = implemented.options
    if (definition.allowedValues && implementationOptions) {
      if (definition.allowedValues.some(value => !implementationOptions.includes(value))) {
        fail(`${tag}.implementation.props.${prop} does not implement every allowed policy value.`)
      }
    }
  }

  for (const [prop, implemented] of Object.entries(implementation.props)) {
    if (
      implemented.required &&
      implemented.default === undefined &&
      (!policy.props[prop] || !policy.props[prop].required)
    ) {
      fail(`${tag}.implementation.props.${prop} is required but optional or unavailable in policy.`)
    }
  }

  for (const slot of policy.slots) {
    if (!implementation.slots.includes(slot)) fail(`${tag}.policy slot "${slot}" is not implemented.`)
  }

  for (const [prop, field] of Object.entries(authoring.props ?? {})) {
    if (!field) continue
    if (!(prop in policy.props)) fail(`${tag}.authoring.props.${prop} is not allowed by policy.`)
    const implemented = implementation.props[prop]
    const policyTypes = expectedImplementationTypes(policy.props[prop].types)
    if (!implemented || !policyTypes.some(type => controlTypes[field.control].includes(type))) {
      fail(`${tag}.authoring.props.${prop} uses an incompatible ${field.control} control.`)
    }
    if (field.control === 'select' && !policy.props[prop].allowedValues?.length) {
      fail(`${tag}.authoring.props.${prop} requires policy allowedValues.`)
    }
  }
  for (const slot of Object.keys(authoring.slots ?? {})) {
    if (!policy.slots.includes(slot)) fail(`${tag}.authoring slot "${slot}" is not allowed by policy.`)
  }
}

function freezeJson<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value as Record<string, unknown>).forEach(freezeJson)
  }
  return value
}

export async function createAuthoringKit<const Components extends ComponentMap>(
  source: AuthoringKitSourceV1<Components>,
): Promise<AuthoringKitV1<Components>> {
  assertJsonValue(source, 'source')
  if (source.version !== 1) fail('version must be 1.')
  try {
    assertPortableComponentPolicyV2(source.policy)
  } catch (error) {
    fail(`policy is invalid (${error instanceof Error ? error.message : 'unknown error'}).`)
  }

  const policyTags = Object.keys(source.policy.components)
  assertUnique(policyTags, 'policy.components')
  const implementationTags = Object.keys(source.implementation)
  const authoringTags = Object.keys(source.authoring)
  if (implementationTags.sort().join('\0') !== [...policyTags].sort().join('\0')) {
    fail('implementation tags must exactly match policy tags.')
  }
  if (authoringTags.sort().join('\0') !== [...policyTags].sort().join('\0')) {
    fail('authoring tags must exactly match policy tags.')
  }

  for (const tag of policyTags) {
    validateComponent(
      tag,
      source.policy.components[tag],
      source.implementation[tag],
      source.authoring[tag],
    )
  }

  assertUnique(source.recipes.map(({ id }) => id), 'recipes')
  for (const recipe of source.recipes) {
    if (!recipe.label.trim()) fail(`recipe "${recipe.id}" has an empty label.`)
    if (recipe.keywords) assertUnique(recipe.keywords, `recipe "${recipe.id}".keywords`)
    await parsePublicRecipeSource(recipe.source, source, `recipe "${recipe.id}"`)
  }

  return freezeJson(source)
}

export async function parseAuthoringSource(
  markdown: string,
  kit: AuthoringKitSourceV1,
  label = 'source',
): Promise<ParseMdcBodyResult['body']> {
  const { body } = await parseMdcBody(markdown, { autoClose: false })
  const validation = validateStoredPortableMarkdownAst(body, kit.policy)
  if (!validation.ok) {
    const issue = validation.issues[0]
    fail(`${label} is outside policy (${issue.code} at ${issue.path.join('.')}).`)
  }
  return body
}

async function parsePublicRecipeSource(
  markdown: string,
  kit: AuthoringKitSourceV1,
  label: string,
): Promise<ParseMdcBodyResult['body']> {
  const { body } = await parseMdcBody(markdown, { autoClose: false })
  const validation = validatePublicMarkdownAst(body, kit.policy)
  if (!validation.ok) {
    const issue = validation.issues[0]
    fail(`${label} is outside policy (${issue.code} at ${issue.path.join('.')}).`)
  }
  return body
}

export async function composeAuthoringKits(
  ...sources: readonly AuthoringKitSourceV1[]
): Promise<AuthoringKitV1> {
  const implementation: Record<string, ComponentImplementationMetadataV1> = {}
  const components: ComponentMap = {}
  const authoring: Record<string, ComponentAuthoringMetadataV1> = {}
  const recipes: AuthoringRecipeV1[] = []
  const recipeIds = new Set<string>()

  for (const source of sources) {
    for (const tag of Object.keys(source.policy.components)) {
      if (tag in components) fail(`component tag "${tag}" is registered more than once.`)
      components[tag] = source.policy.components[tag]
      implementation[tag] = source.implementation[tag]
      authoring[tag] = source.authoring[tag]
    }
    for (const recipe of source.recipes) {
      if (recipeIds.has(recipe.id)) fail(`recipe id "${recipe.id}" is registered more than once.`)
      recipeIds.add(recipe.id)
      recipes.push(recipe)
    }
  }

  return await createAuthoringKit({ authoring, implementation, policy: { version: 2, components }, recipes, version: 1 })
}
