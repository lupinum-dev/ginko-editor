import type { AuthoringKitSource } from '../src/authoring'

const policy = {
  version: 2,
  components: {
    note: {
      kind: 'block',
      media: null,
      props: { title: { required: false, types: ['string'], allowedValues: null } },
      slots: ['default'] as ['default'],
      allowedParents: null,
      allowedChildren: null,
    },
  },
} as const

export const inferredAuthoringKeys = {
  version: 1,
  implementation: {
    note: {
      componentName: 'Note',
      props: { title: { required: false, types: ['string'] } },
      slots: ['default'],
    },
  },
  policy,
  authoring: {
    note: {
      label: 'Note',
      props: {
        title: { control: 'text', label: 'Title' },
        // @ts-expect-error Authoring property keys come from the Content policy.
        unknown: { control: 'text', label: 'Unknown' },
      },
    },
  },
  recipes: [],
} as const satisfies AuthoringKitSource<typeof policy.components>
