> **Playground overhaul — implemented by Astra (2026-09-13).** Matthias requested a full UI/UX overhaul personally by the coordinating Astra agent. This authorizes the playground preview work ahead of the earlier Step 7 pause; authenticated CMS acceptance remains separate and incomplete. Acceptance: a cursor-anchored searchable slash menu, native writing blocks and host recipes, real component previews, coherent light/dark and narrow layouts, keyboard/focus recovery, durable local drafts, and successful Editor verification plus actual browser interaction checks. No publishing or deployment is included. The implementation adds 13 commands, host-owned preview slots, real component examples, image URL validation, and automatic local draft saving. Independent review findings were corrected. Browser checks covered light/dark themes, 390-pixel layout, slash search/insertion, component properties, image validation/rendering, undo, source recovery, reload/navigation persistence, and documentation search. Full Editor verification passes 83 tests plus type/lint/package/docs builds. This acceptance is for the playground overhaul; it does not certify complete Notion feature parity or close the authenticated CMS gate.

# Ginko Editor implementation and rollout plan

Prepared: 2026-09-12. Owner: Matthias / Lupinum. Intended executor: GPT 5.6 Sol, medium reasoning. Reviewer: the coordinating agent that assigns each milestone.

## 1. Current authorization and how to use this plan

This plan began before implementation. Steps 0–3 are now accepted, and Step 4 has a working Editor/Docs candidate and local playground. Section 6 and the dated review entries own current status; the original reconnaissance remains historical evidence. No external publication is authorized.

**Product and architecture goal:** Ginko Content should own the document’s meaning, and Ginko Editor should turn that contract into a good writing experience. CMS and ChiliSkills should need very little integration code.

**Current checkpoint, 2026-09-12:** Gate B2 and Step 6 / Gate D are accepted for local development. Step 5's pending-edit, asset, candidate-setup and V2 package corrections are reviewed, including a real ChiliSkills image export/restore round trip. Gate C remains open for the authenticated CMS save/reload journey. A local CMS host is available at `http://localhost:3000/studio`, awaiting development-account sign-in. Step 7 remains unassigned. Publication, deployment and production migrations remain unauthorized; scoped local commits are authorized.

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
| Ginko Content | Document parsing/serialization, canonical node identity, shared document-validity rules and diagnostics, derived render body, explicit rendering boundary |
| Ginko Editor | Tiptap conversion and representability, editing lifecycle, slash/plus insertion, selection, properties, layouts, undo, authoring UI metadata and scoped styles |
| Ginko Docs | Its Vue/prose components, explicit content policy, generated implementation metadata, authoring labels and recipes |
| Ginko CMS | Draft/save/publish workflow, access control, asset operations, metadata transport and host preview |
| ChiliSkills | Workshop context, local storage, backup/import, document migrations, module undo, script workspace |

The renderer must not depend on the editor at runtime. Docs' optional authoring entry may use editor types as type-only development dependencies; its rendering entry must not import editor code. Content must never depend on CMS, Docs or Editor. Editor must never depend on CMS or ChiliSkills. Avoid introducing a new package just to share a few types when an existing neutral owner fits.

### Component definition and metadata

There are three different facts, each with one owner:

1. **Implementation metadata:** Vue declares actual props/defaults/slots. Extract representable metadata during build where practical. Do not ship an SFC compiler in the editor browser bundle.
2. **Content policy:** the component owner explicitly allows a subset of props and slots for authored documents. Do not automatically expose every Vue prop, event, binding or arbitrary class/style hook.
3. **Authoring metadata:** labels, icons, keywords, grouping, preferred controls, insertion suggestions and recipes. Put this next to the component kit, keyed by existing canonical tags. Rules that determine document validity, including constrained values and structural parent/slot rules, belong to Content policy and its validator. Pure menu preferences remain authoring hints and must not silently invalidate stored source.

Combine these into a serializable authoring manifest. Validate that allowed fields exist and are type-compatible. Derive enum choices/defaults when extraction is reliable; allow explicit authoring control hints for cases that cannot be represented, without duplicating the underlying type declaration. Unsupported complex props use a validated advanced control or source mode. Do not promise automatic form generation for every possible TypeScript type.

Reuse the existing portable policy rather than manually redeclaring its prop types inside a new editor schema. Where authoring types extend it, use inference/indexed access from the canonical types. Keep policy enforcement at the content boundary as well as UI validation.

Content must supply the shared component/native-HTML identity semantics for angle,
colon and legacy nodes. Consumers must not independently interpret parser-owned
markers. Editor may separately reject visual representation it cannot preserve;
that is different from an invalid Content document. Keep these diagnostics distinct.

Provide explicit body rendering with the selected policy and host-local component
map. A standalone preview must not invent a collection envelope to obtain a policy
from global Nuxt configuration. Keep the existing full-document renderer as the
appropriate adapter for collection, locale and reference context. Reuse rendering
logic rather than creating a competing renderer.

Retain source-preserving editing data and normalized rendering data as derived
representations where each is required. Expose the smallest operations needed to
reuse a parsed result; do not force consumers to repeat parsing merely to change
representation. Preserve strict stored-source handling and the existing no-op
source guarantee. API names and export placement are reviewed in Step 4A.

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
| 3 | Safe editor extraction and host boundaries | 1, 2 | B1: extraction | ACCEPTED |
| 4 | Content-owned document contract, Docs kit and playground | 3 | B2: local foundation accepted; CMS tuple limit below | ACCEPTED |
| 6 | Docs writing proof, then focused interaction hardening | 4 | D: initial-kit writing quality accepted | ACCEPTED |
| 5 | CMS adoption and ChiliSkills pilot | 4, 6 | C: corrections reviewed; authenticated CMS journey pending | BLOCKED |
| 7 | Exact preview in each host | 5, 6 | E: preview agreement | TODO |
| 8 | Complete Docs component coverage | 6, 7 | F: component coverage | TODO |
| 9 | ChiliSkills full adoption and content migration | 8 | G: application cutover | TODO |
| 10 | Public documentation and release certification | 9 | H: release readiness | TODO |
| 11 | Authorized external setup, publishing and rollout | 10 | Human release gates | TODO |

The current order is **4C → 6A writing proof → 6B focused hardening → 5 consumer integration → 7–11**. Step and gate identifiers are retained for historical references; table order and dependencies govern execution. Step 6 proves the shared writing experience in Docs; Step 5 must then prove it in both applications before the API is treated as stable.

Default to serial execution. Steps 1 and 2 can be separate bounded assignments if the coordinator explicitly delegates them to different agents. Do not let two agents edit the same files. No implementation agent should execute this entire table unattended in one turn.

Step 4's earlier Editor-owned validation candidate is a preserved checkpoint,
not the final shared validity authority. Its focused corrections are preserved
as regression evidence; Gate B2 now accepts the Content-owned contract through
the revised checkpoints below, with the CMS package tuple limitation recorded
in the latest acceptance entry.

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

### Step 4 — Align the Content contract, authoring kit and playground

**Outcome:** a host registers its components once, edits and renders through one document contract, and retains its own persistence/assets/workflow. Content owns shared document meaning; Editor owns the writing experience. The same JSON-safe kit and initial Docs recipes work in the playground and the two later consumers.

**Scope:** the smallest Content-owned validity/identity and explicit body-rendering contract needed by the existing Step 4 fixtures; direct Editor/Docs/playground adoption; the existing component metadata and kit proof. CMS contract readers and transport may change only as required by an accepted contract migration, without editor adoption. No ChiliSkills production changes or full Docs site inheritance.

#### Step 4A — Review the consumer contract and migration before changing it

Pause former aggregate certification and inventory the current candidate, running
checks, worktrees and dirty files. Keep the playground running and preserve useful
completed results. Use the accepted Content/CMS worktrees from Gate A; record new
revisions explicitly when later assigned changes supersede them.

Prepare one bounded proposal in this plan or a linked owning architecture record:

1. Show actual consumer snippets for: registering Docs plus a host component; editing a source string; rendering its body with an explicit instance policy/component map; CMS transporting the JSON contract through its existing path. Identify the integration code removed. Treat sample API names from discussion as proposals, not requirements.
2. Place shared validity rules (types, requiredness, constrained literal values, slots and necessary structural nesting) and canonical node classification in Content. Retain labels, menu preferences and controls with authoring/UI owners. Define how existing object-valued props, colon documents and native HTML retain their meaning.
3. Reuse the existing parser and serializer; propose only the public projection/diagnostic operations needed by these consumers. Strict stored parsing stays explicit. Do not change existing public parsing defaults without dependency evidence and an accepted migration.
4. Specify the smallest public body-rendering boundary that accepts body, policy and host-local components. Explain how the existing Nuxt full-document renderer delegates to it while preserving locale/reference behavior. Keep parsing/policy imports usable without Vue/Nuxt runtime code. State installation footprint separately from import purity.
5. Audit exact Content contract validators, serialized/generated artifacts, hashes and Content/CMS/Docs readers before adding fields. The current V1 contract rejects unknown fields; an optional TypeScript member is not automatically compatible. Propose coordinated evolution, release order and rollback based on actual dependents. Tightened validity must not silently reject or rewrite existing stored documents; apply new constraints through the accepted policy/migration boundary.
6. Define focused positive/negative fixtures, exact commands and removal criteria for duplicated Editor validity logic and temporary candidate setup. Preserve existing regressions as tests of the owning behavior. Prefer direct adoption of unpublished local APIs; retain published contracts only where dependencies require it, tracked in `internals/migrations.md`.

##### Step 4A proposed contract (review candidate, 2026-09-12)

This proposal is intentionally a versioned extension of the existing Content
contract, not a second authoring schema. The current authoring-kit aggregate stays
in Editor. Content owns the policy inside it and the operations which interpret
that policy; Docs owns the implementation and UI metadata which surround it.

**Consumer shape**

Docs continues to publish its serializable source and its component-only Nuxt
module. A host composes serializable sources separately from runtime component
imports:

```ts
// app/lib/authoring.ts — safe to import from Nuxt configuration
import { ginkoDocsAuthoringKitSource } from '@lupinum/ginko-docs/authoring'
import { composeAuthoringKits } from '@lupinum/ginko-editor/authoring'
import { learningObjectiveAuthoringSource } from './learning-objective'

export const authoringKit = await composeAuthoringKits(
  ginkoDocsAuthoringKitSource,
  learningObjectiveAuthoringSource,
)
```

The host source is plain JSON-safe data. The existing unpublished Editor
aggregate remains version 1 because its envelope did not change; its `policy`
member now requires the independently discriminated Content policy V2:

```ts
// app/lib/learning-objective.ts
import type { AuthoringKitSourceV1 } from '@lupinum/ginko-editor/authoring'

export const learningObjectiveAuthoringSource = {
  version: 1,
  policy: {
    version: 2,
    components: {
      'learning-objective': {
        kind: 'block',
        props: {
          title: { types: ['string'], required: true, allowedValues: null },
          assessed: { types: ['boolean'], required: false, allowedValues: null },
        },
        slots: ['default', 'tip'],
        allowedParents: null,
        allowedChildren: null,
        media: null,
      },
    },
  },
  implementation: {
    'learning-objective': {
      componentName: 'LearningObjective',
      props: {
        title: { required: true, types: ['string'] },
        assessed: { required: false, types: ['boolean'], default: false },
      },
      slots: ['default', 'tip'],
    },
  },
  authoring: {
    'learning-objective': {
      label: 'Learning objective',
      description: 'State what the learner should understand.',
      props: {
        title: { control: 'text', label: 'Title' },
        assessed: { control: 'toggle', label: 'Assessed' },
      },
      slots: { default: { label: 'Objective' }, tip: { label: 'Teaching tip' } },
    },
  },
  recipes: [{
    id: 'learning-objective',
    label: 'Learning objective',
    source: '<learning-objective title="Understand the contract">\nExplain the outcome.\n\n<template #tip>\nUse a concrete example.\n</template>\n</learning-objective>',
  }],
} as const satisfies AuthoringKitSourceV1
```

```ts
// nuxt.config.ts — no app component or #components import here
import ginkoDocsComponentKit from '@lupinum/ginko-docs/component-kit'
import { authoringKit } from './app/lib/authoring'

export default defineNuxtConfig({
  modules: [ginkoDocsComponentKit],
  content: { componentPolicy: authoringKit.policy },
})
```

```ts
// app/lib/preview-components.ts — runtime-local implementations
import LearningObjective from '../components/LearningObjective.vue'
import { authoringKit } from './authoring'

export const previewComponents = {
  ...Object.fromEntries(Object.entries(authoringKit.implementation)
    .map(([tag, implementation]) => [tag, implementation.componentName])),
  'learning-objective': LearningObjective,
}
```

The string remains the only authoring state. Editor receives the instance-local
kit; it does not own or persist a parsed tree:

```vue
<script setup lang="ts">
import { GinkoEditor } from '@lupinum/ginko-editor'
import { authoringKit } from './authoring'

const source = defineModel<string>({ required: true })
</script>

<template>
  <GinkoEditor v-model="source" :authoring-kit="authoringKit" />
</template>
```

A preview parses strictly, keeps the last valid body in host UI state, and renders
that body through the new explicit component. `ContentBodyRenderer` is also a
Nuxt auto-import when the Content module is installed:

```vue
<script setup lang="ts">
import ContentBodyRenderer from '@lupinum/ginko-content/body-renderer'
import {
  parseMdcBody,
  validatePublicMarkdownAst,
  type ParseMdcBodyResult,
} from '@lupinum/ginko-content/cms-contract'
import { authoringKit } from './authoring'
import { previewComponents } from './preview-components'
import { shallowRef, watch } from 'vue'

const source = defineModel<string>({ required: true })
const body = shallowRef<ParseMdcBodyResult['body']>()
const previewError = shallowRef<unknown>()

watch(source, async (value, _oldValue, onCleanup) => {
  let stale = false
  onCleanup(() => { stale = true })
  try {
    const next = await parseMdcBody(value, { autoClose: false })
    const result = validatePublicMarkdownAst(next.body, authoringKit.policy)
    if (!result.ok) throw new Error(result.issues[0]?.message ?? 'Invalid content')
    if (!stale) {
      body.value = result.value
      previewError.value = undefined
    }
  } catch (error) {
    if (!stale) previewError.value = error
  }
}, { immediate: true })
</script>

<template>
  <ContentBodyRenderer
    v-if="body"
    :body="body"
    :policy="authoringKit.policy"
    :components="previewComponents"
  />
</template>
```

The real implementation keeps the candidate's post-`await` revision guard and
explicit stale/error UI; the abbreviated snippet only shows the data boundary.
The Content renderer does not own debounce, stale-body retention, or error copy.

CMS receives the same policy through the existing Content configuration and
artifact path, rather than through an Editor-specific transport:

```ts
// The same nuxt.config.ts adds the existing CMS options; componentPolicy above
// remains the single Content/CMS contract source.
export default defineNuxtConfig({
  modules: [ginkoDocsComponentKit, '@lupinum/ginko-cms'],
  content: { componentPolicy: authoringKit.policy },
  ginkoCms: { /* existing workflow/presentation options */ },
})
```

```json
{
  "format": "ginko-content-contract",
  "version": 2,
  "collections": {
    "docs": {
      "componentPolicy": {
        "version": 2,
        "components": {
          "info": {
            "kind": "block",
            "props": {
              "appearance": {
                "types": ["string"],
                "required": false,
                "allowedValues": ["quiet", "tint"]
              }
            },
            "slots": ["default"],
            "allowedParents": null,
            "allowedChildren": null,
            "media": null
          }
        }
      }
    }
  }
}
```

Content still writes `.ginko/content-contract.json`; CMS still reads it, hashes
the canonical JSON, installs it in `cmsContract`, and projects the policy into
each collection's `settings.componentPolicy`. CMS continues to transport and
save `bodyMdc` strings. Parsed bodies remain derived publication/preview data.

This removes the playground's fake `{ body, collection: 'docs' }` envelope and
global `content.componentPolicy` assembly solely for preview; Editor's
`validateRecipeTree`, its document-value checks against implementation options,
and its parser-marker checks; Docs authoring nesting declarations; and the
full-document renderer's direct ownership of the low-level Markdown renderer. It does not remove
Editor representability checks, Docs labels/controls/recipes, host save/assets,
or CMS workflow validation.

**Exact Content policy and operations**

Add a discriminated, closed `PortableComponentPolicyV2`; do not add optional
members to V1:

```ts
type PortableComponentValueTypeV2 =
  | 'string' | 'number' | 'boolean' | 'json' | 'asset'

interface PortableComponentPropPolicyV2 {
  types: readonly [PortableComponentValueTypeV2, ...PortableComponentValueTypeV2[]]
  required: boolean
  allowedValues: readonly (string | number | boolean)[] | null
}

interface PortableComponentPolicyV2 {
  version: 2
  components: Record<string, {
    kind: 'block' | 'inline'
    props: Record<string, PortableComponentPropPolicyV2>
    slots: readonly string[]
    allowedParents: readonly string[] | null
    allowedChildren: readonly string[] | null
    media: {
      sourceProp: string
      altProp: string | null
      titleProp: string | null
      filenameProp: string | null
    } | null
  }>
}
```

`types` is an array because an authored value can genuinely be `string | json`;
implementation metadata must not narrow that to a false single type. In V2,
`json` means `null`, an array, or a plain JSON object; primitive alternatives are
listed explicitly. `asset` remains a non-empty safe URL or stored asset identity
at its existing boundary. `allowedValues` is either `null` (no literal
restriction) or the exhaustive allowed primitive values; every listed value must
match a declared primitive type. Required means present in authored source; a Vue
default does not make an explicitly required content property optional.

The contract builder normalizes `types` into the fixed order `string`, `number`,
`boolean`, `json`, `asset` before canonical JSON and hashing, and rejects
duplicates. Strict readers and validators require that canonical order but never
sort, rewrite or otherwise mutate caller-owned policy/contract values. They also
reject non-finite numbers,
non-plain or cyclic JSON, duplicate allowed values (identity includes primitive
type), and `allowedValues: []`; use `null` for no literal restriction. If
`allowedValues` is not null, it must contain at least one value for every declared
primitive type. Structured `json` values are not compared with `allowedValues`.
`asset` is exclusive: it cannot be combined with `string` or any other type and
cannot declare `allowedValues`. This prevents an unsafe asset string from being
accepted through an ordinary string branch.

| Declaration | Accepted authored values | Rejected / note |
|---|---|---|
| `types: ['string'], allowedValues: null` | Every string | Numbers, booleans, structured JSON |
| `types: ['string', 'number'], allowedValues: ['sm', 'lg', 1, 2]` | Exactly those four values | Other strings/numbers; omitting all values of either declared primitive type is invalid policy |
| `types: ['string', 'json'], allowedValues: ['auto', 'wide']` | Those strings plus `null`, arrays and plain objects | Other strings; `json` does not absorb primitive values |
| `types: ['string', 'number', 'boolean', 'json'], allowedValues: null` | All finite JSON values | Exact V2 representation of V1 `type: 'json'` |
| `types: ['json'], allowedValues: null` | `null`, arrays and plain objects | Every primitive |
| `types: ['asset'], allowedValues: null` | A safe public asset URL at the public boundary, or a verified stored identity at the storage boundary | Empty/unsafe strings; any union with `asset`; non-null `allowedValues` |

The mechanical V1-to-V2 property projection is fixed and testable:

| V1 `type` | Exact V2 `types` | Other exact V2 fields |
|---|---|---|
| `string` | `['string']` | Same `required`, `allowedValues: null` |
| `number` | `['number']` | Same `required`, `allowedValues: null` |
| `boolean` | `['boolean']` | Same `required`, `allowedValues: null` |
| `json` | `['string', 'number', 'boolean', 'json']` | Same `required`, `allowedValues: null` |
| `asset` | `['asset']` | Same `required`, `allowedValues: null` |

Every V1 component additionally projects to the identical canonical name,
`kind`, prop-name set, `slots` and `media`, with `allowedParents: null` and
`allowedChildren: null`. This preserves V1 value meaning, including primitive
JSON. A V2 owner may add only the reviewed restricting `allowedValues`, parent
and child rules during the eligible migration; the inventory below must prove
all current canonical documents satisfy them.

`slots` remains an allow-list. Existing direct named-template validation remains.
For children inside a named template, the enclosing authored component remains
the structural parent. `allowedParents` and `allowedChildren` are independent
constraints: the former restricts where a component can appear; the latter
restricts what authored component children a container accepts. `null` means no
component-nesting restriction. Native Markdown/HTML children are not component
children and remain allowed unless a later, separately reviewed policy adds prose
content rules. All referenced component names must exist in the same policy.

Extend the existing public functions instead of adding a parallel validator:

```ts
type PortableComponentPolicy = PortableComponentPolicyV1 | PortableComponentPolicyV2

function validatePublicMarkdownAst(
  value: unknown,
  policy?: PortableComponentPolicy,
): PublicMarkdownValidationResult

function validateStoredPortableMarkdownAst(
  value: unknown,
  policy: PortableComponentPolicy,
): PublicMarkdownValidationResult

function classifyPortableMarkdownElement(
  node: Pick<MarkdownNode, 'tag' | 'props'>,
  policy: PortableComponentPolicy,
):
  | { kind: 'html'; name: string }
  | { kind: 'component'; name: string; form: 'block' | 'inline'; registered: boolean }

function projectMdcDocument(
  document: MarkdownDocument,
  options?: Pick<ParseMdcBodyOptions, 'tocDepth'>,
): ParseMdcBodyResult
```

`validatePublicMarkdownAst` keeps all current render-safety checks, then applies
V2 value and nesting rules. Constraint failures use the existing
`invalid_prop_value` code; structural failures add only `invalid_nesting`.
Diagnostics retain the current stable node/property path. Source ranges are
deferred. `classifyPortableMarkdownElement` is the single interpretation of
parser metadata plus policy: explicit HTML stays HTML even when a component has
the same canonical name; angle and colon component forms produce the same
component identity; an unregistered authored component remains identifiable and
is rejected by validation. Consumers do not read `props.$`.

The two validation modes are deliberately not interchangeable:

| Boundary | Parser mode | Validator | Asset rule |
|---|---|---|---|
| Docs recipes and public standalone source | `autoClose: false` | `validatePublicMarkdownAst` | Public-safe URLs only |
| Editor authoring preparation/emission | `autoClose: false` | `validateStoredPortableMarkdownAst` plus Editor representability/round-trip checks | Preserves supported stored identities; the host owns existence, access and URL resolution |
| Interactive playground body | `autoClose: false` after debounce | `validatePublicMarkdownAst`, then `ContentBodyRenderer` repeats it at render | Public-safe URLs only; the last valid body stays visible on failure |
| CMS draft and transition source inventory | `autoClose: false` | `validateStoredPortableMarkdownAst` after the CMS has identified the collection policy | Stored-identity grammar is accepted for declared asset props, but this alone does not prove the asset exists or is renderable |
| CMS publish and active-publication migration proof | `autoClose: false` through the existing projection builder | Existing `assertPublicBodySafe`, then `validatePublicMarkdownAst` on its resolved clone | CMS must resolve/verify supported stored assets before public validation; raw stored identities never reach the renderer |
| Portable import/export | Existing strict portable parser | Existing stored validator plus manifest/asset verification | Contract-declared references must match verified portable assets |

`validateStoredPortableMarkdownAst` already exists internally; 4B exports that
exact runtime-neutral operation from `/cms-contract` because CMS transition and
Editor preparation need it. It must never be used by `ContentBodyRenderer`, Docs
recipes, or an untrusted browser preview. Unsafe schemes fail both validators;
stored mode permits only the existing narrow identity grammar, not arbitrary
strings. The existing CMS public projection currently
resolves only its supported image shapes. A custom component asset identity
which that path cannot resolve makes the no-write V2 migration ineligible; adding
general component-asset resolution and changing purge/reference extraction remain
deferred asset work, not a reason to weaken public URL validation here.

`projectMdcDocument` extracts the current normalized body, TOC and search text
from an already parsed document. `parseMdcBody` delegates to
`parseMdcDocument` plus that projection, so existing callers and defaults remain.
Editor can parse strict source once, project it for Content validation, and adapt
the same `MarkdownDocument` to Tiptap. `serializeMdcDocument` remains the only
serializer. Interactive recovery must opt into `autoClose: true`; stored source,
recipes, editor mode changes, CMS save/publish, and migration audits use
`autoClose: false`.

Colon documents are neither rewritten nor converted to angle syntax on load.
Native HTML is selected by Content's existing explicit HTML marker and safe-tag
rules. Object-valued properties remain valid only when `json` is one of their V2
types. Editor may still reject a valid Content tree as visually unrepresentable;
that remains an Editor diagnostic, not a Content validity failure.

Keep the source callers explicit. Public `parseAuthoringSource` is the Editor
storage/source preparation operation and uses the stored validator. Kit creation
uses a separate package-private `parsePublicRecipeSource` for Docs recipes, and
the playground preview continues to call `parseMdcBody` plus
`validatePublicMarkdownAst` directly before rendering. Do not accept a validation
callback or caller-selected arbitrary validator. The current image conversion
keeps the original `id`/`src` in TipTap props and emits those props again. Its
image extension shows no bare stored identity: `sanitizeImageUrl` rejects that
identity as a display URL, then `assetProvider.buildUrl` supplies the safe host
URL. If schema conversion or semantic round-trip cannot preserve an asset-bearing
node, preparation fails into the existing source-only fallback rather than
rewriting or dropping the reference.

Contract and policy dialects cannot be mixed. A V1 resolved contract contains
only V1 policies; a V2 resolved contract contains only V2 policies in every
collection. The strict named V1 and V2 readers reject the other version and mixed
collections. During the migration window only the generic
`assertResolvedContentContract` returns the discriminated V1-or-V2 union. The
builder emits V1 for an omitted/V1 policy and V2 only for an explicit V2 policy;
there is no per-collection version selection. Render validation accepts either
dialect and preserves V1 semantics unchanged.

**Body-rendering boundary**

Add one public Vue component, `ContentBodyRenderer`, with required `body`,
`policy`, and `components` props and the existing useful presentation props
`tag`, `prose`, `locale`, `defaultLocale`, and `locales`. It forwards ordinary
attributes to its root. An internal `fallbackComponents` prop may remain for the
full Content renderer's bundled prose/plugin fallbacks; it is not a second policy.
The component validates the body with `validatePublicMarkdownAst` immediately
before rendering.

The explicit component map is authoritative. Values may be Vue components or an
explicit registered component name such as `{ info: 'MdcInfo' }`. The low-level
renderer may resolve that named value from Vue's app registry, but it must stop
discovering a custom component merely because its source tag happens to be global.
This preserves Docs module registration while keeping per-instance policy and
component selection isolated.

`ContentRendererMarkdown.vue` continues to resolve document locale, localized
links, references, unwrap, configured tag mappings, plugins, and fallbacks. It
then delegates its final body to `ContentBodyRenderer`. Thus the new body boundary
does not pretend a bare AST contains collection/reference context.

The runtime-neutral `@lupinum/ginko-content/cms-contract` entry remains free of
Vue, Nuxt, Node and filesystem imports. The Vue component is a separate
`@lupinum/ginko-content/body-renderer` export and a Nuxt auto-import. Import purity
does not imply a minimal installation: the current Content package still installs
its existing Nuxt/module dependencies. Splitting that installation footprint is
explicitly deferred.

**Dependency, artifact and migration audit**

- Registry checks on 2026-09-12 found Content `latest` 0.3.6 and `next`
  1.0.0-beta.8; Docs `latest` 0.3.0 and `next` 0.4.0-rc.10; CMS latest 0.1.3,
  CMS Convex latest 0.1.2, and no published Editor package. The local accepted
  Content candidate is `b219f55` with package version beta.7 and contains the
  unpublished strict document parser/serializer work. The local CMS 0.2.0-rc.2
  packages are not published. Docs rc.10 is published; its current authoring and
  component-kit candidate changes are uncommitted.
- The published Content beta.8 tarball exposes only `parseMdcBody` at the MDC
  boundary and has the same closed `PortableComponentPolicyV1`. Its
  `assertResolvedContentContract` accepts only top-level version 1 and exact keys;
  each V1 component accepts exactly `kind`, `props`, `slots`, `media`, and each
  property exactly `type`, `required`. Therefore V2 data cannot be placed in a V1
  object, even as TypeScript-optional members.
- Content's Nuxt module writes canonical JSON to
  `.ginko/content-contract.json`. Its Node reader validates it and recomputes
  SHA-256. Portable-manifest V1 references that file and hash, while directory
  import/export then validates the contract as V1. A V2 contract changes the hash
  even when document source is unchanged and is not a valid V1 portable bundle;
  emitting it under a manifest labelled V1 would hide the incompatibility.
- Local CMS pins Content beta.4 in package manifests, lockfile,
  `compatibility.json`, packed consumers and release evidence. CMS loads the
  artifact into runtime config, validates again in the Nuxt module and Convex,
  stores the JSON plus canonical hash in `cmsContract`, projects the component
  policy into collection settings, and validates public bodies at publish.
  Contract hashes also fence writes, revisions, transitions, diagnostics,
  projection/asset references, and portability runs. Transition target/source
  contracts and portability archives are persisted JSON and will be read again.
- Docs currently develops against beta.7 and declares the broad peer
  `>=1.0.0-beta.7 <2.0.0`; that range would incorrectly claim V1 and V2 are
  interchangeable. The published Docs rc.10 tarball does not contain the new
  `authoring` or `component-kit` exports at all; those exports and files exist only
  in the current uncommitted candidate. Editor's package is unpublished and can
  adopt the new API directly. The playground currently aliases the local built
  Content contract and copies a Docs candidate; these are candidate proofs, not
  registry evidence.
- Existing CMS transitions treat every component-policy change as incompatible,
  but currently validate only strict parsing for draft `bodyMdc` and require all
  affected entries to be unpublished. That is not an acceptable V1-to-V2 policy
  migration: active revision snapshots also need validation, while valid source
  must not be unpublished or rewritten merely to change policy metadata.

Use a temporary dual-reader window, tracked in Content and CMS
`internals/migrations.md`. The no-write transition lane is deliberately narrower
than "policy-only". CMS derives it server-side with this exact predicate; a
client cannot select it:

```ts
type EligiblePolicyVersionChange = 'v1-to-v2' | 'v2-to-v1' | null

function classifyNoWritePolicyVersionChange(
  current: ResolvedContentContract,
  target: ResolvedContentContract,
): EligiblePolicyVersionChange
```

For `v1-to-v2`, `current.version` is 1 and `target.version` is 2. Canonical
comparison must prove identical top-level format, default locale, locales,
fallbacks and collection-ID set. Every collection must have identical canonical
fields other than `componentPolicy`, including kind, schema/structure, locale,
routing and portability fields. Each target policy must have exactly the same
component-name set; each component must have identical `kind`, prop-name set,
per-prop `required`, slots and media. Each target prop's `types` must equal the
fixed V1 projection table above. Only `allowedValues`, `allowedParents` and
`allowedChildren` may change from their projected `null` value to a valid V2
restriction. Parent/child names must resolve in the same unchanged component set.
No component addition/removal, kind change, prop type/required change,
slot/media change, collection-field change, locale/routing change, or arbitrary
V2-to-V2 policy edit is eligible.

For `v2-to-v1`, apply the exact inverse test: the current V2 contract must have
only the projected V1 type sets and otherwise the same component identity,
kind, props, required flags, slots and media; the target V1 contract must equal
the canonical V1 projection which removes only the three V2 constraint fields.
V1-to-V1 and V2-to-V2 changes never enter this lane. Recompute the predicate from
the installed source contract and persisted target contract during staging,
validation, every apply page, cancellation and activation; never trust a stored
mode flag without checking both hashes and contracts again.

Under the locked source contract, transition validation inventories every
affected entry as follows:

1. Strict-parse every draft `bodyMdc` with `autoClose: false` and call
   `validateStoredPortableMarkdownAst` with the target collection policy.
2. For each `activePublications` locale/revision pointer, prove the locale belongs
   to that collection, load the exact `entryRevisions` row, verify its entry,
   collection and stored hash relationship, strict-parse its snapshot, and run
   storage validation with the target policy.
3. Call the existing `buildPublicProjectionFromRevisionSnapshot` path with that
   revision and target collection. This is the real publish path: it resolves the
   supported stored assets, calls `assertPublicBodySafe`, public-validates the
   resolved clone, and builds the expected public structural/data/search/asset
   facts and references.
4. Reuse/extract the existing read-only projection comparison behind
   `publicDerivedRowsMatch` to compare that expected result with `publicEntries`,
   `publicSearchEntries` and `contentAssetRefs`, including the active revision ID.
   Do not repair or reproject. A mismatch fails the transition and must be fixed
   through the existing repair operation before retrying.
5. Call the existing `readPublicBodyFromRevision` path (or its exact shared
   projection helper) as the final renderer-input proof. A `publicEntries` row
   contains structural/data/asset facts, not body content; public body is always
   derived on demand from the active revision snapshot.

Inactive historical revisions keep their original contract/content hashes and
are not relabelled or rendered under the target. The unchanged media declaration,
exclusive asset value type and real projection path preserve asset meaning. If a
custom component contains a stored asset identity that the current CMS projection
cannot resolve, migration fails; this step does not widen asset extraction or
purge behavior.

The apply output for every eligible item must be canonical-field-for-field equal
to `readTransitionInput` (including source and source hash). The apply handler
checks that equality, skips `applyTransitionOutput` entirely, and changes only the
transition item's bookkeeping state. It never writes entries, revisions, public
rows, search rows or asset references. Activation is the single atomic operation
which installs the target contract/hash and completes the transition.

Cancellation remains conservative for ordinary transitions. For this proved
no-write lane only, it also accepts `state: 'applying'` with `appliedCount > 0`
when it recomputes eligibility, confirms the installed contract/hash still equal
the transition source, and confirms the existing per-page counters/invariants show
that every completed page took the guarded no-op branch. This evidence is recorded
and advanced atomically by each existing transition page; cancellation checks the
bounded run summary and current page state, never scans all applied items in one
Convex mutation. It then cancels the run and releases the lock; no target contract
is installed.
This makes interruption after any apply page safely cancellable. Stale generation
or cursor tokens remain rejected. Activation and cancellation use the existing
serialization rule so only one terminal action wins; cancellation after completed
activation is refused.

The release and rollback sequence is:

1. Release a Content candidate which preserves strict named V1 readers/writers,
   adds strict named V2 readers/writers and the reviewed projection/renderer APIs,
   and makes the generic reader return the discriminated union. Add
   `PortableManifestV2` for V2 contracts and retain V1 bundle reads; portable
   document bytes are unchanged. Omitted/V1 input still emits V1.
2. Update the unpublished CMS 0.2 line to accept the contract union and implement
   the exact lane above inside its existing transition system. No Convex table
   shape changes. Prove interruption/resume, cancellation after multiple pages,
   stale generation/cursor rejection, activation/cancel serialization, refusal
   after completion, and the reverse transition. In every cancel case the source
   hash and all canonical content/projection rows remain unchanged.
3. Publish Docs with an explicit V2 policy and raise its Content peer floor to the
   first V2 Content release. Publish Editor against that floor. Update CMS exact
   dependencies, compatibility data, candidate artifacts and hashes. Candidate
   cross-package tests precede any registry action.
4. On each host, preflight the eligible V1-to-V2 transition. Invalid documents or
   stale projections are corrected deliberately through their owning workflow;
   they are never normalized by migration. Activate only when all draft and active
   revision proofs pass, then regenerate the contract artifact, V2 portable
   manifests and fixture hashes.
5. Before activation, rollback is the safe cancellation above. After activation,
   keep the V2-aware binaries installed and start a new reverse eligible
   V2-to-V1 transition using the saved/rebuilt V1 artifact. Validate again, install
   its V1 hash, then downgrade packages. Editor and Docs can revert independently.
6. Only after supported hosts have no stored V1 contract, make V2 the Content
   default, remove the V1 writer/normal CMS branches, and remove both migration-log
   entries. Retain a named V1 archive reader only for a documented import need.

**Bounded implementation files and proof**

- Content: `types/component-policy.ts`; `cms-contract/{types,build,validate,
  render-policy,mdc,index}.ts`; the public body renderer and the existing
  `MarkdownRenderer`/`ContentRendererMarkdown`; module/runtime-config types;
  contract, purity, parser, render-policy and component tests; package export and
  packed Vue/Nuxt fixtures. Portability changes are limited to the discriminated
  resolved-contract union plus a V2 manifest discriminator/read-write branch; its
  document and asset formats do not change.
- CMS: the existing artifact loader/module contract types; installed-contract,
  publish-safety and transition model/staging/validation/apply paths; portability
  resolved-contract annotations; compatibility metadata and focused tests. Do
  not adopt Editor or change Studio UI in this step.
- Docs: `tags.ts`, the authoring source/generator/generated metadata, their tests,
  peer metadata and component-only certification. Vue extraction continues to
  prove implemented props/defaults/slots and that explicit allowed literals are
  supported. Extracted literal options are derived evidence; only Content policy
  decides which values are valid authoring choices.
- Editor/playground: `authoring.ts`, the conversion adapter/pipeline and fallback
  node conversion, focused authoring/type tests, playground preview and Nuxt
  setup. Preserve async/lifecycle regression files unchanged except for direct
  API adoption.

Positive fixtures cover angle and colon `info`, native `<article>`, the `img`
native/component collision, string-or-object props, optional booleans, required
props, default and named slots, layout/column nesting and two isolated policies.
Negative fixtures cover unknown/unsafe components, wrong types, unsupported
literal values, missing required props, duplicate/unknown slots, both directions
of invalid nesting, malformed strict source and explicit native HTML collisions.
An asset-boundary fixture uses the currently supported image shape with a stored
identity: Editor load, visual edit and flush preserve that identity byte-for-byte;
the visual node displays only a safe URL returned by `assetProvider.buildUrl`;
direct public validation/rendering rejects the unresolved identity; and an unsafe
scheme fails both stored and public validation. If that node is not representable,
the test instead requires the existing source-only fallback with the source bytes
unchanged—never a lossy visual conversion.
The same canonical fixture source must be asserted through Content validation,
Docs recipes, Editor preparation/emission, body rendering, and CMS draft plus
active-publication transition preflight; owner-specific expected UI remains local.

The first 4B proof uses these focused commands (with the new test files added to
the named groups), not aggregate release gates:

```sh
# Content
pnpm exec vitest run --config vitest.config.ts --project unit \
  test/unit/resolved-content-contract.test.ts \
  test/unit/cms-contract-purity.test.ts
pnpm exec vitest run --config vitest.config.ts --project contracts-node \
  test/contracts/cms-render-policy.test.ts \
  test/contracts/render-components-contracts.test.ts \
  test/contracts/portability-contracts.test.ts

# CMS
pnpm exec vitest run \
  test/component/contractTransitions.test.ts \
  test/component/contract-write-invariants.test.ts \
  test/component/entries/projection-maintenance.test.ts \
  test/component/entries/publish.test.ts \
  test/module/content-contract.test.ts

# Docs
pnpm exec vp test \
  layer/authoring.test.ts \
  layer/component-kit.test.ts \
  scripts/generate-authoring-metadata.test.ts

# Editor
pnpm exec vitest run \
  test/authoring.test.ts \
  test/authoring-editor.test.ts \
  test/authoring-regressions.test.ts \
  test/authoring-async-regressions.test.ts
pnpm typecheck
```

At 4C run Content `pnpm verify`, Editor `pnpm verify`, Docs
`pnpm release:verify` (which contains its aggregate and packed certification),
and CMS `pnpm run check`, followed by CMS `pnpm run package:e2e` for the changed
candidate contract path. Remove Editor's duplicate traversal and marker
interpretation in the same 4B cutover. Remove candidate copies/aliases only after
packed consumers resolve the reviewed Content and Docs archives. The lasting
playground remains; temporary `.candidate` trees and local dependency links do not.

**Checkpoint 4A:** reviewer accepts the concrete signatures, responsibility split,
compatibility plan and bounded file map before production implementation. No new
package, registry, parser grammar, document store, generic plugin framework, full
source-map system or fleet refactor is included.

#### Step 4B — Implement the accepted contract and adopt it directly

After 4A acceptance, implement the reviewed Content contract and renderer boundary,
then update Editor, Docs and the playground. Remove the superseded Editor-owned
validity traversal and marker interpretation in the same cutover. Keep Editor's
schema representability, async ordering, flush and asset-lifetime safeguards.
Keep runtime component imports separate from serializable metadata and avoid
hand-authored duplicate prop type declarations where build metadata is reliable.

Prove identical Content validity results for source input, recipes, editor
preparation/emission, body preview and the applicable CMS validation boundary.
Include native/angle/colon collisions, primitive/object unions, required/default
props, named slots and valid/invalid nesting. Two differently configured instances
must remain isolated. Inspect the real body renderer with Docs and host components,
plus stale/failed/recovered preview states, at desktop and narrow widths.

**Checkpoint 4B:** reviewer accepts the focused correction and direct consumer code
before final aggregate certification. Existing parser corpus and editor safety
regressions must remain green; source-only fallback remains valid for unsupported
visual representation.

#### Step 4C — Certify the final shared contract

Run owning aggregate gates for the final changed source: Content `pnpm verify`,
Editor `pnpm verify`, Docs `pnpm verify`, and CMS `pnpm run check` when its contract
reader/transport changes. Use package certification commands containing these
aggregates instead of repeating both. Prove isolated packed Editor Vue/Nuxt
consumers, the Content body-rendering entry and the Docs component-only entry.
Record compatible candidate revisions, archive hashes and registry limitations.
Only the reviewer accepts Gate B2. After acceptance, assign Step 6A in the Docs playground; Step 5 waits for the Step 6 writing proof and focused hardening.

The remaining asset API cleanup, optional shared preview composable, full source
mapping, and package-install footprint restructuring are deferred until their
consumer requirement is demonstrated and separately assigned. The current work
must not expand into every API opportunity from the discussion.

**Kit and playground requirements retained from the original Step 4:**

1. Implement section 4's separation between implementation metadata, explicit policy and authoring metadata. Reuse `layer/tags.ts` and `layer/components.ts` as the public tag authority.
2. Start with prose, `info`, `layout`/`column`, and a test host component such as `learning-objective` with title and default content. Do not introduce a production workshop block type for this proof.
3. Generate build-time metadata from Vue where reliable and validate it against policy. Add editorial hints only where necessary. Test a union prop, optional boolean, named slot and an unsupported complex type. Inspect Nuxt Studio's implementation as a reference, not a mandatory dependency.
4. Provide a JSON-safe kit usable across the CMS transport. A runtime-free authoring export must not import Vue components, Editor UI or Nuxt. Keep actual component imports/registration local to the rendering host.
5. Add a minimal component-only Docs integration, preferably an optional existing-package export/module. Trace transitive requirements: prose styles, CSS tokens, icons, image helpers and app-config defaults. It must not install pages, blog routes, sitemap, site SEO or host-wide fonts.
6. Define recipes once in the accepted source syntax, then parse them with the canonical engine. Do not hand-maintain both a Tiptap JSON recipe and a Markdown recipe. Validate recipe nesting and required fields.
7. Reject duplicate tags/IDs and invalid recipes. Demonstrate two editor instances with different kits and no shared mutable state.
8. Use the existing Editor documentation app as the lasting interactive playground, as requested by Matthias on 2026-09-12. Embed the real built Editor package with the actual Docs kit, one host-owned component, canonical rendering, source access, sample documents and reset. Use disposable in-memory content. Include a second editor with a different kit to demonstrate isolation. This step demonstrates the existing editing surface; later writing milestones extend the same playground. Do not create a separate demo application or persistence system.

**Acceptance:** the custom component appears through metadata alone, its props/slots round-trip, its real host renderer works, Docs rendering imports have no Editor runtime dependency, and the component-only consumer has no unintended routes/style changes.

**Verify:** the focused and aggregate checks in 4B/4C, plus type tests proving valid keys are inferred and unknown property names are rejected where practical. Keep metadata-extraction fixtures and the current editing lifecycle regressions.

**Gate B2:** reviewer approves public contract shape only after seeing consumer code. Reject duplicate type sources, unnecessary wrapper functions, and a type-extraction system larger than the actual requirements.

The Editor docs playground is the shared manual review surface. Inspect editing,
source/visual transitions, actual component rendering, invalid-source recovery,
keyboard operation, and a narrow viewport. Leave the reviewed local playground
running with its URL for Matthias. It complements isolated archive certification
and later CMS/ChiliSkills acceptance; it does not replace either. Keep local
candidate dependency evidence distinct from registry-compatible release proof.

**Prompt:**

```text
Execute Step 4A only of /Users/matthias/Git/0_libs/ginko-editor/plan.md.
Preserve the current candidate and playground. Propose the smallest Content-owned
document-validity and explicit body-rendering contract, show real consumer calls,
and audit contract readers/migration needs. Return the bounded proposal for
review before production changes. Do not start 4B, aggregates or Step 5 yet.
```

### Step 6 — Prove the Docs writing experience, then harden it

**Outcome:** a complete, convincing writing experience in the permanent Docs playground, using the real packages, before CMS and ChiliSkills integration.

**Prerequisite:** reviewer acceptance of Step 4C / Gate B2. This step runs before Step 5.

**Scope:** the existing Editor docs playground, actual Ginko Editor/Content packages, the Docs component kit, and one existing host-owned component. Keep experimental layout and demo controls in the playground where practical. Reusable editing behavior belongs in Editor and document meaning stays in Content. Do not build a second editor, duplicate parser or validation rules, new backend, or speculative extension framework. No CMS/ChiliSkills cutover or production data changes belong here.

#### Step 6A — Demonstrate one complete writing journey

Inspect the current interface first. Use applicable design, layout, typography and accessibility skills to make the writing surface content-led; the current toolbar-heavy playground is not the accepted design. Work through the real packages with the smallest useful implementation, and inspect the browser while exploring the interaction before expanding a permanent test suite or API.

The first reviewable journey must work end to end:

1. Start with an empty document. Type `/note`, find the actual Docs information/callout component, and insert it with Enter. Use `note` as an Editor search keyword for the existing component, without inventing a second Content tag or schema. The `/` menu supports search, arrows, Enter and Escape; the touch-friendly `+` exposes the same valid insertions.
2. Write inside the callout and change its title/appearance using the existing typed metadata. Show the actual Docs renderer in preview. Cancelling the menu must preserve selection and focus.
3. Insert two columns, write in both slots, and undo/redo insertion and edits without losing content or jumping the cursor.
4. Insert and configure the existing host-owned component, including its named slot, using the same public integration contract. Preserve the second kit's isolation demonstration.
5. Switch to Markdown and back without changing document meaning. An incomplete source example remains editable and unchanged, with honest stale-preview feedback and a recovery path.
6. Save and reopen the source through a minimal playground-owned local draft control. Await the existing Editor `flush()` before reading/saving the source; clearly label it as a local demo draft. Reuse an existing local mechanism if one fits, otherwise use one namespaced browser-storage entry. Do not add persistence to Editor, create a backend, or imply this proves CMS persistence.

**Checkpoint 6A:** provide the running playground, a concise list of consumer API calls actually used, and browser evidence for the complete journey at desktop and 390px width. The reviewer operates it before assigning 6B. This is a working slice, not a screenshot mockup; shortcuts in content safety, fake previews, and duplicated host integration rules are not acceptable. Identify any API friction from the demonstrated use before generalizing it.

**Verification during exploration:** keep the existing source-preservation, validation and editing-lifecycle regressions green. Use focused checks for changed behavior and browser interaction while shaping the UX. Add a regression test immediately for a concrete safety defect; do not prebuild a large suite around speculative controls or implementation structure. Full final aggregates belong to 6B after the interaction is accepted unless a repository rule or concrete failure requires them earlier.

**Prompt:**

```text
Execute Step 6A only of /Users/matthias/Git/0_libs/ginko-editor/plan.md after
Gate B2 acceptance. Prove the complete Docs playground writing journey through
the real packages: /note, properties, two columns, a custom host component,
undo/redo, source recovery and local save/reopen. Inspect desktop and mobile
behavior while implementing. Keep content safety checks; avoid speculative API
and test expansion. Return the running browser proof for review before 6B.
```

#### Step 6B — Harden the demonstrated interaction

After reviewer acceptance of 6A, retain the proven interaction and simplify any temporary implementation. Complete the initial writing behavior without widening the component set:

1. Finish slash/plus keyboard and focus handling; do not trigger in code blocks or during IME composition. Use Content's structural rules for all insertions.
2. Complete selection formatting and block move, duplicate and delete actions. Provide keyboard alternatives to drag and keep destructive actions undoable.
3. Verify column boundary movement, empty slots, Enter/Backspace, nesting, paste, parent deletion and undo. Prevent invalid parent/child placement consistently in insertion, drag and paste paths.
4. Finish typed property controls required by the initial kit. Preserve omitted, empty, zero and false values, and prevent invalid transient input from corrupting source. Add asset/advanced controls only where this journey demonstrates a need.
5. Keep source/visual transitions and diagnostics reliable. Preserve the existing source-only fallback for unsupported representations.
6. Remove obsolete experimental controls, duplicate state and unused abstractions introduced during 6A. Keep the example as the permanent integration playground.

**Acceptance:** keyboard-only authors complete the accepted journey; mobile insertion works without slash typing; no content loss, selection jumps or duplicate history entries occur. The example uses the public packages with little host code. Final cross-application acceptance remains in Step 5.

**Verify:** add focused regression tests for accepted observable behavior, including IME, paste, source recovery and the save/flush boundary. Run the owning Editor aggregate once at final handoff and relevant owning checks for other changed packages. Record desktop and 390px behavior and inspect a representative long document. Measure typing/preview behavior before adding performance machinery. Do not write tests that merely mirror the chosen implementation.

**Gate D:** reviewer evaluates actual writing behavior and the consumer integration example, corrects observed focus/cursor defects, and accepts Step 6 before assigning Step 5.

**Prompt:**

```text
Execute Step 6B only of /Users/matthias/Git/0_libs/ginko-editor/plan.md after
6A acceptance. Harden the demonstrated Docs writing experience, simplify the
implementation, and add focused behavior regressions. Prove keyboard, touch,
undo, paste, source recovery and local save/reopen; run the owning final checks.
Return Gate D. CMS and ChiliSkills integration remains Step 5.
```

### Step 5 — Integrate the proven editor into both consumers

**Outcome:** the same built package runs inside CMS and a ChiliSkills pilot before the API is treated as stable.

**Prerequisite:** accepted Gate B2 and Step 6 Gate D. Repeat the accepted Docs writing journey in both hosts, including slash/plus insertion, properties, columns, undo/redo, source recovery, and save/reopen. Host-specific undo, persistence and assets remain real integration acceptance requirements. Before CMS adoption, establish isolated package-consumer proof using the exact CMS and V2 Content candidate archives, exercising the changed reader/validation path. The 4C registry-compatible development lane does not satisfy this. Use a documented local verification lane or appropriately attested clean candidates; do not weaken release guards, fabricate compatibility versions, or infer publication authorization.

**Scope:** CMS `FieldRichtext.vue`, existing metadata/asset/preview integration and old editor removal; ChiliSkills focused script workspace/pilot and tests; narrow Editor API corrections revealed by these consumers.

**Work:**

1. Replace CMS' internal editor imports with the shared package. Keep draft, dirty state, save/publish, permissions, asset URLs and host-preview operations in existing owners.
2. Send authoring metadata through the existing content contract. Confirm how contracts are rebuilt/versioned and how existing Studio receives them; avoid a parallel metadata endpoint. Handle absent or malformed metadata conservatively without altering source.
   Use the accepted Step 4 Content validity contract and body-rendering boundary directly. Host adapters own persistence, assets and workflow; they must not rebuild document validation or infer parser markers.
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

### Step 7 — Connect trustworthy previews

**Outcome:** authors can see the actual host rendering of current content without creating a second parser or publishing drafts accidentally.

**Scope:** host preview integration, canonical Content renderer usage, minimal Editor preview integration point, tests.

**Work:**

1. In ChiliSkills, render the current source through the accepted Content profile and actual Docs/application components. Use the component-only styles. Avoid fake full document envelopes if an existing body-render entry already fits; inspect the public API first.
   Consume the explicit body-rendering boundary accepted in Step 4. Keep CMS collection/locale/reference context in its existing full-document adapter where it is needed.
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

#### 2026-09-12 — Reviewer accepts Gate B1 and assigns Step 4

**Gate B1: ACCEPTED** by coordinator task
`01a09425-69ce-73d3-843f-32d46fe88775` at Editor
`2cc8271cf6c280d7689361c06d0c03b6a07a34fb`, with the main correction in
`7e1b81a90a3c0d5a0d33509ef8809bee4b88bd65`. The reviewer inspected the full
correction diff and clean worktree, reproduced the earlier failed-flush recovery
defect, and verified that Markdown mode now reveals the exact last safe source
without emitting the invalid visual document. Its independent focused rerun
passed 28 tests across lifecycle, real-schema and conversion files; diff hygiene
also passed.

The earlier aggregate, candidate-archive certification, packed Vue/Nuxt and
Chromium evidence remains accepted because the final focused change only alters
the failed-flush mode transition and adds its regression. No unresolved Gate B1
content-loss, stale-async, asset-cancellation, browser-import, peer-range or
style blocker remains. The Content registry helper/version gate is unchanged
and publication remains unauthorized.

The reviewer assigned Step 4 only. The implementation must keep runtime-free
authoring metadata separate from Content policy and UI metadata, derive types
from one source, reuse Docs tag/component authority, parse recipes with the
canonical Content engine, and prove real registration, isolated kits, duplicate
rejection and bounded property/slot handling. Step 5 remains blocked on Gate B2.

#### 2026-09-12 — Reviewer ownership transferred

Matthias transferred review, correction coordination, and orchestration to task
`01a09564-7dee-70a1-828c-84dd6628054d`. The previous reviewer confirmed the
handoff and will make no further assignments, file changes, or gate decisions.
The implementor remains task `01a0943e-9f8d-7130-81e9-e09aa36cae34`, with its
existing Step 4 assignment and settings. Accepted gates and external-action
limits remain in force. Send subsequent review packets to the new coordinator.

The incoming reviewer inspected the accepted evidence and the in-progress
Editor/Docs changes. Independent calls against the draft `createAuthoringKit`
confirmed that it accepted a number control for a string-only policy, a required
implementation prop omitted from policy without a default, and a recipe value
outside declared select options. Corrections and regression evidence were
requested from the implementor. The reviewer also flagged manually duplicated
enum metadata, numeric-default extraction, generated-payload drift detection,
and the outstanding real-editor/host registration and nesting proofs. These are
early findings against unfinished work, not a final Gate B2 verdict. Step 4
remains `IN PROGRESS`; Step 5 is not assigned.

#### 2026-09-12 — Docs playground requested

Matthias requested that the docs serve as the playground for seeing and checking
the implementation. The coordinator assigned a permanent, bounded playground
inside the existing Editor docs app to the Step 4 implementor. The playground
uses the actual package, Docs kit, host component and canonical rendering, with
disposable examples and source recovery. Its scope grows with accepted editor
features in later steps. Keep this as one maintained demonstration and manual
review surface, with isolated packed consumers and real application adoption
remaining separate gates. No deployment or publication was requested.

#### 2026-09-12 — Content-first contract checkpoint before adoption

After discussing the API opportunities, Matthias asked whether to pause and
update the plan now or defer the changes. The coordinator recommended the bounded
change now, before CMS and ChiliSkills adoption, and amended the active plan with
the goal: **Ginko Content should own the document’s meaning, and Ginko Editor
should turn that contract into a good writing experience. CMS and ChiliSkills
should need very little integration code.**

The former Step 4 aggregate assignment is paused at a safe checkpoint. Steps 0–3
remain accepted. The latest Step 4 correction independently passed five Editor
files with 31 tests; earlier Docs generator/kit checks passed three files with
six tests. The coordinator independently verified actual Docs/host rendering,
invalid-source recovery, instance isolation and a narrow viewport in the local
playground. These are retained focused results, not full Gate B2 acceptance.

Step 4A now owns the bounded contract/migration proposal; 4B requires its review
acceptance, and 4C certifies the resulting candidate. Preserve existing source,
fixtures and safety corrections. Slash/plus insertion and the final writing UX
remain explicit Step 6 requirements. No production migration, application
cutover, dependency publication or external setup is authorized by this record.

#### 2026-09-12 — Step 4A contract proposal ready for review

The concrete Step 4A review candidate is recorded under Step 4A above. It proposes
one closed, discriminated Content policy V2; a resolved Content contract V2; the
minimum node-classification and parsed-document projection operations; and one
explicit Vue body renderer. Editor keeps its current authoring-kit aggregate and
all UI/lifecycle ownership. No production source, package dependency, generated
artifact, stored document, contract installation or external system was changed.

The audit covered the accepted Content candidate, the published Content beta.8
tarball, the local CMS 0.2 candidate's strict readers, hashes, transitions,
revision/publication state and portability paths, and both the published and
candidate Docs rc.10 package surfaces. It found that V1 cannot accept additive
policy fields, portable V1 cannot honestly contain the V2 contract, and the
current CMS transition would require valid published entries to be unpublished.
The proposal therefore includes a temporary tracked dual-reader window, a V2
portable manifest, and an exact no-write V1-to-V2/V2-to-V1 lane. That lane permits
only the fixed V1 representation plus new V2 literal/nesting constraints, validates
drafts and active revision snapshots through the real public projection builder,
compares revision-backed derived rows without repair, and never treats a
`publicEntries` row as body storage. Apply pages change bookkeeping only; the
source bytes and every canonical content/projection row remain unchanged.

Final re-review also preserves the established storage boundary: Editor source
preparation/emission uses the exported stored validator, while Docs recipes,
browser previews and the body renderer remain on public validation. The proposal
records the existing image `id`/`src` round-trip and host `buildUrl` display path,
an unresolved-identity fixture, non-mutating strict readers, builder-only type
normalization, and bounded per-page cancellation evidence.

The already-running Docs `pnpm release:verify` was allowed to finish for retained
checkpoint evidence. It exited 0 after dependency/audit/workflow checks,
format/lint/type checks, 30 test files with 222 tests, the 309-route production
site build, deterministic two-pack SHA-256
`895cf62890d5c18ea59da25cf1ecde60063cbcdc46a51e61e82131da31a0f635`, packed
single-locale/i18n/structural fixtures, and the packed component-only kit with a
host renderer. This certifies the preserved pre-4A Docs candidate only; 4C must
rerun the owning final aggregate after an accepted 4B implementation.

The Editor playground remains running at `http://127.0.0.1:4317/playground` with
the previously reviewed candidate. Step 4 is still `IN PROGRESS`; this entry asks
the coordinator for **Checkpoint 4A acceptance or changes required**. Step 4B,
Step 5, commits and publication remain unassigned.

#### 2026-09-12 — Checkpoint 4A accepted; Step 4B assigned

The coordinator accepted the revised Step 4A contract plan after reviewing the
stored/public boundary, builder-only type normalization and non-mutating readers,
exact V1/V2 eligibility and rollback, bounded cancellation invariants, revision-
backed public projection proof, asset-preservation fixture and focused commands.
This is design acceptance only, not code acceptance or host migration approval.

Step 4B is assigned. Implement the reviewed Content policy, operations and body
renderer; adopt them directly in Editor, Docs and the playground; remove the
superseded Editor document-validity/marker traversal; and make only the bounded
CMS contract-reader/transition changes required by V2. CMS Editor adoption,
Studio UI, ChiliSkills, deployed-host activation, aggregates/4C, commits,
publication and Step 5 remain unassigned. Preserve active pointers, historical
hashes and the running playground, and return focused evidence to the coordinator.

#### 2026-09-12 — Step 4B implementation ready for review

The reviewed Content V2 boundary is implemented as uncommitted candidate work on
top of Content `b219f55b6a7f5d00ce134e244fa253a2dfb8aa57` and CMS
`1b123377c1388e2bb5583c949ba911707b048208`. Editor and Docs remain the existing
dirty Gate B2 candidates at `28f21167e662fd50e08ffcc9d86299124495afba` and
`3e5f752ffe09e33a3fd0f641209056701ee9476f`; no unrelated candidate work was
discarded or committed.

Content now owns a closed discriminated V1/V2 component-policy contract. V2 adds
canonical type unions, literal `allowedValues`, exclusive assets and explicit
nesting. Builders normalize type order; strict readers reject non-canonical input
without mutating it. Separate stored and public validators preserve unresolved
asset identity only at the stored boundary. The media reader checks that every
referenced alt, title and filename field is string-capable. The new document
projection clones its input, and the new public `ContentBodyRenderer` validates
and renders an explicit body, policy and component map. The full Content renderer
delegates its body path to that component. V2 portability manifests and the
module/runtime types use the same contract union, and Content exports one
portable-policy assertion for downstream configuration boundaries.

Editor now consumes those operations directly. Its source preparation and
emission use the stored validator; recipes use public validation; kit creation
uses Content's V2 policy assertion. The duplicate Editor policy-marker and
nesting traversal is gone. Docs defines its component constraints once as V2,
including the layout/column relationship and literal values, and its authoring
tests call the Content assertion. The playground renders previews through the
body renderer rather than the full query renderer. Its candidate preparation
copies the exact built Content package and rewrites the copied Docs module entry
to that candidate, preventing two Content runtimes during local review. This
temporary local-candidate path remains recorded in `internals/migrations.md`.

CMS readers, runtime policy transport and portability paths accept the V1/V2
union without changing their ownership. The reviewed exact no-write transition
classifier admits only a fixed representation with a policy-version change,
recomputes from the installed and target contracts at staging, validation, every
apply page, activation and applying-state cancellation, and validates both draft
storage and revision-backed public projections. Eligible apply pages update only
transition-item/run bookkeeping; canonical entry, draft, revision, publication,
public-entry, search and asset-reference rows remain untouched. Reverse V2-to-V1,
stale projections and incompatible type changes are covered. The temporary dual
reader window and its exact removal condition are recorded in the CMS
`internals/migrations.md`.

Focused Content evidence passed: three unit files with 20 tests, the node
portability-selection project with 20 tests, the Nuxt render-components contract
with 18 tests, `pnpm typecheck:source`, the package build, and targeted ESLint.
Focused Editor evidence passed four files with 23 tests, `pnpm typecheck`, and
targeted ESLint. Focused Docs evidence passed three files with seven tests; the
direct ESLint invocation only reported that these package files are ignored, so
no Docs lint claim is made here. Focused CMS evidence passed five files with 48
tests, Convex type checking, and targeted oxfmt/ESLint. After the final activation
recomputation change, `contractTransitions.test.ts` passed its 20 tests again,
Convex type checking passed again, and the changed apply file passed oxfmt and
ESLint. Diff whitespace checks pass in all four repositories.

A fresh real Chromium run exercised the live playground at 1440×1000 and
390×844. Information, two-column and host-component recipes rendered through the
new body renderer. The deliberately unclosed component kept its source and
reported a stale preview. The independent kit stayed isolated. The narrow page
had equal 390 px scroll and client widths, and no console or page errors were
observed. The first review attempt exposed that client-only routing conflicts
with the inherited Docs Open Graph setup; the workaround was removed, SSR was
restored, and the same checks then passed. The playground remains running at
`http://127.0.0.1:4317/playground`.

The dependency/release limit is unchanged: registry Content beta.8 does not
contain these candidate APIs, so local Docs review uses the tracked exact
candidate copy. No version floor was invented, no aggregate or packed 4C check
was run, and nothing was published or deployed. Existing historical contract
hashes and active pointers are not rewritten; the no-write lane changes the
installed contract pointer only after every bounded item completes. Historical
V1 revisions remain V1 evidence and rollback is limited to the reviewed exact
representation while the dual-reader window is active.

Step 4B is **READY FOR REVIEW**. Only coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d` may accept it or require changes. Step 4C,
Step 5, commits, publication and deployment remain blocked.

#### 2026-09-12 — Step 4B review: changes required

The coordinator reviewed the candidate diffs, ran independent focused probes,
and inspected the restarted playground on desktop and at 390 by 844. Step 4B
is not accepted; Step 4C remains unassigned.

Confirmed corrections: preserve V1 URL safety when authored component names
collide with native tags (the candidate emitted a `javascript:` anchor which the
accepted validator rejects); enforce explicit renderer component selection;
separate direct named-slot ownership from component ancestry; classify colon
inline components correctly; and permit explicit policy literals supported by
an open implementation string type without requiring a duplicate options list.
Editor must also complete the assigned projection/classification adoption: its
current source path still reparses the original document and interprets inline
parser metadata directly.

Existing five Editor files passed 32 tests, including stored-image preservation.
Independent current-contract probes reproduced the findings above. The CMS
transition suite passed 20 tests and independent multi-page cancellation,
invalid-active-revision and staged-output probes passed three tests; no normal
CMS transition corruption was established. Reconcile its simpler no-op proof and
active-revision validation with the plan, and retain the meaningful additional
tests, without adding unnecessary state or rewriting historical hashes.

The ordinary Information, two-column and host-component previews rendered, and
invalid source retained the previous preview before successful recovery. This
browser evidence does not cover the failing contract cases. The coordinator
restarted the stopped docs server at `http://127.0.0.1:4317/playground` and left
it running in Visual mode; source/registry and final UI acceptance limits remain.

#### 2026-09-12 — Step 4B corrections ready for re-review

The requested corrections are implemented without widening Step 4B. Content now keeps native
HTML URL, network-property and active-tag invariants in force even when a V1 or V2 component
policy uses the same canonical name. Renderer-level regressions cover unsafe colon components
and explicit native angle HTML under both policy versions. Authored components resolve only
through the renderer instance's explicit map; a named explicit selector may resolve the app
registry, while an omitted or missing implementation throws a visible
`MissingMarkdownComponentError`. Colon and angle authored identities still select host
components, and explicit native HTML remains native across name collisions.

Named-slot validation now tracks the direct parent separately from the nearest component
ancestor, so a native wrapper cannot borrow its ancestor's slot authority. Content annotates
both block and inline colon parser output, projects that origin through the canonical component
classifier, and serializes each colon form without changing it. The internal projected marker is
excluded from agent-facing component props. Builder regressions also prove that non-finite V2
literal values cannot reach an emitted contract.

Editor now parses the original source once in visual preparation. That same parsed document is
adapted for TipTap, projected for stored-policy validation, and used for the original side of
semantic comparison; only the serialized result is independently reparsed. Conversion uses
Content's classifier and the passed policy instead of reading parser block metadata directly.
Policy `allowedValues` may narrow an implementation's open string type, while an actual closed
implementation `options` union must still cover the policy literals. Focused form regressions
exercise matching and mismatching colon and angle components through the real preparation path.

CMS retains the simpler reviewed proof. Installed contracts are immutable inputs; each lifecycle
boundary recomputes exact no-write eligibility, each staged item proves input and output equality,
and the existing staged, validated, applied and pending counts establish bounded completion. No
new summary counter or second validation authority was added. Active revision snapshots are
projected through the same public projection builder and target policy, while derived rows are
compared rather than repaired. The retained tests now cover cancellation after two of three
no-write apply pages with all canonical rows unchanged, rejection of a valid draft paired with an
invalid active revision snapshot, and rejection when staged source changes before apply.

Historical revision `contentHash` values intentionally remain tied to the contract under which
the revision was created. The transition changes only the installed active contract pointer after
all bounded work completes. Historical restoration across policy versions therefore requires the
corresponding contract to remain readable during the tracked V1/V2 window; it does not require a
historical revision hash to equal the current installed hash. The dual-reader removal condition
remains recorded in CMS `internals/migrations.md`.

Focused correction evidence is green. Content source type checking, targeted ESLint, four suites
with 114 tests, and the package build pass; the build still prints the pre-existing non-fatal
`vue-docgen-web-types` error after the successful module build. The two intentional Comark
snapshot updates record colon parser/projected component origin and no longer leak that marker
into agent Markdown. Editor passes six focused files with 39 tests, type checking, targeted
ESLint, and its production build. CMS passes the 22-test transition suite, contract and Convex
type checks, the CMS runtime Vue type check, and targeted test lint. Diff whitespace checks pass
in Content, Editor, Docs and CMS. Reviewer-only probe files were removed after their cases were
promoted into the owning suites.

A fresh Chromium check at 1440 by 1000 and 390 by 844 rendered the host learning-objective
component, entered the deliberate stale-preview state for invalid source, and recovered to a
current information preview. Both viewports had no console or page errors; the narrow document's
scroll width equalled its 390 px client width. The refreshed playground remains running at
`http://127.0.0.1:4317/playground`.

Step 4B is **READY FOR RE-REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. Step 4C, aggregates, CMS Editor/Studio adoption,
ChiliSkills, commits, publication and deployment remain unassigned.

The coordinator's final independent probes then found two narrow regressions, both now corrected
and promoted into the permanent Content suites. A conventional explicit selector
`{ 'host-note': 'HostNote' }` now reaches the app registry instead of recursing through its own
kebab-case selector. Colon serialization now follows the colon attribute grammar rather than HTML
entity escaping, so literal ampersands and entity-looking strings preserve their exact parsed
values across repeated serialize/reparse cycles. The permanent colon corpus also covers escaped
brackets, formatted and nested inline content, multiple inline nodes, empty inline components,
block properties, slots and inline children inside blocks. The temporary reviewer files and old-
renderer comparison were removed. The corrected focused Content set passes four files with 124
tests, source type checking, targeted ESLint and whitespace checks. Step 4B remains ready for the
coordinator's gate decision; 4C and later work remain paused.

#### 2026-09-12 — Reviewer accepts Step 4B; Step 4C assigned

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` accepts the bounded
Step 4B implementation and corrections. Independent final Content verification
passes 124 tests across component-policy-v2, render-components-contracts,
cms-render-policy, and comark-conformance-contracts. The named-selector SSR
failure and colon literal-escaping regression are resolved in permanent tests.
The preceding independent Editor review passed six files with 49 tests; the
bounded CMS review and promoted transition regressions remain accepted evidence.

The reviewer reopened the available playground and verified the current host
component, default content and named teaching-tip slot. Deliberately incomplete
source remains intact in Source only mode while the last valid preview becomes
Stale. Earlier responsive evidence remains recorded above; this final correction
does not certify the Step 6 writing UI.

Step 4C is assigned: run each owning final aggregate once through its appropriate
certification command and verify isolated packed consumers. Record exact candidate
revisions, dirty-source identity, archive hashes, and registry limitations. Gate B2
is not yet accepted. Step 5, commits, publication, deployment, and production data
changes remain unassigned.

#### 2026-09-12 — User authorizes writing proof before consumer integration

Matthias approved changing the sequence to prove the complete Docs writing
experience before expanding the library through CMS and ChiliSkills integration.
Finish the already assigned 4C foundation certification. After Gate B2 acceptance,
assign 6A only, then review the running writing journey before 6B hardening. Step 5
follows accepted Gate D. Current step identifiers remain stable; the table,
dependencies and active packets above reflect the new order.

The proof uses the actual packages and permanent Docs playground, including
`/note`, real Docs and host components, properties, two columns, undo/redo, Markdown
recovery and explicitly local save/reopen. Tests continue to protect established
content safety; exploratory interactions are inspected in the browser before
large test or API expansion. No separate throwaway editor or new backend is
introduced. This authorization changes local development order, not publication,
deployment or production migration permissions.

#### 2026-09-12 — Step 4C certification ready for Gate B2 review

The final dirty candidates are based on Content
`b219f55b6a7f5d00ce134e244fa253a2dfb8aa57`, Editor
`28f21167e662fd50e08ffcc9d86299124495afba`, Docs
`3e5f752ffe09e33a3fd0f641209056701ee9476f`, and CMS
`1b123377c1388e2bb5583c949ba911707b048208`. All four worktrees remain dirty by
design; no commit, publication, deployment, or production data change was made.
`git diff --check` passes in every repository, and source package manifests contain
no `file:` or `link:` dependency specifiers.

Content `pnpm verify` passes 130 test files with 1,361 tests, its type checks and
builds, six E2E files with 15 tests, and the isolated packed consumer. The exact
dirty archive is `@lupinum/ginko-content@1.0.0-beta.7`, SHA-256
`b97c7a4aa224a7ce39c9a9190a7869247c117607e6a0d983501defb128314aa5`; its
release artifact records `worktreeDirty: true` and `releaseEligible: false`. The
aggregate exposed Nuxt's conversion of nested runtime-config `null` values to empty
strings. Content now restores those policy sentinels at its renderer boundary and
keeps the regression in `runtime-config-contracts.test.ts`. The recurring
`vue-docgen-web-types` message remains non-fatal after the successful package build.

Editor `pnpm verify` passes dependency policy, lint, Vue type checking, nine test
files with 60 tests, the library build, and the Docs candidate build. Its final
isolated Vue and Nuxt consumers pass against the Content archive above. The Editor
archive is `@lupinum/ginko-editor@0.1.0`, SHA-256
`7e92f768d8c826f8b9b3f76cda009a771fe182fb3b33e8b1d3cb6a1fbaf7a3b0`.

Docs `pnpm release:verify`, with the exact Content tarball supplied through the
verification environment, passes formatting, lint, type checking, 30 test files
with 223 tests, a production build that prerenders 309 routes, reproducible packing,
the single-locale and i18n fixture matrix, and the packed component-only kit with a
host-owned renderer. The Docs archive is `@lupinum/ginko-docs@0.4.0-rc.10`, SHA-256
`8a87d3c856109dac139e26e4abcfb4c3c88fd90d5ebc76e1473026d205b41bcd`.
Certification records Content SHA-256
`b97c7a4aa224a7ce39c9a9190a7869247c117607e6a0d983501defb128314aa5`,
Nuxt/Vue 4.5.1/3.5.40 and current 4.5.2/3.5.42 lanes, and
`releaseEvidence: false` because both inputs are dirty. Temporary physical package
copies and candidate aliases were removed after certification; the normal root
candidate and Docs registry links were restored. The disposable physical copies
were moved to Trash rather than irreversibly deleted.

CMS `pnpm run check` passes formatting, all policy and release-hygiene checks,
package and Studio builds/type checks, 193 test files with one skipped, and 1,324
tests with one skipped. The aggregate caught the intentional canonical parser
addition of `$` component-origin metadata and two reviewed module-size overruns.
The golden fixture now records the metadata required by V2 policy validation; the
no-write policy classifier and transition output application were split into
focused modules instead of raising size limits. The focused golden, size-budget,
and transition set passes 32 tests. The supported `package:e2e:dev` lane also
passes tarball local-specifier checks, the isolated Nuxt consumer, package imports,
Content safety probes, portability, and pnpm use. Its exact package hashes are:

- `@lupinum/ginko-cms-contract@0.2.0-rc.2`:
  `b50eedf646a445478af592566881e12a917d513ab6ed488a7de400b7e589742a`
- `@lupinum/ginko-cms-convex@0.2.0-rc.2`:
  `a9a50877200555d1f8998933e1a1e4d26a4d2f8ba28f6b75f34b96f518c88128`
- `@lupinum/ginko-cms@0.2.0-rc.2`:
  `ea06b52f8a42443f05ea7f118241fbca3791318cf7d636347bc086c4a88295a7`

The literal CMS `pnpm run package:e2e` candidate lane cannot truthfully certify
this uncommitted stack: it requires `.pack/candidate/candidate-artifact.json`, and
`candidate:pack` correctly requires a clean source plus immutable upstream hashes.
CMS compatibility still pins registry Content beta.4; the local Docs install and
the other published Content candidates do not contain this dirty V2/parser source.
The attempted command stopped at that missing-manifest preflight. The passing
development-source lane therefore proves the existing registry-compatible CMS
package path only, not the unpublished V2 tuple. No release floor, compatibility
entry, candidate attestation, or local dependency was invented to hide this limit.

A refreshed real-browser check of the lasting playground rendered the two-column
Docs component and the isolated host component at desktop and 390 by 844. Both
previews reached `Current`; the narrow document had equal 375 px scroll/client
width after browser chrome, and no console warnings or errors. Duplicate stale dev
roots were stopped. The refreshed server and deliverable tab remain available at
`http://127.0.0.1:4317/playground`.

Step 4C is **READY FOR GATE B2 REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. Step 6A must not start until the reviewer
accepts Gate B2. Step 5, commits, publication, deployment, and production migrations
remain unassigned.

#### 2026-09-12 — Gate B2 accepted for local foundation; Step 6A assigned

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` accepts Gate B2 for
continued local development of the shared contract and Docs writing proof. The
reviewer inspected the aggregate-found runtime-config correction and CMS module
extractions, then independently ran 33 Content runtime-config/renderer tests and
32 CMS transition/golden/module-budget tests; all pass. Content, Editor and Docs
archive hashes were independently recomputed and match the 4C packet. The Docs
certification identifies the exact Content archive and correctly states
`releaseEvidence: false`; the Content artifact records dirty, non-release inputs.
The wider aggregate and browser results above are implementor evidence, not a
claim that the reviewer reran every aggregate.

The CMS candidate lane's missing clean candidate attestation is a real remaining
certification limit. The passing development lane covers registry-compatible
packages, not the unpublished V2 tuple. This does not block the Docs writing proof.
Exact CMS/V2 Content archive-consumer proof is required before CMS adoption in
Step 5, and clean release/registry certification remains required before release.
No check is relabeled as passing, and no release guard or dependency floor is
changed by this decision.

Step 6A only is assigned now: demonstrate the complete writing journey in the
permanent Docs playground through the actual packages. The reviewer must operate
the running journey before assigning 6B. Preserve content-safety regressions,
explore uncertain UI in the browser, and avoid speculative test/API expansion.
Step 5, commits, publication, deployment and production migrations remain
unassigned. Current candidate bases and exact archive identities are recorded in
the preceding 4C packet.

#### 2026-09-12 — User-authorized local commit checkpoint

Matthias explicitly requested proper commits across the affected repositories.
The implementor paused with no writes or checks running. The coordinator reviewed
and committed the current source, tests and package integration in each owner;
publication, push, tags and production changes were not requested or performed.

| Repository | Branch | Source commit |
|---|---|---|
| Content | `fix/parser-parity` | `e484dbeffe70534002e5bb4c20e4bc1b64ed62f5` |
| Docs | `docs/complete-mdc-author-reference` | `10fc712215b493b508ba828000e86420c60b028b` |
| CMS | `fix/parser-parity` | `b8d6de45dfd2e4877bfa4e9fdd53e57937c9ed1a` |
| Editor | `main` | `f9dc2180f19bcf9bcfbeea729dbc4a13734c8a4a` |

Content and CMS commits preserve the reviewed foundation. Docs includes the new
`note` search keyword. The Editor commit includes the initial Step 6A source work
already present when the user requested the checkpoint: slash/plus insertion,
property controls, toolbar changes and local draft playground controls. This is
not Step 6A acceptance; the complete browser journey still needs implementation
and review. No earlier dirty-archive evidence is relabeled as certification of
these new clean commit IDs, and the CMS/V2 package-tuple limit still applies.

Pre-commit verification independently passed all 62 Editor tests and seven focused
Docs authoring/component-kit/generator tests. Two asset workflow tests initially
used the former toolbar location; they now operate More → Image and retain their
cancellation/stale-completion assertions. The disabled-feature test also opens
More before checking the available actions. Editor typechecking and targeted test
lint pass. Previous 4C aggregate evidence remains recorded with its exact scope.
Both the user's ChiliSkills checkout and the implementor's ChiliSkills worktree
were clean and required no commit. Generated builds, candidate copies and archives
remain ignored. This plan/evidence update is committed separately after the four
source commits so the cross-repository checkpoint has an exact durable record.

#### 2026-09-12 — Step 6A complete writing journey ready for review

The permanent Docs playground now demonstrates the assigned writing slice through
the built Editor, Content and Docs packages. From an empty visual document, the
real browser accepted `/note`; the keyword-filtered list exposed the Docs
Information recipe, ArrowDown/ArrowUp retained keyboard selection, and Enter
inserted the callout. Escape closed a second slash menu while preserving the
editor's active focus. The pointer/touch `+ Insert` path used the same recipe
list and inserted Information at the 390 px viewport.

The selected callout's typed metadata controls changed its title to “Before you
begin” and appearance to `quiet`; editing its content updated the real Docs
preview. The two-column recipe inserted, both column bodies were edited, Undo
restored “Second column.”, and Redo restored “Recommended approach.” The
host-owned `learning-objective` recipe inserted with its named `tip` slot;
the title and assessed toggle were configured and the named-slot content was
edited. Markdown mode then showed the canonical component source, including the
`<template #tip>` boundary.

The deliberate unclosed source remained byte-for-byte unchanged in the source
textarea. The preview switched to Stale while retaining the last valid rendered
body, stated the parse failure, and the explicit recovery action restored the
previous canonical source. The clearly labeled Local demo draft awaited the
Editor's exposed `flush()`, saved one namespaced browser-storage value, survived
a new empty document, and reopened the complete source. This remains demo-only
browser storage; it does not claim application persistence.

Desktop inspection showed the content-led reading surface, compact progressive
toolbar, typed component settings and side-by-side real preview. At a requested
390 by 844 viewport, the page's 375 px content width equalled its scroll width,
the toolbar remained operable, touch targets expanded, the editor and preview
stacked, and `+ Insert` completed the same Information insertion. The restored
desktop viewport also had equal 1,265 px client and scroll widths. Browser logs
contained no warnings or errors. The second editor continued to render only its
isolated `host-note` kit.

Focused checks pass: Editor type checking; targeted source, component and
playground lint; 14 authoring/authoring-editor tests including slash search,
insertion and Escape focus restoration; the Editor production build; six Docs
authoring/generator tests; Docs candidate preparation against the accepted local
Content build; and Docs Nuxt type checking and production build. The reviewer
checkpoint additionally ran all 62 Editor tests and seven Docs focused tests
before the browser journey. All owning worktrees are clean at the source
checkpoint; this evidence entry is the only subsequent tracked change.

The consumer calls actually needed are `composeAuthoringKits` /
`createAuthoringKit`, `<GinkoEditor v-model :authoring-kit>`, its exposed
`flush()`, Content's `parseMdcBody` and `validatePublicMarkdownAst`, and
`ContentBodyRenderer` with the same policy and host component map. One concrete
API friction remains for later evaluation: insertion is intentionally anchored
to the current ProseMirror selection, so a host cannot request a root-level
insertion independently of that selection. The playground did not add a second
placement authority or speculative API for this.

Step 6A is **READY FOR REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. The running deliverable remains
`http://127.0.0.1:4317/playground`. Step 6B and Step 5 remain paused pending
reviewer operation and acceptance. No push, tag, publication, deployment or
production data change occurred.

#### 2026-09-12 — Reviewer operation of Step 6A: changes required

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` independently operated
implementation `f9dc218` (evidence HEAD `5f12893`) through the running built
playground. The core journey works: normal keystrokes `/note`, arrows/Enter,
callout properties and body, two edited column slots, Undo/Redo of the second
column, host title/toggle/named tip slot, canonical Markdown, and local
save/new/reopen. Reopened source exactly equals the source captured before save.
The incomplete-source fixture remains byte-identical after attempted visual
conversion, with the previous valid preview explicitly Stale; recovery works.
At 390px, pointer-operated + Insert successfully adds Information. Browser
warning/error logs are empty. The second kit remains isolated.

Step 6A is **CHANGES REQUIRED**, limited to these observed writing defects:

1. Property edits steal focus. On the Information inspector, type in Icon and
   press Tab: focus goes to the contenteditable document instead of the next
   Title field. Title and select edits also return focus to the document.
   `updateSelectedProp` unconditionally calls `instance.commands.focus()` after
   updating the node. Keep focus and natural Tab order within property controls
   while preserving the selected block. Recheck select, checkbox, and text edits.
2. Narrow columns retain desktop spans. At 390px with the valid nested
   Information → Layout recipe, the two editable columns have computed spans 4
   and 8 and widths about 74px/161px; words in the first column break into
   fragments. The responsive full-width rule loses to the more specific size
   selectors in playground.vue. Stack both editable columns on narrow screens,
   including sm/lg widths and this nested case; preserve the desktop ratio.
3. The large marketing-style header still dominates the opening viewport. The
   initial desktop screenshot puts the editor toolbar near the bottom with the
   writing content below it. Replace it with a compact playground heading and
   short help so the actual editor is immediately usable. Keep the task focused
   on writing; do not add a new design system or another demo shell.

These are corrections to the demonstrated slice, not an assignment of 6B.
Recheck the affected browser journeys and add only focused regression coverage
for the confirmed focus defect. Preserve the passing content/persistence journey.
Return the running corrected desktop and 390px example for reviewer operation.
The review document is restored in Visual mode and saved as the local demo draft;
viewport overrides are reset. Local corrective commits remain authorized; push,
publication, Step 6B and Step 5 remain unassigned.

#### 2026-09-12 — Step 6A browser corrections ready for re-review

Corrective implementation `c6ca47f` removes the unconditional editor-focus
command after property transactions. The selected component remains selected,
while the browser now follows the natural inspector order: Tab from Information
Appearance reaches Icon, Tab from Icon reaches Title, and Tab from the
learning-objective Assessed checkbox reaches its Title. The focused
authoring-editor regression exercises text, select and toggle transactions,
asserts that each active form control retains focus during the update, and
confirms that the selected-block inspector remains mounted.

The narrow playground override now matches the specificity of both `sm` and
`lg` desktop rules. In the reviewer's nested Information → Layout document at
the 390 by 844 viewport, both column rectangles are 247 px wide at the same
64 px left coordinate and occur on separate rows (tops 40 and 130); the document
client and scroll widths both remain 375 px after browser chrome. Resetting the
viewport preserves the asymmetric desktop column widths. The more compact page
heading places the desktop editor toolbar and editable content in the opening
screen; at 390 px the heading, concise journey help, editor header, toolbar and
start of the current content all appear in the opening viewport.

The focused regression passes with four authoring-editor tests. Targeted lint,
Editor type checking and the Editor production build pass. The refreshed Docs
candidate passes Nuxt type checking. A fresh browser tab after candidate
preparation has no warning or error logs; transient Vite reload messages from
the candidate directory replacement were isolated to the prior development tab
and are not current runtime failures. The complete reviewer document is restored
in Visual mode in the deliverable tab, and the responsive viewport override is
reset.

Step 6A is again **READY FOR REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. Step 6B, Step 5, push, publication and
deployment remain unassigned.

#### 2026-09-12 — Reviewer accepts Step 6A; Step 6B assigned

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` accepts the corrected
Step 6A writing proof at source commit `c6ca47fbe66dfbec8334817145c7948c77021109`
(evidence commit `df0969e`). The reviewer reloaded the built playground and
independently verified the three requested corrections through normal UI actions.

Appearance changes followed by Tab reach Icon; typing in Icon followed by Tab
reaches Title; committing Title reaches Save locally. Changing Assessed followed
by Tab reaches the host Title. The selected-component inspector remains present,
and the property changes reach preview. The focused authoring-editor suite passes
all four tests, including the new focus regression.

At a 390 by 844 viewport, both nested sm/lg column boxes compute `grid-column:
1 / -1`, with equal widths about 247px and distinct vertical positions. The first
column text is readable without the earlier word fragmentation. After resetting
the viewport, the desktop spans remain 4 and 8 (about 164px/339px in the nested
example). Opening desktop and mobile screenshots include the editor toolbar and
writing content. The previous independently verified full journey remains the
acceptance evidence for insertion, component editing, undo/redo, exact local
save/reopen and unchanged incomplete source.

The saved reviewer document is restored in Visual mode, the viewport override is
reset, and the playground remains available. This accepts the bounded working
proof, not full Step 6 hardening, host integration or release readiness.

Assign Step 6B only, following its existing packet: preserve the proven experience,
complete the initial keyboard/block-action/property/source behavior, remove
unneeded experimental code, add focused observable-behavior regressions and run
owning final checks once at handoff. Do not expand the component set, invent a
root-insert API without demonstrated need, or start CMS/ChiliSkills adoption.
Return Gate D for reviewer operation. Local corrective commits remain authorized;
Step 5, push, publication, deployment and production migration remain unassigned.

#### 2026-09-12 — Step 6B hardening ready for Gate D review

Editor source commit `49e6be4` completes the assigned initial-kit hardening while
preserving the accepted Step 6A writing journey. Slash and `+ Insert` use the same
focused menu; Escape restores the document selection after the menu unmounts.
Slash insertion stays inactive during IME composition and in code blocks.

Every selected component now exposes accessible Move up, Move down, Duplicate and
Delete actions. Move also has `Alt+ArrowUp` / `Alt+ArrowDown`, and duplicate has
`Alt+Shift+D`. Each action is one undoable history step and keeps a useful node
selection. No drag implementation was added, so there is no separate pointer-only
mutation path whose validity can diverge from these actions.

Structural editing now protects component boundaries from destructive Backspace
and Delete merges. Recipe placement checks the selected component's actual parent.
Markdown paste constructs the candidate ProseMirror transaction, serializes the
whole resulting document, and validates it with the active authoring kit before
dispatch. This accepts a column replacement inside a layout while rejecting the
same column at the root, without duplicating Content's policy model in Editor.
Parent deletion remains a normal undoable block action, and the restored document
continues to validate after Enter, boundary deletion attempts, delete and undo.

Typed properties distinguish omitted values from valid empty strings, zero and
false. Number controls keep invalid intermediate text local, announce a concise
validation error, and update canonical source only after a finite number is
available; blank input removes the optional property. Source/Visual stale-preview
and explicit recovery behavior from Step 6A remains intact.

Focused authoring-editor coverage now has 11 tests for insertion focus, code/IME,
block actions and single-step undo, typed property edge cases, parent-sensitive
paste and structural boundaries. The single final owning `pnpm verify` aggregate
passed dependency policy, full ESLint, Vue type checking, all 70 tests, the Editor
production build, candidate preparation, and the Docs Nuxt production build.
`git diff --check` also passed.

Browser operation on the built playground confirmed duplicate/delete/move and
Undo, plus-menu focus and Escape recovery, and a 21-paragraph long document whose
real preview reflected the final edit by the 400 ms check. At 390 by 844, the
document client and scroll widths both measured 375 px; nested `sm` and `lg`
columns remained readable as equal-width stacked rows. A fresh post-build tab has
no warning or error logs and is restored to the saved reviewer document in Visual
mode at `http://127.0.0.1:4317/playground`.

Known limits are unchanged and explicit. Insertion remains anchored to the current
selection; no speculative root-insert API was added. The initial Docs kit has no
standalone numeric component, so numeric transient-input behavior is proven by the
focused generic-kit test rather than that browser fixture. Local demo storage is
still browser-only. Markdown flavors receive the new policy-validated paste path;
ordinary semantic HTML continues through ProseMirror's native paste behavior.

Step 6B is **READY FOR GATE D REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. Step 5 and CMS/ChiliSkills adoption remain
paused. No push, tag, publication, deployment or production data change occurred.


#### 2026-09-12 — Gate D reviewer requires numeric-field lifecycle correction

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` reviewed source
`49e6be4` and evidence `341aba8`. Gate D is **CHANGES REQUIRED** for a confirmed
property-control defect. Valid numeric drafts remain in a cache keyed by document
position, tag and property name. After changing count from 1 to 5, Undo restores
canonical count 1 while the inspector still displays 5. An invalid `bad` entry
also survives host document replacement: the new document has count 42, but its
field still displays the old entry and error. Both independent mounted-editor
probes fail at the displayed-value assertion after confirming correct canonical
values.

Correction scope: keep the document authoritative after valid property commits,
undo/redo, selected-block changes and document/kit replacement. Retain incomplete
numeric text only for the relevant active field. Avoid adding persistent block
identity or a second model to manage temporary input. Move the two observable
regressions into the owning authoring-editor suite and remove the temporary
reviewer probe file.

Independent existing authoring-editor and editor-workflows suites passed all 26
tests. Real playground operation confirmed Duplicate followed by one Undo
restores the original component tree. A separate rich-HTML placement probe did
not establish a defect: native paste normalized the tested wrapper to ordinary
rich text, and flush/save succeeded. It is not part of this correction request.

Content, Docs, CMS and both ChiliSkills checkouts were clean at their recorded
local commits during this review. Editor correction source/tests and evidence
must also be committed locally before resubmission. No push, publication,
deployment or production data change is authorized. Step 5 remains unassigned
until Gate D is accepted and its exact CMS/V2 package prerequisite is proved.

#### 2026-09-12 — Numeric-field lifecycle correction ready for re-review

Correction source commit `4a9da66` makes canonical component properties
authoritative again. A valid number no longer remains in the local draft cache,
and any real document transaction clears the current invalid draft. Selection,
external document and authoring-kit changes also clear it. A consumed delayed
v-model echo does not clear a newer incomplete input, so ordinary host feedback
cannot interrupt the active field.

The number control now distinguishes an incomplete numeric prefix from invalid
text. Prefixes such as `1.`, `-` and an unfinished exponent remain editable and
do not mutate canonical source or show a premature error; complete decimal,
negative and exponent values commit normally. Unrelated text such as `bad` keeps
the existing concise validation error until corrected or its authority changes.
No block IDs or parallel persisted state were introduced.

The two reviewer regressions are now owning tests: Undo restores both canonical
count 1 and displayed value 1, and host replacement at the same position/tag
replaces `bad` with canonical/displayed count 42 and removes the error. A third
focused test covers sequential decimal and negative prefixes. The temporary
reviewer probe file is removed.

Focused authoring-editor checks pass all 14 tests, along with targeted ESLint,
Vue type checking and `git diff --check`. The final post-correction `pnpm verify`
aggregate passes dependency policy, full ESLint, Vue type checking, all 73 tests,
the Editor production build, candidate preparation and the Docs Nuxt production
build. The reviewer also independently confirmed sequential `1.` → `1.5` input
in a mounted-editor test, and block move/delete with single Undo in the browser,
then restored the saved reviewer fixture. The playground remains available at
`http://127.0.0.1:4317/playground`.

The Step 6B limits recorded above are unchanged. This correction is **READY FOR
GATE D RE-REVIEW** by coordinator task
`01a09564-7dee-70a1-828c-84dd6628054d`. Step 5 and CMS/ChiliSkills adoption remain
paused. No push, tag, publication, deployment or production data change occurred.


#### 2026-09-12 — Reviewer accepts Step 6 / Gate D and audits local commits

Coordinator task `01a09564-7dee-70a1-828c-84dd6628054d` accepts Step 6B and
Gate D at corrective source commit `4a9da6659f9f7e0da8e10535fd50516ecc4f3169`
with implementor evidence `d057d45`. Independent review confirms the correction
removes valid drafts, clears stale incomplete drafts on document changes, and
preserves a newer input when a delayed host echo is consumed. The original Undo
and document-replacement failures are now passing owning regressions. The
reviewer independently ran authoring-editor and editor-workflows on the submitted
commit: both files, all 29 tests passed. The implementor's final full verification
reports 73 passing tests, lint, type checking, Editor build and Docs build.

The reviewer operated Duplicate, Move down and Delete, each followed by a single
Undo restoring the original block tree. A fresh post-build browser tab reopened
the saved nested Docs/host-component fixture in Visual mode with a Current real
preview and no warning or error logs. Earlier desktop/mobile, slash insertion,
focus, source recovery and exact save/reopen evidence remains applicable. Numeric
controls are covered by mounted-editor regressions; the initial Docs fixture has
no numeric field. This accepts the bounded initial-kit experience, not all Docs
components, complete host integration or release readiness.

Local work is committed at Content `e484dbe`, Docs `10fc712`, CMS `b8d6de45`,
and Editor `4a9da66` plus plan/evidence commits. Both ChiliSkills checkouts remain
unchanged and clean at `663ee19`. The unrelated untracked
`plans/2026-09-06-architecture-review.md` in the main CMS checkout is excluded
from this work; the CMS implementation worktree is clean. Temporary reviewer
probes are removed. The playground remains at
`http://127.0.0.1:4317/playground` with the reviewer document restored.

Step 5 is the next planned milestone and remains unassigned. Its exact CMS/V2
package-consumer prerequisite still applies before adoption. No push, tag,
publication, deployment or production data change occurred.


#### 2026-09-12 — Step 5 assigned after accepted Docs writing proof

Matthias asked why implementation had stopped and what comes next. The
coordinator resumes implementor task `01a0943e-9f8d-7130-81e9-e09aa36cae34`
with Step 5 only, following accepted Gate D at `cf422e6`.

First establish the exact CMS/V2 Content candidate package-consumer proof using
the documented local lane or correctly attested clean candidates. Preserve
release guards and record the exact artifacts and commands. After that proof
passes, proceed with the existing Step 5 packet: shared Editor adoption in CMS
and a safe ChiliSkills script pilot, preserving host-owned assets, persistence,
permissions and undo. Use disposable pilot fixtures; existing saved ChiliSkills
content is outside this step's migration scope. Remove the old CMS editor only
after parity and import-consumer checks pass.

Return Gate C with independently operable local previews, consumer API examples,
focused behavior evidence and owning verification results. Commit scoped source,
tests and evidence locally. Step 7 and later milestones remain unassigned. No
push, publication, deployment or production migration is authorized.


#### 2026-09-12 — Gate C reviewer requires host integration corrections

The implementor submitted Editor `856372e`, CMS `17db81ef` (prerequisites
`b172eaf0`, `3b8fcc5b`), and ChiliSkills `f5a67ee`. The packet reports clean
source trees, CMS check/build and 1,276 tests with one skipped, ChiliSkills check
with 55 tests, and local candidate package installation/build. Gate C is
**CHANGES REQUIRED**; passing build/component checks do not cover the failures
below.

1. **Pending edits can be lost.** In the real ChiliSkills pilot at port 4321,
   the reviewer typed a final phrase in Visual mode and immediately selected
   “Einfaches Textfeld.” The phrase was absent from the resulting textarea.
   Neither host currently awaits the shared Editor's exposed `flush()` at its
   save/close boundary; Editor cancels pending conversion on unmount by design.
   Integrate pending edits into host save, close/navigation and undo ordering.
   Preserve recoverable source on failure. The separate plain-text escape also
   removes pilot enrollment with no return path for a nonempty pilot; prefer the
   existing Source mode or a safely reversible mode switch.
2. **Local image insertion fails.** The reviewer used the real file picker with
   `tests/fixtures/diagram.png`. The image rendered without a `src` (natural
   width zero) and conversion reported “This document violates the editor
   authoring kit.” The pilot's canonical `asset:` scheme and display `blob:` URL
   do not fit the current Content/Editor URL boundaries. Correct the canonical
   reference/display resolution contract, preserving URL safety and host-owned
   bytes. Verify real insertion, reload after asynchronous asset loading,
   export/restore, failure cleanup and Undo. Synchronous insertion acceptance is
   not equivalent to later conversion success. Keep CMS-specific storage-ID
   recognition in its asset provider and hide unsupported metadata actions.
3. **Candidate setup is not reproducible from committed inputs.** Both hosts
   import unpublished packages absent their dependency manifests/lockfiles or a
   committed setup command; verification relies on manually linked ignored
   `node_modules` entries. Add a documented exact-candidate bootstrap for clean
   checkouts/consumers, including compatible Vue/TipTap identity, without putting
   temporary links in release manifests or publishing. The visual editor must
   actually mount in integration regressions. A temporary reviewer component
   probe failed during mounting with Vue ref/peer warnings before its intended
   assertion; it was removed and is not counted as data-loss evidence.
4. **The V2 package prerequisite remains open.** The new local-content lane
   checks V2 symbol presence, but its offline contract builder receives no V2
   policy. The reviewer executed that exact builder call and confirmed version
   1 with an empty V1 component policy. Existing packed safety probes exercise
   native Content without a component policy. Add an actual V2 custom-component
   contract and positive/negative cases through packed CMS using the exact
   Content archive; record artifacts and results.
5. **The real CMS browser journey is missing.** Mounted FieldRichtext tests and
   a Studio build do not satisfy both-host acceptance. Investigate the documented
   local host/bridge workflow without disturbing the user's port 3000 process or
   changing remote backend/auth state. If an external action is necessary,
   identify the exact missing authorization and finish independent corrections
   first. Do not silently waive this requirement.

The reviewer restored the disposable Fourier script through the UI, undid the
failed image/module asset insertion, and left the pilot available at
`http://127.0.0.1:4321/modules/signale-spektren`. Source fixture content is
restored; temporary reviewer test files are removed. Implementation source was
not edited by the reviewer during this audit.

These bounded Step 5 corrections are assigned to the implementor. Commit source,
tests and evidence locally, then return Gate C again with operable host previews.
Step 7 and later milestones remain unassigned. No push, publication, deployment
or production migration is authorized.


#### 2026-09-12 — Correction review resumed; remaining lifecycle and restore defects

Matthias requested continuation after the implementor task was interrupted. The
coordinator resumed the assigned Step 5 correction work and reviewed Editor
`ec473f4`, ChiliSkills `5cd2ebd`, and CMS `bb57906f`. Initial fixes now include
pending-edit registration and awaited save/export/route-leave boundaries,
separate canonical/display image URLs, explicit metadata capability, exact
candidate bootstrap scripts and an actual V2 offline contract fixture.
Independent focused checks passed: Editor 32 tests, ChiliSkills 10 tests, CMS
flush-registry one test. This is progress, not Gate C acceptance.

The reviewer independently confirmed a remaining data-loss path at the isolated
`http://localhost:4321/modules/signale-spektren` origin: open the empty Fourier
slide, enable the pilot, type “Reviewer collapse test,” immediately collapse the
lecture, then reopen. The script is empty. CollapsibleContent unmounts the editor
without an awaited flush. The separate `127.0.0.1` implementor fixture was not
modified by this check.

A focused reviewer test also confirms that `remapScriptAssetIds` rewrites both
plain-text `id="asset-before"` examples and Markdown images inside fenced code
when mapping an asset identity. A real image control case rewrites correctly.
Backup restore must preserve text/code examples and legacy script meaning;
reuse the canonical Content media-reference semantics rather than parallel
regular-expression scanners. The temporary reviewer test was removed after
recording the failure and sent to the implementor for an owning regression.

Code review identified two CMS follow-ups: locale switching checks emitted
`isDirty` before deciding to save, so pending visual edits can be missed on
query-only navigation; secondary-editor closing and same-component route
changes need the same lifecycle assessment. The new-entry leave guard also
remains dirty after a successful create, causing an erroneous unsaved-changes
prompt during its success navigation. Correct the successful ownership
transition while retaining guards for failed saves.

These are included in the existing Step 5 correction assignment. Final image
picker/reload/export evidence, exact final-candidate checks and the real CMS
host journey remain required. No further milestone, publication or deployment
is assigned. Scoped local correction and evidence commits remain authorized.

#### 2026-09-12 — Gate C corrections reviewed; CMS sign-in remains the next action

Reviewed local revisions:

- Content `f854977551c9a32b3bedf1abc8d6b94e757a8a7f`: shared stored-media collection
  and stored-ID remapping, with policy validation and exact no-op source preservation.
  The coordinator implemented this bounded correction using the existing AST traversal.
- Editor `2d9aa495549a2c072d09765e0044a6ae80b062f6`: default asset insertion preserves
  a supplied durable URL; host providers can retain canonical IDs.
- CMS `b0ebeb435380210be77a0e174b1869c93a667675`: awaited locale/create/route boundaries
  and correct ownership after successful entry creation.
- ChiliSkills `795ecef`, then `eb4ce97`: awaited host source/asset transactions,
  per-block failure state, safe lecture collapse/removal, Content-owned media parsing,
  concurrent slide-field preservation, and no unsupported File action.
- Docs remains `10fc712215b493b508ba828000e86420c60b028b`.

The coordinator independently ran Editor workflow/authoring tests (33 passed),
CMS locale/flush tests (5 passed), and ChiliSkills pilot/module tests (14 passed
before the final File-capability-only correction). The implementor verified that
final correction with its mounted pilot tests (2 passed), lint and typecheck.
The implementor reports full Editor verification (78 tests), full ChiliSkills
check (63 tests, types and builds), and focused CMS checks plus Studio types/build.

Content's full `pnpm verify` passed: 1,363 core tests, 15 server e2e tests,
typechecks, static checks, docs and examples. Two `pnpm release:pack` builds
produced the same clean-source archive. Its packed consumer build/import/typecheck
lane passed, including public imports and meaningful new helper regressions;
the optional browser/plugin lane was not rerun for this pure helper addition.

Exact local candidate identities:

- Content `.pack/lupinum-ginko-content-1.0.0-beta.7.tgz`:
  `81b94b5950c5b396989172e6d21d195fc99afd0525a272873bab8196df0e4119`.
- Editor `release-artifacts/lupinum-ginko-editor-0.1.0.tgz`:
  `6b4f6eda23aafaa227c253df3c821d7f478faa3af22f83819cf3f430414d8861`.
- CMS local-content archive:
  `80ebb49f568cf6be4596f13c17b6c23256da3a567a1c08eddf29a18e9551422c`.

CMS's `.pack/local-content/release-evidence-pnpm.json` identifies clean CMS
`b0ebeb43` and the exact Content archive above. The implementor's local-content
lane passed clean install/build, public imports, actual V2 authoring positive/
negative probes and a portability document/asset round trip. This is offline
candidate evidence, not live CMS acceptance or release certification. The
coordinator also executed CMS's committed candidate bootstrap and verified the
installed new Content exports.

Independent ChiliSkills browser evidence at the isolated `localhost:4321` origin:
immediate type/collapse/reopen retained the final text; the actual picker inserted
`tests/fixtures/diagram.png`; Markdown stored a UUID while the image rendered from
a blob URL at natural width 640. Reload retained that image. The actual module
export produced a ZIP containing `module.json` and the referenced image bytes.
Restoring that exact ZIP through the app remapped the UUID and rendered the image
at width 640 again. Module Undo recovered the prior module. The reviewer restored
the original `Collapse persistence proof` script and removed the generated ZIP.
The separate implementor origin at `127.0.0.1:4321` remains available.

CMS startup investigation recovered an inspectable host without remote changes.
The normal dev launcher hits `spawn EBADF` in esbuild 0.28.2 during Nitro's dev
build; pipe/PTY, Node 24.18/24.21 and Nuxt `--no-fork` reproduced it. A normal
production build instead failed because `/blog` prerender received a Content
data-source 502. A diagnostic built host with only public prerender disabled
serves the real Studio sign-in at `http://localhost:3000/studio`; Studio source
is served by Vite on 5252. The repository config is unchanged. Only an ignored
`.env.local` with the existing development connection settings was created.
No credentials were copied into source, and no backend/auth configuration or
backend data was changed. Temporary process instrumentation was removed.

**Remaining gate and owners:** Matthias signs in with the development owner
account; the coordinator then verifies real CMS editing, immediate save, reload,
locale switching and creation, and reports any observed contract/backend blocker.
An authenticated session was requested instead of exposing the password in the
task. Code corrections and package checks do not waive this browser requirement.
Gate C is not accepted, and Step 7 remains unassigned. Completed source changes
are committed locally; no push, publication or deployment occurred.


### In-depth correction review — 2026-09-13

The coordinator completed independent API, conversion and playground reviews and
fixed all actionable findings. Visual mode retains edits when serialization
fails; asynchronous asset/paste operations reject stale ownership; authoring
inputs are frozen before validation; typed component properties and canonical
media metadata survive native HTML copy. Content now owns safe quoted/typed
inline-component serialization. Media insertion capabilities are explicit in
Editor, CMS and ChiliSkills, including the additive `enableImages` option.

Editor `pnpm verify` passed all 110 tests, lint, types, library and documentation
builds. Content full verification passed, including 15 server end-to-end tests;
the final parser correction passed the refreshed 1,375-test core suite and source
types/lint. CMS `pnpm check` passed 1,281 tests (one existing skipped), formatting,
static checks and types. ChiliSkills pilot tests (2), types and lint passed.
Content's Vue-only IDE metadata generation was verified separately after fixing
a pre-existing silent generator failure. Final packaged-consumer and browser
evidence is recorded in the follow-up below.

This review does not waive the authenticated CMS save/reload acceptance gate
described above. No release, deployment or remote backend change is authorized
by these local verification results.


#### Final installed-package and browser evidence

The clean Content correction is `2789113`; its reproducible archive SHA-256 is
`f25e43f24d88c820612421011cd8a475155b92398698ffc778de25236eb7bc07`.
The Editor correction is `43a73ca`; its archive SHA-256 is
`3582d95f511f9bfab0d0316cc9ef83553727c1490e0b70f7a732331f76c807ed`.
Fresh installed Vue and Nuxt consumers passed public API/declaration checks,
component/slot typechecks, production builds and explicit CSS inclusion using
these two archives. Editor's dependency audit reports no known vulnerabilities.
The Content archive includes the verified IDE metadata artifact.

CMS correction `4da0a230` passed the full check described above. Its refreshed
strict candidate install uses these exact archives; 64 focused workflow/probe
tests and Studio types passed again against them. ChiliSkills updated its host
to Vue 3.5.42 and Nuxt 4.5.2 to meet the accepted package peer ranges. Its refreshed
candidate install validates peers, retaining only Ginko Docs' existing, narrowly
scoped Sharp 0.35.4 exception, with a removal condition in its migration log.
ChiliSkills then passed full `pnpm check`: all 63 tests, lint, formatting, types,
slide build and Nuxt production build. Docs source remains unchanged at `10fc712`.

The coordinator tested the actual built playground at
`http://localhost:4317/playground`: `/note` filtering and keyboard insertion,
property editing and matching live preview, Markdown paste conversion and
visible rejection of unsupported pasted content, aligned tables, multi-paragraph
lists, unlabeled code fences, and isolated-editor collapse retention. Final
desktop and 390×844 checks passed; the insert menu fits the viewport and the page
has one main landmark and one main-content ID. The welcome document was restored
and survives reload. The preview remains running.

Independent reviewers report no remaining actionable findings in the reviewed
API, conversion and playground changes. Authenticated CMS editing/save/reload
remains the explicit unverified acceptance gate; local package and component
checks do not establish that backend workflow. No push, publication or deployment
was performed.


### Inline editing and Markdown clipboard — 2026-09-13

The writing canvas now owns contextual editing controls. The selected-block
inspector and image action bar below the document have been removed. Callout
and image cogs open local settings; callout titles, aside labels, and excerpt
labels are editable directly. Callouts can change type without losing their
properties or body. The candidate must validate against Content before it applies.
Latest-choice and document ownership guards reject stale asynchronous changes.

The public optional `canvas` metadata refers to existing component properties.
Docs owns the six callout variants and the three paired column presets. The
Editor has no Docs tag dependency. A paired layout exposes a divider and width
labels, with pointer capture, three snap positions, keyboard adjustment,
cancellation, and one-step undo. Existing custom layouts remain untouched on
load. Component isolation prevents ordinary joins from discarding block metadata.

Tables have contextual row, column, and alignment icon menus. The first row is
the Markdown header; another row can be promoted without discarding the old
header. Code language and filename controls use the existing source properties.
Image controls preserve stable asset references and refresh resolved URLs
without replacing the image element or rewriting document source.

Copy/Cut use Content's canonical serializer for both Markdown and component
source. Warm selections write synchronously; immediate selections use the native
async clipboard while retaining user activation. Failed copies are visible,
and a pending cut never deletes a subsequently changed selection. Ordinary
input-field copying remains native. No second Markdown serializer was introduced.

Validation: Editor `pnpm verify` passed with 160 tests, lint, types, dependency
checks, library build, and production Docs build. Docs `pnpm check` and all 226
tests passed; its earlier complete verification and component-only consumer
review were extended with the newly observed image-wrapper correction. Independent
review fixes cover component boundaries, variant races, hot kit changes, numeric
drafts, keyboard history, and image-provider refresh.

Real browser checks passed at desktop and 390×844: direct title editing and
callout switching, three-position drag and keyboard resize, slash table insertion,
row/column menus, inline image controls, and reload persistence. The production
specimen containing a callout, paired columns, table, named code block, image,
aside, and excerpt produced byte-identical canonical Markdown after Copy → new
page → Paste → Copy. The reader image's zero-width wrapper was fixed in Docs.

Docs revision `d6a6910` supplies ten authored component tags and component-only
styles. This is the certified simple-component surface; complex grouped Docs
components (such as tabs, quizzes, and timelines) still need their own editing
contracts. The existing authenticated CMS save/reload gate remains unverified.
This pass does not publish packages, deploy applications, or change host storage.
