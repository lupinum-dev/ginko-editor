<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'

import type { AuthoringRecipe } from '../authoring'
import GinkoRecipeIcon from './GinkoRecipeIcon.vue'
import type { EditorText } from './messages'
import type { RecipeGroup, RecipeMatch } from './recipe-search'
import { isImageRecipe } from './writingRecipes'

defineOptions({ name: 'GinkoInsertMenu' })

const props = defineProps<{
  id: string
  to: InstanceType<typeof globalThis.HTMLElement> | string
  origin: 'button' | 'slash'
  groups: readonly RecipeGroup[]
  busy: boolean
  error: string | null
  position: { left: string; top: string; maxHeight: string }
  text: EditorText
}>()
const query = defineModel<string>('query', { required: true })
const activeIndex = defineModel<number>('activeIndex', { required: true })
const emit = defineEmits<{
  select: [recipe: AuthoringRecipe]
  keydown: [event: InstanceType<typeof globalThis.KeyboardEvent>]
}>()
defineSlots<{ 'recipe-preview'?: (props: { recipe: AuthoringRecipe }) => unknown }>()

const slots = useSlots()
const root = ref<InstanceType<typeof globalThis.HTMLElement>>()
const search = ref<InstanceType<typeof globalThis.HTMLInputElement>>()
/** Groups with the keyboard index of each option. */
const sections = computed(() => {
  let index = 0
  return props.groups.map((group, groupIndex) => ({
    ...group,
    headingId: `${props.id}-group-${groupIndex}`,
    options: group.matches.map(match => ({ match, index: index++ })),
  }))
})
const entries = computed(() => props.groups.flatMap(group => group.matches))
const activeRecipe = computed(() => entries.value[activeIndex.value]?.recipe)
const showsPreview = computed(() =>
  !!activeRecipe.value
  && !isImageRecipe(activeRecipe.value)
  && activeRecipe.value.id !== 'ginko.context.add-item'
  && !!slots['recipe-preview'],
)
let pointer: { x: number; y: number } | undefined

/** Hovering selects only after a real pointer movement, not when keyboard scrolling moves the list. */
function hover(event: InstanceType<typeof globalThis.MouseEvent>, index: number) {
  if (pointer && pointer.x === event.clientX && pointer.y === event.clientY) return
  pointer = { x: event.clientX, y: event.clientY }
  activeIndex.value = index
}

function parts(match: RecipeMatch) {
  const result: { text: string; matched: boolean }[] = []
  let at = 0
  for (const [start, end] of match.ranges) {
    if (start > at) result.push({ text: match.label.slice(at, start), matched: false })
    result.push({ text: match.label.slice(start, end), matched: true })
    at = end
  }
  if (at < match.label.length) result.push({ text: match.label.slice(at), matched: false })
  return result
}

function description(match: RecipeMatch) {
  return match.description
    || (match.recipe.keywords?.length
      ? `/${match.recipe.keywords[0]}`
      : props.text('insertRecipe', { label: match.label.toLocaleLowerCase() }))
}

defineExpose({ root, search })
</script>

<template>
  <Teleport :to="to">
    <div
      ref="root"
      class="ginko-editor__insert-menu"
      :class="{ 'ginko-editor__insert-menu--preview': showsPreview }"
      :style="position"
      @keydown="emit('keydown', $event)"
    >
      <label
        v-if="origin === 'button'"
        class="ginko-editor__insert-search"
      >
        <span aria-hidden="true">/</span>
        <span class="ginko-editor__sr-only">{{ text('searchBlocks') }}</span>
        <input
          ref="search"
          v-model="query"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="id"
          :aria-activedescendant="activeRecipe ? `${id}-${activeIndex}` : undefined"
          autocomplete="off"
          :placeholder="text('searchBlocks')"
        >
      </label>
      <div
        v-else
        class="ginko-editor__insert-query"
        aria-hidden="true"
      >
        <span>{{ text('availableBlocks') }}</span>
        <kbd>/{{ query }}</kbd>
      </div>
      <div
        :id="id"
        class="ginko-editor__insert-results"
        role="listbox"
        :aria-label="text('availableBlocks')"
      >
        <div
          v-for="section in sections"
          :key="section.key"
          class="ginko-editor__insert-group"
          role="group"
          :aria-labelledby="section.headingId"
        >
          <div
            :id="section.headingId"
            class="ginko-editor__insert-group-label"
            role="presentation"
          >
            {{ section.label }}
          </div>
          <button
            v-for="{ match, index } in section.options"
            :id="`${id}-${index}`"
            :key="`${section.key}-${index}-${match.recipe.id}`"
            tabindex="-1"
            type="button"
            role="option"
            :aria-selected="index === activeIndex"
            :disabled="busy"
            :data-recipe="match.recipe.id"
            @mousedown.prevent
            @mousemove="hover($event, index)"
            @click="emit('select', match.recipe)"
          >
            <span
              class="ginko-editor__recipe-symbol"
              aria-hidden="true"
            ><GinkoRecipeIcon :name="match.recipe.icon" /></span>
            <span class="ginko-editor__recipe-text">
              <strong><template
                v-for="(part, partIndex) in parts(match)"
                :key="partIndex"
              ><mark
                v-if="part.matched"
                class="ginko-editor__recipe-match"
              >{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></strong>
              <small>{{ description(match) }}</small>
            </span>
            <span
              v-if="index === activeIndex"
              aria-hidden="true"
            >↵</span>
          </button>
        </div>
      </div>
      <div
        v-if="entries.length === 0"
        class="ginko-editor__insert-empty"
      >
        <p>{{ text('noBlocks') }}</p>
        <p class="ginko-editor__insert-hint">
          {{ text('noBlocksHint') }}
        </p>
      </div>
      <p
        class="ginko-editor__sr-only"
        aria-live="polite"
      >
        {{ text('blockResults', { count: entries.length }) }}
      </p>
      <div
        v-if="showsPreview && activeRecipe"
        class="ginko-editor__recipe-preview"
        tabindex="-1"
        role="region"
        :aria-label="text('recipePreview')"
      >
        <slot
          name="recipe-preview"
          :recipe="activeRecipe"
        />
      </div>
      <p
        v-if="error"
        class="ginko-editor__insert-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p class="ginko-editor__insert-help">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          {{ text('navigate') }}
        </span>
        <span>
          <kbd>↵</kbd>
          {{ text('insertHelp') }}
        </span>
        <span v-if="showsPreview">
          <kbd>tab</kbd>
          {{ text('previewHelp') }}
        </span>
        <span>
          <kbd>esc</kbd>
          {{ text('closeHelp') }}
        </span>
      </p>
    </div>
  </Teleport>
</template>
