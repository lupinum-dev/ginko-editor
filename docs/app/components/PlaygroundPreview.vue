<script setup lang="ts">
import ContentBodyRenderer from '@lupinum/ginko-content/body-renderer'
import { parseMdcBody, validatePublicMarkdownAst, type ParseMdcBodyResult } from '@lupinum/ginko-content/cms-contract'
import type { AuthoringKitV1 } from '@lupinum/ginko-editor/authoring'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import LearningObjective from './LearningObjective.vue'
import HostNote from './HostNote.vue'

const props = defineProps<{ source: string; kit: AuthoringKitV1; compact?: boolean }>()
const body = shallowRef<ParseMdcBodyResult['body'] | null>(null)
const error = ref('')
const parsing = ref(false)
const renderKey = ref(0)
const components = computed(() => ({ ...Object.fromEntries(Object.entries(props.kit.implementation).map(([tag, implementation]) => [tag, implementation.componentName])), 'learning-objective': LearningObjective, 'host-note': HostNote }))
let revision = 0
let timer: ReturnType<typeof globalThis.setTimeout>
watch(() => [props.source, props.kit] as const, ([source, kit]) => {
  const current = ++revision
  globalThis.clearTimeout(timer)
  parsing.value = true
  timer = globalThis.setTimeout(async () => {
    try {
      const parsed = await parseMdcBody(source, { autoClose: false })
      const result = validatePublicMarkdownAst(parsed.body, kit.policy)
      if (!result.ok) throw new Error('This source contains a block or property that the document does not support.')
      if (current !== revision) return
      body.value = result.value
      error.value = ''
      renderKey.value++
    } catch (cause) {
      if (current !== revision) return
      error.value = cause instanceof Error ? cause.message : 'Unable to render this source.'
    } finally {
      if (current === revision) parsing.value = false
    }
  }, 120)
}, { immediate: true })
onBeforeUnmount(() => { revision++; globalThis.clearTimeout(timer) })
</script>

<template>
  <div
    class="document-preview content-prose"
    :class="{ 'document-preview--compact': compact }"
    :aria-busy="parsing"
  >
    <p
      v-if="error"
      class="preview-error"
      role="alert"
    >
      Preview paused. {{ error }} Your source is safe.
    </p>
    <NuxtErrorBoundary
      v-if="body"
      :key="renderKey"
      @error="error = 'This component could not be rendered.'"
    >
      <ContentBodyRenderer
        :body="body"
        :policy="kit.policy"
        :components="components"
        :prose="true"
      />
    </NuxtErrorBoundary>
    <div
      v-if="!source.trim() && !compact"
      class="preview-empty"
    >
      <span aria-hidden="true">Aa</span>
      <h3>Your words, ready for readers.</h3>
      <p>Start writing or add a block. The real page will appear here as you work.</p>
    </div>
  </div>
</template>

<style scoped>
.document-preview { font-size: 15px; line-height: 1.75; overflow-wrap: anywhere; }
.document-preview :deep(h1) { font-size: 2rem; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 1.2rem; }
.document-preview :deep(h2) { font-size: 1.45rem; line-height: 1.3; margin-top: 1.8rem; }
.document-preview :deep(h3) { font-size: 1.15rem; }
.document-preview :deep(p) { margin: .75rem 0; }
.document-preview :deep(ul) { list-style: disc; padding-inline-start: 1.4rem; }
.document-preview :deep(ol) { list-style: decimal; padding-inline-start: 1.4rem; }
.document-preview :deep(blockquote:not(.content-excerpt-body)) { border-inline-start: 3px solid var(--foreground); padding-inline-start: 1rem; }
.document-preview :deep(pre) { overflow-x: auto; padding: 1rem; border-radius: .5rem; background: var(--muted); }
.document-preview :deep(table) { width: 100%; border-collapse: collapse; }
.document-preview :deep(td), .document-preview :deep(th) { border: 1px solid var(--border); padding: .5rem; text-align: start; }
.document-preview--compact { font-size: 12px; line-height: 1.5; }
.document-preview--compact :deep(h1), .document-preview--compact :deep(h2) { font-size: 1.1rem; margin: .3rem 0; }
.document-preview--compact :deep(p) { margin: .25rem 0; }
.preview-error { border: 1px solid var(--border); border-radius: .5rem; padding: .75rem; font-size: .8rem; color: var(--destructive); }
.preview-empty { max-width: 19rem; margin: 6rem auto; text-align: center; color: var(--muted-foreground); }
.preview-empty > span { display: inline-grid; place-items: center; width: 3rem; height: 3rem; border: 1px solid var(--border); border-radius: .7rem; font: 1.2rem Georgia, serif; }
.preview-empty h3 { color: var(--foreground); font-size: 1rem; margin: 1rem 0 .4rem; }
.preview-empty p { font-size: .85rem; }
</style>
