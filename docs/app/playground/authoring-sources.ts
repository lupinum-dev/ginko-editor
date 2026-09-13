import type { AuthoringKitSourceV1 } from '@lupinum/ginko-editor/authoring'

export const learningObjectiveSource = {
  version: 1,
  implementation: {
    'learning-objective': {
      componentName: 'LearningObjective',
      props: {
        assessed: { default: false, required: false, types: ['boolean'] },
        title: { required: true, types: ['string'] },
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
          title: { required: true, types: ['string'], allowedValues: null },
        },
        slots: ['default', 'tip'],
        allowedParents: null,
        allowedChildren: null,
      },
    },
  },
  authoring: {
    'learning-objective': {
      label: 'Learning objective',
      canvas: { titleProp: 'title' },
      description: 'A host-owned objective with an optional teaching tip.',
      props: {
        assessed: { control: 'toggle', label: 'Assessed' },
        title: { control: 'text', label: 'Title' },
      },
      slots: { default: { label: 'Objective' }, tip: { label: 'Teaching tip' } },
    },
  },
  recipes: [{
    id: 'learning-objective',
    label: 'Learning objective',
    source:
      '<learning-objective title="Understand the contract" assessed>\nExplain the outcome in plain language.\n\n<template #tip>\nKeep the example concrete.\n</template>\n</learning-objective>',
  }],
} as const satisfies AuthoringKitSourceV1

export const hostNoteSource = {
  version: 1,
  implementation: {
    'host-note': { componentName: 'HostNote', props: {}, slots: ['default'] },
  },
  policy: {
    version: 2,
    components: {
      'host-note': { kind: 'block', media: null, props: {}, slots: ['default'], allowedParents: null, allowedChildren: null },
    },
  },
  authoring: {
    'host-note': { label: 'Host note', description: 'Available only in the isolated editor.' },
  },
  recipes: [{
    id: 'host-note',
    label: 'Host note',
    source: '<host-note>\nThis component belongs only to the second kit.\n</host-note>',
  }],
} as const satisfies AuthoringKitSourceV1

export const hostComponentSources = [learningObjectiveSource, hostNoteSource] as const
