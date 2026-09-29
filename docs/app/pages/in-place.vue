<script setup lang="ts">
import { useHead } from '#imports'
import { GinkoEditor, germanMessages, type EditorProfileName } from '@lupinum/ginko-editor'
import { computed, ref } from 'vue'

defineOptions({ name: 'InPlaceEditingPage' })

useHead({ title: 'In-place editing · Ginko Editor' })

const german = ref(false)
const messages = computed(() => (german.value ? germanMessages : undefined))

interface Field {
  key: string
  label: string
  profile: EditorProfileName
  source: string
}

const fields = ref<Field[]>([
  { key: 'title', label: 'Headline · plain', profile: 'plain', source: 'Fresh pasta, every morning' },
  {
    key: 'lead',
    label: 'Lead · inline',
    profile: 'inline',
    source: 'Made by hand in our kitchen since 1998. **Open Tuesday to Sunday**, see [the menu](https://example.com/menu).',
  },
  {
    key: 'body',
    label: 'Story · article',
    profile: 'article',
    source:
      '## This week\n\n'
      + 'The first wild garlic is here. We fold it into ravioli with ricotta and lemon.\n\n'
      + '- Ravioli with wild garlic\n- Tagliatelle with ragù\n\n'
      + '> Select text to format it. Type / at the start of a line for blocks.',
  },
])
const byKey = (key: string) => fields.value.find(field => field.key === key)!
</script>

<template>
  <main class="in-place">
    <header class="in-place__intro">
      <p class="in-place__eyebrow">
        Inline variant
      </p>
      <h1>Edit the page, not a form.</h1>
      <p>
        Each text below is a separate <code>GinkoEditor</code> with <code>variant="inline"</code>.
        It uses the page's own typography. The profile decides what a writer can create: try to
        paste a table into the lead, or type <code>## </code> in the headline.
      </p>
      <label class="in-place__toggle">
        <input
          v-model="german"
          type="checkbox"
        >
        German interface text
      </label>
    </header>

    <article class="site-card">
      <p class="site-card__kicker">
        Trattoria Ginko · Vienna
      </p>
      <GinkoEditor
        v-model="byKey('title').source"
        class="site-card__title"
        variant="inline"
        profile="plain"
        :messages="messages"
        aria-label="Headline"
      />
      <GinkoEditor
        v-model="byKey('lead').source"
        class="site-card__lead"
        variant="inline"
        profile="inline"
        :messages="messages"
        aria-label="Lead"
      />
      <GinkoEditor
        v-model="byKey('body').source"
        class="site-card__body"
        variant="inline"
        profile="article"
        :enable-images="false"
        :messages="messages"
        aria-label="Story"
      />
    </article>

    <section
      class="in-place__sources"
      aria-label="Stored Markdown"
    >
      <div
        v-for="field in fields"
        :key="field.key"
      >
        <h2>{{ field.label }}</h2>
        <pre>{{ field.source }}</pre>
      </div>
    </section>
  </main>
</template>

<style scoped>
.in-place {
  display: grid;
  gap: 2.5rem;
  max-width: 64rem;
  margin-inline: auto;
  padding: 2rem clamp(1rem, 4vw, 3rem) 4rem;
  color: var(--foreground);
}

.in-place__intro {
  display: grid;
  gap: .75rem;
  max-width: 42rem;
}

.in-place__intro h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  letter-spacing: -.03em;
  line-height: 1.1;
}

.in-place__intro p {
  margin: 0;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.in-place__eyebrow {
  font-size: .75rem;
  font-weight: 650;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.in-place__toggle {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  min-height: 44px;
  font-size: .9rem;
}

.site-card {
  display: grid;
  gap: 1.25rem;
  border-radius: 1.5rem;
  padding: clamp(1.5rem, 6vw, 4rem);
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(244 196 124 / .35), transparent 60%),
    #fbf7f0;
  color: #2b2118;
  font-family: Georgia, 'Times New Roman', serif;
  box-shadow: 0 30px 60px -30px rgb(60 40 20 / .35);
  --ring: #b0703a;
}

.site-card__kicker {
  margin: 0;
  font: 600 .75rem/1.4 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #8a5a32;
}

.site-card__title {
  font-size: clamp(2.2rem, 6vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -.02em;
}

.site-card__title :deep(p) {
  margin: 0;
}

.site-card__lead {
  max-width: 36rem;
  font-size: 1.25rem;
  line-height: 1.55;
  color: #5b4636;
}

.site-card__lead :deep(p) {
  margin: 0;
}

.site-card__lead :deep(a) {
  color: #8a4b1c;
  text-underline-offset: 3px;
}

.site-card__body {
  max-width: 38rem;
  font-size: 1.05rem;
  line-height: 1.7;
}

.site-card__body :deep(h2) {
  margin: 1.5rem 0 .5rem;
  font-family: inherit;
  font-size: 1.5rem;
}

.site-card__body :deep(p),
.site-card__body :deep(ul),
.site-card__body :deep(blockquote) {
  margin: 0 0 .9rem;
}

.site-card__body :deep(ul) {
  padding-inline-start: 1.25rem;
  list-style: disc;
}

.site-card__body :deep(blockquote) {
  border-inline-start: 3px solid #d7a574;
  padding-inline-start: 1rem;
  color: #6b5442;
  font-style: italic;
}

.in-place__sources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}

.in-place__sources h2 {
  margin: 0 0 .4rem;
  font-size: .8rem;
  color: var(--muted-foreground);
}

.in-place__sources pre {
  margin: 0;
  min-height: 4rem;
  border: 1px solid var(--border);
  border-radius: .75rem;
  padding: .75rem;
  font-size: .78rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
