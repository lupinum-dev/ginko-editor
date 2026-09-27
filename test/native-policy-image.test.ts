// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { parseMdcBody } from '@lupinum/ginko-content/cms-contract'
import { describe, expect, it, vi } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, type AuthoringKitSourceV1 } from '../src/authoring'
import { prepareMarkdownForVisualEditing } from '../src/lib/conversionPipeline'

function imageSource(): AuthoringKitSourceV1 {
  return {
    version: 1,
    policy: { version: 2, components: { image: {
      kind: 'block', slots: [], allowedParents: null, allowedChildren: [],
      media: { sourceProp: 'src', altProp: 'alt', titleProp: 'title', filenameProp: 'filename' },
      props: {
        src: { types: ['asset'], required: true, allowedValues: null },
        id: { types: ['string'], required: false, allowedValues: null },
        filename: { types: ['string'], required: false, allowedValues: null },
        alt: { types: ['string'], required: false, allowedValues: null },
        title: { types: ['string'], required: false, allowedValues: null },
        width: { types: ['string', 'number'], required: false, allowedValues: null },
        height: { types: ['string', 'number'], required: false, allowedValues: null },
      },
    } } },
    implementation: { image: { componentName: 'ContentImage', slots: [], props: {
      src: { types: ['string'], required: true },
      id: { types: ['string'], required: false },
      filename: { types: ['string'], required: false },
      alt: { types: ['string'], required: false },
      title: { types: ['string'], required: false },
      width: { types: ['string', 'number'], required: false },
      height: { types: ['string', 'number'], required: false },
    } } },
    authoring: { image: { label: 'Image', props: { alt: { control: 'text', label: 'Description' } } } }, recipes: [],
  }
}
const source = `::image
\`\`\`yaml [props]
id: stored-image
src: stored-image
filename: canopy.png
alt: Forest canopy
title: Looking up
width: 960
height: 640
\`\`\`
::`

describe('canonical policy image editing', () => {
  it('loads a native image and preserves all metadata when editing and saving', async () => {
    const kit = await createAuthoringKit(imageSource())
    const wrapper = mount(GinkoEditor, { props: { modelValue: source, authoringKit: kit, assetProvider: { buildUrl: () => '/canopy.png', parseUrl: () => null } } })
    try {
      await flushPromises()
      await vi.waitFor(() => expect(wrapper.find('.ginko-image img').exists()).toBe(true))
      expect(wrapper.get('.ginko-image img').attributes('src')).toBe('/canopy.png')
      expect(wrapper.get('.ginko-image img').attributes('alt')).toBe('Forest canopy')
      const instance = wrapper.vm.getEditor()!
      const image = instance.state.doc.firstChild!
      expect(image.type.name).toBe('image')
      instance.view.dispatch(instance.state.tr.setNodeMarkup(0, undefined, { ...image.attrs, props: { ...image.attrs.props, alt: 'Updated canopy description' } }))
      expect((await wrapper.vm.flush()).ok).toBe(true)
      const output = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
      expect(typeof output).toBe('string')
      const parsed = await parseMdcBody(String(output))
      expect(parsed.body.children[0]).toMatchObject({ tag: 'image', props: { id: 'stored-image', src: 'stored-image', filename: 'canopy.png', alt: 'Updated canopy description', title: 'Looking up', width: '960', height: '640' } })
    } finally { wrapper.unmount() }
  })

  it.each(['extra-prop', 'different-media', 'slots', 'no-id', 'mismatched-id', 'alternate-alt', 'missing-title', 'restricted-alt', 'restricted-dimension-type'])('preserves custom image identity with %s', async variant => {
    const authoring = imageSource()
    const definition = authoring.policy.components.image!
    if (variant === 'extra-prop') {
      definition.props.variant = { types: ['string'], required: false, allowedValues: null }
      authoring.implementation.image = { ...authoring.implementation.image!, props: { ...authoring.implementation.image!.props, variant: { types: ['string'], required: false } } }
    } else if (variant === 'different-media') definition.media = null
    else if (variant === 'alternate-alt') definition.media = { ...definition.media!, altProp: 'title' }
    else if (variant === 'missing-title') {
      Reflect.deleteProperty(definition.props, 'title')
      const props = { ...authoring.implementation.image!.props }
      Reflect.deleteProperty(props, 'title')
      authoring.implementation.image = { ...authoring.implementation.image!, props }
      definition.media = { ...definition.media!, titleProp: null }
    } else if (variant === 'restricted-alt') definition.props.alt!.allowedValues = ['Forest canopy']
    else if (variant === 'restricted-dimension-type') {
      definition.props.width!.types = ['string']
      authoring.implementation.image = { ...authoring.implementation.image!, props: { ...authoring.implementation.image!.props, width: { types: ['string'], required: false } } }
    }
    else if (variant !== 'no-id' && variant !== 'mismatched-id') {
      definition.slots = ['default']
      authoring.implementation.image = { ...authoring.implementation.image!, slots: ['default'] }
    }
    const kit = await createAuthoringKit(authoring)
    const input = variant === 'missing-title' ? source.replace('title: Looking up\n', '') : variant === 'no-id' ? source.replace('id: stored-image\n', '') : variant === 'mismatched-id' ? source.replace('id: stored-image\n', 'id: different-image\n') : source
    const result = await prepareMarkdownForVisualEditing(input, undefined, undefined, kit)
    expect(result.ok).toBe(true)
    expect(result.value?.content?.[0]).toMatchObject({ type: 'element', attrs: { tag: 'image' } })
  })
})
