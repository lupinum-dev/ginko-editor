# In-place editing

Use `variant="inline"` to edit text where it appears on the page. It has no
frame, header, or source switch and uses the host's typography.

```vue
<GinkoEditor v-model="lead" variant="inline" profile="inline"
  :messages="germanMessages" aria-label="Einleitung" />
```

## Profiles

| Profile | Allowed |
| --- | --- |
| `plain` | Paragraphs, line breaks |
| `inline` | `plain` + bold, italic, link |
| `article` | `inline` + headings 2–4, lists, quotes, dividers, images |
| `full` | Everything (default) |

The profile limits the toolbar, shortcuts, slash menu, Markdown input rules,
and paste. Paste keeps the text and removes structure and formatting that the
profile does not allow. Loaded content is not changed.

Enforce the profile on save as well:

```ts
import { findProfileViolations } from '@lupinum/ginko-editor/runtime'

const violations = findProfileViolations(tiptapJson, 'article')
if (violations.length) throw new Error('This text contains formatting that is not allowed here.')
```

## Toolbars

| Prop | Values | Default |
| --- | --- | --- |
| `toolbarPlacement` | `top`, `keyboard`, `auto`, `false` | `top` (default variant), `auto` (inline) |
| `selectionToolbar` | `auto`, `always`, `false` | `auto` (off on touch devices) |
| `selectionToolbarItems` | Toolbar groups | bold, italic, strike, code, link |
| `header`, `sourceToggle` | booleans | `true` for default, `false` for inline |

`keyboard` docks the formatting row above the on-screen keyboard while the
editor has focus. `auto` uses it on touch devices.

## Styling

Style the element around the editor like the published page. Focus outline:
`--ginko-inline-focus-outline`, `--ginko-inline-focus-offset`,
`--ginko-inline-focus-radius`. Avoid `transform` on ancestors, because the
floating toolbars use fixed positioning.
