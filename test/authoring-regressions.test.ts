// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GinkoEditor from '../src/GinkoEditor.vue'
import { createAuthoringKit, parseAuthoringSource, type AuthoringKitSourceV1 } from '../src/authoring'
import { prepareMarkdownForVisualEditing } from '../src/lib/conversionPipeline'

function kitSource(): AuthoringKitSourceV1 {
  return {
    version: 1,
    policy: {
      version: 2,
      components: {
        note: {
          kind: 'block',
          media: null,
          props: {
            title: {
              required: false,
              types: ['string'],
              allowedValues: ['one', 'two'],
            },
          },
          slots: ['default'],
          allowedParents: null,
          allowedChildren: null,
        },
      },
    },
    implementation: {
      note: {
        componentName: 'Note',
        props: {
          title: {
            required: false,
            types: ['string'],
            options: ['one', 'two'],
          },
        },
        slots: ['default'],
      },
    },
    authoring: {
      note: {
        label: 'Note',
        props: {
          title: { control: 'select', label: 'Title' },
        },
      },
    },
    recipes: [],
  }
}

describe('incoming reviewer Step 4 probes', () => {
  it('does not accept an optional policy for a required implementation prop without a default', async () => {
    const source = kitSource()
    source.implementation.note = {
      ...source.implementation.note,
      props: {
        title: { required: true, types: ['string'], options: ['one', 'two'] },
      },
    }
    source.recipes=[{id:'missing',label:'Missing',source:'<note>\nText\n</note>'}]
    await expect(createAuthoringKit(source)).rejects.toThrow()
  })
  it('preserves the object branch of an implementation union allowed by policy', async () => {
    const source = kitSource()
    source.policy.components.note.props.title = {
      required: false,
      types: ['string', 'json'],
      allowedValues: null,
    }
    source.implementation.note = {
      ...source.implementation.note,
      props: {
        title: { required: false, types: ['string', 'object'], options: ['one', 'two'] },
      },
    }
    source.authoring.note.props={}
    const kit=await createAuthoringKit(source)
    await expect(parseAuthoringSource('<note :title=\'{"value":"one"}\'>\nText\n</note>',kit)).resolves.toBeDefined()
  })
  it('allows policy literals to narrow an open implementation string', async () => {
    const source = kitSource()
    source.implementation.note = {
      ...source.implementation.note,
      props: { title: { required: false, types: ['string'] } },
    }
    const kit = await createAuthoringKit(source)
    await expect(parseAuthoringSource('<note title="one">\nText\n</note>', kit)).resolves.toBeDefined()
    await expect(parseAuthoringSource('<note title="three">\nText\n</note>', kit)).rejects.toThrow('outside policy')
  })
  it('uses the same enum constraints for visual preparation as for canonical preview', async () => {
    const kit=await createAuthoringKit(kitSource())
    const source='<note title="three">\nText\n</note>'
    await expect(parseAuthoringSource(source,kit)).rejects.toThrow('outside policy')
    expect((await prepareMarkdownForVisualEditing(source,undefined,undefined,kit)).ok).toBe(false)
  })
  it('applies component options to colon syntax as well as angle syntax', async () => {
    const kit = await createAuthoringKit(kitSource())
    await expect(parseAuthoringSource('::note{title="three"}\nText\n::', kit)).rejects.toThrow('outside policy')
    await expect(parseAuthoringSource('<note title="three">\nText\n</note>', kit)).rejects.toThrow('outside policy')
  })
  it('does not apply component authoring rules to explicitly native HTML', async () => {
    const source: AuthoringKitSourceV1 = {
      version: 1,
      policy: {
        version: 2,
        components: {
          div: {
            kind: 'block',
            media: null,
            props: {},
            slots: ['default'],
            allowedParents: ['div'],
            allowedChildren: null,
          },
        },
      },
      implementation: {
        div: { componentName: 'CustomDiv', props: {}, slots: ['default'] },
      },
      authoring: { div: { label: 'Custom div' } },
      recipes: [],
    }
    const kit=await createAuthoringKit(source)
    await expect(parseAuthoringSource('<div>Native HTML</div>',kit)).resolves.toBeDefined()
    await expect(parseAuthoringSource('::div\nComponent\n::',kit)).rejects.toThrow('invalid_nesting')
  })
  it('applies nesting rules to unmarked colon components', async () => {
    const source: AuthoringKitSourceV1 = {
      version: 1,
      policy: {
        version: 2,
        components: {
          panel: {
            kind: 'block',
            media: null,
            props: {},
            slots: ['default'],
            allowedParents: null,
            allowedChildren: ['note'],
          },
          note: {
            kind: 'block',
            media: null,
            props: {},
            slots: ['default'],
            allowedParents: ['panel'],
            allowedChildren: null,
          },
        },
      },
      implementation: {
        panel: { componentName: 'Panel', props: {}, slots: ['default'] },
        note: { componentName: 'Note', props: {}, slots: ['default'] },
      },
      authoring: {
        panel: { label: 'Panel' },
        note: { label: 'Note' },
      },
      recipes: [],
    }
    const kit = await createAuthoringKit(source)
    await expect(parseAuthoringSource('::panel\n:::note\nNested\n:::\n::', kit)).resolves.toBeDefined()
    await expect(parseAuthoringSource('::note\nTop level\n::', kit)).rejects.toThrow('invalid_nesting')
  })
  it('does not discard a pending visual edit when kit identity changes', async () => {
    const kit = await createAuthoringKit(kitSource())
    const equivalent = await createAuthoringKit(kitSource())
    const wrapper = mount(GinkoEditor, {
      props: {
        modelValue: 'Original\n',
        authoringKit: kit,
        syncDebounceMs: 10000,
      },
    })
    try {
      await flushPromises()
      wrapper.vm.editor!.commands.insertContent('Pending ')
      expect(wrapper.vm.editor!.getText()).toContain('Pending')
      await wrapper.setProps({authoringKit:equivalent})
      await flushPromises()
      await wrapper.vm.flush()
      expect(wrapper.vm.editor!.getText()).toContain('Pending')
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('Pending')
    } finally { wrapper.unmount() }
  })
})
