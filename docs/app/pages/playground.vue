<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { useHead } from '#imports'
import {
  GinkoEditor,
  GinkoImagePicker,
  type GinkoEditorHandle,
} from '@lupinum/ginko-editor'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import {
  isolatedAuthoringKit,
  playgroundAuthoringKit,
} from '../playground/contracts'
import {
  createPlaygroundAssets,
  playgroundImageSource,
} from '../playground/assets'
import PlaygroundPreview from '../components/PlaygroundPreview.vue'
import { useLocalDraft } from '../composables/useLocalDraft'
import { usePlaygroundImagePicker } from '../composables/usePlaygroundImagePicker'

defineOptions({ name: 'EditorPlaygroundPage' })

useHead({ title: 'Writing playground · Ginko Editor' })

const welcomeDocument =
  '# A little structure. A lot of possibility.\n\n' +
  'Good documents make room for the important things. ' +
  'Start with a thought, give it a shape, and make it your own.\n\n' +
  '<info title="Make yourself at home" appearance="tint">\n' +
  'Everything on this page is editable. ' +
  'Type **/** on a new line to add a block, or select some text to format it.\n' +
  '</info>\n\n' +
  '## From an idea to a clear page\n\n' +
  '- Write naturally, with Markdown shortcuts.\n' +
  '- Add tabs, steps, a callout, columns, or a learning objective.\n' +
  '- See the actual components in the live preview.\n\n' +
  '> The best tool gets out of the way of your next thought.\n\n' +
  '## Try a layout block\n\n' +
  '::tabs\n' +
  ':::tab{label="Write"}\n' +
  'Select a tab to edit its content. Select **+** to add a tab.\n' +
  ':::\n\n' +
  ':::tab{label="Review"}\n' +
  'Double-click a tab name to rename it.\n' +
  ':::\n' +
  '::\n'

const editor = ref<GinkoEditorHandle>()
const workspace = ref<globalThis.HTMLElement>()
const view = ref<'write' | 'split' | 'preview'>('split')
const showLibrary = ref(false)
const showChecks = ref(false)
const pending = ref(false)
const previousDocument = ref<string | null>(null)
const isolatedSource = ref(isolatedAuthoringKit.recipes[0]?.source ?? '')

const assets = createPlaygroundAssets()

provide(playgroundImageSource, assets.resolve)

const {
  source,
  ready,
  draftStatus,
  save: saveDraft,
  restore: restoreDraft,
} = useLocalDraft({
  key: 'ginko-editor:docs-playground:draft:v1',
  initialValue: welcomeDocument,
  isBlocked: () => pending.value,
})

const {
  imagePicker,
  imageLibraryOpen,
  imageQuery,
  imageChoices,
  finishImageChoice,
} = usePlaygroundImagePicker(assets.images)

const examples = computed(() => playgroundAuthoringKit.recipes)

const wordCount = computed(() =>
  source.value.trim().split(/\s+/).filter(Boolean).length,
)

async function flushEditor() {
  const result = await editor.value?.flush()

  if (result && !result.ok) {
    draftStatus.value = result.error.message
    return false
  }

  return true
}

async function replaceDocument(value: string) {
  if (!await flushEditor()) {
    return false
  }

  previousDocument.value = source.value
  source.value = value
  view.value = 'split'
  showLibrary.value = false

  return true
}

async function undoReplacement() {
  if (previousDocument.value === null) {
    return
  }

  const previous = previousDocument.value

  if (await replaceDocument(previous)) {
    previousDocument.value = null
  }
}

async function setView(value: typeof view.value) {
  if (value === 'preview' && !await flushEditor()) {
    return
  }

  view.value = value
}

function handlePendingChange(value: boolean) {
  pending.value = value

  if (value && view.value === 'preview') {
    view.value = 'split'
  }
}

function protectPendingChanges(event: InstanceType<typeof globalThis.BeforeUnloadEvent>) {
  if (pending.value) {
    event.preventDefault()
    event.returnValue = ''
  }
  else {
    saveDraft()
  }
}

onMounted(async () => {
  try {
    await assets.load()
  }
  catch {
    draftStatus.value = 'Browser image storage is unavailable'
  }

  restoreDraft()
})

onMounted(() => {
  globalThis.addEventListener('beforeunload', protectPendingChanges)
})

onBeforeRouteLeave(async () => {
  if (!await flushEditor()) {
    return false
  }

  saveDraft()
})

onBeforeUnmount(() => {
  assets.dispose()
  globalThis.removeEventListener('beforeunload', protectPendingChanges)
})
</script>

<template>
  <div
    ref="workspace"
    class="writing-workspace"
  >
    <header class="workspace-heading">
      <div class="workspace-breadcrumb">
        <img
          class="workspace-mark"
          src="/icon.svg"
          alt=""
        >
        <span>Ginko Editor</span>
        <span aria-hidden="true">/</span>
        <strong>Playground</strong>
      </div>
      <div class="workspace-actions">
        <button
          type="button"
          :aria-expanded="showLibrary"
          @click="showLibrary = !showLibrary"
        >
          <span aria-hidden="true">▦</span>
          Block library
        </button>
        <button
          type="button"
          @click="replaceDocument('')"
        >
          <span aria-hidden="true">+</span>
          New page
        </button>
      </div>
    </header>

    <div class="workspace-subheading">
      <div>
        <h1>A space to think, write, and build.</h1>
        <p>Your content. Real components. One uninterrupted writing flow.</p>
      </div>
      <div
        class="workspace-views"
        role="group"
        aria-label="Workspace view"
      >
        <button
          v-for="mode in (['write', 'split', 'preview'] as const)"
          :key="mode"
          type="button"
          :aria-pressed="view === mode"
          @click="setView(mode)"
        >
          {{ { write: 'Write', split: 'Split view', preview: 'Preview' }[mode] }}
        </button>
      </div>
    </div>

    <section
      v-if="showLibrary"
      class="block-library"
      aria-label="Block library"
    >
      <div class="library-heading">
        <div>
          <h2>A good starting point.</h2>
          <p>These are the actual components your readers will see.</p>
        </div>
        <button
          type="button"
          aria-label="Close block library"
          @click="showLibrary = false"
        >
          ×
        </button>
      </div>
      <div class="library-grid">
        <article
          v-for="recipe in examples"
          :key="recipe.id"
          class="library-card"
        >
          <div class="library-card-preview">
            <PlaygroundPreview
              :source="recipe.source"
              :kit="playgroundAuthoringKit"
              compact
            />
          </div>
          <div class="library-card-footer">
            <strong>{{ recipe.label }}</strong>
            <button
              type="button"
              @click="replaceDocument(recipe.source)"
            >
              Try example
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="previousDocument !== null"
      class="document-notice"
      role="status"
    >
      <span>Page changed. Your previous document is still available.</span>
      <button
        type="button"
        @click="undoReplacement"
      >
        Undo
      </button>
    </div>

    <div
      class="document-workspace"
      :data-view="view"
    >
      <section
        v-show="view !== 'preview'"
        class="document-panel document-panel--editor"
        aria-label="Writing canvas"
      >
        <div class="panel-heading">
          <span>
            <span class="panel-dot" />
            Writing canvas
          </span>
          <span class="panel-hint">Type / to add a block</span>
        </div>
        <GinkoEditor
          v-if="ready"
          ref="editor"
          v-model="source"
          :authoring-kit="playgroundAuthoringKit"
          :asset-provider="assets.provider"
          :image-upload="assets.upload"
          :image-picker="imagePicker"
          :image-drop-target="workspace"
          :enable-files="false"
          :enable-video="false"
          image-output="markdown"
          aria-label="Main playground editor"
          placeholder="Write something, or type / for blocks…"
          @pending-change="handlePendingChange"
        >
          <template #recipe-preview="{ recipe }">
            <PlaygroundPreview
              :source="recipe.source"
              :kit="playgroundAuthoringKit"
              compact
            />
          </template>
        </GinkoEditor>
      </section>
      <section
        v-show="view !== 'write'"
        class="document-panel document-panel--preview"
        aria-label="Rendered page preview"
      >
        <div class="panel-heading">
          <span>
            <span class="panel-dot panel-dot--live" />
            Live preview
          </span>
          <span class="panel-hint">What your readers see</span>
        </div>
        <div class="reader-page">
          <PlaygroundPreview
            :source="source"
            :kit="playgroundAuthoringKit"
          />
        </div>
      </section>
    </div>

    <GinkoImagePicker
      :open="imageLibraryOpen"
      :images="imageChoices"
      :query="imageQuery"
      @update:query="imageQuery = $event"
      @select="finishImageChoice?.($event)"
      @update:open="!$event && finishImageChoice?.(null)"
    />
    <footer class="workspace-footer">
      <span role="status">
        <span class="save-dot" />
        {{ pending ? 'Updating document…' : draftStatus }}
      </span>
      <span>
        {{ wordCount }} source words
        <span aria-hidden="true">·</span>
        Markdown + components
      </span>
    </footer>
    <div class="workspace-help">
      <span>
        <kbd>/</kbd>
        insert blocks
        <span aria-hidden="true">·</span>
        <kbd>Ctrl/⌘</kbd>
        <kbd>Z</kbd>
        undo
        <span aria-hidden="true">·</span>
        Use the cog to change a block
      </span>
      <button
        type="button"
        @click="replaceDocument(welcomeDocument)"
      >
        Load welcome page
      </button>
    </div>

    <section class="integration-checks">
      <button
        type="button"
        :aria-expanded="showChecks"
        @click="showChecks = !showChecks"
      >
        Integration checks
        <span aria-hidden="true">{{ showChecks ? '−' : '+' }}</span>
      </button>
      <div
        v-show="showChecks"
        class="checks-content"
      >
        <h2>An independent authoring kit</h2>
        <p>This second editor accepts only its own host note. Registrations stay local to each editor.</p>
        <GinkoEditor
          v-model="isolatedSource"
          :authoring-kit="isolatedAuthoringKit"
          :enable-images="false"
          :enable-files="false"
          :enable-video="false"
          aria-label="Isolated kit editor"
        />
        <PlaygroundPreview
          :source="isolatedSource"
          :kit="isolatedAuthoringKit"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.writing-workspace {
  max-width: 1500px;
  margin-inline: auto;
  padding: 0 clamp(1rem, 3vw, 3rem) 3rem;
  color: var(--foreground);
}

.writing-workspace button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 36px;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  background: transparent;
  padding: 0.4rem 0.7rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.writing-workspace button:hover {
  background: var(--muted);
}

.writing-workspace button:focus-visible {
  outline-offset: 3px;
}

.workspace-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border);
}

.workspace-breadcrumb,
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.8rem;
}

.workspace-breadcrumb {
  color: var(--muted-foreground);
}

.workspace-breadcrumb strong {
  color: var(--foreground);
  font-weight: 500;
}

.workspace-mark {
  width: 29px;
  height: 29px;
  border-radius: 0.5rem;
}

.workspace-actions button:last-child {
  border-color: var(--border);
}

.workspace-subheading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding: 2rem 0 1.5rem;
}

.workspace-subheading h1 {
  font-size: clamp(1.3rem, 2.4vw, 1.8rem);
  letter-spacing: -0.035em;
  font-weight: 600;
  margin: 0 0 0.4rem;
  line-height: 1.25;
}

.workspace-subheading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.85rem;
}

.workspace-views {
  display: flex;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--muted);
  flex-shrink: 0;
}

.workspace-views button {
  min-height: 30px;
  white-space: nowrap;
}

.workspace-views button[aria-pressed='true'] {
  background: var(--card);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
}

.document-workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--border);
  border-radius: 0.7rem;
  background: var(--card);
}

.document-workspace[data-view='write'],
.document-workspace[data-view='preview'] {
  grid-template-columns: 1fr;
}

.document-panel {
  min-width: 0;
}

.document-panel--preview {
  border-left: 1px solid var(--border);
  background: color-mix(in srgb, var(--card) 97%, var(--foreground));
  border-radius: 0 0.7rem 0.7rem 0;
}

[data-view='preview'] .document-panel--preview {
  border-left: 0;
  border-radius: 0.7rem;
}

.panel-heading {
  height: 43px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--border);
  padding-inline: 1rem;
  font-size: 0.72rem;
  color: var(--muted-foreground);
}

.panel-heading > span:first-child {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 550;
  color: var(--foreground);
}

.panel-dot,
.save-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--muted-foreground);
}

.panel-dot--live,
.save-dot {
  background: #6b9872;
}

.reader-page {
  max-width: 48rem;
  min-height: 660px;
  margin-inline: auto;
  padding: clamp(1.5rem, 3.5vw, 3rem);
}

.document-panel :deep(.ginko-editor) {
  border: 0;
  border-radius: 0 0 0.7rem 0.7rem;
}

.document-panel :deep(.ginko-editor__header) {
  padding: 0.35rem 0.6rem;
  border-bottom: 0;
}

.document-panel :deep(.ginko-editor__status) {
  display: none;
}

.document-panel :deep(.ginko-editor__header) {
  grid-template-columns: 1fr auto;
}

.document-panel :deep(.ginko-editor__modes button) {
  font-size: 0.73rem;
  min-height: 30px;
}

.document-panel :deep(.ginko-editor__insert-trigger) {
  font-size: 0.78rem;
}

.document-panel :deep(.ginko-editor__toolbar) {
  padding-block: 0.2rem;
}

.document-panel :deep(.ginko-editor__surface) {
  padding: clamp(1.5rem, 3.5vw, 3rem);
}

.document-panel :deep(.ProseMirror) {
  min-height: 510px;
  font-size: 15px;
  line-height: 1.75;
}

.document-panel :deep(.ginko-editor__source) {
  min-height: 660px;
  padding: 2rem;
  line-height: 1.9;
}

.document-panel :deep(.ProseMirror div[data-type='element'] p) {
  margin: 0.35rem 0;
}

.workspace-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0.2rem;
  color: var(--muted-foreground);
  font-size: 0.7rem;
}

.workspace-footer > span:first-child {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.workspace-help {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--muted-foreground);
  font-size: 0.72rem;
}

.workspace-help kbd {
  display: inline-block;
  min-width: 17px;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  padding: 0.05rem 0.2rem;
  margin-inline: 0.1rem;
  text-align: center;
  font: inherit;
}

.block-library {
  border: 1px solid var(--border);
  border-radius: 0.7rem;
  padding: 1.2rem;
  margin-bottom: 1.5rem;
  background: var(--card);
}

.library-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.library-heading h2 {
  margin: 0 0 0.3rem;
  font-size: 1rem;
}

.library-heading p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted-foreground);
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.library-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  min-width: 0;
}

.library-card-preview {
  padding: 1rem;
  flex: 1;
  min-height: 160px;
}

.library-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-top: 1px solid var(--border);
  padding: 0.5rem 0.6rem 0.5rem 0.9rem;
  font-size: 0.8rem;
}

.library-card-footer strong {
  font-weight: 550;
}

.document-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  font-size: 0.8rem;
}

.document-notice button {
  text-decoration: underline;
}

.integration-checks {
  border-top: 1px solid var(--border);
  margin-top: 2rem;
}

.integration-checks > button {
  width: 100%;
  justify-content: space-between;
  color: var(--muted-foreground);
  padding: 1rem 0;
}

.checks-content {
  max-width: 50rem;
  padding-block: 1rem;
}

.checks-content h2 {
  font-size: 1.1rem;
}

.checks-content > p {
  font-size: 0.85rem;
  margin-bottom: 1rem;
  color: var(--muted-foreground);
}

@media (max-width: 850px) {
  .workspace-subheading {
    align-items: start;
    flex-direction: column;
  }

  .document-workspace {
    grid-template-columns: 1fr;
  }

  .document-panel--preview {
    border-left: 0;
    border-top: 1px solid var(--border);
  }

  .reader-page {
    min-height: 320px;
  }

  .library-grid {
    grid-template-columns: 1fr;
  }

  .library-card-preview {
    min-height: 100px;
  }

  .workspace-help {
    align-items: start;
    flex-direction: column;
    gap: 0.4rem;
  }
}

@media (max-width: 500px) {
  .workspace-heading {
    align-items: start;
    flex-direction: column;
    gap: 0.7rem;
  }

  .workspace-actions {
    width: 100%;
    justify-content: space-between;
  }

  .panel-hint {
    display: none;
  }

  .workspace-footer {
    flex-direction: column;
    gap: 0.4rem;
  }

  .writing-workspace button {
    min-height: 40px;
  }

  .document-panel :deep(.ginko-editor__surface) {
    padding: 1.2rem;
  }
}
</style>
