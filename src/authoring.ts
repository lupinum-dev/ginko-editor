import {
  assertPortableComponentPolicyV2,
  parseMdcBody,
  validatePublicMarkdownAst,
  validateStoredPortableMarkdownAst,
  type ParseMdcBodyResult,
  type PortableComponentPolicyV2,
} from '@lupinum/ginko-content/cms-contract'

import { ginkoLayoutKitSource } from './layout-kit'
import type { JsonValue } from './types'

export { ginkoLayoutKitSource, ginkoLayoutComponentNames, ginkoLayoutComponentPolicy } from './layout-kit'

export type AuthoringControl = 'json' | 'number' | 'select' | 'text' | 'toggle'
export type ImplementationPropType = 'boolean' | 'complex' | 'number' | 'object' | 'string'

export interface ComponentImplementationProp {
  default?: JsonValue
  options?: readonly (boolean | number | string)[]
  required: boolean
  types: readonly ImplementationPropType[]
}

export interface ComponentImplementationMetadata {
  componentName: string
  props: Readonly<Record<string, ComponentImplementationProp>>
  slots: readonly string[]
}

export interface ComponentAuthoringField {
  control: AuthoringControl
  help?: string
  label: string
}

type ComponentPolicy = PortableComponentPolicyV2['components'][string]

/** How the canvas shows the repeated children of a container component. */
export type ComponentItemsPresentation = 'accordion' | 'grid' | 'stack' | 'steps' | 'tabs' | 'timeline'

/**
 * Repeated children of a container component. Set exactly one of `childTag`
 * or `childNode`. The canvas adds, removes, renames, and selects items with
 * normal document steps. The selected tab and collapsed items are view state.
 */
export interface ComponentCanvasItems {
  /** Each item is a component with this tag. */
  childTag?: string
  /**
   * Each item is a built-in node. `codeBlock` items are code blocks.
   * `heading` items start at a heading with the template's heading level.
   */
  childNode?: 'codeBlock' | 'heading'
  presentation: ComponentItemsPresentation
  /** A text property of the child component that names each item. */
  labelProp?: string
  /** A property of this component that sets the number of grid columns. */
  columnsProp?: string
  /** The label of the add control, for example "Add tab". */
  addLabel?: string
  /** MDC source for one new item. */
  template: string
}

export type ComponentAuthoringMetadata<
  Definition extends ComponentPolicy = ComponentPolicy,
> = {
  /** Canvas interactions reference the same properties as the content policy. */
  canvas?: {
    switchGroup?: string
    tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'idea'
    titleProp?: keyof Definition['props'] & string
    columns?: {
      childTag: string
      sizeProp: string
      presets: readonly { label: string; values: readonly [string, string]; ratio: number }[]
    }
    items?: ComponentCanvasItems
  }
  description?: string
  label: string
  props?: Partial<Record<keyof Definition['props'] & string, ComponentAuthoringField>>
  slots?: Partial<Record<Definition['slots'][number], { label: string }>>
}

export interface AuthoringRecipe {
  /** Short explanation shown while choosing a block. */
  description?: string
  /**
   * The menu group. Built-in groups are `text`, `lists`, `media`, `layout`,
   * `callouts`, and `advanced`. Other values show as their own group heading.
   */
  group?: string
  /** A Lucide icon name in kebab-case, for example `panel-top`. */
  icon?: string
  id: string
  keywords?: readonly string[]
  label: string
  source: string
}

type ComponentMap = PortableComponentPolicyV2['components']

export type AuthoringKitSource<Components extends ComponentMap = ComponentMap> = {
  authoring: {
    [Tag in keyof Components]: ComponentAuthoringMetadata<Components[Tag]>
  }
  implementation: { [Tag in keyof Components]: ComponentImplementationMetadata }
  policy: { version: 2; components: Components }
  recipes: readonly AuthoringRecipe[]
  version: 1
}

export type AuthoringKit<Components extends ComponentMap = ComponentMap> = Readonly<
  AuthoringKitSource<Components>
>

/** @deprecated Use `ComponentImplementationProp`. */
export type ComponentImplementationPropV1 = ComponentImplementationProp
/** @deprecated Use `ComponentImplementationMetadata`. */
export type ComponentImplementationMetadataV1 = ComponentImplementationMetadata
/** @deprecated Use `ComponentAuthoringField`. */
export type ComponentAuthoringFieldV1 = ComponentAuthoringField
/** @deprecated Use `ComponentAuthoringMetadata`. */
export type ComponentAuthoringMetadataV1<
  Definition extends ComponentPolicy = ComponentPolicy,
> = ComponentAuthoringMetadata<Definition>
/** @deprecated Use `AuthoringRecipe`. */
export type AuthoringRecipeV1 = AuthoringRecipe
/** @deprecated Use `AuthoringKitSource`. */
export type AuthoringKitSourceV1<Components extends ComponentMap = ComponentMap> = AuthoringKitSource<Components>
/** @deprecated Use `AuthoringKit`. */
export type AuthoringKitV1<Components extends ComponentMap = ComponentMap> = AuthoringKit<Components>

const controlTypes: Record<AuthoringControl, readonly ImplementationPropType[]> = {
  json: ['boolean', 'number', 'object', 'string'],
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
  implementation: ComponentImplementationMetadata,
  authoring: ComponentAuthoringMetadata,
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
    // A policy `json` value is free-form data. The component must accept at
    // least one of its value types and normalize the others itself.
    const missing = definition.types.includes('json')
      ? expected.some(type => implemented.types.includes(type)) ? [] : expected
      : expected.filter(type => !implemented.types.includes(type))
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
    if (field.control === 'json' && !policy.props[prop].types.includes('json')) {
      fail(`${tag}.authoring.props.${prop} uses a json control without a policy json type.`)
    }
  }
  if (authoring.canvas?.switchGroup !== undefined && !authoring.canvas.switchGroup.trim()) {
    fail(`${tag}.canvas.switchGroup must not be empty.`)
  }
  if (
    authoring.canvas?.tone
    && !['neutral', 'info', 'warning', 'danger', 'success', 'idea'].includes(authoring.canvas.tone)
  ) {
    fail(`${tag}.canvas.tone is unsupported.`)
  }
  const titleProp = authoring.canvas?.titleProp
  if (
    titleProp
    && (!policy.props[titleProp]?.types.includes('string') || authoring.props?.[titleProp]?.control !== 'text')
  ) {
    fail(`${tag}.canvas.titleProp must reference an authored text property.`)
  }
  for (const slot of Object.keys(authoring.slots ?? {})) {
    if (!policy.slots.includes(slot)) fail(`${tag}.authoring slot "${slot}" is not allowed by policy.`)
  }
}

const itemPresentations: readonly ComponentItemsPresentation[] = [
  'accordion', 'grid', 'stack', 'steps', 'tabs', 'timeline',
]

function validateItems(tag: string, source: AuthoringKitSource) {
  const items = (source.authoring[tag] as ComponentAuthoringMetadata).canvas?.items
  if (!items) return
  const path = `${tag}.canvas.items`
  const parent = source.policy.components[tag]
  if (parent.kind !== 'block' || !parent.slots.includes('default')) {
    fail(`${path} requires a block component with a default slot.`)
  }
  if (!itemPresentations.includes(items.presentation)) fail(`${path}.presentation is unsupported.`)
  if ((items.childTag === undefined) === (items.childNode === undefined)) {
    fail(`${path} must set exactly one of childTag or childNode.`)
  }
  if (items.childNode !== undefined && !['codeBlock', 'heading'].includes(items.childNode)) {
    fail(`${path}.childNode is unsupported.`)
  }
  if (items.childTag !== undefined) {
    const child = source.policy.components[items.childTag]
    if (!child || child.kind !== 'block') fail(`${path}.childTag must reference a block component.`)
    if (
      (parent.allowedChildren && !parent.allowedChildren.includes(items.childTag))
      || (child.allowedParents && !child.allowedParents.includes(tag))
    ) {
      fail(`${path} must respect parent and child placement policy.`)
    }
    if (items.labelProp !== undefined && !child.props[items.labelProp]?.types.includes('string')) {
      fail(`${path}.labelProp must be a declared text property of "${items.childTag}".`)
    }
  } else if (items.labelProp !== undefined) {
    fail(`${path}.labelProp requires childTag.`)
  }
  if (items.columnsProp !== undefined) {
    const types = parent.props[items.columnsProp]?.types
    if (!types?.some(type => type === 'string' || type === 'number')) {
      fail(`${path}.columnsProp must be a declared text or number property of "${tag}".`)
    }
  }
  if (items.addLabel !== undefined && !items.addLabel.trim()) fail(`${path}.addLabel must not be empty.`)
  if (typeof items.template !== 'string' || !items.template.trim()) fail(`${path}.template must not be empty.`)
}

type ParsedNode = { type?: string; tag?: string; props?: Record<string, unknown>; children?: ParsedNode[] }

async function validateItemTemplate(tag: string, items: ComponentCanvasItems, source: AuthoringKitSource) {
  const path = `${tag}.canvas.items.template`
  const { body } = await parseMdcBody(items.template, { autoClose: false })
  const nodes = ((body as ParsedNode).children ?? []).filter(node => node.type === 'element')
  const isNative = (node: ParsedNode) => (node.props?.$ as { html?: number } | undefined)?.html === 1
  const level = (node: ParsedNode | undefined) => /^h([1-6])$/.exec(node?.tag ?? '')?.[1]
  if (items.childTag !== undefined) {
    if (nodes.length !== 1 || nodes[0].tag !== items.childTag || isNative(nodes[0])) {
      fail(`${path} must contain exactly one "${items.childTag}" component.`)
    }
  } else if (items.childNode === 'codeBlock') {
    if (nodes.length !== 1 || nodes[0].tag !== 'pre') fail(`${path} must contain exactly one code block.`)
  } else {
    const first = Number(level(nodes[0]))
    if (!first || nodes.slice(1).some(node => Number(level(node) ?? 7) <= first)) {
      fail(`${path} must start with the only heading of its level.`)
    }
  }
  // Placement inside the container is checked above. Check the item content alone.
  const components = { ...source.policy.components }
  if (items.childTag) components[items.childTag] = { ...components[items.childTag], allowedParents: null }
  const validation = validatePublicMarkdownAst(body, { version: 2, components })
  if (!validation.ok) {
    const issue = validation.issues[0]
    fail(`${path} is outside policy (${issue.code} at ${issue.path.join('.')}).`)
  }
}

function freezeJson<T>(value: T): T {
  if (value && typeof value === 'object') {
    if (!Object.isFrozen(value)) Object.freeze(value)
    Object.values(value as Record<string, unknown>).forEach(freezeJson)
  }
  return value
}

export async function createAuthoringKit<const Components extends ComponentMap>(
  source: AuthoringKitSource<Components>,
): Promise<AuthoringKit<Components>> {
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

  for (const tag of policyTags) {
    const metadata: ComponentAuthoringMetadata = source.authoring[tag]
    const columns = metadata.canvas?.columns
    if (!columns) continue
    const child = source.policy.components[columns.childTag]
    const allowed = child?.props[columns.sizeProp]?.allowedValues
    if (
      source.policy.components[tag].kind !== 'block'
      || child?.kind !== 'block'
      || !allowed?.length
      || columns.presets.length < 2
    ) {
      fail(`${tag}.canvas.columns must reference a block child with discrete sizes and at least two presets.`)
    }
    const parent = source.policy.components[tag]
    if (
      (parent.allowedChildren && !parent.allowedChildren.includes(columns.childTag))
      || (child.allowedParents && !child.allowedParents.includes(tag))
    ) {
      fail(`${tag}.canvas.columns must respect parent and child placement policy.`)
    }
    let lastRatio = 0
    const pairs = new Set<string>()
    for (const preset of columns.presets) {
      if (
        !Number.isFinite(preset.ratio)
        || pairs.has(JSON.stringify(preset.values))
        || !preset.label.trim()
        || preset.values.length !== 2
        || preset.values.some(value => !allowed.includes(value))
        || preset.ratio <= lastRatio
        || preset.ratio >= 1
      ) {
        fail(`${tag}.canvas.columns presets must use allowed size pairs and increasing ratios between zero and one.`)
      }
      pairs.add(JSON.stringify(preset.values))
      lastRatio = preset.ratio
    }
  }

  for (const tag of policyTags) validateItems(tag, source)

  assertUnique(source.recipes.map(({ id }) => id), 'recipes')
  // Validation crosses an async parser boundary. Consume the input now so
  // callers cannot change the contract while its recipes are being checked.
  freezeJson(source)
  for (const tag of policyTags) {
    const items = (source.authoring[tag] as ComponentAuthoringMetadata).canvas?.items
    if (items) await validateItemTemplate(tag, items, source)
  }
  for (const recipe of source.recipes) {
    if (!recipe.label.trim()) fail(`recipe "${recipe.id}" has an empty label.`)
    if (recipe.keywords) assertUnique(recipe.keywords, `recipe "${recipe.id}".keywords`)
    if (recipe.group !== undefined && (!recipe.group.trim() || recipe.group.length > 40)) {
      fail(`recipe "${recipe.id}".group must be a short, non-empty name.`)
    }
    if (recipe.icon !== undefined && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(recipe.icon)) {
      fail(`recipe "${recipe.id}".icon must be a kebab-case Lucide icon name.`)
    }
    await parsePublicRecipeSource(recipe.source, source, `recipe "${recipe.id}"`)
  }

  return freezeJson(source)
}

export async function parseAuthoringSource(
  markdown: string,
  kit: AuthoringKitSource,
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
  kit: AuthoringKitSource,
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
  ...sources: readonly AuthoringKitSource[]
): Promise<AuthoringKit> {
  const implementation: Record<string, ComponentImplementationMetadata> = {}
  const components: ComponentMap = {}
  const authoring: Record<string, ComponentAuthoringMetadata> = {}
  const recipes: AuthoringRecipe[] = []
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

  return await createAuthoringKit({
    authoring,
    implementation,
    policy: { version: 2, components },
    recipes,
    version: 1,
  })
}

/** Create the built-in layout kit alone. Compose its source to add host components. */
export async function createGinkoLayoutKit(): Promise<AuthoringKit<typeof ginkoLayoutKitSource.policy.components>> {
  return await createAuthoringKit(ginkoLayoutKitSource)
}
