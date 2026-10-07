import { Fragment, Slice, type Node, type Schema } from '@tiptap/pm/model'
import { Step, StepMap, StepResult, type Mappable } from '@tiptap/pm/transform'
import type { JsonRecord, JsonValue } from '../types'

const stepType = 'ginkoSetNodePropertyV1'
const variantStepType = 'ginkoSetComponentVariantV1'
const propertyNodes = new Set(['element', 'inline-element', 'image', 'file', 'video'])
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor'])
const registration = Symbol.for('@lupinum/ginko-editor/property-steps/v1')
const attributeStepType = 'ginkoSetNodeAttributeV1'
const attributeRegistration = Symbol.for('@lupinum/ginko-editor/attribute-step/v1')

function cloneValue(value: unknown, depth = 0): JsonValue {
  if (depth > 32) throw new RangeError('Property value is too deeply nested.')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(item => cloneValue(item, depth + 1))
  if (value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry, depth + 1)]))
  }
  throw new RangeError('Property value must be JSON data.')
}

/** Change one property while keeping other properties from the current document.
 * Whole props-object replacement loses independent edits when steps are rebased.
 */
export class SetNodePropertyStep extends Step {
  readonly value: JsonValue | undefined

  constructor(readonly pos: number, readonly key: string, value: JsonValue | undefined) {
    super()
    if (!Number.isSafeInteger(pos) || pos < 0 || !key || forbiddenKeys.has(key)) {
      throw new RangeError('Invalid property step position or key.')
    }
    this.value = value === undefined ? undefined : cloneValue(value)
  }

  apply(doc: Node) {
    if (this.pos >= doc.content.size) return StepResult.fail('Property position is outside the document.')
    const node = doc.nodeAt(this.pos)
    if (!node || !propertyNodes.has(node.type.name)) return StepResult.fail('No property node at this position.')
    const props: JsonRecord = { ...node.attrs.props }
    if (this.value === undefined) delete props[this.key]
    else props[this.key] = this.value
    const updated = node.type.create({ ...node.attrs, props }, null, node.marks)
    return StepResult.fromReplace(doc, this.pos, this.pos + 1,
      new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1))
  }

  getMap() { return StepMap.empty }

  invert(doc: Node) {
    const node = doc.nodeAt(this.pos)
    if (!node || !propertyNodes.has(node.type.name)) throw new RangeError('No property node to invert.')
    return new SetNodePropertyStep(this.pos, this.key, node.attrs.props?.[this.key])
  }

  map(mapping: Mappable) {
    const pos = mapping.mapResult(this.pos, 1)
    // An insertion immediately before the node sets deletedAfter too. Its
    // associated position survives; only discard an actually deleted target.
    return pos.deleted ? null : new SetNodePropertyStep(pos.pos, this.key, this.value)
  }

  merge(other: Step) {
    return other instanceof SetNodePropertyStep && other.pos === this.pos && other.key === this.key
      ? new SetNodePropertyStep(this.pos, this.key, other.value)
      : null
  }

  toJSON() {
    return { stepType, pos: this.pos, key: this.key,
      ...(this.value === undefined ? { remove: true } : { value: this.value }) }
  }

  static fromJSON(_schema: Schema, json: unknown) {
    if (!json || typeof json !== 'object' || !('pos' in json) || !('key' in json)
      || typeof json.pos !== 'number' || typeof json.key !== 'string') {
      throw new RangeError('Invalid property step.')
    }
    if ('remove' in json) {
      if (json.remove !== true || 'value' in json) throw new RangeError('Invalid property removal.')
      return new SetNodePropertyStep(json.pos, json.key, undefined)
    }
    if (!('value' in json)) throw new RangeError('Property step needs a value.')
    return new SetNodePropertyStep(json.pos, json.key, cloneValue(json.value))
  }
}

/** Tag and parser source metadata are one change, including when rebased. */
export class SetComponentVariantStep extends Step {
  readonly syntax: JsonValue | undefined
  constructor(readonly pos: number, readonly tag: string, syntax: JsonValue | undefined) {
    super()
    if (!Number.isSafeInteger(pos) || pos < 0 || !/^[a-z][a-z0-9-]*$/.test(tag)) {
      throw new RangeError('Invalid component variant step.')
    }
    this.syntax = syntax === undefined ? undefined : cloneValue(syntax)
  }
  apply(doc: Node) {
    if (this.pos >= doc.content.size) return StepResult.fail('Variant position is outside the document.')
    const node = doc.nodeAt(this.pos)
    if (node?.type.name !== 'element') return StepResult.fail('No component at this position.')
    const props: JsonRecord = { ...node.attrs.props }
    if (this.syntax === undefined) delete props.$
    else props.$ = this.syntax
    const updated = node.type.create({ ...node.attrs, tag: this.tag, props }, null, node.marks)
    return StepResult.fromReplace(doc, this.pos, this.pos + 1, new Slice(Fragment.from(updated), 0, 1))
  }
  getMap() { return StepMap.empty }
  invert(doc: Node) {
    const node = doc.nodeAt(this.pos)
    if (node?.type.name !== 'element') throw new RangeError('No component to invert.')
    return new SetComponentVariantStep(this.pos, node.attrs.tag, node.attrs.props?.$)
  }
  map(mapping: Mappable) {
    const pos = mapping.mapResult(this.pos, 1)
    return pos.deleted ? null : new SetComponentVariantStep(pos.pos, this.tag, this.syntax)
  }
  /** A later variant choice for the same component replaces the earlier one. */
  merge(other: Step) {
    return other instanceof SetComponentVariantStep && other.pos === this.pos
      ? new SetComponentVariantStep(this.pos, other.tag, other.syntax) : null
  }
  toJSON() {
    return { stepType: variantStepType, pos: this.pos, tag: this.tag,
      ...(this.syntax === undefined ? { removeSyntax: true } : { syntax: this.syntax }) }
  }
  static fromJSON(_schema: Schema, json: unknown) {
    if (!json || typeof json !== 'object' || !('pos' in json) || !('tag' in json)
      || typeof json.pos !== 'number' || typeof json.tag !== 'string') throw new RangeError('Invalid variant step.')
    if ('removeSyntax' in json) {
      if (json.removeSyntax !== true || 'syntax' in json) throw new RangeError('Invalid variant syntax removal.')
      return new SetComponentVariantStep(json.pos, json.tag, undefined)
    }
    if (!('syntax' in json)) throw new RangeError('Variant step needs source syntax.')
    return new SetComponentVariantStep(json.pos, json.tag, cloneValue(json.syntax))
  }
}

/** Native AttrStep drops edits after insertion immediately before the node.
 * This field step uses the same surviving-position rule as property changes.
 */
export class SetNodeAttributeStep extends Step {
  readonly value: JsonValue
  constructor(readonly pos: number, readonly key: string, value: JsonValue) {
    super()
    if (!Number.isSafeInteger(pos) || pos < 0 || !key || key === 'props' || forbiddenKeys.has(key)) {
      throw new RangeError('Invalid node attribute step.')
    }
    this.value = cloneValue(value)
  }
  apply(doc: Node) {
    if (this.pos >= doc.content.size) return StepResult.fail('Attribute position is outside the document.')
    const node = doc.nodeAt(this.pos)
    if (!node || node.isText || !Object.hasOwn(node.type.spec.attrs ?? {}, this.key)) return StepResult.fail('Unknown node attribute.')
    const updated = node.type.create({ ...node.attrs, [this.key]: this.value }, null, node.marks)
    return StepResult.fromReplace(doc, this.pos, this.pos + 1, new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1))
  }
  getMap() { return StepMap.empty }
  invert(doc: Node) {
    const node = doc.nodeAt(this.pos)
    if (!node || !Object.hasOwn(node.attrs, this.key)) throw new RangeError('No node attribute to invert.')
    return new SetNodeAttributeStep(this.pos, this.key, node.attrs[this.key])
  }
  map(mapping: Mappable) {
    const pos = mapping.mapResult(this.pos, 1)
    return pos.deleted ? null : new SetNodeAttributeStep(pos.pos, this.key, this.value)
  }
  merge(other: Step) {
    return other instanceof SetNodeAttributeStep && other.pos === this.pos && other.key === this.key
      ? new SetNodeAttributeStep(this.pos, this.key, other.value) : null
  }
  toJSON() { return { stepType: attributeStepType, pos: this.pos, key: this.key, value: this.value } }
  static fromJSON(_schema: Schema, json: unknown) {
    if (!json || typeof json !== 'object' || !('pos' in json) || !('key' in json) || !('value' in json)
      || typeof json.pos !== 'number' || typeof json.key !== 'string') throw new RangeError('Invalid node attribute step.')
    return new SetNodeAttributeStep(json.pos, json.key, cloneValue(json.value))
  }
}

/** Both browser and backend schema creation install the same wire step. */
export function registerPropertyStep() {
  // The registry belongs to ProseMirror, which can outlive a reloaded editor
  // module in Nuxt development. Wire changes require a new versioned ID.
  if (Reflect.get(Step, registration) !== true) {
    Step.jsonID(stepType, SetNodePropertyStep)
    Step.jsonID(variantStepType, SetComponentVariantStep)
    Object.defineProperty(Step, registration, { value: true })
  }
  if (Reflect.get(Step, attributeRegistration) !== true) {
    Step.jsonID(attributeStepType, SetNodeAttributeStep)
    Object.defineProperty(Step, attributeRegistration, { value: true })
  }
}
