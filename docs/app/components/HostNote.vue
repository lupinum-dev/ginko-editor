<template>
  <aside class="host-note">
    <strong>Isolated kit</strong><slot />
  </aside>
</template>

<style scoped>
.host-note { border: 1px dashed var(--border); border-radius: var(--radius); background: var(--muted); padding: .8rem 1rem; }
.host-note strong { display: block; margin-bottom: .25rem; }
</style>
