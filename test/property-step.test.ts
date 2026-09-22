import { describe, expect, it, vi } from 'vitest'
import { Step, Transform } from '@tiptap/pm/transform'
import { createEditorSchema, SetNodePropertyStep, SetComponentVariantStep } from '../src/runtime'

const schema = createEditorSchema()
function document() {
  return schema.nodeFromJSON({ type: 'doc', content: [{
    type: 'element', attrs: { tag: 'note', props: { title: 'Old', tone: 'info' } },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this body.' }] }],
  }] })
}

describe('property steps', () => {
  it('keeps the wire registry usable when the editor module reloads', async () => {
    vi.resetModules()
    const reloaded = await import('../src/lib/property-step')
    expect(() => reloaded.registerPropertyStep()).not.toThrow()
    const step = new reloaded.SetNodePropertyStep(0, 'title', 'Reloaded')
    expect(Step.fromJSON(schema, step.toJSON()).apply(document()).doc?.firstChild?.attrs.props.title).toBe('Reloaded')
  })

  it('rebases a variant as one change and keeps concurrent properties and text', () => {
    const base = document()
    const variant = new SetComponentVariantStep(0, 'warning', { sourceName: 'warning', syntax: 'angle', block: 1 })
    const remote = new Transform(base).step(new SetNodePropertyStep(0, 'title', 'Remote title'))
      .insert(2, schema.text('Remote '))
      .insert(0, schema.nodes.paragraph!.create(null, schema.text('Before')))
    const mapped = Step.fromJSON(schema, variant.toJSON()).map(remote.mapping)!
    remote.step(mapped)
    expect(remote.doc.lastChild?.attrs.tag).toBe('warning')
    expect(remote.doc.lastChild?.attrs.props).toMatchObject({ title: 'Remote title', $: { sourceName: 'warning' } })
    expect(remote.doc.lastChild?.textContent).toBe('Remote Keep this body.')
    const undo = variant.invert(base).map(remote.mapping)!
    remote.step(undo)
    expect(remote.doc.lastChild?.attrs.tag).toBe('note')
    expect(remote.doc.lastChild?.attrs.props).toEqual({ title: 'Remote title', tone: 'info' })
  })

  it('preserves independent property edits in both server orders', () => {
    const base = document()
    const title = new SetNodePropertyStep(0, 'title', 'New')
    const tone = new SetNodePropertyStep(0, 'tone', 'warning')
    for (const [first, second] of [[title, tone], [tone, title]]) {
      const accepted = new Transform(base).step(first!)
      accepted.step(second!.map(accepted.mapping)!)
      expect(accepted.doc.firstChild?.attrs.props).toEqual({ title: 'New', tone: 'warning' })
      expect(accepted.doc.textContent).toBe(base.textContent)
      accepted.doc.check()
    }
  })

  it('maps through preceding edits and keeps remote text inside the component', () => {
    const base = document()
    const property = new SetNodePropertyStep(0, 'title', 'New')
    const remote = new Transform(base).insert(2, schema.text('Remote '))
      .insert(0, schema.nodes.paragraph!.create(null, schema.text('Before')))
    const rebased = property.map(remote.mapping)!
    remote.step(rebased)
    expect(remote.doc.lastChild?.attrs.props.title).toBe('New')
    expect(remote.doc.textContent).toBe('BeforeRemote Keep this body.')
    const removed = new Transform(base).delete(0, base.content.size)
    expect(property.map(removed.mapping)).toBeNull()
  })

  it('undoes only the local property and distinguishes null from deletion', () => {
    const base = document()
    const title = new SetNodePropertyStep(0, 'title', null)
    const changed = new Transform(base).step(title).step(new SetNodePropertyStep(0, 'tone', 'warning'))
    expect(changed.doc.firstChild?.attrs.props.title).toBeNull()
    changed.step(title.invert(base))
    expect(changed.doc.firstChild?.attrs.props).toEqual({ title: 'Old', tone: 'warning' })
    const remove = new SetNodePropertyStep(0, 'title', undefined)
    const wire = Step.fromJSON(schema, JSON.parse(JSON.stringify(remove.toJSON())))
    const removed = wire.apply(changed.doc).doc!
    expect(Object.hasOwn(removed.firstChild!.attrs.props, 'title')).toBe(false)
    expect(remove.invert(changed.doc).apply(removed).doc?.eq(changed.doc)).toBe(true)
  })

  it('uses accepted order for the same property and preserves it when steps merge', () => {
    const first = new SetNodePropertyStep(0, 'title', 'First')
    const last = new SetNodePropertyStep(0, 'title', 'Last')
    expect(first.merge(last)?.apply(document()).doc?.firstChild?.attrs.props.title).toBe('Last')
    expect(first.merge(new SetNodePropertyStep(0, 'tone', 'warning'))).toBeNull()
  })

  it('round-trips structured values without retaining a mutable input reference', () => {
    const value = { items: [1, 'two', null], enabled: false }
    const step = new SetNodePropertyStep(0, 'options', value)
    value.items.push(3)
    const copy = Step.fromJSON(schema, JSON.parse(JSON.stringify(step.toJSON())))
    expect(copy.apply(document()).doc?.firstChild?.attrs.props.options).toEqual({ items: [1, 'two', null], enabled: false })
  })

  it('rejects malformed wire steps and refuses nodes without properties', () => {
    for (const json of [
      { pos: -1, key: 'title', value: '' },
      { pos: 0.5, key: 'title', value: '' },
      { pos: 0, key: '__proto__', value: {} },
      { pos: 0, key: 'title' },
      { pos: 0, key: 'title', remove: false },
      { pos: 0, key: 'title', remove: true, value: null },
      { pos: 0, key: 'title', value: Infinity },
    ]) expect(() => SetNodePropertyStep.fromJSON(schema, json)).toThrow(RangeError)
    expect(new SetNodePropertyStep(1, 'title', '').apply(document()).failed).toBeTruthy()
    expect(new SetNodePropertyStep(1000, 'title', '').apply(document()).failed).toBeTruthy()
  })
})
