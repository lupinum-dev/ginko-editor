<script setup lang="ts">
defineProps<{
  assessed?: boolean
  title: string
}>()
</script>

<template>
  <section
    class="learning-objective"
    :data-assessed="assessed ? 'true' : undefined"
  >
    <p class="learning-objective__eyebrow">
      Learning objective
    </p>
    <h3>{{ title }}</h3>
    <div class="learning-objective__body">
      <slot />
    </div>
    <aside class="learning-objective__tip">
      <strong>Teaching tip</strong><slot name="tip" />
    </aside>
  </section>
</template>

<style scoped>
.learning-objective { border: 1px solid var(--border); border-left: 4px solid var(--primary); border-radius: var(--radius); background: var(--card); padding: 1rem 1.1rem; }
.learning-objective[data-assessed='true'] { border-left-color: var(--success); }
.learning-objective__eyebrow { margin: 0 0 .25rem; color: var(--muted-foreground); font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.learning-objective h3 { margin: 0; font-size: 1rem; }
.learning-objective__body { margin-top: .6rem; }
.learning-objective__tip { margin-top: .8rem; border-top: 1px solid var(--border); padding-top: .7rem; color: var(--muted-foreground); font-size: .875rem; }
.learning-objective__tip strong { display: block; margin-bottom: .2rem; color: var(--foreground); }
</style>
