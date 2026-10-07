---
name: ginko-editor
description: Use when an agent embeds or configures @lupinum/ginko-editor in a Vue or Nuxt app, including the GinkoEditor component, v-model and flush() persistence, toolbar and messages (German germanMessages), in-place editing with variant="inline", content profiles (plain, inline, article), the keyboard-docked toolbar, image and asset hooks, authoring kits, or server-side validation with the runtime entry.
---

# Ginko Editor

Use this skill for app-facing work with `@lupinum/ginko-editor`. It is for apps that embed the editor, not for changing the editor's internals.

## Workflow

1. Inspect the app first: `package.json`, `nuxt.config.ts` or the Vue entry, and every place that mounts `GinkoEditor` or saves its value.
2. Read only the matching reference:
   - First setup, persistence, and flush: [references/quickstart.md](references/quickstart.md)
   - Editing text on the page, profiles, phones: [references/in-place-editing.md](references/in-place-editing.md)
3. Keep the app's own UI conventions for buttons, dialogs, and theme tokens.
4. Validate with the smallest relevant command, then the app's gates.

## Hard rules

- Import the styles once: `import '@lupinum/ginko-editor/style.css'`.
- Markdown (MDC) in `v-model` is the only document format. Do not store TipTap JSON.
- Await `editorRef.value.flush()` before you save, close, or replace a document. Keep the editor mounted when it returns `{ ok: false }`.
- The host owns persistence and asset storage. Use `imageUpload`, `imagePicker`, and `request-*` events; never put upload credentials in the editor.
- `profile` and `collaboration` are read once at mount. Remount (change the `key`) to change them.
- A profile limits what the editor creates, but loaded content is not changed. Enforce the same profile where the document is stored with `findProfileViolations` from `@lupinum/ginko-editor/runtime`.
- Server code imports only `@lupinum/ginko-editor/runtime`. It has no Vue or browser globals.
- `@lupinum/ginko-content` is a peer dependency. Keep one copy (`vite.resolve.dedupe` in Nuxt).
- Pass `messages` for non-English UI. `germanMessages` is complete; spread it to override single keys.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
```

Check real behavior in a browser: type, format, paste, and reload after a save.
On phones, check that the docked formatting row stays above the keyboard.
