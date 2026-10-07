/**
 * The default layout kit. Its component vocabulary is the Ginko Docs component
 * policy, so a document written with this kit renders on a Ginko Docs site.
 *
 * This module has no Vue or browser dependencies.
 */
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'

import type {
  AuthoringKitSource,
  AuthoringRecipe,
  ComponentAuthoringMetadata,
  ComponentImplementationMetadata,
  ComponentImplementationProp,
} from './authoring'

type ComponentDefinition = PortableComponentPolicyV2['components'][string]
type ComponentProps = ComponentDefinition['props']
type ValueType = 'string' | 'number' | 'boolean' | 'json' | 'asset'

// The policy helpers match the Ginko Docs policy source. Keep the output identical.
const valueTypes = (type: ValueType) =>
  type === 'json' ? (['string', 'number', 'boolean', 'json'] as const) : ([type] as const)
const optional = (type: ValueType) => ({ types: valueTypes(type), required: false, allowedValues: null })
const required = (type: ValueType) => ({ types: valueTypes(type), required: true, allowedValues: null })
const choice = <const Values extends readonly [string, ...string[]]>(...allowedValues: Values) => ({
  types: ['string'] as const,
  required: false,
  allowedValues: [...allowedValues],
})
const block = (
  props: ComponentProps = {},
  slots: string[] = ['default'],
  media: ComponentDefinition['media'] = null,
  nesting: Pick<ComponentDefinition, 'allowedParents' | 'allowedChildren'> = {
    allowedParents: null,
    allowedChildren: null,
  },
): ComponentDefinition => ({ kind: 'block', props, slots, media, ...nesting })
const inline = (props: ComponentProps = {}): ComponentDefinition => ({
  kind: 'inline',
  props,
  slots: ['default'],
  allowedParents: null,
  allowedChildren: null,
  media: null,
})

const appearance = { appearance: optional('string') }
const notice = block({ title: optional('string'), icon: optional('string'), ...appearance })

/** The Ginko Docs component policy (version 2). */
export const ginkoLayoutComponentPolicy = {
  components: {
    accordion: block({
      ...appearance,
      type: optional('string'),
      collapsible: optional('boolean'),
      defaultValue: optional('json'),
    }),
    'accordion-item': block(
      {
        value: optional('string'),
        title: optional('string'),
        content: optional('string'),
      },
      ['default', 'title', 'content'],
    ),
    api: block({
      ...appearance,
      title: optional('string'),
      icon: optional('string'),
      method: optional('string'),
      path: optional('string'),
      groups: optional('json'),
    }),
    aside: block({ label: optional('string'), ...appearance }),
    card: block(
      {
        title: optional('string'),
        description: optional('string'),
        footer: optional('string'),
        to: optional('string'),
        target: optional('string'),
        icon: optional('string'),
        iconColor: optional('string'),
        img: optional('asset'),
        showLinkIcon: optional('boolean'),
        horizontal: optional('boolean'),
        ...appearance,
      },
      ['default', 'title', 'description', 'footer'],
      { sourceProp: 'img', altProp: null, titleProp: null, filenameProp: null },
    ),
    cards: block({ cols: optional('string'), ...appearance }),
    center: block({
      size: optional('string'),
      max: optional('string'),
      type: optional('string'),
    }),
    'code-group': block(appearance),
    'code-tree': block({
      ...appearance,
      defaultValue: optional('string'),
      expandAll: optional('boolean'),
    }),
    collapse: block(appearance),
    column: block({ size: choice('sm', 'md', 'lg') }, ['default'], null, {
      allowedParents: ['layout'],
      allowedChildren: null,
    }),
    dropcap: block({ lines: optional('json') }),
    error: notice,
    excerpt: block({ label: optional('string'), source: optional('string'), ...appearance }),
    figure: block(
      {
        ...appearance,
        src: required('asset'),
        alt: required('string'),
        caption: optional('string'),
        width: optional('json'),
        height: optional('json'),
        bleed: optional('string'),
        aspect: optional('string'),
        fit: optional('string'),
        zoom: optional('json'),
      },
      ['default'],
      { sourceProp: 'src', altProp: 'alt', titleProp: null, filenameProp: null },
    ),
    files: block({ active: optional('string'), annotations: optional('json'), ...appearance }),
    idea: notice,
    info: block({
      title: optional('string'),
      icon: optional('string'),
      appearance: choice('quiet', 'tint'),
    }),
    kbd: inline(),
    layout: block(
      { type: choice('default', 'card', 'border', 'border-dashed', 'outline', 'outline-dashed') },
      ['default'],
      null,
      { allowedParents: null, allowedChildren: ['column'] },
    ),
    note: notice,
    quiz: block({
      ...appearance,
      title: optional('string'),
      description: optional('string'),
      questionLabel: optional('string'),
      backLabel: optional('string'),
      nextLabel: optional('string'),
      resultsLabel: optional('string'),
      correctSummaryLabel: optional('string'),
      perfectLabel: optional('string'),
      retryPrompt: optional('string'),
      resetLabel: optional('string'),
    }),
    'quiz-question': block({
      question: required('string'),
      type: optional('string'),
      explanation: optional('string'),
      options: required('json'),
      checkLabel: optional('string'),
      correctLabel: optional('string'),
      incorrectLabel: optional('string'),
      resetLabel: optional('string'),
      multipleChoiceLabel: optional('string'),
    }),
    'read-more': block({ title: optional('string'), links: required('json'), ...appearance }, []),
    steps: block({ mode: optional('string'), ...appearance }),
    success: notice,
    tab: block({ icon: optional('string'), label: optional('string') }),
    tabs: block({ layout: optional('string'), padded: optional('boolean'), ...appearance }),
    timeline: block(appearance),
    'timeline-item': block({
      date: optional('string'),
      label: optional('string'),
      title: optional('string'),
      icon: optional('string'),
      active: optional('boolean'),
    }),
    toc: block(
      {
        title: optional('string'),
        depth: optional('json'),
        open: optional('json'),
      },
      [],
    ),
    warning: notice,
  },
  version: 2,
} satisfies PortableComponentPolicyV2

type LayoutTag = keyof typeof ginkoLayoutComponentPolicy.components

/** The Ginko Docs Vue component that renders each tag. */
export const ginkoLayoutComponentNames = {
  accordion: 'MdcAccordion',
  'accordion-item': 'MdcAccordionItem',
  api: 'MdcApi',
  aside: 'MdcAside',
  card: 'MdcCard',
  cards: 'MdcCards',
  center: 'MdcCenter',
  'code-group': 'MdcCodeGroup',
  'code-tree': 'MdcCodeTree',
  collapse: 'MdcCollapse',
  column: 'MdcColumn',
  dropcap: 'MdcDropcap',
  error: 'MdcError',
  excerpt: 'MdcExcerpt',
  figure: 'MdcFigure',
  files: 'MdcFiles',
  idea: 'MdcIdea',
  info: 'MdcInfo',
  kbd: 'MdcKbd',
  layout: 'MdcLayout',
  note: 'MdcNote',
  quiz: 'MdcQuiz',
  'quiz-question': 'MdcQuizQuestion',
  'read-more': 'MdcReadMore',
  steps: 'MdcSteps',
  success: 'MdcSuccess',
  tab: 'MdcTab',
  tabs: 'MdcTabs',
  timeline: 'MdcTimeline',
  'timeline-item': 'MdcTimelineItem',
  toc: 'MdcInlineToc',
  warning: 'MdcWarning',
} as const satisfies Record<LayoutTag, string>

type Prop = ComponentImplementationProp
const text: Prop = { required: false, types: ['string'] }
const flag: Prop = { required: false, types: ['boolean'] }
const quietOrTint: Prop = { required: false, types: ['string'], options: ['quiet', 'tint'] }
/** An untyped Vue property (`unknown`) accepts every JSON value. */
const anyValue: Prop = { required: false, types: ['boolean', 'number', 'object', 'string'] }
const noticeProps = { title: text, icon: text, appearance: quietOrTint }

/**
 * Runtime properties and slots of the Ginko Docs Vue components, for the
 * properties that the policy exposes. Components that read `useSlots()`
 * render their default slot although their template has no `<slot>`.
 */
const implementationProps: Record<LayoutTag, { props: Record<string, Prop>; slots: readonly string[] }> = {
  accordion: {
    props: {
      appearance: quietOrTint,
      type: { required: false, types: ['string'], default: 'single', options: ['single', 'multiple'] },
      collapsible: { required: false, types: ['boolean'], default: true },
      defaultValue: { required: false, types: ['string', 'object'] },
    },
    slots: ['default'],
  },
  'accordion-item': {
    props: { value: text, title: text, content: text },
    slots: ['title', 'content', 'default'],
  },
  // MdcApi renders only its `groups` property. Default slot content is kept in
  // the document but the Docs renderer does not show it.
  api: {
    props: { appearance: quietOrTint, title: text, icon: text, method: text, path: text, groups: anyValue },
    slots: ['default'],
  },
  aside: { props: { label: text, appearance: quietOrTint }, slots: ['default'] },
  card: {
    props: {
      title: text,
      description: text,
      footer: text,
      to: text,
      target: text,
      icon: text,
      iconColor: {
        required: false,
        types: ['string'],
        options: ['muted', 'foreground', 'primary', 'info', 'success', 'warning', 'destructive'],
      },
      img: text,
      showLinkIcon: { required: false, types: ['boolean'], default: true },
      horizontal: { required: false, types: ['boolean'], default: false },
      appearance: quietOrTint,
    },
    slots: ['title', 'description', 'default', 'footer'],
  },
  cards: {
    props: {
      cols: { required: false, types: ['number', 'string'], default: 2, options: ['1', '2', '3'] },
      appearance: quietOrTint,
    },
    slots: ['default'],
  },
  center: {
    props: {
      size: { required: false, types: ['string', 'object'], default: 'md', options: ['sm', 'md', 'lg'] },
      max: { required: false, types: ['string'], options: ['sm', 'md', 'lg'] },
      type: {
        required: false,
        types: ['string', 'object'],
        default: 'default',
        options: ['default', 'card', 'border', 'border-dashed', 'outline', 'outline-dashed'],
      },
    },
    slots: ['default'],
  },
  'code-group': { props: { appearance: quietOrTint }, slots: ['default'] },
  'code-tree': {
    props: { appearance: quietOrTint, defaultValue: text, expandAll: flag },
    slots: ['default'],
  },
  collapse: { props: { appearance: quietOrTint }, slots: ['default'] },
  column: {
    props: { size: { required: false, types: ['string', 'object'], default: 'md', options: ['sm', 'md', 'lg'] } },
    slots: ['default'],
  },
  dropcap: { props: { lines: { required: false, types: ['number', 'string'], default: 2 } }, slots: ['default'] },
  error: { props: noticeProps, slots: ['default'] },
  excerpt: { props: { label: text, source: text, appearance: quietOrTint }, slots: ['default'] },
  figure: {
    props: {
      appearance: quietOrTint,
      src: text,
      alt: text,
      caption: text,
      width: { required: false, types: ['string', 'number'] },
      height: { required: false, types: ['string', 'number'] },
      bleed: { required: false, types: ['boolean', 'string'] },
      aspect: { required: false, types: ['string'], options: ['auto', 'video', 'wide', 'square', 'portrait'] },
      fit: { required: false, types: ['string'], options: ['cover', 'contain'] },
      zoom: { required: false, types: ['boolean', 'string'], default: 'auto' },
    },
    slots: ['default'],
  },
  files: { props: { active: text, annotations: { required: false, types: ['object'] }, appearance: quietOrTint }, slots: ['default'] },
  idea: { props: noticeProps, slots: ['default'] },
  info: { props: noticeProps, slots: ['default'] },
  kbd: { props: {}, slots: ['default'] },
  layout: {
    props: {
      type: {
        required: false,
        types: ['string', 'object'],
        default: 'default',
        options: ['default', 'card', 'border', 'border-dashed', 'outline', 'outline-dashed'],
      },
    },
    slots: ['default'],
  },
  note: { props: noticeProps, slots: ['default'] },
  quiz: {
    props: {
      appearance: quietOrTint,
      title: text,
      description: text,
      questionLabel: text,
      backLabel: text,
      nextLabel: text,
      resultsLabel: text,
      correctSummaryLabel: text,
      perfectLabel: text,
      retryPrompt: text,
      resetLabel: text,
    },
    slots: ['default'],
  },
  'quiz-question': {
    props: {
      question: { required: true, types: ['string'] },
      type: { required: false, types: ['string'], default: 'single', options: ['single', 'multiple'] },
      explanation: text,
      options: { required: true, types: ['object'] },
      checkLabel: text,
      correctLabel: text,
      incorrectLabel: text,
      resetLabel: text,
      multipleChoiceLabel: text,
    },
    slots: ['default'],
  },
  'read-more': { props: { title: text, links: anyValue, appearance: quietOrTint }, slots: [] },
  steps: {
    props: { mode: { required: false, types: ['string'], default: 'icons', options: ['icons', 'numbered'] }, appearance: quietOrTint },
    slots: ['default'],
  },
  success: { props: noticeProps, slots: ['default'] },
  tab: { props: { icon: text, label: text }, slots: ['default'] },
  tabs: {
    props: {
      layout: { required: false, types: ['string'], default: 'separate', options: ['separate', 'line'] },
      padded: { required: false, types: ['boolean'], default: true },
      appearance: quietOrTint,
    },
    slots: ['default'],
  },
  timeline: { props: { appearance: quietOrTint }, slots: ['default'] },
  'timeline-item': {
    props: { date: text, label: text, title: text, icon: text, active: flag },
    slots: ['default'],
  },
  toc: {
    props: { title: text, depth: { required: false, types: ['number'] }, open: { required: false, types: ['boolean', 'string'] } },
    slots: [],
  },
  warning: { props: noticeProps, slots: ['default'] },
}

const implementation = Object.fromEntries(
  (Object.keys(ginkoLayoutComponentNames) as LayoutTag[]).map(tag => [tag, {
    componentName: ginkoLayoutComponentNames[tag],
    ...implementationProps[tag],
  }]),
) as Record<LayoutTag, ComponentImplementationMetadata>

const appearanceField = {
  control: 'text',
  label: 'Appearance',
  help: 'quiet or tint. Leave empty to use the site setting.',
} as const
const iconField = { control: 'text', label: 'Icon', help: 'An icon name, for example lucide:rocket.' } as const
const content = { default: { label: 'Content' } }

function callout(label: string, description: string, tone: 'neutral' | 'warning' | 'danger' | 'success' | 'idea') {
  return {
    label,
    description,
    canvas: { titleProp: 'title', switchGroup: 'callout', tone },
    props: { icon: iconField, title: { control: 'text', label: 'Title' }, appearance: appearanceField },
    slots: content,
  } as const
}

const authoring: { [Tag in LayoutTag]: ComponentAuthoringMetadata } = {
  note: callout('Note', 'Useful context alongside the main text.', 'neutral'),
  warning: callout('Warning', 'A condition readers should check before continuing.', 'warning'),
  error: callout('Error', 'Explain a failure and how to recover.', 'danger'),
  success: callout('Success', 'Confirm an outcome or a completed step.', 'success'),
  idea: callout('Idea', 'A suggestion worth exploring.', 'idea'),
  info: {
    label: 'Information',
    description: 'Supporting information that readers should notice.',
    canvas: { titleProp: 'title', switchGroup: 'callout', tone: 'info' },
    props: {
      appearance: { control: 'select', label: 'Appearance' },
      icon: iconField,
      title: { control: 'text', label: 'Title' },
    },
    slots: content,
  },
  aside: {
    label: 'Aside',
    description: 'Additional context beside the main argument.',
    canvas: { titleProp: 'label' },
    props: { label: { control: 'text', label: 'Label' }, appearance: appearanceField },
    slots: content,
  },
  excerpt: {
    label: 'Excerpt',
    description: 'A quoted passage with a source.',
    canvas: { titleProp: 'label' },
    props: {
      label: { control: 'text', label: 'Label' },
      source: { control: 'text', label: 'Source' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Quotation' } },
  },
  layout: {
    label: 'Layout',
    description: 'A responsive row for related columns.',
    canvas: {
      columns: {
        childTag: 'column',
        sizeProp: 'size',
        presets: [
          { label: 'Small / Large', values: ['sm', 'lg'], ratio: 1 / 3 },
          { label: 'Medium / Medium', values: ['md', 'md'], ratio: 1 / 2 },
          { label: 'Large / Small', values: ['lg', 'sm'], ratio: 2 / 3 },
        ],
      },
    },
    props: { type: { control: 'select', label: 'Style' } },
    slots: { default: { label: 'Columns' } },
  },
  column: {
    label: 'Column',
    description: 'A responsive column inside a layout.',
    props: { size: { control: 'select', label: 'Width' } },
    slots: content,
  },
  tabs: {
    label: 'Tabs',
    description: 'Content that readers switch between.',
    canvas: {
      items: {
        childTag: 'tab',
        labelProp: 'label',
        presentation: 'tabs',
        addLabel: 'Add tab',
        template: '::tab{label="New tab"}\nWrite the tab content here.\n::',
      },
    },
    props: {
      layout: { control: 'text', label: 'Layout', help: 'separate or line.' },
      padded: { control: 'toggle', label: 'Padded' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Tabs' } },
  },
  tab: {
    label: 'Tab',
    description: 'One tab inside tabs.',
    canvas: { titleProp: 'label' },
    props: { label: { control: 'text', label: 'Label' }, icon: iconField },
    slots: content,
  },
  accordion: {
    label: 'Accordion',
    description: 'Questions or sections that readers open one at a time.',
    canvas: {
      items: {
        childTag: 'accordion-item',
        labelProp: 'title',
        presentation: 'accordion',
        addLabel: 'Add item',
        template: '::accordion-item{title="New question"}\nWrite the answer here.\n::',
      },
    },
    props: {
      type: { control: 'text', label: 'Type', help: 'single or multiple.' },
      collapsible: { control: 'toggle', label: 'Collapsible' },
      defaultValue: {
        control: 'json',
        label: 'Open items',
        help: 'An item value, or a JSON list of item values for the multiple type.',
      },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Items' } },
  },
  'accordion-item': {
    label: 'Accordion item',
    description: 'One item inside an accordion.',
    canvas: { titleProp: 'title' },
    props: {
      title: { control: 'text', label: 'Title' },
      value: { control: 'text', label: 'Value', help: 'A unique name for this item.' },
    },
    slots: {
      default: { label: 'Content' },
      title: { label: 'Title' },
      content: { label: 'Content' },
    },
  },
  steps: {
    label: 'Steps',
    description: 'A sequence of instructions. Each level-three heading starts a step.',
    canvas: {
      items: {
        childNode: 'heading',
        presentation: 'steps',
        addLabel: 'Add step',
        template: '### New step\n\nDescribe this step.',
      },
    },
    props: {
      mode: { control: 'text', label: 'Mode', help: 'icons or numbered.' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Steps' } },
  },
  cards: {
    label: 'Cards',
    description: 'A grid of linked cards.',
    canvas: {
      items: {
        childTag: 'card',
        labelProp: 'title',
        presentation: 'grid',
        columnsProp: 'cols',
        addLabel: 'Add card',
        template: '::card{title="New card"}\nDescribe this card.\n::',
      },
    },
    props: {
      cols: { control: 'text', label: 'Columns', help: '1, 2, or 3.' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Cards' } },
  },
  card: {
    label: 'Card',
    description: 'A card with a title, text, and an optional link.',
    canvas: { titleProp: 'title' },
    props: {
      title: { control: 'text', label: 'Title' },
      description: { control: 'text', label: 'Description' },
      to: { control: 'text', label: 'Link' },
      target: { control: 'text', label: 'Link target' },
      footer: { control: 'text', label: 'Footer' },
      icon: iconField,
      iconColor: { control: 'text', label: 'Icon color' },
      img: { control: 'text', label: 'Image' },
      showLinkIcon: { control: 'toggle', label: 'Show link icon' },
      horizontal: { control: 'toggle', label: 'Horizontal' },
      appearance: appearanceField,
    },
    slots: {
      default: { label: 'Content' },
      title: { label: 'Title' },
      description: { label: 'Description' },
      footer: { label: 'Footer' },
    },
  },
  timeline: {
    label: 'Timeline',
    description: 'Events in time order.',
    canvas: {
      items: {
        childTag: 'timeline-item',
        labelProp: 'title',
        presentation: 'timeline',
        addLabel: 'Add event',
        template: '::timeline-item{title="New event"}\nDescribe the event.\n::',
      },
    },
    props: { appearance: appearanceField },
    slots: { default: { label: 'Events' } },
  },
  'timeline-item': {
    label: 'Timeline event',
    description: 'One event in a timeline.',
    canvas: { titleProp: 'title' },
    props: {
      title: { control: 'text', label: 'Title' },
      date: { control: 'text', label: 'Date' },
      label: { control: 'text', label: 'Label' },
      icon: iconField,
      active: { control: 'toggle', label: 'Current event' },
    },
    slots: content,
  },
  'code-group': {
    label: 'Code group',
    description: 'Code examples that readers switch between.',
    canvas: {
      items: {
        childNode: 'codeBlock',
        presentation: 'tabs',
        addLabel: 'Add file',
        template: '```ts [example.ts]\n// Write the code here.\n```',
      },
    },
    props: { appearance: appearanceField },
    slots: { default: { label: 'Code blocks' } },
  },
  'code-tree': {
    label: 'Code tree',
    description: 'Several files that readers browse in a file tree.',
    canvas: {
      items: {
        childNode: 'codeBlock',
        presentation: 'stack',
        addLabel: 'Add file',
        template: '```ts [src/example.ts]\n// Write the code here.\n```',
      },
    },
    props: {
      defaultValue: { control: 'text', label: 'Selected file', help: 'The file name to show first.' },
      expandAll: { control: 'toggle', label: 'Expand all folders' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Files' } },
  },
  collapse: {
    label: 'Collapse',
    description: 'Long content that readers expand.',
    props: { appearance: appearanceField },
    slots: content,
  },
  center: {
    label: 'Center',
    description: 'Content in a centered column.',
    props: {
      size: { control: 'text', label: 'Size', help: 'sm, md, or lg.' },
      max: { control: 'text', label: 'Maximum width', help: 'sm, md, or lg.' },
      type: { control: 'text', label: 'Style', help: 'default, card, border, border-dashed, outline, or outline-dashed.' },
    },
    slots: content,
  },
  figure: {
    label: 'Figure',
    description: 'An image with a caption.',
    props: {
      src: { control: 'text', label: 'Image' },
      alt: { control: 'text', label: 'Alternative text' },
      caption: { control: 'text', label: 'Caption' },
      aspect: { control: 'text', label: 'Aspect', help: 'auto, video, wide, square, or portrait.' },
      fit: { control: 'text', label: 'Fit', help: 'cover or contain.' },
      bleed: { control: 'text', label: 'Bleed', help: 'outside to use the full width.' },
      width: { control: 'json', label: 'Width', help: 'A number of pixels.' },
      height: { control: 'json', label: 'Height', help: 'A number of pixels.' },
      zoom: { control: 'json', label: 'Zoom', help: 'true, false, or "auto".' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Caption' } },
  },
  dropcap: {
    label: 'Drop cap',
    description: 'A large first letter.',
    props: { lines: { control: 'json', label: 'Lines', help: 'The height of the letter in lines.' } },
    slots: content,
  },
  kbd: {
    label: 'Keyboard key',
    description: 'A key or shortcut in a sentence.',
    slots: { default: { label: 'Key' } },
  },
  'read-more': {
    label: 'Read more',
    description: 'Links to further reading.',
    props: {
      title: { control: 'text', label: 'Title' },
      links: {
        control: 'json',
        label: 'Links',
        help: 'A JSON list of links. Each link has title and to, and can have description and icon.',
      },
      appearance: appearanceField,
    },
  },
  toc: {
    label: 'Table of contents',
    description: 'A table of contents for this page.',
    props: {
      title: { control: 'text', label: 'Title' },
      depth: { control: 'json', label: 'Depth', help: 'The deepest heading level, for example 2.' },
      open: { control: 'json', label: 'Open', help: 'true to show the list open.' },
    },
  },
  quiz: {
    label: 'Quiz',
    description: 'Questions that readers answer to check what they learned.',
    canvas: {
      items: {
        childTag: 'quiz-question',
        labelProp: 'question',
        presentation: 'stack',
        addLabel: 'Add question',
        template:
          '::quiz-question\n---\nquestion: New question\noptions:\n  - text: Correct answer\n    correct: true\n'
          + '  - text: Wrong answer\n    correct: false\n---\nExplain the answer here.\n::',
      },
    },
    props: {
      title: { control: 'text', label: 'Title' },
      description: { control: 'text', label: 'Description' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Questions' } },
  },
  'quiz-question': {
    label: 'Quiz question',
    description: 'One question with answer choices.',
    canvas: { titleProp: 'question' },
    props: {
      question: { control: 'text', label: 'Question' },
      type: { control: 'text', label: 'Type', help: 'single or multiple.' },
      options: {
        control: 'json',
        label: 'Choices',
        help: 'A JSON list of at least two choices. Each choice has text and correct.',
      },
      explanation: { control: 'text', label: 'Explanation' },
    },
    slots: { default: { label: 'Explanation' } },
  },
  api: {
    label: 'API reference',
    description: 'Structured fields in a reference panel.',
    canvas: { titleProp: 'title' },
    props: {
      title: { control: 'text', label: 'Title' },
      icon: iconField,
      method: { control: 'text', label: 'Method' },
      path: { control: 'text', label: 'Path' },
      groups: {
        control: 'json',
        label: 'Groups',
        help: 'A JSON list of groups. Each group has label and entries.',
      },
      appearance: appearanceField,
    },
    slots: { default: { label: 'Content (not shown on Docs sites)' } },
  },
  files: {
    label: 'Files',
    description: 'A folder structure without file contents.',
    props: {
      active: { control: 'text', label: 'Highlighted path' },
      annotations: { control: 'json', label: 'Annotations', help: 'A JSON object from paths to labels.' },
      appearance: appearanceField,
    },
    slots: { default: { label: 'File list' } },
  },
}

const recipes: readonly AuthoringRecipe[] = [
  {
    id: 'ginko.layout.note',
    label: 'Note',
    description: 'Useful context alongside the main text.',
    keywords: ['callout', 'notice'],
    group: 'callouts',
    icon: 'sticky-note',
    source: '::note{title="Keep in mind"}\nWrite the important context here.\n::',
  },
  {
    id: 'ginko.layout.info',
    label: 'Information',
    description: 'Supporting information that readers should notice.',
    keywords: ['callout', 'info', 'tip'],
    group: 'callouts',
    icon: 'info',
    source: '::info{title="Good to know"}\nWrite the supporting information here.\n::',
  },
  {
    id: 'ginko.layout.warning',
    label: 'Warning',
    description: 'A condition readers should check before continuing.',
    keywords: ['callout', 'caution', 'alert'],
    group: 'callouts',
    icon: 'triangle-alert',
    source: '::warning{title="Before you continue"}\nWrite the condition here.\n::',
  },
  {
    id: 'ginko.layout.error',
    label: 'Error',
    description: 'Explain a failure and how to recover.',
    keywords: ['callout', 'danger', 'failure'],
    group: 'callouts',
    icon: 'circle-x',
    source: '::error{title="Something needs attention"}\nExplain the failure and the recovery here.\n::',
  },
  {
    id: 'ginko.layout.success',
    label: 'Success',
    description: 'Confirm an outcome or a completed step.',
    keywords: ['callout', 'done', 'check'],
    group: 'callouts',
    icon: 'circle-check',
    source: '::success{title="You are ready"}\nWrite the outcome here.\n::',
  },
  {
    id: 'ginko.layout.idea',
    label: 'Idea',
    description: 'A suggestion worth exploring.',
    keywords: ['callout', 'tip', 'suggestion'],
    group: 'callouts',
    icon: 'lightbulb',
    source: '::idea{title="Try this"}\nWrite the suggestion here.\n::',
  },
  {
    id: 'ginko.layout.aside',
    label: 'Aside',
    description: 'Add context without interrupting the main text.',
    keywords: ['sidebar', 'context'],
    group: 'callouts',
    icon: 'message-square-quote',
    source: '::aside{label="A little context"}\nAdd a useful detail here.\n::',
  },
  {
    id: 'ginko.layout.excerpt',
    label: 'Excerpt',
    description: 'Quote a passage and name its source.',
    keywords: ['quotation', 'citation'],
    group: 'text',
    icon: 'text-quote',
    source: '::excerpt{label="In their words" source="Source"}\nWrite the quoted passage here.\n::',
  },
  {
    id: 'ginko.layout.dropcap',
    label: 'Drop cap',
    description: 'Start a passage with a large first letter.',
    keywords: ['initial', 'letter'],
    group: 'text',
    icon: 'case-upper',
    source: '::dropcap\nWrite the first paragraph of the story here.\n::',
  },
  {
    id: 'ginko.layout.kbd',
    label: 'Keyboard key',
    description: 'Show a key or a shortcut in a sentence.',
    keywords: ['kbd', 'shortcut', 'key'],
    group: 'text',
    icon: 'keyboard',
    source: 'Press :kbd[Ctrl] + :kbd[K] to search.',
  },
  {
    id: 'ginko.layout.two-columns',
    label: 'Two columns',
    description: 'Put related content side by side.',
    keywords: ['layout', 'columns', 'side by side'],
    group: 'layout',
    icon: 'columns-2',
    source:
      '::layout{type="border"}\n:::column{size="sm"}\nFirst column.\n:::\n\n:::column{size="lg"}\nSecond column.\n:::\n::',
  },
  {
    id: 'ginko.layout.tabs',
    label: 'Tabs',
    description: 'Content that readers switch between.',
    keywords: ['tab', 'switch'],
    group: 'layout',
    icon: 'panel-top',
    source:
      '::tabs\n:::tab{label="First tab"}\nWrite the first tab here.\n:::\n\n'
      + ':::tab{label="Second tab"}\nWrite the second tab here.\n:::\n::',
  },
  {
    id: 'ginko.layout.accordion',
    label: 'Accordion',
    description: 'Questions or sections that readers open one at a time.',
    keywords: ['faq', 'collapsible', 'disclosure'],
    group: 'layout',
    icon: 'list-collapse',
    source:
      '::accordion\n:::accordion-item{title="First question"}\nWrite the first answer here.\n:::\n\n'
      + ':::accordion-item{title="Second question"}\nWrite the second answer here.\n:::\n::',
  },
  {
    id: 'ginko.layout.steps',
    label: 'Steps',
    description: 'A sequence of instructions.',
    keywords: ['procedure', 'how to', 'sequence'],
    group: 'layout',
    icon: 'list-checks',
    source:
      '::steps\n### Prepare\n\nDescribe the first step.\n\n### Do the work\n\nDescribe the second step.\n\n'
      + '### Check the result\n\nDescribe the last step.\n::',
  },
  {
    id: 'ginko.layout.cards',
    label: 'Cards',
    description: 'A grid of linked cards.',
    keywords: ['grid', 'card', 'links'],
    group: 'layout',
    icon: 'layout-grid',
    source:
      '::cards{cols="2"}\n:::card{title="First card"}\nDescribe the first card.\n:::\n\n'
      + ':::card{title="Second card"}\nDescribe the second card.\n:::\n::',
  },
  {
    id: 'ginko.layout.timeline',
    label: 'Timeline',
    description: 'Events in time order.',
    keywords: ['history', 'events', 'changelog'],
    group: 'layout',
    icon: 'milestone',
    source:
      '::timeline\n:::timeline-item{date="Start" title="First event"}\nDescribe the first event.\n:::\n\n'
      + ':::timeline-item{date="Next" title="Second event"}\nDescribe the second event.\n:::\n::',
  },
  {
    id: 'ginko.layout.collapse',
    label: 'Collapse',
    description: 'Long content that readers expand.',
    keywords: ['expand', 'more', 'fold'],
    group: 'layout',
    icon: 'chevrons-down-up',
    source: '::collapse\nWrite the long content here.\n::',
  },
  {
    id: 'ginko.layout.center',
    label: 'Center',
    description: 'Content in a centered column.',
    keywords: ['centered', 'narrow'],
    group: 'layout',
    icon: 'align-center',
    source: '::center{size="md"}\nWrite the centered content here.\n::',
  },
  {
    id: 'ginko.layout.figure',
    label: 'Figure',
    description: 'An image with a caption. Set the image in the block settings.',
    keywords: ['image', 'photo', 'caption'],
    group: 'media',
    icon: 'frame',
    source: '::figure{src="/images/example.jpg" alt="Describe the image" caption="Write the caption here."}\n::',
  },
  {
    id: 'ginko.layout.code-group',
    label: 'Code group',
    description: 'Code examples that readers switch between.',
    keywords: ['code', 'tabs', 'snippets'],
    group: 'advanced',
    icon: 'files',
    source:
      '::code-group\n```ts [example.ts]\nexport const answer = 42\n```\n\n'
      + '```js [example.js]\nexport const answer = 42\n```\n::',
  },
  {
    id: 'ginko.layout.code-tree',
    label: 'Code tree',
    description: 'Several files that readers browse in a file tree.',
    keywords: ['files', 'code', 'project'],
    group: 'advanced',
    icon: 'folder-code',
    source:
      '::code-tree\n```ts [src/index.ts]\nexport const answer = 42\n```\n\n'
      + '```json [package.json]\n{ "name": "example" }\n```\n::',
  },
  {
    id: 'ginko.layout.files',
    label: 'Files',
    description: 'Show a folder structure.',
    keywords: ['folders', 'tree', 'directory'],
    group: 'advanced',
    icon: 'folder-tree',
    source: '::files\n- `content`\n  - `index.md`\n- `public`\n  - `logo.svg`\n::',
  },
  {
    id: 'ginko.layout.read-more',
    label: 'Read more',
    description: 'Link to further reading.',
    keywords: ['links', 'related', 'see also'],
    group: 'advanced',
    icon: 'book-open',
    source: '::read-more{title="Read more"}\n---\nlinks:\n  - title: Getting started\n    to: /\n---\n::',
  },
  {
    id: 'ginko.layout.toc',
    label: 'Table of contents',
    description: 'List the headings of this page.',
    keywords: ['toc', 'contents', 'outline'],
    group: 'advanced',
    icon: 'list-tree',
    source: '::toc{title="On this page"}\n::',
  },
  {
    id: 'ginko.layout.quiz',
    label: 'Quiz',
    description: 'Let readers check what they learned.',
    keywords: ['question', 'test', 'check'],
    group: 'advanced',
    icon: 'circle-help',
    source:
      '::quiz{title="Check your understanding"}\n:::quiz-question\n---\nquestion: Which answer is correct?\n'
      + 'options:\n  - text: This answer\n    correct: true\n  - text: That answer\n    correct: false\n---\n'
      + 'Explain the answer here.\n:::\n::',
  },
  {
    id: 'ginko.layout.api',
    label: 'API reference',
    description: 'Describe structured fields in a reference panel.',
    keywords: ['api', 'fields', 'reference', 'props'],
    group: 'advanced',
    icon: 'braces',
    source:
      '::api{title="Fields"}\n---\ngroups:\n  - label: Fields\n    entries:\n      - name: title\n'
      + '        annotation: string\n        required: true\n        description: The page title.\n---\n::',
  },
]

/**
 * The built-in layout kit source. Compose it with other kits through
 * `composeAuthoringKits`, or create it alone with `createGinkoLayoutKit`.
 */
export const ginkoLayoutKitSource = {
  version: 1,
  policy: ginkoLayoutComponentPolicy,
  implementation,
  authoring,
  recipes,
} satisfies AuthoringKitSource
