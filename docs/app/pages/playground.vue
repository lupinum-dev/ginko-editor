<script setup lang="ts">
defineOptions({ name: 'EditorPlaygroundPage' })

import ContentBodyRenderer from '@lupinum/ginko-content/body-renderer'
import {
  parseMdcBody,
  validatePublicMarkdownAst,
  type ParseMdcBodyResult,
} from '@lupinum/ginko-content/cms-contract'
import { GinkoEditor, type EditorFlushResult } from '@lupinum/ginko-editor'
import type { AuthoringKitV1 } from '@lupinum/ginko-editor/authoring'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import HostNote from '../components/HostNote.vue'
import LearningObjective from '../components/LearningObjective.vue'
import { isolatedAuthoringKit, playgroundAuthoringKit } from '../playground/contracts'

const incompleteSource = '# Recovery stays safe\n\n<learning-objective title="Incomplete">\nThis tag is intentionally left open.\n'
const localDraftKey = 'ginko-editor:docs-playground:draft:v1'
const source = ref('')
const isolatedSource = ref(isolatedAuthoringKit.recipes[0]?.source ?? '')
const editor = ref<{ flush: () => Promise<EditorFlushResult> }>()
const recoverySource = ref('')
const localDraftAvailable = ref(false)
const localDraftStatus = ref('This browser only. Nothing is uploaded.')

onMounted(() => {
  localDraftAvailable.value = globalThis.localStorage.getItem(localDraftKey) !== null
})

async function saveLocalDraft() {
  const result = await editor.value?.flush()
  if (result && !result.ok) {
    localDraftStatus.value = 'Fix the source warning before saving.'
    return
  }
  globalThis.localStorage.setItem(localDraftKey, source.value)
  localDraftAvailable.value = true
  localDraftStatus.value = 'Saved in this browser.'
}

function reopenLocalDraft() {
  const draft = globalThis.localStorage.getItem(localDraftKey)
  if (draft === null) {
    localDraftStatus.value = 'No local demo draft is saved yet.'
    return
  }
  source.value = draft
  localDraftStatus.value = 'Reopened the local demo draft.'
}

function clearDocument() {
  source.value = ''
  localDraftStatus.value = 'Started a new empty document.'
}

function loadIncompleteSource() {
  recoverySource.value = source.value
  source.value = incompleteSource
}

function recoverSource() {
  source.value = recoverySource.value
}

function useCanonicalPreview(markdown: Readonly<{ value: string }>, kit: AuthoringKitV1) {
  const body = shallowRef<ParseMdcBodyResult['body'] | null>(null)
  const error = ref<string | null>(null)
  const state = ref<'current' | 'parsing' | 'stale'>('parsing')
  let revision = 0
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined

  watch(() => markdown.value, (value) => {
    revision += 1
    const currentRevision = revision
    if (timer) globalThis.clearTimeout(timer)
    state.value = 'parsing'
    timer = globalThis.setTimeout(async () => {
      try {
        const parsed = await parseMdcBody(value, { autoClose: false })
        const validation = validatePublicMarkdownAst(parsed.body, kit.policy)
        if (!validation.ok) {
          const issue = validation.issues[0]
          throw new Error(`Source is outside policy (${issue?.code} at ${issue?.path.join('.')}).`)
        }
        if (currentRevision !== revision) return
        body.value = validation.value
        error.value = null
        state.value = 'current'
      } catch (cause) {
        if (currentRevision !== revision) return
        error.value = cause instanceof Error ? cause.message : 'The source could not be parsed.'
        state.value = 'stale'
      }
    }, 120)
  }, { immediate: true })

  onBeforeUnmount(() => {
    revision += 1
    if (timer) globalThis.clearTimeout(timer)
  })
  return { body, error, state }
}

const { body: previewBody, error: previewError, state: previewState } = useCanonicalPreview(source, playgroundAuthoringKit)
const { body: isolatedPreviewBody, error: isolatedPreviewError, state: isolatedPreviewState } = useCanonicalPreview(isolatedSource, isolatedAuthoringKit)
const previewComponents = {
  column: 'MdcColumn',
  info: 'MdcInfo',
  layout: 'MdcLayout',
  'learning-objective': LearningObjective,
}
const isolatedPreviewComponents = { 'host-note': HostNote }
const previewRenderError = ref<string | null>(null)
const isolatedRenderError = ref<string | null>(null)
const previewRenderKey = ref(0)
const isolatedRenderKey = ref(0)

watch(previewBody, () => {
  previewRenderError.value = null
  previewRenderKey.value += 1
})
watch(isolatedPreviewBody, () => {
  isolatedRenderError.value = null
  isolatedRenderKey.value += 1
})

const previewDisplayState = computed(() => previewRenderError.value ? 'stale' : previewState.value)
const isolatedDisplayState = computed(() => isolatedRenderError.value ? 'stale' : isolatedPreviewState.value)
const previewDisplayError = computed(() => previewRenderError.value ?? previewError.value)
const isolatedDisplayError = computed(() => isolatedRenderError.value ?? isolatedPreviewError.value)

function renderErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The rendered preview failed.'
}
</script>

<template>
  <main class="playground-page">
    <header class="playground-intro">
      <p class="playground-kicker">
        Live package playground
      </p>
      <h1>Shape the content. See the real page.</h1>
      <p>Start empty, add structured blocks, and inspect the canonical Markdown whenever you need it. The preview uses the built Ginko packages and real Docs components.</p>
    </header>

    <section
      aria-labelledby="main-playground-title"
      class="playground-section"
    >
      <div class="playground-section__header">
        <div>
          <h2 id="main-playground-title">
            A complete authoring journey
          </h2>
          <p>In the empty editor, type <kbd>/note</kbd> and press <kbd>Enter</kbd>. Use <strong>+ Insert</strong> for touch or pointer input.</p>
        </div>
        <button
          class="playground-new"
          type="button"
          @click="clearDocument"
        >
          New empty document
        </button>
      </div>

      <div class="playground-grid">
        <div class="playground-panel">
          <div class="playground-panel__label">
            <span>Canonical authoring surface</span><span>In memory</span>
          </div>
          <GinkoEditor
            ref="editor"
            v-model="source"
            :authoring-kit="playgroundAuthoringKit"
            aria-label="Main playground editor"
            placeholder="Start writing, or type / for blocks…"
          />
          <section
            class="playground-local"
            aria-labelledby="local-draft-title"
          >
            <div>
              <h3 id="local-draft-title">
                Local demo draft
              </h3>
              <p role="status">
                {{ localDraftStatus }}
              </p>
            </div>
            <div class="playground-local__actions">
              <button
                type="button"
                @click="saveLocalDraft"
              >
                Save locally
              </button>
              <button
                type="button"
                :disabled="!localDraftAvailable"
                @click="reopenLocalDraft"
              >
                Reopen
              </button>
              <button
                type="button"
                @click="loadIncompleteSource"
              >
                Try incomplete source
              </button>
              <button
                v-if="previewDisplayState === 'stale' && recoverySource !== source"
                type="button"
                @click="recoverSource"
              >
                Recover last valid source
              </button>
            </div>
          </section>
        </div>

        <div class="playground-panel playground-panel--preview">
          <div class="playground-panel__label">
            <span>Real Docs preview</span>
            <span
              role="status"
              :data-state="previewDisplayState"
            >{{ previewDisplayState }}</span>
          </div>
          <div
            v-if="previewDisplayError"
            class="playground-error"
            role="alert"
          >
            Preview is stale. {{ previewDisplayError }} Your source is unchanged.
          </div>
          <div
            class="playground-preview content-prose"
            :aria-busy="previewDisplayState === 'parsing'"
          >
            <NuxtErrorBoundary
              v-if="previewBody"
              :key="previewRenderKey"
              @error="previewRenderError = renderErrorMessage($event)"
            >
              <ContentBodyRenderer
                :body="previewBody"
                :policy="playgroundAuthoringKit.policy"
                :components="previewComponents"
                :prose="true"
              />
            </NuxtErrorBoundary>
            <p
              v-else
              class="playground-empty"
            >
              Your rendered page will appear here.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section
      aria-labelledby="isolation-title"
      class="playground-section playground-section--quiet"
    >
      <div class="playground-section__header">
        <div>
          <p class="playground-kicker">
            Isolation check
          </p>
          <h2 id="isolation-title">
            A different editor, a different kit
          </h2>
          <p>This editor accepts only its local <code>host-note</code>. Main-editor registrations do not leak into it.</p>
        </div>
      </div>
      <div class="playground-grid playground-grid--quiet">
        <div class="playground-panel">
          <GinkoEditor
            v-model="isolatedSource"
            :authoring-kit="isolatedAuthoringKit"
            aria-label="Isolated kit editor"
          />
        </div>
        <div class="playground-panel">
          <div class="playground-panel__label">
            <span>Isolated preview</span>
            <span
              role="status"
              :data-state="isolatedDisplayState"
            >{{ isolatedDisplayState }}</span>
          </div>
          <div
            v-if="isolatedDisplayError"
            class="playground-error"
            role="alert"
          >
            Preview is stale. {{ isolatedDisplayError }} Your source is unchanged.
          </div>
          <div
            class="playground-preview content-prose"
            :aria-busy="isolatedDisplayState === 'parsing'"
          >
            <NuxtErrorBoundary
              v-if="isolatedPreviewBody"
              :key="isolatedRenderKey"
              @error="isolatedRenderError = renderErrorMessage($event)"
            >
              <ContentBodyRenderer
                :body="isolatedPreviewBody"
                :policy="isolatedAuthoringKit.policy"
                :components="isolatedPreviewComponents"
                :prose="true"
              />
            </NuxtErrorBoundary>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.playground-page { width: min(100% - 2rem, 92rem); margin: 0 auto; padding: clamp(1.75rem, 4vw, 3.25rem) 0; }
.playground-intro { max-width: 58rem; margin-bottom: clamp(1.75rem, 3vw, 2.5rem); }
.playground-intro h1 { max-width: 18ch; margin: .3rem 0 .7rem; font-size: clamp(2.15rem, 4vw, 3.5rem); line-height: 1; letter-spacing: -.045em; }
.playground-intro > p:last-child { max-width: 42rem; font-size: 1.05rem; line-height: 1.65; }
.playground-intro > p:last-child, .playground-section__header p { margin: 0; color: var(--muted-foreground); }
.playground-kicker { margin: 0; color: var(--primary); font-size: .72rem; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
.playground-section { border-top: 1px solid var(--border); padding: 1.75rem 0 4rem; }
.playground-section--quiet { padding-bottom: 0; }
.playground-section__header { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.25rem; }
.playground-section__header > div { max-width: 48rem; }
.playground-section__header h2 { margin: 0 0 .35rem; font-size: clamp(1.25rem, 2vw, 1.55rem); letter-spacing: -.02em; }
.playground-section__header kbd { border: 1px solid var(--border); border-bottom-width: 2px; border-radius: .3rem; background: var(--muted); padding: .05rem .3rem; color: var(--foreground); font: .82em/1.4 ui-monospace, monospace; }
.playground-new, .playground-local button { min-height: 2.5rem; border: 1px solid var(--border); border-radius: .5rem; background: var(--card); color: var(--foreground); padding: .45rem .75rem; font: 600 .82rem/1.2 inherit; cursor: pointer; }
.playground-new:hover, .playground-local button:hover { background: var(--muted); }
.playground-new:focus-visible, .playground-local button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.playground-local button:disabled { cursor: not-allowed; opacity: .5; }
.playground-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(22rem, .95fr); gap: clamp(1rem, 2vw, 1.5rem); align-items: start; }
.playground-panel { min-width: 0; }
.playground-panel--preview { position: sticky; top: 1rem; }
.playground-panel__label { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: .5rem; color: var(--muted-foreground); font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.playground-panel__label [data-state='current'] { color: var(--success); }
.playground-panel__label [data-state='stale'] { color: var(--destructive); }
.playground-preview { min-height: 30rem; border: 1px solid var(--border); border-radius: .85rem; background: var(--card); padding: clamp(1.15rem, 3vw, 2rem); }
.playground-empty { margin: 8rem auto 0; color: var(--muted-foreground); text-align: center; }
.playground-error { margin-bottom: .5rem; border: 1px solid color-mix(in oklab, var(--destructive) 35%, var(--border)); border-radius: .5rem; background: color-mix(in oklab, var(--destructive) 8%, var(--card)); padding: .65rem .75rem; color: var(--foreground); font-size: .82rem; }
.playground-local { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: .75rem; border: 1px solid var(--border); border-radius: .65rem; background: color-mix(in oklab, var(--card) 88%, var(--muted)); padding: .75rem; }
.playground-local h3, .playground-local p { margin: 0; }
.playground-local h3 { font-size: .82rem; }
.playground-local p { color: var(--muted-foreground); font-size: .72rem; }
.playground-local__actions { display: flex; flex-wrap: wrap; justify-content: end; gap: .4rem; }
.playground-section--quiet .ginko-editor, .playground-section--quiet .playground-preview { min-height: auto; }
.playground-grid--quiet { opacity: .88; }
:deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout']) { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: .75rem; }
:deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column']) { grid-column: span 6; }
:deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column'][props*='sm']) { grid-column: span 4; }
:deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column'][props*='lg']) { grid-column: span 8; }
@media (max-width: 800px) {
  .playground-section__header, .playground-local { align-items: stretch; flex-direction: column; }
  .playground-grid { grid-template-columns: 1fr; }
  .playground-panel--preview { position: static; }
  .playground-preview { min-height: 18rem; }
  .playground-local__actions { justify-content: start; }
  :deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column']),
  :deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column'][props*='sm']),
  :deep(.ginko-editor .ProseMirror div[data-type='element'][tag='layout'] > div[data-type='element'][tag='column'][props*='lg']) { grid-column: 1 / -1; }
}
</style>
