# Ginko Editor implementation and rollout plan

Prepared: 2026-09-12. Owner: Matthias / Lupinum. Intended executor: GPT 5.6 Sol, medium reasoning. Reviewer: the coordinating agent that assigns each milestone.

## 1. Current authorization and how to use this plan

This repository currently contains only this plan and Git metadata. No library, dependencies, application changes, GitHub repository, commits, or releases have been created by this planning task. This document describes future work; it is not evidence that any step has passed.

Matthias requested a separate Ginko Editor library shared by Ginko CMS and ChiliSkills, with Ginko Docs components, custom application components, slash insertion, layout editing, source mode, and trustworthy preview. He prefers named angle-tag syntax such as `<info>...</info>` where the shared content engine can support it correctly.

When implementation is authorized, execute one numbered step at a time. Read this entire file before the first step. Each step's prompt incorporates the common executor instructions below and its own scope, acceptance criteria, and verification. A new executor must receive the absolute path to this file and the assigned step number; it needs no earlier chat history.

The plan uses the Lupinum OSS single-package library profile. Its local source is `/Users/matthias/Git/0_libs/lupinum-oss`; the public handbook is [oss.lupinum.com](https://oss.lupinum.com). Preserve the operational contract of its tested starter, while adapting the product build for Vue components. Do not copy the starter until Step 2 is assigned.

### Common executor instructions

1. Read the assigned repositories' current `AGENTS.md`, `MAINTAINING.md`, architecture decisions, and package scripts. Read `docs/WRITING.md` before editing public documentation. These repositories have different toolchains and release procedures; preserve each one.
2. Inspect `git status --short`, branch, HEAD, and relevant diffs before editing. Preserve unrelated work. Refresh the evidence below if it has drifted. A harmless line move is not a reason to stop; a changed contract or concurrent edit needs reconciliation with the reviewer.
3. Work only on the assigned step and its necessary tests/documentation. Use the simplest direct implementation. Do not build speculative frameworks, mutable global registries, a second persistence model, or alternate parser pipelines.
4. Run the smallest relevant checks during development. Run the owning repository's aggregate gate once at handoff when required. Do not repeatedly run child checks and their aggregate without a new reason. Report an existing failing baseline separately from failures introduced by the change.
5. Inspect material interface changes in a real browser before and after implementation. Verify desktop, narrow screens, keyboard operation, and a failure/recovery path. Screenshots and build success do not replace interaction tests.
6. Use type inference and explicit domain types. Avoid `any` and casts used to hide uncertainty. Keep generated data reproducible. Keep domain policy out of transports and application orchestration.
7. For a milestone review, provide changed files, exact commands/results, browser evidence, package versions, known limitations, and the next proposed step. The executor may mark a step `READY FOR REVIEW`; only the reviewer marks it `ACCEPTED`.
8. Stop dependent work at an explicit review gate until the reviewer responds. Review findings go back to the executor for correction, then re-review the affected behavior. Do not self-approve or silently move to the next milestone.
9. Repository creation, pushing, PRs, issues, merging, deployment, and npm publication are separate external actions. Follow the implementation task's authorization and repository rules. This plan alone grants no external authority. Prepare local evidence before requesting a necessary external decision. npm bootstrap and protected publication retain their required human action.
10. Use Conventional Commits for authorized commits. Use `gh-publish-pr` when assigned publishing work, and `gh-stack` for dependent PRs within one repository. Cross-repository dependencies use explicit linked PRs and release order; they are not a single Git stack.
11. Keep this file as the execution index. Do not create a competing roadmap or copy the plan into multiple repositories. Repository-specific architecture decisions and tests belong with their owners and should be linked here.

### Initial implementation prompt

```text
Use GPT 5.6 Sol with medium reasoning. Read
/Users/matthias/Git/0_libs/ginko-editor/plan.md completely.
Execute Step 0 only, following the common executor instructions and that
step's acceptance criteria. Treat all later steps as context, not permission
to implement them. Preserve unrelated work and do not publish anything.
Return the review packet defined in section 10 and request reviewer approval
before proceeding to Step 1.
```

For later dispatches, replace `Step 0` with the assigned step and explicitly reference the previously accepted review. If no reviewer messaging tool exists, return the packet in the task and wait for the coordinating agent to continue it. Do not create a new user-owned task without a request.

## 2. Product outcome and boundaries

An author can open a script, write normal rich text, insert useful layouts through `/` or a visible plus button, edit component properties and nested content, preview the actual result, switch to source safely, undo changes, and reopen the saved document without content loss. The same library supports Ginko CMS Studio and ChiliSkills without application forks.

### Included in the complete rollout

- A Vue 3 and TypeScript library named `@lupinum/ginko-editor` in this repository.
- One source string as the persisted authoring value. Tiptap state and parser output are derived.
- Visual editing, source editing, selection toolbar, slash menu, visible insertion control, component properties, nested slots, and block controls.
- Shared content parsing semantics across editing, preview, and publishing.
- Ginko Docs authoring metadata and component-only registration with the styles needed for faithful rendering.
- Application-owned components registered without changing the library.
- CMS workflow and assets preserved; ChiliSkills local saving, backups, restore, and undo preserved.
- All currently public Ginko Docs tags accounted for, with curated insertion recipes and contextual child insertion.
- Browser checks and isolated packed consumers, then controlled repository setup and release rollout.

### Excluded unless Matthias changes scope

- Real-time collaboration, CRDTs, cloud persistence, authentication, a new backend, AI writing, and comments.
- An open-ended Markdown fork or a second editor-only parser. Step 1 includes the bounded shared-engine work required for the accepted angle-tag component syntax.
- Bare `<>...</>` fragments, arbitrary JavaScript expressions, or arbitrary executable Vue templates.
- Replacing ChiliSkills' slide canvas, PPTist, PDF/PPTX import, presentation mode, workshop block model, or private speaker notes.
- Embedding the full Nuxt Studio application or reviving the archived CMS editor.
- Importing the full Ginko Docs website layer into ChiliSkills merely to get authored components.
- A generic plugin marketplace, separate schema package, event bus, background jobs, or a runtime dependency on the OSS handbook.
- Fleet-wide release workflow migrations, unrelated dependency upgrades, redesigns of the host applications, or launch services added without a real requirement.

### UX direction

Use each host's existing visual identity. The shared editor supplies scoped styles and a small theme surface; it does not replace host navigation or save controls. Start with a functional shared UI and permit narrow host integration points only where both consumers demonstrate a need.

```text
ChiliSkills slide card
  Slide content
  Skriptum · short excerpt                         Open
  Private speaker notes

Focused writing area
  Back to slide       Skriptum          Host save status
  Write | Split | Preview                      Source
  ---------------------------------------------------
  Heading                    | Rendered heading
  [Context | Exercise]       | [Context | Exercise]
  Type / or use +            | Actual host components
```

On narrow screens use Write/Preview tabs. Avoid a full editor instance for every collapsed slide; mount the active writing surface. Preserve the selected block and return focus to the opener when closing it. Show honest local save state in ChiliSkills and existing draft/publication state in CMS.

Recipes should describe tasks: “Two columns”, “Information”, “Tabs”, “Timeline”. Child tags such as `column`, `tab`, and `quiz-question` should normally be inserted inside their parent. An advanced component menu must still respect structural validity. Source mode preserves access to the supported language.

The first layout views must communicate actual structure: editable columns appear next to each other on desktop and stack at narrow widths. Generic labelled boxes are a fallback, not the final experience for the main layout recipes. Exact interactive components render in preview; the authoring view prioritizes stable editing and selection.

## 3. Evidence and repository map

These are local observations, not claims about deployed services or current npm versions. Recheck before implementation.

| Repository | Absolute root | Planned against HEAD | Working tree observed |
|---|---|---|---|
| Editor | `/Users/matthias/Git/0_libs/ginko-editor` | Unborn `main` | This plan only |
| CMS | `/Users/matthias/Git/0_libs/ginko-cms` | `d0e279816e06c065165b28efe6f3fbfda45a03ae` | Untracked `plans/`; preserve it |
| Content | `/Users/matthias/Git/0_libs/ginko-content` | `994862e5b96a8be5115c6f6b622ab07f620117f4` | Untracked `DESLOP-AUDIT.md`; preserve it |
| Docs | `/Users/matthias/Git/0_libs/ginko-docs` | `3e5f752ffe09e33a3fd0f641209056701ee9476f` | Clean |
| ChiliSkills | `/Users/matthias/Git/1_apps/chiliskills` | `663ee19db8659640dde53ef70376390bf9d83b4a` | Clean |
| OSS handbook | `/Users/matthias/Git/0_libs/lupinum-oss` | `8232a551fc23bec40c838056c6018a92791196b1` | Clean |

Drift check: in each existing repository, run `git diff --stat <the SHA above>..HEAD -- <assigned paths>` and inspect working-tree changes too. Never reset a repository to the recorded SHA merely to match this plan.

The configured application handbook references below were absent during planning. Recheck them during Step 0, and use them if restored. Their absence does not block work under the available repository instructions:

- `/Users/matthias/Git/0_libs/lupinum/lupinum-app/standards/agent-development.md`
- `/Users/matthias/Git/0_libs/lupinum/lupinum-app/playbooks/agent-development.md`

### Existing code to read

Paths in this table are relative to the absolute root named above.

| Owner | Files | Reason |
|---|---|---|
| CMS | `packages/cms/studio-app/src/editor/ui/Editor.vue` | Existing editor UI and mode behavior |
| CMS | `packages/cms/studio-app/src/editor/lib/markdown.ts` | Comark parse and serialization adapter |
| CMS | `packages/cms/studio-app/src/editor/lib/conversionPipeline.ts`, `mdcToTiptap.ts`, `tiptapToMdc.ts` | Conversion and failure handling; verify exact filenames during recon |
| CMS | `packages/cms/studio-app/src/editor/model/useContentSync.ts`, `useRawMode.ts`, `default-asset-provider.ts` | Synchronization, mode changes, and host coupling |
| CMS | `packages/cms/studio-app/src/components/studio/fields/FieldRichtext.vue` | Field wrapper, assets, and current source-only preview |
| CMS | `packages/cms/src/module/content-contract.ts` | Existing host-to-Studio contract boundary |
| CMS | `test/runtime/editor/`, `test/fixtures/editor-conversion/` | Existing regression tests and realistic source fixtures |
| CMS | `packages/cms/compatibility.json`, `MAINTAINING.md` | Exact release dependency authority and CMS-specific release procedure |
| Content | `packages/content/src/core/markdown/parse-comark.ts` | Fixed parser profile and typed-component-frontmatter correction |
| Content | `packages/content/src/cms-contract/mdc.ts` | Public `parseMdcBody()` boundary |
| Content | `packages/content/src/types/component-policy.ts` | Existing portable component policy |
| Content | `packages/content/src/runtime/app/components/ContentRenderer.vue` | Canonical rendering integration |
| Content | `test/unit/comark-parser-lifecycle.test.ts`, `test/unit/cms-contract-purity.test.ts` | Parser lifecycle and runtime-neutral boundary tests |
| Docs | `layer/tags.ts`, `layer/components.ts` | Public tags, implementations, and policy exports |
| Docs | `layer/app/components/mdc/`, `layer/app/components/prose/` | Actual props, slots, component dependencies and styles |
| Docs | `layer/package.json`, `layer/nuxt.config.ts`, `ARCHITECTURE.md` | Package exports, framework coupling, and package boundaries |
| ChiliSkills | `app/lib/module.ts`, `app/lib/moduleMigration.ts`, `app/lib/modulePackage.ts` | Schema version 2, legacy import, backups and restore |
| ChiliSkills | `app/composables/useModuleEditor.ts` | Existing persistence and undo ownership |
| ChiliSkills | `app/components/workshop/SlideBlock.vue`, `BlockCard.vue` | Script, text-body, and assignment-body textareas |
| ChiliSkills | `tests/unit/module.test.ts`, `tests/component/module-editor.test.ts`, `tests/e2e/` | Consumer behavior test patterns |
| ChiliSkills | `docs/proof/lehrer-editor-polish.md`, `app/assets/css/workshop.css` | Existing product and design constraints |

Read-only behavioral references if useful: `/Users/matthias/Git/alignment/nuxt-studio` for component metadata and insertion, and `/Users/matthias/Git/1_apps/_archive/ginko-cms-old` for old slash behavior. Do not copy either system wholesale. Check license/attribution before moving code from any source.

### Facts that determine the plan

1. CMS' installed Comark was `0.3.2`; Content's was `0.6.2`. Parsing `<callout>\nHello **world**\n</callout>` produced a `strong` node in the former and literal Markdown markers in the latter. This used an arbitrary parser tag, not a public Docs recipe.
2. Content creates its parser with `typedComponentFrontmatter()`. CMS calls Comark directly. CMS' installed parser returned YAML `false` and `3` as strings in the inspected example. Using the same parser brand does not establish semantic parity.
3. Content's `parseMdcBody()` explicitly uses a fixed portable baseline, excluding site-configured filesystem plugins. Do not silently add arbitrary host plugins to CMS publishing.
4. The current portable policy defines block/inline kind, permitted property types/requiredness, slots, and media mappings. It does not contain all authoring controls, enum choices, or presentation labels.
5. Docs' public registry contains 33 tags. `info`, `note`, `warning`, `error`, `success`, and `idea` are public callout variants. `MdcCallout.vue` exists internally; `callout` is not a public tag in the inspected registry. Derive coverage from the live registry rather than hard-coding the count forever.
6. ChiliSkills persists script/body strings and schema version 2. Reinterpreting text as Markdown can change meaning even when the TypeScript field remains `string`. Local documents and imported backups are real dependencies.
7. ChiliSkills' lockfile resolved Nuxt 4.4.8. Verify Docs' declared minimums and the new component-only integration before selecting an upgrade. A caret range in `package.json` does not prove the installed version.
8. A generic component node and exact host preview are different surfaces. CMS Studio is separately built and cannot receive executable Vue components in JSON metadata. Custom component rendering belongs in the host where the implementation exists.

## 4. Architecture and invariants

### Ownership

| Owner | Responsibility |
|---|---|
| Ginko Content | Parsing semantics, normalized content contract, portable policy, render boundary |
| Ginko Editor | Tiptap integration, source conversion, authoring UI, authoring metadata types, scoped styles |
| Ginko Docs | Its Vue/prose components, explicit content policy, generated implementation metadata, authoring labels and recipes |
| Ginko CMS | Draft/save/publish workflow, access control, asset operations, metadata transport and host preview |
| ChiliSkills | Workshop context, local storage, backup/import, document migrations, module undo, script workspace |

The renderer must not depend on the editor at runtime. Docs' optional authoring entry may use editor types as type-only development dependencies; its rendering entry must not import editor code. Content must never depend on CMS, Docs or Editor. Editor must never depend on CMS or ChiliSkills. Avoid introducing a new package just to share a few types when an existing neutral owner fits.

### Component definition and metadata

There are three different facts, each with one owner:

1. **Implementation metadata:** Vue declares actual props/defaults/slots. Extract representable metadata during build where practical. Do not ship an SFC compiler in the editor browser bundle.
2. **Content policy:** the component owner explicitly allows a subset of props and slots for authored documents. Do not automatically expose every Vue prop, event, binding or arbitrary class/style hook.
3. **Authoring metadata:** labels, icons, keywords, grouping, preferred controls, valid nesting and insertion recipes. Put this next to the component kit, keyed by existing canonical tags.

Combine these into a serializable authoring manifest. Validate that allowed fields exist and are type-compatible. Derive enum choices/defaults when extraction is reliable; allow explicit authoring control hints for cases that cannot be represented, without duplicating the underlying type declaration. Unsupported complex props use a validated advanced control or source mode. Do not promise automatic form generation for every possible TypeScript type.

Reuse the existing portable policy rather than manually redeclaring its prop types inside a new editor schema. Where authoring types extend it, use inference/indexed access from the canonical types. Keep policy enforcement at the content boundary as well as UI validation.

Two applications must be able to use different component sets on the same page without leakage. Reject duplicate tags/recipe IDs with a useful diagnostic. Preserve unknown source without executing unregistered components. Use one direct composition operation if needed; do not add a mutable global registration system.

### Starting API sketch, to finalize at Gate B

```vue
<GinkoEditor
  v-model="source"
  :authoring-kit="authoringKit"
  :asset-provider="assetProvider"
  :disabled="disabled"
/>
```

The prop names are a design starting point, not an already published API. Keep `modelValue` a string. The host owns saving and preview; a slot or small explicit integration point is sufficient. Do not add a generic parser injection API: all supported consumers must use the canonical profile.

Specify before release: initial load behavior, external model replacement, input events, in-flight conversion ordering, disabled/read-only semantics, unmount behavior, document switching, error reporting, asset cancellation, and IME composition. `v-model` updates must never create feedback loops or mark an unchanged document as edited.

Keep Vue and the Tiptap packages shared where needed for a single compatible runtime. Test peer resolution; do not blindly externalize every dependency. Mark CSS as a side effect in package metadata when needed so production builds retain it.

### Content guarantees

- Opening an unchanged document and switching modes without edits preserves the exact original source string.
- A successful visual edit may normalize supported syntax, but must preserve semantic content: text, marks, links, properties, typed values, slots and nesting. Document what normalization is expected.
- Unsupported or malformed syntax must remain recoverable. Initially, keep the whole document in source mode when safe visual editing cannot be proven. An opaque unsupported block may be added only with tests proving edits around it preserve its bytes and position.
- Parsing/serialization failure must not emit empty or partially converted content. Keep the last user source, show a recoverable error, and allow copying/editing that source.
- Async conversions and previews must discard stale results. Switching documents, typing quickly, or closing the editor cannot overwrite newer input.
- Do not claim byte preservation for arbitrary visual edits or use snapshots alone to prove semantic equivalence.
- Store only canonical source in authoring persistence. Existing published AST projections remain allowed where already part of Content/CMS and rebuildable from source; this plan does not remove them.

### Syntax decision

Named angle tags are the accepted syntax for newly generated component source. Step 1 must implement one tested shared profile that preserves nested Markdown, typed properties, slots, escaping and serialization through the actual editor conversion and publish/render paths. Existing colon syntax remains supported and is not rewritten on load. Documentation reference: [Comark components](https://comark.dev/syntax/components).

The implementation must stay bounded to a maintained Ginko Content-owned Comark extension or a concrete upstream change that is necessary after hook feasibility is tested. Do not add an editor-only preprocessor or begin an open-ended language fork. Independent scaffolding can continue during Step 1A review; dependent conversion behavior cannot.

Preserve existing valid syntax. Do not automatically rewrite old documents on load or introduce permanent dual-format persistence.

## 5. Verification commands

Run these from their repository roots. They were inspected in local package scripts; they were not executed by this planning task. Reconfirm scripts after drift. Commands for new files below are planned commands and must be implemented/wired before claiming they pass.

| Repository | Focused iteration | Handoff / release evidence |
|---|---|---|
| Editor, after scaffolding | `pnpm test`, `pnpm typecheck`, targeted Vitest files | `pnpm verify`; `pnpm release:verify` for package certification |
| Content | `pnpm exec vitest run --project unit test/unit/comark-parser-lifecycle.test.ts test/unit/cms-contract-purity.test.ts` | `pnpm verify`; `pnpm release:verify` for final release candidate |
| CMS | `pnpm exec vitest run test/runtime/editor` | `pnpm run check`; packed rehearsal `pnpm run release:verify`; registry lane `pnpm run release:verify:registry` only after approved upstream publication |
| Docs | `pnpm test --run layer/app/features/docs/docs-navigation.test.ts`; target new authoring tests similarly | `pnpm verify`; `pnpm release:verify` |
| ChiliSkills | `pnpm exec vitest run tests/unit/module.test.ts tests/component/module-editor.test.ts` | `pnpm check`; `pnpm test:e2e -- tests/e2e/script-editor.spec.ts` once added |

`pnpm check` in ChiliSkills includes its PPTist build dependency. Do not bypass it by changing unrelated integrations. The CMS dev command can prepare a Convex deployment: inspect it before running, use the documented safe consumer/staging setup, and do not use production data for verification.

New Editor contract tests should cover parser agreement, conversion, source preservation, manifest validation, asset integration, and public package exports. Add browser tests for editor interaction. Proposed stable test locations are `test/contracts/`, `test/unit/`, and `test/browser/`; follow the selected starter's conventions if they differ, and record final commands here once.

Package checks must exercise installed archives in isolated consumers, including a plain Vue/Vite consumer and a Nuxt consumer. Source aliases and sibling symlinks are useful during local iteration but cannot certify an npm package. Do not commit `file:`, `link:`, absolute paths, or sibling source imports as release dependencies.

## 6. Execution order and status

Statuses: `TODO`, `IN PROGRESS`, `READY FOR REVIEW`, `ACCEPTED`, `BLOCKED`. A block needs a concrete reason and owner. Acceptance records must identify the reviewed revision and evidence.

| Step | Deliverable | Depends on | Review gate | Status |
|---|---|---|---|---|
| 0 | Fresh evidence, baseline and bounded work map | None | Recon review | ACCEPTED |
| 1 | Parser agreement and angle-syntax implementation | 0 | A: content safety | ACCEPTED |
| 2 | OSS library scaffold and packed Vue foundation | 0 | Scaffold review | ACCEPTED |
| 3 | Safe editor extraction and host boundaries | 1, 2 | B1: extraction | READY FOR REVIEW |
| 4 | Authoring contract and small Docs component kit | 3 | B2: contract | TODO |
| 5 | CMS adoption and ChiliSkills pilot | 4 | C: two-consumer proof | TODO |
| 6 | Complete core writing interaction | 5 | D: writing quality | TODO |
| 7 | Exact preview in each host | 5; final check after 6 | E: preview agreement | TODO |
| 8 | Complete Docs component coverage | 6, 7 | F: component coverage | TODO |
| 9 | ChiliSkills full adoption and content migration | 8 | G: application cutover | TODO |
| 10 | Public documentation and release certification | 9 | H: release readiness | TODO |
| 11 | Authorized external setup, publishing and rollout | 10 | Human release gates | TODO |

Default to serial execution. Steps 1 and 2 can be separate bounded assignments if the coordinator explicitly delegates them to different agents. Do not let two agents edit the same files. No implementation agent should execute this entire table unattended in one turn.

## 7. Step-by-step work packets

### Step 0 — Establish the current baseline

**Outcome:** the next executor has verified current source, dependencies, command behavior, and exact paths; existing failures cannot be confused with regressions.

**Scope:** read all five product repositories and the OSS handbook; update evidence/status in this plan. No product code changes.

**Work:**

1. Recheck the SHAs and dirty files above. Inspect any existing CMS `plans/` for overlapping ongoing work, without editing or adopting stale plans automatically.
2. Read source files listed in section 3 and relevant architecture/product documents. Map every import from the CMS editor into CMS-only state, assets, theme/UI components and routing. Identify generic code to move versus wrappers to keep.
3. Inspect installed Comark, Tiptap, Vue and Nuxt versions in both dependency manifests and lockfiles. Record exports actually available. Do not assume `parse` and `createMarkdownParser` exist in every version.
4. Run the focused existing parser/editor/module tests from section 5. Inspect test-runner configuration if selection fails; record the corrected exact command. Capture a representative current CMS and ChiliSkills browser flow using safe local setups.
5. Inventory document formats and import/export callers. Use fixtures and intentionally supplied local examples; do not log full private documents or environment values.
6. Define local branches/worktrees and proposed cross-repository change boundaries. Use short descriptive names, such as `feat/shared-editor` or `fix/editor-parser-parity`, without mandatory agent prefixes. If worktrees are needed, record their paths here.

**Acceptance:** source map and installed version table recorded; baseline test results separated by repository; UI baseline or exact access limitation recorded; existing local work preserved.

**Verify:** `git status --short` in every repository shows no product changes from this step. Focused commands either pass or have an actionable baseline-failure record. Do not declare the whole system green from these narrow checks.

**Prompt:**

```text
Execute Step 0 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Refresh evidence and establish focused baselines. Read the source and current
instructions; do not scaffold or alter product code. Update the plan with exact
versions, paths, baseline outcomes and proposed work boundaries. Return the
section 10 review packet and wait for recon acceptance.
```

### Step 1 — Establish one parsing contract and implement angle syntax

**Outcome:** editing, preview and publishing agree on the content language, including the accepted named angle-tag component syntax.

**Scope:** Content parser/profile/public runtime-neutral entry and tests; CMS parsing adapter and parity tests; this plan's decision record. No editor redesign, backend workflow changes or mass document rewrites.

**Work:**

1. Reproduce the installed-version differences using identical fixtures. Include public `<info>` and colon `::info` examples, inline tags, booleans `false/true`, numbers `0/3`, string `"false"`, JSON, named/default slots, nested columns, escaped delimiters, comments, code fences, Unicode and incomplete documents.
2. Compare parse, serialize, reparse, CMS conversion and Content rendering—not only standalone Comark AST output. Distinguish safe normalization from lost meaning. Include asset references and URL policy.
3. Reuse or narrowly expose the canonical runtime-neutral parser profile through Ginko Content's existing public surface. Inspect whether the current normalized tree preserves all source/conversion metadata before making the editor consume it. A direct public parser helper may be needed; do not force a lossy AST through adapters just to reuse a name.
4. Keep typed-frontmatter correction and plugin policy in Content. Update the CMS adapter to consume the agreed semantics. Ensure the browser import does not pull in Node, Nuxt server, Convex, or filesystem code. Keep old published Content exports compatible.
5. Present the angle-tag contract and matrix to the reviewer before implementing the language extension. Prove whether Comark's public parser and serializer hooks can support the bounded Content-owned extension. Escalate an upstream change only with the exact missing hook. Document accepted behavior and limitations here and in the owning repo's architecture record.
6. Add one authoritative fixture corpus in Content and a narrowly scoped test-fixture distribution mechanism only if needed by isolated consumers. Avoid manually maintained duplicate expected ASTs. Editor-specific selection/undo fixtures remain in Editor. Define how downstream tests run against the same reviewed source examples.

**Acceptance:** parity tests pass for angle and existing colon syntax through one profile; unsupported constructs have an explicit non-destructive path; no duplicated typed-prop correction; no new server imports in the browser boundary; the reviewer has accepted the Step 1A contract and Gate A implementation.

**Verify:** Content focused parser and purity tests, CMS `test/runtime/editor` tests, then Content `pnpm verify` and CMS `pnpm run check` at handoff. Add a browser-bundle/import check for the new public entry. Record pre-existing incompatibilities instead of deleting their tests.

**Gate A:** reviewer checks the actual fixture output and source preservation, dependency changes, public API compatibility, and implemented syntax contract. Do not proceed to conversion extraction with unresolved parser semantics.

#### Step 1A — Review the angle-tag contract before implementation

Matthias decided on 2026-09-12 that full named angle-tag component syntax must
be implemented before the editor rollout. This accepts the product direction,
not the parser implementation or Gate A. Colon MDC remains supported for
existing documents. It is not the preferred generated syntax for new editor
content.

Before the language extension is implemented, the executor must provide the
reviewer with fixture-backed semantics for block and inline components, nested
Markdown, typed properties, default and named slots, nested components+layouts,
escaping, code fences, comments, unknown tags, malformed/incomplete input, and
parse/serialize/reparse behavior. The contract must state how authored
components differ from ordinary HTML and how application-owned tags work in
the fixed portable profile without editor-specific parser state.

The implementation must use one maintained parser extension or an accepted
upstream Comark change. It must not preprocess source with editor-only regular
expressions. It must preserve passive HTML and existing colon documents
without rewriting them on load. Bare fragments and executable JavaScript or
Vue expressions remain excluded. Strict stored parsing and interactive
auto-close behavior must be specified and tested separately. Review of this
contract is required before editing the angle-tag parser implementation.

**Prompt:**

```text
Execute Step 1 of /Users/matthias/Git/0_libs/ginko-editor/plan.md after
accepted Step 0. Prove parser parity, implement the accepted named angle-tag
contract, and put the shared behavior in Ginko Content. Do not add an
editor-only syntax preprocessor or rewrite saved documents. Return Gate A
evidence and wait for reviewer acceptance.
```

### Step 2 — Scaffold the single-package Vue library

**Outcome:** a maintainable OSS repository builds and certifies a real Vue component package.

**Scope:** Editor repository, preserving `plan.md`; read the OSS starter and handbook. GitHub and npm changes are deferred to Step 11 unless separately authorized earlier.

**Work:**

1. Read the current OSS root instructions, `docs/content/docs/1.get-started/2.choose-a-profile.md`, `3.procedures/1.create-a-repository.md`, and `starters/library/`. Use the single-package starter, with root `src/` and `docs/`.
2. Materialize starter files without overwriting this plan or replacing `.git`. Do not create a monorepo of editor-core/editor-vue/editor-nuxt packages.
3. Use product name `Ginko Editor`, package `@lupinum/ginko-editor`, MIT, and Lupinum ownership. Intended GitHub identity is `lupinum-dev/ginko-editor`, subject to availability verification before remote creation. Proposed docs domain is `ginko-editor.lupinum.com`; do not claim DNS/deployment exists or invent an analytics ID.
4. Adapt build/type generation for `.vue` files using supported Vue tooling. The inspected starter uses a plain TypeScript tsup command; copying it unchanged does not prove Vue SFC packaging. Verify current official build-tool documentation before selecting the smallest suitable adaptation.
5. Establish package exports, explicit CSS import, CSS side-effect handling, Vue peer dependency, Tiptap dependency strategy and browser-safe entry. The scaffold smoke component is temporary and must be removed when real editor code arrives.
6. Keep the starter's command interface, dependency quarantine, CI and protected publication boundaries. Initial `pnpm install` creates the lockfile; later installs use `--frozen-lockfile`. Do not add broad dependency-policy exclusions.
7. Add minimal isolated packed Vue and Nuxt consumers. Verify component import, styles and declarations in a production build. Avoid broad Node/browser support claims beyond tested versions.

**Acceptance:** no unresolved starter placeholders; package output contains usable Vue component code, declarations and CSS; a clean consumer imports it without Nuxt/CMS runtime coupling; local instructions describe actual commands and ownership.

**Verify:** `pnpm verify`; `pnpm release:verify` once the required source commit exists under authorized Git work. If no commit is authorized, complete non-release checks and record certification's missing commit precondition. These commands must use the actual adapted package build and packed consumers.

**Prompt:**

```text
Execute Step 2 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Scaffold a single published Vue package from the current Lupinum OSS library
starter. Preserve plan.md and Git history. Prove SFC, declaration and CSS
packaging in isolated consumers. Do not implement the editor or create remote
services. Return the scaffold review packet.
```

### Step 3 — Extract existing editor behavior safely

**Outcome:** Editor contains the reusable current editing implementation, with explicit host integration boundaries and no CMS runtime dependency.

**Scope:** Editor source/tests/styles; CMS editor extraction seam and tests. Preserve CMS field/workflow wrappers. Use the parser decision accepted at Gate A.

**Work:**

1. Move reusable Tiptap extensions, conversion logic, source-mode handling and content synchronization from the source map. Preserve notices and attribution. Move generic tests/fixtures with their owner; retain consumer workflow tests in CMS.
2. Keep the extraction behavior-focused. Do not redesign slash menus or write a generic extension framework yet. Remove the scaffold smoke component.
3. Replace CMS-only imports with the minimum real integration points. Asset selection/upload/removal and persistence remain host-owned. Model cancellation as a normal result and map errors back to the UI without losing content.
4. Define `modelValue`/update behavior, external replacement, async ordering, disabled state, parse errors, mode switches and unmount. Derive state instead of persisting editor JSON or keeping a second source field in the host.
5. Preserve original source on a no-op session. Add a whole-document source-only fallback for unsupported input before attempting opaque editable nodes. Do not equate successful parsing with safe Tiptap conversion.
6. Scope editor styles and avoid bundling the CMS UI framework. Reuse accessible low-level primitives where needed; do not ban a justified small primitive dependency while hand-writing inaccessible menus.

**Acceptance:** existing supported conversion fixtures pass against the extracted implementation; no-op source equality and error recovery pass; plain Vue consumer works; imports do not reach CMS, Convex, router, Nuxt server or application state; CSS survives a production build.

**Verify:** Editor targeted conversion/sync/asset tests, `pnpm verify`, packed import smoke; CMS editor regression tests for any temporary seam. Compare old and extracted behavior for intentional parser corrections separately from extraction changes.

**Gate B1:** reviewer checks source loss, stale async updates, peer resolution, asset cancellation, and every host dependency removed. A temporary parallel implementation may exist only in the working extraction branch; remove it at Step 5 before merging the consumer cutover. If it must remain active in released code, track it in the owning `internals/migrations.md` with its exact removal condition.

**Prompt:**

```text
Execute Step 3 of /Users/matthias/Git/0_libs/ginko-editor/plan.md after
Gates A and the scaffold review pass. Extract the existing CMS editor without
adding the new UX. Preserve source and failure recovery, isolate host assets
and persistence, and keep imports browser-safe. Return Gate B1 evidence.
```

### Step 4 — Define the authoring contract and a small Docs kit

**Outcome:** a host can register its own component, and both applications can consume the same serializable metadata and initial Docs recipes.

**Scope:** Editor authoring types/validation; Docs metadata/build exports, selected authored components/styles and component-only registration; minimal Content policy extension only if demonstrated and reviewed. No full Docs site inheritance in ChiliSkills.

**Work:**

1. Implement section 4's separation between implementation metadata, explicit policy and authoring metadata. Reuse `layer/tags.ts` and `layer/components.ts` as the public tag authority.
2. Start with prose, `info`, `layout`/`column`, and a test host component such as `learning-objective` with title and default content. Do not introduce a production workshop block type for this proof.
3. Generate build-time metadata from Vue where reliable and validate it against policy. Add editorial hints only where necessary. Test a union prop, optional boolean, named slot and an unsupported complex type. Inspect Nuxt Studio's implementation as a reference, not a mandatory dependency.
4. Provide a JSON-safe kit usable across the CMS transport. A runtime-free authoring export must not import Vue components, Editor UI or Nuxt. Keep actual component imports/registration local to the rendering host.
5. Add a minimal component-only Docs integration, preferably an optional existing-package export/module. Trace transitive requirements: prose styles, CSS tokens, icons, image helpers and app-config defaults. It must not install pages, blog routes, sitemap, site SEO or host-wide fonts.
6. Define recipes once in the accepted source syntax, then parse them with the canonical engine. Do not hand-maintain both a Tiptap JSON recipe and a Markdown recipe. Validate recipe nesting and required fields.
7. Reject duplicate tags/IDs and invalid recipes. Demonstrate two editor instances with different kits and no shared mutable state.

**Acceptance:** the custom component appears through metadata alone, its props/slots round-trip, its real host renderer works, Docs rendering imports have no Editor runtime dependency, and the component-only consumer has no unintended routes/style changes.

**Verify:** new manifest/recipe tests in Editor and Docs; Editor `pnpm verify`; Docs `pnpm verify` and isolated package-entry checks. Add type tests proving valid keys are inferred and unknown property names are rejected where practical.

**Gate B2:** reviewer approves public contract shape only after seeing consumer code. Reject duplicate type sources, unnecessary wrapper functions, and a type-extraction system larger than the actual requirements.

**Prompt:**

```text
Execute Step 4 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Build the smallest serializable authoring contract and Docs component-only kit
that prove info, two columns and one host-owned component. Keep policy explicit
and metadata derived. Show real consumer registration code and return Gate B2.
```

### Step 5 — Integrate the shared editor into both consumers early

**Outcome:** the same built package runs inside CMS and a ChiliSkills pilot before the API is treated as stable.

**Scope:** CMS `FieldRichtext.vue`, existing metadata/asset/preview integration and old editor removal; ChiliSkills focused script workspace/pilot and tests; narrow Editor API corrections revealed by these consumers.

**Work:**

1. Replace CMS' internal editor imports with the shared package. Keep draft, dirty state, save/publish, permissions, asset URLs and host-preview operations in existing owners.
2. Send authoring metadata through the existing content contract. Confirm how contracts are rebuilt/versioned and how existing Studio receives them; avoid a parallel metadata endpoint. Handle absent or malformed metadata conservatively without altering source.
3. Remove the old CMS implementation and obsolete generic tests after parity passes. Keep CMS-specific adapters/tests. Use `rg` to prove no consumers still import the removed path.
4. Add a focused ChiliSkills script workspace using the real package. Use empty/new test content or disposable fixtures until Step 9's migration decision is complete. Do not reinterpret all existing saved text yet.
5. Connect to the existing module editor update path. Decide how Tiptap text undo and module-level undo interact: typing should undo predictably without a full document history entry per keystroke; changing the selected slide must not undo another slide's text. Prove the behavior before general rollout.
6. Register the same Docs kit and the test custom component in both safe consumer fixtures. Demonstrate local asset selection in ChiliSkills and existing CMS asset resolution without imposing a common backend.
7. Install local candidate archives in isolated consumers for integration evidence. Development links must remain temporary and absent from release package metadata.

**Acceptance:** both apps edit, save/reopen, switch source mode and handle a conversion error through one implementation; CMS existing media and workflow tests pass; no duplicated old editor remains in the completed CMS cutover; ChiliSkills production data is untouched by the pilot.

**Verify:** Editor focused tests for API changes; CMS `pnpm run check` and relevant workflow/browser tests; ChiliSkills focused module/component tests, `pnpm typecheck` and browser pilot; packed smoke for both integrations. The wider ChiliSkills gate belongs to the full cutover unless pilot changes affect broader behavior.

**Gate C:** reviewer operates both applications, inspects host integration code, and rejects APIs that only fit one consumer. Consolidate any provisional API changes before expanding features.

**Prompt:**

```text
Execute Step 5 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Adopt the shared editor in CMS and a safe ChiliSkills script pilot. Preserve
existing host persistence/assets/undo, transport JSON metadata through the
existing CMS contract, and remove the old CMS editor after parity is proved.
Return Gate C with browser evidence from both consumers.
```

### Step 6 — Complete the core writing experience

**Outcome:** the initial component set is pleasant and reliable to write with in both applications.

**Scope:** Editor interactions, node views, styles and tests; host integration only when required for the accepted shared contract.

**Work:**

1. Add slash suggestions using the current supported Tiptap mechanism. Include search, categories, labels, arrow keys, Enter, Escape, and a visible plus button. Preserve selection and focus on insert/cancel; do not trigger inside code blocks or during IME composition.
2. Add selection formatting and block actions for move, duplicate and delete. Keyboard move controls must provide the same outcome as drag. Keep destructive block actions undoable.
3. Implement readable two-column authoring views with editable content in both columns. Test cursor movement across boundaries, empty-slot placeholders, Enter/Backspace, nesting, paste, deleting a parent and undoing it.
4. Build property controls from validated metadata: text, enum, boolean, number and the justified asset/advanced controls. Preserve distinctions between omitted, empty, zero and false. Invalid transient form input must not corrupt the source.
5. Implement contextual child insertion. Prevent invalid parent/child placement in slash, drag and paste paths using the same structural rules. Do not keep these invariants only in toolbar handlers.
6. Add stable source/visual transitions and conversion diagnostics. Ensure incomplete source remains editable and users can recover without losing what they typed.
7. Use applicable accessibility, layout, typography and animation skills when implementing these surfaces. Respect reduced motion, touch targets and existing host design. Animate only where it improves feedback.

**Acceptance:** keyboard-only authors can insert and configure a valid layout, edit both slots, move it, undo/redo and return to the host; mobile insertion works without slash typing; no selection jumps or duplicated history entries occur in the tested journeys.

**Verify:** Editor unit and browser tests, including IME/paste/source-mode cases; `pnpm verify`; targeted interaction tests in both hosts. Record desktop and 390px-wide behavior and inspect a representative long document. Measure typing and preview behavior before adding performance machinery.

**Gate D:** reviewer evaluates actual writing behavior, not just screenshots or implementation-shaped tests. Correct observed focus/cursor defects before accepting.

**Prompt:**

```text
Execute Step 6 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Complete slash/plus insertion, block actions, typed property controls and
editable two-column node views for the initial kit. Prove keyboard, touch,
undo, paste and source recovery behavior in both hosts. Return Gate D.
```

### Step 7 — Connect trustworthy previews

**Outcome:** authors can see the actual host rendering of current content without creating a second parser or publishing drafts accidentally.

**Scope:** host preview integration, canonical Content renderer usage, minimal Editor preview integration point, tests.

**Work:**

1. In ChiliSkills, render the current source through the accepted Content profile and actual Docs/application components. Use the component-only styles. Avoid fake full document envelopes if an existing body-render entry already fits; inspect the public API first.
2. Debounce expensive work only as necessary. Cancel/ignore stale parse results. A parse error keeps the user's source intact and identifies that preview is stale or unavailable rather than presenting it as current.
3. In CMS, reuse its authorized host draft preview. For live unsaved preview, inspect existing capabilities before adding transport. Never serialize Vue functions/components into the manifest or publish merely to preview.
4. If an embedded host preview is needed and fits the existing host architecture, keep its payload and origin contract explicit and reuse existing authorization. Validate message origin/source, scoped document identity and payload; never use unrestricted `postMessage('*')` for drafts. Do not introduce a messaging bridge if existing preview navigation is sufficient.
5. Label preview state honestly: editing structure, current-content preview, or saved host draft. A saved-only preview must not claim to show unsaved edits. If live unsaved CMS preview cannot fit without material new infrastructure, present the concrete limitation to the reviewer rather than silently replacing it with generic rendering.
6. Test the custom component with the real host implementation and theme. Verify links, image/asset paths, named slots and interactive components. Apply the same content policy as publishing.

**Acceptance:** preview and published/rendered meaning agree on the canonical corpus; the custom component renders correctly in each host; quick edits cannot show older output as current; preview never writes publication state; failure and stale-state behavior are explicit.

**Verify:** targeted host preview/browser tests; Content parser/render tests if modified; owning aggregate gate for changed public behavior. Prove unauthorized cross-document preview is rejected if transport changed.

**Gate E:** reviewer compares source, preview and published output using the same fixtures and verifies unsaved/saved labeling.

**Prompt:**

```text
Execute Step 7 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Connect actual host previews using the canonical parser and renderer. Reuse
CMS draft preview, keep unsaved/saved state honest, prevent stale async output,
and verify application-owned components. Return Gate E evidence.
```

### Step 8 — Cover the complete Ginko Docs component vocabulary

**Outcome:** every public Docs tag has a defined, tested authoring path and safe source behavior.

**Scope:** Docs authoring manifest/recipes, Editor node views only where existing capabilities are insufficient, component coverage tests and docs examples. Do not add new public Docs tags merely to meet the plan.

**Work:**

1. Derive the inventory from `layer/tags.ts`. For each tag record insertion path, policy, props/slots, parent constraints, authoring representation, preview fixture and round-trip fixture.
2. Expand by families: notices/prose; layout/cards; tabs/accordion; steps/timeline; figures/files/media; quizzes; code/API/navigation-aware components. Keep each family a bounded patch and ask for review when it changes the shared contract.
3. Create valid composite recipes. Child tags have contextual insertion. Avoid duplicate definitions of variants in multiple slash menus.
4. For host-dependent components such as table of contents, files or navigation-aware links, state the required host capability. Disable unavailable insertion with a clear reason instead of inserting broken content. Preserve existing source even when that host capability is absent.
5. Verify equivalent props/slots and actual rendered content after editing. Generic nodes are acceptable for uncommon/advanced components when they remain useful and safe; important layout recipes require purposeful views.
6. Add coverage tests comparing registry keys to manifest and fixture coverage, so new public tags cannot silently disappear from authoring support. Test behavior, not merely equal counts.

**Acceptance:** every registry tag is covered by a recipe, valid contextual insertion, advanced insertion or an explicitly documented source-only path accepted by the reviewer; every supported visual path preserves semantics; no invalid raw child recipe appears at top level.

**Verify:** full manifest/recipe/round-trip matrix; Docs `pnpm verify`; Editor `pnpm verify`; representative browser journeys for each component family. Do not run a separate identical browser test for every label variant when contract coverage suffices.

**Gate F:** reviewer checks the coverage matrix and exercises the highest-risk composites. Unexplained source-only gaps in required layouts block acceptance.

**Prompt:**

```text
Execute Step 8 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Cover the live Ginko Docs public component registry with valid recipes,
contextual insertion, preserved props/slots and real preview fixtures. Expand
in small component families, keep capability limits explicit, and return Gate F.
```

### Step 9 — Complete ChiliSkills adoption and migration

**Outcome:** slide scripts, text-block bodies and assignment bodies use the shared editor safely, including saved documents and backups.

**Scope:** ChiliSkills workshop writing UI, existing schema/import/persistence/undo owners, component-only Docs integration and tests. Speaker notes and slide content remain unchanged.

**Work:**

1. Inspect actual stored/importable formats and representative user-approved examples. Determine whether existing strings intentionally contain Markdown or are literal text. Do not use a heuristic that silently guesses differently on each load.
2. If a hard cutover is safe because no meaningful saved dependencies exist, document the evidence. Otherwise use a one-time schema-version migration through `readModule()` and existing import paths, preserving literal text/line breaks as intended. Do not add parallel `plainText` and `markdown` fields.
3. Preserve a recoverable original backup before rewriting user data. Test current v2 documents, older legacy imports, Unicode, Markdown-looking text, blank content, asset references and backup ZIP restore. Migration must be idempotent and must not mutate the original input object.
4. Replace all three requested textarea surfaces through the same focused editor integration. Maintain the existing German product vocabulary and visual identity. Keep the compact slide excerpt and private speaker notes.
5. Make autosave/module-history integration reliable across fast typing, app reload, source errors, closing the workspace and switching between documents. Flush valid pending input through the owning save path; retain invalid source as recoverable author input according to the approved contract.
6. Use mounted active editors rather than one heavy editor per collapsed slide. Resolve observed Nuxt/peer mismatches in a focused dependency change only if required by the component kit.
7. Remove pilot-only code, obsolete textarea branches and temporary local package links. Keep migration code only while old saved documents/backups are supported; document its exact dependency and removal condition in `internals/migrations.md` if temporary.

**Acceptance:** all three fields save/reopen correctly; old documents and backups follow an explicit tested conversion; module undo and editor undo are predictable; presentation, import/export, notes and asset behavior remain intact; no duplicate persistence state exists.

**Verify:** `pnpm exec vitest run tests/unit/module.test.ts tests/component/module-editor.test.ts`, focused new migration tests, `pnpm check`, and `pnpm test:e2e -- tests/e2e/script-editor.spec.ts`. The new browser journey must edit each field, insert a layout, configure a custom component fixture, preview, undo, reload and restore an exported backup. Recheck existing import/presentation journeys where touched.

**Gate G:** reviewer inspects migration before any user-data rewrite and approves the complete local cutover only after the save/reload/restore proof. If data interpretation remains ambiguous, bring actual bounded examples and a recommendation to Matthias; continue independent UI work.

**Prompt:**

```text
Execute Step 9 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Finish ChiliSkills script/text/assignment adoption through existing persistence
and undo. Resolve legacy text semantics with evidence and a one-time migration
only if needed. Preserve backups, notes, slide rendering and imports. Return
Gate G with save/reload/restore and browser evidence.
```

### Step 10 — Document and certify the release candidates

**Outcome:** the new package and each changed dependency/consumer can be reviewed and released from exact verified artifacts.

**Scope:** Editor public docs/examples/package contracts/release metadata; necessary Docs/Content/CMS integration docs and package certification; final consumer verification. No publication yet.

**Work:**

1. Write public installation and minimal usage examples for plain Vue, Nuxt, Ginko Docs kits, custom components, host asset selection, source mode, errors, styles and preview. Clearly distinguish host saving from editor input. Remove placeholder demo code.
2. Document syntax decisions, source normalization and unsupported-input behavior. Describe the smallest custom component registration once and test that example. Keep English/German Docs content aligned where repository policy requires it.
3. Finalize peer ranges against tested Vue/Tiptap/Nuxt/Content versions. Verify browser-safe/type-only exports and CSS retention. Do not advertise framework-neutral editing when the package requires Vue.
4. Run isolated archives through plain Vue and Nuxt production consumers. Include a separately built CMS Studio integration and ChiliSkills production build so source aliases cannot hide missing files or undeclared dependencies.
5. Use existing local package rehearsal tools for coordinated unpublished changes. Keep all temporary specifiers out of publishable artifacts. Preserve each repository's compatibility authority rather than adding a second version matrix.
6. Review every changed repository for obsolete code, duplicate schema/policy, derived state without rebuild rules, leaked CMS imports, unsafe source conversion and abandoned compatibility code.
7. Prepare per-repository PR boundaries and release order. Content must be available before downstream code requiring its new contract; Docs and Editor order follows their actual dependency graph. Keep type-only Docs authoring metadata free of a mandatory Editor runtime dependency to avoid a cycle. CMS' contract/Convex/CMS internal publication order remains owned by its current runbook.
8. Run the relevant release gates once on the intended final revisions, retaining exact archives, checksums, CI IDs and source SHAs. Record missing live credentials/services as unverified, never as passed.

**Acceptance:** examples work from package installs; all required source/browser/packed checks pass; artifacts have no local dependencies; dependencies form an acyclic graph; public behavior and migrations are documented; no release is described as live before publication.

**Verify:** Editor, Content and Docs `pnpm release:verify` where changed; CMS's current source/candidate/registry lanes at their documented preconditions; ChiliSkills `pnpm check` and relevant end-to-end journey. Use aggregate composition to avoid duplicate full checks. CI must certify exact release commits.

**Gate H:** reviewer examines public API examples, package contents, dependency graph, final diffs, browser acceptance and rollout/rollback evidence. New code after certification invalidates that candidate and requires proportionate re-verification.

**Prompt:**

```text
Execute Step 10 of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Complete public docs and examples, certify exact packed consumers, remove
temporary integration paths, and prepare the cross-repository release order.
Follow each repository's own runbook. Do not publish. Return Gate H with exact
revision/artifact evidence and unresolved external gates.
```

### Step 11 — Perform the authorized external rollout

**Outcome:** verified packages are available through the approved release process and both applications use registry artifacts with final smoke evidence.

**Scope:** only authorized GitHub/npm/docs-hosting setup and release operations, package version adoption, post-release verification and cleanup. If external setup was separately authorized earlier, inspect/reuse it rather than recreate it.

**Work:**

1. Verify name availability and intended owner/visibility for `lupinum-dev/ginko-editor` and `@lupinum/ginko-editor`. Create the GitHub repository only with applicable authorization. Follow current OSS creation and launch procedures; use `gh-publish-pr` for publishing local work.
2. Apply supported repository settings and read them back: real required checks, protected branch/release controls, minimal workflow permissions, SHA-pinned Actions and protected npm environment. Do not make optional Vercel previews a required check.
3. Open one `Launch checklist` issue listing only unresolved human/provider gates with handbook links. Do not fabricate provider ownership, analytics IDs, DNS, trust records or reviewer availability. External-service setup must not delay already-authorized local implementation.
4. If docs hosting is authorized, configure the actual final domain and `docs/` root with access to workspace source. Follow current on-demand preview, production and analytics policy. Do not silently migrate existing application deployments.
5. Publish upstream changes in the verified dependency order. For the new npm package, use the handbook's explicit first-release bootstrap with the exact certified archive and required human authentication. Then bind the actual workflow/environment as trusted publisher and verify the record. Do not use a generic automated first-publish shortcut.
6. Follow each existing repository's current protected release process. CMS has a distinct release-candidate runbook and channel policy; do not replace it with the new library's starter procedure as part of this task.
7. Replace local candidate dependencies with approved registry versions, update owning lockfiles/compatibility records and run registry consumer verification. Merge/deploy only within the external action authorization and repository policy.
8. Verify installed version/integrity, CSS and custom component registration, both host writing journeys, source recovery, assets and preview. Record URLs, deployed revisions and registry evidence without exposing private content or credentials.
9. Close only completed checklist items. Remove agent-owned worktrees, archives and processes that are no longer needed, preserving release evidence as required and all unrelated user work.

**Acceptance:** registry bytes match approved artifacts, runtime consumers use those versions, required release provenance/bootstrap limitations are recorded, authorized deployed surfaces pass smoke checks, and remaining human-only gates are explicit.

**Verify:** official registry/trust/release readbacks; fresh package installs; owning registry certification lanes; browser smoke on the actual authorized deployment. Local success alone does not satisfy this step.

**Prompt:**

```text
Execute the authorized portions of Step 11 in
/Users/matthias/Git/0_libs/ginko-editor/plan.md after Gate H. Re-read current
Lupinum OSS and repository release procedures, inspect existing external state,
and publish only retained certified artifacts through approved paths. Prepare
one concrete next action for any remaining human release gate. Report exact
registry/deployment evidence and do not mark unverified gates complete.
```

## 8. Test acceptance matrix

Use this matrix to assign tests to their owning layer. It supplements step-specific checks; do not duplicate identical implementation tests in every repository.

| Behavior | Primary owner | Required proof |
|---|---|---|
| Shared syntax and typed props | Content | Same canonical corpus produces equivalent supported meaning for editor and publish paths |
| Source no-op | Editor | Exact source equality after open/close and no-edit mode switching |
| Visual conversion | Editor | Semantic equality of supported props/slots/text after edit and reparse |
| Unsupported/malformed source | Editor | Original remains recoverable; no empty/partial overwrite |
| Out-of-order conversion | Editor | Older result cannot replace newer source or another document |
| Manifest/recipe validity | Editor + Docs | Invalid keys, duplicate tags, invalid nesting and missing required props fail clearly |
| Kit isolation | Editor | Two simultaneous editors with different kits do not affect each other |
| Registry coverage | Docs | Every current public tag maps to a tested authoring path |
| Component-only integration | Docs | Authored components/styles work; no unintended website routes or globals |
| Custom component | Both hosts | Same metadata contract, actual local renderer, no Editor code changes |
| Slash/plus, selection, keyboard | Editor browser tests | Complete insertion/edit/move/undo journey using keyboard and touch |
| Asset operations | Host + Editor boundary | Selection, cancellation and failure preserve source and authorized references |
| Preview fidelity | Host + Content | Same source/policy/components; no stale content presented as current |
| CMS save/publish behavior | CMS | Draft/dirty state/assets/access rules remain intact |
| Legacy data and backups | ChiliSkills | Explicit version handling, idempotent conversion, export/restore, Unicode and literal text |
| Undo/save/reload | ChiliSkills | Predictable history, no keystroke loss on switch/close/reload |
| Package correctness | Editor release tests | Clean Vue/Nuxt archive installs, types, CSS, no server imports/local specifiers |
| Published adoption | Release owners | Certified bytes, compatible registry versions, actual host smoke |

Include realistic combinations, not only empty isolated tags: columns with lists and media; tabs with named slots; false/zero/omitted properties; unknown components beside known content; Markdown-looking literal text; large scripts; rapid document switching.

## 9. Rollback and stop conditions

### Rollback

- Before publication, revert the owning focused change or return the consumer to its previous approved package. Keep original source/backup data. Do not keep two active editor implementations as a permanent fallback.
- After publication, do not delete or overwrite an npm version. Follow the owning runbook for deprecation, dist-tag changes when authorized, and a corrective release from reviewed source.
- A source-syntax change and a package rollback are not automatically compatible. Record the last version that can read newly authored documents before rollout. If old code cannot read new documents, prefer a forward fix or a tested reverse migration; never blindly deploy the old reader over new data.
- For ChiliSkills, retain original backup data before a content migration. A rollback must restore a complete consistent document/assets pair. Do not overwrite edits created after migration with an older backup without an explicit user decision.
- For CMS preview transport or metadata changes, retain published public contract compatibility and follow existing contract-transition handling. Do not bypass access checks to make a fallback work.

### Escalate to the reviewer when

- The accepted parser profile cannot preserve required content, or the bounded angle-tag extension requires an open-ended fork or a breaking upstream change.
- An extraction requires CMS/backend policy in Editor or a circular package dependency.
- Metadata extraction would require a second hand-maintained prop schema or unsupported runtime compilation.
- Existing saved text cannot be classified safely from available evidence.
- A proposed package rollback would make new documents unreadable.
- A focused fix requires a significant out-of-scope redesign, release workflow replacement or new hosted service.
- A required check repeatedly fails after diagnosis and reasonable correction, or cannot run without an unavailable external capability. Supply the first actionable error and continue independent authorized work.

Routine implementation choices, missing line numbers, harmless file moves and reparable local setup problems do not require Matthias' attention. Ask the reviewer first. Escalate a material product or external decision to Matthias only with a concrete recommendation and evidence.

## 10. Review protocol and evidence log

The coordinator assigns one bounded step using its prompt and the absolute plan path. Sol implements it and requests review. The reviewer reads the actual diff, reruns focused acceptance checks where needed, and tests the real interface at UI gates. The reviewer returns `ACCEPT`, `CHANGES REQUIRED`, or a specific unresolved decision. Sol fixes rejected work and returns updated evidence. Continue only after acceptance of dependent gates.

Review packet template:

```text
Step / gate:
Repositories, branches/worktrees and exact HEADs:
Changed files and concrete behavior:
Checks run (command, result, environment):
Browser journeys and evidence paths:
Package/fixture versions and artifact hashes if relevant:
Source preservation / migration / rollback evidence:
Known failures or unverified areas:
Removed obsolete code / temporary code still active:
Requested reviewer decision:
Recommended next step after acceptance:
```

An agent review is not human npm approval, a source test is not an isolated packed-consumer result, and a local browser trial is not deployment proof. Record those distinctions explicitly.

### Accepted decisions

- Separate repository and one shared Vue package: accepted product direction.
- Raw source remains canonical authoring persistence: accepted direction, with explicit migration analysis.
- Custom components and both consumers are first-class: accepted direction.
- Full named angle-tag component syntax before editor rollout: accepted product decision. Step 1A's syntax contract is accepted; the implementation remains pending Gate A review.
- Initial kit proves public `info`, `layout`/`column`, and one host-owned component before expanding the registry.
- No implementation or remote publication was performed while writing this plan.

### Execution evidence

Append concise dated entries here as work proceeds. Link to owning test files, architecture records, PRs and retained artifacts rather than copying their contents. Keep the status table in section 6 current.

#### 2026-09-12 — Recon accepted; execution moved to a separate Codex task

Matthias authorized implementation with GPT 5.6 Sol at medium reasoning and reviewer-controlled gates. His latest speed preference is **no Fast mode**. The earlier planning-only authorization statement records the original task, not the current implementation authorization. No external publication is authorized by this entry.

The original executor subagent was stopped at Matthias' request to use a separate Codex task. No product files were changed by that executor. Existing repository HEADs and dirty files matched section 3. Its completed focused baselines were Content: 2 files/5 tests, CMS: 16 files/49 tests, Docs: 1 file/11 tests, ChiliSkills: 2 files/7 tests; all exited 0. ChiliSkills emitted only outdated browser-mapping warnings. No baseline test process remained running.

The reviewer independently ran `pnpm exec vitest run test/runtime/editor/markdown.test.ts test/runtime/editor/use-content-sync.test.ts test/runtime/editor/use-raw-mode.test.ts` in CMS: 3 files/8 tests passed, exit 0. The reviewer inspected existing ChiliSkills at `http://localhost:3000/modules/signale-spektren` through the real browser: home-to-module navigation, focused script textarea beneath the first slide, separate private notes, and text-body editing surface. Desktop screenshots were inspected at 1280 by 720. Content was not edited; save/reload and mobile were not tested in this baseline. The existing server belongs to the user and must not be stopped.

CMS browser baseline remains unverified: its normal dev preparation invokes `convex dev --once`. Use a verified frontend-only harness or authorized safe staging later. This limitation does not block parser work or scaffolding, and must be resolved before accepting CMS UI adoption.

Reviewer findings carried into implementation: Content's runtime-neutral entry still ships in a package with required Nuxt peers, so import purity and installation footprint are separate claims. Existing CMS conversion normalizes content and strips style nodes; tests passing do not prove arbitrary source preservation. Comark 0.6.2 uses CommonMark HTML-block semantics, so do not downgrade Content or add an editor-only preprocessor to imitate CMS' older parser.

**Review verdict:** Step 0 accepted for proceeding to Steps 1 and 2, with the UI and dependency limits above explicit. The next executor should read this evidence and inspect its assigned paths, not repeat the entire baseline audit. Coordination/reviewer task: `01a09425-69ce-73d3-843f-32d46fe88775` on host `local`.

#### 2026-09-12 — Step 1A angle-tag contract accepted

The reviewer accepted the fixture-backed syntax contract before production implementation. The accepted boundary is a Ginko Content-owned Comark extension using public MarkdownIt and serializer hooks; no Comark fork, source preprocessor, or editor-owned grammar is allowed.

Lowercase standard HTML remains native, including when the component registry contains a conflicting key. PascalCase explicitly selects components and canonicalizes to existing lowercase/kebab registry keys. Lowercase non-HTML component names remain accepted. Raw editor trees retain the bounded angle-origin marker; normalized public ASTs retain only `{ component: 1, block: 0 | 1 }`, mutually exclusive with native HTML metadata. Component markers require registration and metadata is never forwarded as Vue props.

Component prop names are case-sensitive. Exact, case-only, and bound/unbound duplicates are rejected. Quoted attributes are strings, valueless attributes are `true`, and `:prop` accepts finite JSON literals only. Block tags and named-slot templates use their own logical lines; inline components support inline Markdown only. Implicit default content may occur around named slots in encounter order, while explicit and implicit default content cannot be mixed. Strict stored/publish parsing reports typed locations; interactive auto-close is derived-only. Angle source serializes as angle source, colon source remains colon source, and native HTML remains HTML.

The reviewer required collision, unsafe-native-tag, slot ambiguity, entity, code/comment, nesting, and real CMS conversion tests at Gate A. The reviewer also required an audit for existing native collision tags before consumer changes and a forward-fix/migration plan once angle-authored content exists.

#### 2026-09-12 — Step 1 implementation ready for Gate A review

The implementation is committed on isolated `fix/parser-parity` worktrees. Ginko Content revision `8d3326f259ec58a59996dae1686bc7b552903c47` adds the Content-owned angle parser and serializer extension, public runtime-neutral editing helpers, normalized component/native markers, collision-aware render policy, renderer/agent/asset handling, architecture documentation, and the authoritative conformance corpus. Ginko CMS revision `1828d9150aae77d61955b150ce97f9b70f2aea66` removes its direct Comark 0.3.2 parser, consumes the Content contract, preserves parser-origin metadata and JSON prop values through Tiptap conversion, retains source child order, and makes stored/preview/publish parsing explicitly strict.

Content `pnpm verify` passed on the committed source: dependency policy, package and documentation builds, lint and repository policies, 129 prepared test files with 1,322 tests, source and Nuxt type checks, quickstart build, and six end-to-end files with 15 tests. The focused native-collision render-policy contract passed 34 tests after fixing validation precedence. CMS `test/runtime/editor` passed 16 files with 51 tests. CMS formatting, lint/policy checks, type checks, package/Studio production build, publish-specifier check, and the complete Vitest suite were exercised against a local link to the built Content candidate. The first full CMS test pass had one unrelated five-second Convex portability timeout while Content end-to-end tests were running concurrently; the isolated test then passed and the complete CMS suite passed with 193 files and 1,315 tests, plus one skipped test. A final aggregate CMS rerun reached the complete Vitest stage after all earlier stages passed, but its terminal result was not retained across the task's usage-limit interruption; no verification process remains running.

Content remains version `1.0.0-beta.7` with Comark `^0.6.2` and one new direct `entities` `^7.0.1` dependency. CMS removes direct Comark `^0.3.2`. CMS' tracked compatibility authority still names the currently published Content `1.0.0-beta.4`; tests used the locally built Content revision above. Do not merge or release the CMS revision before a Content release provides the new helpers. Final compatible version updates and registry proof remain Step 10 work; no local/file dependency was committed.

The collision audit found no existing stored Content or CMS fixture that depends on a lowercase standard-HTML name resolving as a component. Matches outside the new corpus were Vue/templates, documentation examples, renderer output, or policy tests. No document rewrite is required now. If angle-authored content exists before a later grammar change, preserve source by forward-fixing the shared Content extension and add a one-time source migration only for demonstrated stored dependencies; do not add an editor compatibility parser.

No user-facing interface changed, so a browser interaction pass is not applicable at this gate. The CMS Studio production bundle is the browser-import proof for the new public Content entry. The corrected agent-development handbook paths were read before handoff; they did not require new app adoption machinery for this parser-only milestone. No private documentation, credentials, customer data, external publication, or production system was used. Rollback is the two commits above in CMS-first then Content order; no persisted data or source document was rewritten. Gate A remains reviewer-owned, and Step 2 or dependent conversion extraction must not start until the reviewer accepts this evidence.

The first Gate A source review returned **CHANGES REQUIRED**. Reviewer probes found premature ownership of Markdown autolinks and native HTML, inline closing scans that treated code/escapes/comments as components, incorrect fence-length tracking, destructive inline trailing-whitespace serialization, and incomplete strict structural errors for orphan closes and slot structure. The reviewer also required the portability asset rewrite path to use the canonical serializer, a lasting recovery test showing invalid raw CMS source is not replaced, and real TipTap schema acceptance or an explicit source-only fallback for nested inline components and empty slots. The original revisions above remain review history; the corrections and replacement candidate follow.

The correction candidate is Content `9da04a78896327172c71af81ca6696556cb500ce` (correction commits `e0d5a54c10e7abe181aa1350e2b51a14f77cc5a8` and `9da04a78896327172c71af81ca6696556cb500ce`) with CMS `1b123377c1388e2bb5583c949ba911707b048208` (correction commits `a1cde663c22d7b9063c13a09f52d43e79531a43e` and `1b123377c1388e2bb5583c949ba911707b048208`). Candidate classification now leaves native HTML and CommonMark URI/email autolinks to their original tokenizers. Inline matching skips escaped text, code spans, comments, and complete non-component HTML constructs. Block matching enforces CommonMark fence marker, length, indentation, and closing-tail rules. Inline serialization retains significant trailing content. Strict parsing rejects orphan/partial closes and openings, misplaced or duplicate slots, and mixed explicit/implicit defaults with original-document line and column evidence.

Portable asset rewriting now validates through the normalized policy but mutates and serializes the raw Content document, so angle, colon, and native source forms retain their owning serializer. The narrow Comark 0.6 compatibility rule for existing CMS CSS-custom-property MDC is recorded in Content's `internals/migrations.md` with its dependency and exact removal condition. CMS extends the actual TipTap schema only as required: inline components accept nested inline content and slots accept an empty block sequence. A mounted `Editor` test proves nested inline components and empty named slots survive apply and serialization, while malformed angle source returns a typed parse failure without replacing the last good editor document.

Final correction checks are green. Content `pnpm verify` passed at `9da04a7`: 129 prepared test files with 1,327 tests, all source/Nuxt type checks, package/docs/examples/quickstart builds and policies, plus six end-to-end files with 15 tests. The focused corrected contracts passed four files with 78 tests, including exact reviewer reproductions and angle-preserving portability rewrites. CMS `pnpm run check` passed at `1b123377`: formatting, lint/policies, all type checks, package and Studio production builds, publish-specifier validation, and 193 passed test files with 1,317 tests; one unrelated test remains intentionally skipped. No verification process or preview remains running. This correction supersedes the earlier candidate while preserving its audit and compatibility limitations, and is ready for Gate A re-review.

The second Gate A review returned **CHANGES REQUIRED** for two remaining precedence boundaries. The block close matcher still allowed an HTML-comment opener inside a fenced code block to hide the real fence close, and it treated a whole-line component delimiter inside a multiline CommonMark code span as structural. Asset collection and rewrite also applied a colliding component media policy to explicitly native non-image HTML. Step 1 returned to `IN PROGRESS`; the exact reviewer reproductions and native/component asset identity matrix are the required correction scope.

The second correction candidate is Ginko Content `cec8431` (`fix(markdown): respect parser context boundaries`); CMS remains `1b123377`. Fence state now has precedence over HTML-comment detection, and one shared code-span guard protects component-like whole lines in both boundary discovery and nested block tokenization. The lasting conformance assertions verify the exact fenced-comment and multiline-code-span ASTs. Asset traversal now resolves parser identity before a colliding media policy: explicitly native non-image HTML is ignored, native `img` keeps its established `src` handling, and angle/colon/legacy component paths retain registry handling. The portability matrix covers native `figure`, explicit `Figure`, native `img`, explicit `Img`, Markdown's unmarked image path, collection, storage rewrite, restore, and external rewrite.

At Content `cec8431`, the focused gate command passed four files with 80 tests plus source TypeScript and focused ESLint. A final `pnpm verify` passed: dependency and repository policies, package/docs/example/quickstart builds, 129 prepared files with 1,329 tests, source/Nuxt/consumer type checks, and six end-to-end files with 15 tests. Against that rebuilt Content candidate, CMS `conversion-pipeline` and `roundtrip` passed two files with eight tests; the CMS aggregate typecheck command also passed, including package builds, Studio production build, playground preparation, runtime Vue typecheck, and Studio typecheck. Both worktrees are clean, no test or preview process remains, and no external action occurred. Step 1 is again `READY FOR REVIEW`; only the reviewer may accept Gate A.

The third Gate A review accepted the asset-identity correction and confirmed the fence/comment reproductions, but returned **CHANGES REQUIRED** for the neighborhood-based multiline-code guard. It treated backticks in quoted component props and a preceding heading as code-span openers, and independent 250/500/1,000/2,000-line diagnostics showed quadratic rescanning. Step 1 returned to `IN PROGRESS`. The replacement must use the existing parser's block/paragraph boundaries, derive context at most once per relevant block parse, retain the fixed multiline span and source locations, and pass focused review before another aggregate run.

The focused replacement candidate is Content `b36e3d5` (`fix(markdown): derive code spans from block tokens`). It removes the whole-neighborhood heuristic. The existing MarkdownIt instance now performs an analysis-mode block tokenization with the angle rule disabled; only multiline spans within real inline-token ranges protect component-looking whole lines. A per-block-state WeakMap caches each range analysis for the lifetime of that parse, with container offsets in the key, so paragraph terminator checks do not rescan ordinary text. Exact AST tests cover the retained multiline span plus quoted-prop and heading boundaries; existing fence, indented-code, comment, list/container and location contracts remain in the focused file. A non-threshold 250/2,000-line correctness test passed; an isolated verbose run reported 22 ms for both sizes together on this machine, recorded only as diagnostic scaling evidence. Focused parser/purity/render/portability checks passed four files with 81 tests, and source TypeScript plus focused ESLint passed. Per reviewer direction, aggregate checks are deferred until this focused correction is accepted.

Focused review of `b36e3d5` kept the block-token direction but returned **CHANGES REQUIRED** because disabling angle parsing across an entire body made nested component bodies opaque HTML blocks, and raw backtick scanning still lacked inline HTML identity. Content `5b6585f` (`fix(markdown): analyze nested code contexts`) replaces the whole-body analysis with one-block analysis that starts only on ordinary content lines. Structural angle lines remain visible to the existing outer tag stack. The same MarkdownIt instance supplies both block ranges and inline token types; native HTML ranges are masked from the already-confirmed code-token scan, while genuine multiline code spans protect only their covered document lines. Cached range results remain transient to the block state. Exact round-trip AST coverage now includes nested same-name components, `Layout`/`Column`, multiline code containing apparent closes, and a native inline element whose quoted attribute contains a backtick. Focused checks passed four files with 82 tests, source TypeScript, focused ESLint, and diff hygiene. The 250/2,000-line non-threshold check completed in 16 ms in the isolated local diagnostic; the nested integration matrix completed in 12 ms. Aggregates remain deferred pending focused reviewer acceptance.

Focused review of `5b6585f` confirmed all earlier context cases but returned **CHANGES REQUIRED** because one suffix tokenization discarded later inline-token contexts, causing another suffix parse for every blank-separated paragraph, and code-unit masking used Unicode code points while MarkdownIt/JavaScript offsets use UTF-16 indices. Content `bfef1e0` (`fix(markdown): cache block context analysis`) stores every inline context returned by a suffix tokenization in one per-state/range cache, skips blank lines without analysis, and uses UTF-16 code-unit masking. The lasting scale matrix now covers 250, 500, 1,000, and 2,000 blank-separated paragraphs without time assertions; isolated diagnostics were 13/7/14/24 ms in the warmed run, showing the repeated-suffix behavior is gone. The nested/native-inline matrix includes the 🌶️ surrogate-pair case. Focused parser/portability/render/purity checks passed four files with 85 tests, plus source TypeScript, focused ESLint, and diff hygiene. Aggregates remain deferred until focused reviewer acceptance.

The reviewer accepted the focused parser correction at Content `bfef1e0`. Content `b219f55` adds the requested lasting, test-only exact reproduction combining ten astral emoji, native inline HTML with a backtick in an attribute, and a genuine multiline code span containing an apparent component close. It asserts the expected tree and code text plus source round-trip. No production behavior changed after focused acceptance.

Final Gate A aggregates are green at Content `b219f55b6a7f5d00ce134e244fa253a2dfb8aa57` and CMS `1b123377c1388e2bb5583c949ba911707b048208`. Content `pnpm verify` passed dependency/repository/release policies, package/docs/examples/quickstart builds, 129 prepared test files with 1,334 tests, source/Nuxt/consumer type checks, and six end-to-end files with 15 tests. Against the rebuilt and locally linked final Content checkout, CMS `pnpm run check` passed formatting, lint and repository policies, all package/runtime/Studio type checks, package and Studio production builds, playground preparation, publish-specifier validation, and 193 test files with 1,317 tests; one test remains intentionally skipped. Both worktrees are clean, `git diff --check` passes, and no Step 1 verification or preview process remains running.

The release limitation is unchanged: Content remains `1.0.0-beta.7`, while CMS' tracked compatibility authority still names the published Content `1.0.0-beta.4`. No local or `file:` dependency specifier was committed. CMS must not merge or release before a Content release supplies the new helpers; version finalization and registry proof remain Step 10 work. No browser journey is applicable because Step 1 changes parsing and shared conversion behavior without changing the interface; the CMS Studio production build is the browser-import proof. No persisted data was migrated, no document was rewritten, and no external action occurred. Step 1 is `READY FOR REVIEW`; only the reviewer may accept Gate A, and Step 2 remains blocked until that decision.

#### 2026-09-12 — Reviewer accepts Gate A and assigns Step 2

**Gate A: ACCEPTED** by coordinator task `01a09425-69ce-73d3-843f-32d46fe88775` at Content `b219f55b6a7f5d00ce134e244fa253a2dfb8aa57` and CMS `1b123377c1388e2bb5583c949ba911707b048208`. This verdict supersedes the pending statuses in the historical entries above.

The reviewer inspected the production changes and successive corrections, independently reproduced the reported defects, and verified their correction. The last independent conformance/portability run passed 67 tests. A separate focused probe verified the exact ten-emoji/native-HTML/multiline-code round trip; same-machine diagnostics measured roughly 9/12/24 ms for 500/1,000/2,000 ordinary paragraphs. These timings demonstrate the correction for that workload, not a general performance guarantee. The final commit contains only the requested lasting regression-test update and was inspected separately.

The executor's final Content `pnpm verify` and CMS `pnpm run check` both passed at the revisions above, including the rebuilt Content dependency used by CMS. The reviewer confirmed both worktrees were clean. No unresolved observed Gate A defect remains. Browser interaction, complete editor source-only behavior, packed Editor consumers, published dependency compatibility, and deployment remain later acceptance gates; passing source checks does not certify them.

Step 2 is assigned to the existing Sol task `01a0943e-9f8d-7130-81e9-e09aa36cae34`, using `/Users/matthias/Git/0_libs/ginko-editor` as the scaffold destination. Preserve this plan and `.git`, follow the current Lupinum OSS single-package library starter, and prove actual Vue SFC/declaration/CSS packaging with isolated Vue and Nuxt consumers. Local scoped commits and local certification are authorized. Do not implement the editor, start Step 3, alter the accepted Content/CMS candidates, or create external repositories/services during this step. Continue without Fast mode and return the scaffold review packet before advancing.

#### 2026-09-12 — Step 2 scaffold ready for review

The current Lupinum OSS single-package library starter was materialized as one root `@lupinum/ginko-editor` package with root `src/`, `test/`, `scripts/`, and `docs/`; `plan.md` and the existing Git repository were preserved. All product placeholders were replaced with Ginko Editor, Lupinum ownership, intended repository `lupinum-dev/ginko-editor`, and proposed documentation domain `ginko-editor.lupinum.com`. Analytics and feedback stay disabled, and no remote repository, npm package, DNS record, deployment, issue, or other external state was created.

The Vue package adaptation follows current official Vite library-mode and Vue TypeScript guidance. Vite 8 with the official Vue plugin compiles the temporary `GinkoEditorScaffold.vue` smoke component to one browser-safe ESM entry while externalizing Vue. `vue-tsc` emits the public entry and SFC declarations. Vite emits `dist/style.css`, which is exposed as `@lupinum/ginko-editor/style.css` and retained through the package's CSS side-effect declaration. Vue is the only runtime peer. No Content, Tiptap, Nuxt, CMS, or application dependency was added merely for scaffolding; Step 3 owns the dependency decision from the real extraction. The temporary smoke component, its test, and its CSS are documented for removal in Step 3.

Implementation commits are `1ed1bd2` (`feat: scaffold Vue editor package`) and `070c285` (`test: complete packed consumer type setup`). `pnpm verify` passed dependency quarantine, lint, SFC type checking, one package test, the Vite library build and declarations, and the Ginko Docs production build. The first `pnpm release:verify` exposed an incomplete isolated Vue consumer harness: Vite 8 declarations required Node types and an ESNext library. The focused packed-consumer rerun passed after adding those consumer-only settings. The complete release certification then passed: zero known audit vulnerabilities, the full `pnpm verify` aggregate, an inert `0.1.0` archive, and clean archive installs plus type checks and production builds in both Vue 3.5.42/Vite 8.1.5 and Nuxt 4.5.2 consumers. Both consumers import the actual tarball, not source aliases or links, and the verifier checks the CSS marker, public entry declaration, and SFC declaration in installed output. Final archive identity and source commit are recorded in the generated ignored `release-artifacts/release.json` for local review; nothing was published.

Step 2 is `READY FOR REVIEW`. A browser interaction pass is not applicable to this temporary smoke component because it exists only to certify package mechanics and will be removed before the editor UI milestone. Step 3 remains blocked until the reviewer accepts this scaffold, and the accepted Content/CMS Step 1 candidates were not changed.

#### 2026-09-12 — Reviewer accepts Step 2 and assigns extraction

**Step 2: ACCEPTED** at Editor `5cec45cf873049d7e335d514822a5de24dfdaffa`. The reviewer inspected repository instructions, build/type/CSS configuration, the temporary component, certification scripts, documentation, and the packed files. The retained archive SHA-256 was independently verified as `571bc903a28fcf4cd2ae8254066ca396432459783a1cc1df67fc28bda1b15307`; its manifest identifies that source revision. The emitted JavaScript imports only Vue, and the archive includes its public entry, SFC declarations and explicit CSS export.

The reviewer independently ran `node scripts/verify-packed-consumer.mjs` against that retained archive: isolated Vue and Nuxt installations, declaration checks, production builds and CSS-retention checks passed. The executor's `pnpm verify` and final `pnpm release:verify` evidence remains attached above. This acceptance covers the scaffold, not editor functionality or a published package.

The reviewer also served the built docs on an owned loopback-only static server and inspected the real page. Home-to-documentation navigation, searching for scaffold content, opening the matching section, the code example, and the mobile page-navigation control were verified. Screenshots were inspected at the default desktop viewport and 390 by 844. The temporary viewport was reset, the review tab closed, and the owned server stopped. The unrelated docs development process reported by the executor was neither started nor stopped by this reviewer; its ownership remains unknown.

Step 3 is assigned to the existing Sol task. Extract the accepted CMS editor behavior into this package, remove the temporary scaffold component and its tests/fixtures, preserve raw source on no-op sessions and failures, and keep assets/persistence in the host. Use the shared Content parser without copying its grammar. Resolve the known distinction between browser import purity and Content's package-install footprint explicitly; do not introduce Nuxt/CMS/backend runtime coupling or a second parser to make a plain Vue consumer pass. Return Gate B1 evidence before host adoption or new writing UX.

#### 2026-09-12 — Step 3 extraction ready for review

Step 3 is implemented at Editor `2dce3be9c5edc88dfb9d50ce83a2b25c40825b71`. The temporary scaffold was removed and replaced by the extracted `GinkoEditor`, TipTap schema/extensions, conversion pipeline, scoped UI, explicit asset request events, and exposed insertion methods. Markdown remains canonical. Initial load and mode switches do not emit; unsupported or invalid source stays intact in whole-document source mode; a generation guard cancels pending or stale conversions on external replacement and unmount. The package imports only `@lupinum/ginko-content/cms-contract` for parsing and serialization. Its built entry externalizes Vue, TipTap, and that Content subpath and contains no CMS, Convex, router, Nuxt server, or application-state import.

The focused gate passes 17 tests across four files. It covers the five accepted CMS conversion fixtures, the actual TipTap schema, semantic preservation after edits, exact no-op equality, edit/undo, source-only fallback, invalid-source recovery, newest-document ordering, cancellation of pending local updates, unmount cancellation, and a cancelled asset request. `pnpm verify` passed dependency policy, lint, type checking, those tests, the Editor build, and the documentation production build. `pnpm release:verify` then passed the audit and full verification again and certified isolated Vue and Nuxt installs, type checks, production builds, declarations, and CSS using the accepted Content candidate archive. The retained Editor archive is `release-artifacts/lupinum-ginko-editor-0.1.0.tgz`, SHA-256 `6b985cf182df7a1566399478d186d6c176fd5f00309511a40799775a889ad875`.

A real Chromium journey at 1280×720 loaded the built Editor package with the actual TipTap surface and accessible toolbar. The exact input `# Browser journey\n\nEdit this paragraph.\n` survived Visual → Markdown unchanged. Replacing the source with `# Browser journey\n\nEdited in Chromium.\n` rendered the new document. Typing ` More text.` in the visual editor updated the host model to `# Browser journey\n\nEdited in Chromium. More text.\n`; Undo restored the prior source. The only console noise came from the temporary Vite preview's unset Vue feature flags and its missing favicon, not the editor. The preview server and files were removed after verification.

The release blocker is explicit: the accepted Content candidate still identifies as `1.0.0-beta.7`, but the npm archive for that version does not export `parseMdcDocument` or `serializeMdcDocument`. The normal Editor manifest contains no local/file dependency. Local certification therefore used `GINKO_CONTENT_TARBALL` with the accepted Gate A candidate. A new published Content version containing those helpers, a matching Editor minimum version, and registry-only consumer proof remain required before release. Content's broader install footprint, including its Nuxt peer/dependencies, also remains a release review item even though the Editor browser bundle is pure. The accepted CMS candidate was not changed; its current editor is the documented temporary copy to remove during the Step 5 consumer cutover.

Step 3 is `READY FOR REVIEW`. Only the reviewer may accept Gate B1. Do not start Step 4 or consumer adoption before that verdict.

#### 2026-09-12 — Step 3 Gate B1 correction ready for re-review

The first Gate B1 review returned **CHANGES REQUIRED** after real-browser and
mounted-lifecycle probes found stale source resurrection, unsafe late asset
completion, pending edits lost on close, permissive schema fallback, collapsed
media block boundaries, and toolbar styles that did not reach the child
component. The focused correction is Editor
`7e1b81a90a3c0d5a0d33509ef8809bee4b88bd65` (`fix: harden editor lifecycle
boundaries`).

The component now exposes an async `flush()` result that hosts must await before
close or document replacement. It drains edits that arrive during conversion,
stays failed across repeated calls until recovery, and never claims persistence.
Asset events carry request-scoped completion callbacks tied to the initiating
editor, revision, document, selection, mode, editability, feature flag, and
lifetime. Direct media operations enforce the same active visual-document
boundary. Echo tracking is bounded to the latest emitted value; a current
external replacement remains the source shown by both modes.

Visual preparation and application now construct the document with the actual
TipTap schema and call `check()`. Unknown or structurally invalid content fails
closed without mutating the editor. The accepted five-fixture corpus is mounted
through that schema: four supported fixtures open visually without emission,
while the comment-bearing angle fixture remains byte-for-byte available in
source mode because Step 3 has no comment node. Blockquote and named-slot inline
runs are normalized into schema-valid paragraphs, including inline, nested and
empty named-slot coverage. Markdown image/file media retain block boundaries at
root and nested structural depths, so a following heading survives reparse.
Toolbar commands are typed and their styles now live with the toolbar component.

`pnpm verify` passed dependency policy, lint, type checking, 34 tests across five
files, the Editor build, and the documentation production build. With the
accepted Content candidate archive supplied through `GINKO_CONTENT_TARBALL`,
`pnpm release:verify` passed the audit and aggregate checks again, then certified
clean packed Vue and Nuxt consumers. The retained Editor archive SHA-256 is
`d3465d39774aa7e992b84085bfdd636e4139b7d32ee401d15ebe1acb0dc93dd7`.

A fresh Chromium check verified the toolbar button's computed border, radius,
and padding; inserted an image before `# Review document`; observed exact source
`![Sample](/sample.svg)\n\n# Review document\n\nOriginal paragraph.\n`; and switched
back to Visual with both image and `h1` intact. The owned preview processes and
temporary files were removed. No external action occurred. The registry Content
helper/version blocker from the original packet remains unchanged. Step 3 is
again `READY FOR REVIEW`; Step 4 has not started.
