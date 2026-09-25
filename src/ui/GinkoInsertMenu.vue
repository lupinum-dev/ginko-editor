<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'

import type { AuthoringRecipe } from '../authoring'
import type { EditorText } from './messages'
import { isImageRecipe, recipeCopy, recipeSymbol } from './writingRecipes'

defineOptions({ name: 'GinkoInsertMenu' })

const props = defineProps<{
  id: string
  to: InstanceType<typeof globalThis.HTMLElement> | string
  origin: 'button' | 'slash'
  recipes: readonly AuthoringRecipe[]
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
const activeRecipe = computed(() => props.recipes[activeIndex.value])
const showsPreview = computed(() =>
  !!activeRecipe.value && !isImageRecipe(activeRecipe.value) && !!slots['recipe-preview'],
)

function description(recipe: AuthoringRecipe) {
  return recipeCopy(recipe, props.text).description
    || (recipe.keywords?.length
      ? `/${recipe.keywords[0]}`
      : props.text('insertRecipe', { label: recipe.label.toLocaleLowerCase() }))
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
        <button
          v-for="(recipe, index) in recipes"
          :id="`${id}-${index}`"
          :key="`${index}-${recipe.id}`"
          tabindex="-1"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          :disabled="busy"
          @mousedown.prevent
          @mouseenter="activeIndex = index"
          @click="emit('select', recipe)"
        >
          <span
            class="ginko-editor__recipe-symbol"
            aria-hidden="true"
          >{{ recipeSymbol(recipe) }}</span>
          <span class="ginko-editor__recipe-text">
            <strong>{{ recipeCopy(recipe, text).label }}</strong>
            <small>{{ description(recipe) }}</small>
          </span>
          <span
            v-if="index === activeIndex"
            aria-hidden="true"
          >↵</span>
        </button>
        <p
          v-if="recipes.length === 0"
          class="ginko-editor__insert-empty"
        >
          {{ text('noBlocks') }}
        </p>
      </div>
      <div
        v-if="showsPreview && activeRecipe"
        class="ginko-editor__recipe-preview"
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
        <span>
          <kbd>esc</kbd>
          {{ text('closeHelp') }}
        </span>
      </p>
    </div>
  </Teleport>
</template>
