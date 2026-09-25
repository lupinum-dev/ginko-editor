import type { Editor } from '@tiptap/core'
import type { Selection } from '@tiptap/pm/state'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
 
  watch,
  type Ref,
  type ShallowRef,
} from 'vue'

import type { AuthoringKit, AuthoringRecipe } from '../authoring'
import { addContainerItem, containerAt } from '../lib/container-items'
import type { EditorOperationContext } from '../lib/editor-operations'
import type { EditorOverlayController } from '../ui/context'
import { runRecipeCommand } from '../ui/recipe-command'
import { groupMatches, rankRecipes, type RecipeGroup, type RecipeMatch } from '../ui/recipe-search'
import { slashKey } from '../ui/slash-command'
import { isImageRecipe, recipeCopy, writingRecipes } from '../ui/writingRecipes'

type BrowserElement = InstanceType<typeof globalThis.HTMLElement>
type BrowserKeyboardEvent = InstanceType<typeof globalThis.KeyboardEvent>

/** The rendered menu parts that positioning and focus need. */
export interface InsertMenuElements {
  root?: BrowserElement
  search?: InstanceType<typeof globalThis.HTMLInputElement>
}

export interface InsertMenuOptions {
  editor: ShallowRef<Editor | undefined>
  editorRoot: Ref<BrowserElement | undefined>
  menu: Ref<InsertMenuElements | undefined>
  overlays: EditorOverlayController
  kit: ShallowRef<AuthoringKit | undefined>
  enableImages: () => boolean
  canMutate: () => boolean
  isDisposed: () => boolean
  operationContext: EditorOperationContext
  requestImage: (range?: { from: number; to: number }) => void
}

/** The most recent recipes that one editor keeps in memory. */
const recentLimit = 5

/** An action for the container that holds the selection, for example "Add tab". */
interface ContextAction {
  recipe: AuthoringRecipe
  container: number
  after: number
}

/** The block menu opened by the Insert button or by typing `/` in a paragraph. */
/** Ids must stay unique across separate Vue apps on one page. */
let insertMenuCount = 0

export function useInsertMenu(options: InsertMenuOptions) {
  const { editor, overlays } = options
  const owner = {}
  const id = `ginko-insert-${++insertMenuCount}`
  const open = ref(false)
  const origin = ref<'button' | 'slash'>('button')
  const query = ref('')
  const activeIndex = ref(0)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const position = ref({ left: '8px', top: '48px', maxHeight: '420px' })
  const container = shallowRef<BrowserElement>()
  const recent = shallowRef<readonly AuthoringRecipe[]>([])
  const contextAction = shallowRef<ContextAction>()
  let selection: Selection | undefined
  let resizeObserver: InstanceType<typeof globalThis.ResizeObserver> | undefined

  const menuElement = () => options.menu.value?.root

  // Native writing blocks come first within a group; kit recipes follow in kit order.
  const available = computed(() => [
    ...writingRecipes.filter(recipe => options.enableImages() || !isImageRecipe(recipe)),
    ...(options.kit.value?.recipes ?? []),
  ])
  const copy = (recipe: AuthoringRecipe) => recipeCopy(recipe, overlays.text)
  /** Menu groups in display order. Context actions come first, then recent recipes. */
  const groups = computed<RecipeGroup[]>(() => {
    const searching = !!query.value.trim()
    const action = contextAction.value
    const pinned: RecipeGroup[] = []
    if (action) {
      const [match] = rankRecipes([action.recipe], query.value, copy)
      pinned.push({ key: '__ginko-context', label: overlays.text('groupContext'), matches: match ? [match] : [] })
    }
    const all = available.value
    let rest: readonly AuthoringRecipe[] = all
    if (!searching) {
      const recentMatches = recent.value.filter(recipe => all.includes(recipe))
      if (recentMatches.length) {
        pinned.push({
          key: '__ginko-recent',
          label: overlays.text('groupRecent'),
          matches: rankRecipes(recentMatches, '', copy),
        })
        rest = all.filter(recipe => !recentMatches.includes(recipe))
      }
    }
    return groupMatches(rankRecipes(rest, query.value, copy), overlays.text, { query: searching, pinned })
  })
  /** Options in keyboard order. */
  const entries = computed<RecipeMatch[]>(() => groups.value.flatMap(group => group.matches))
  const recipes = computed(() => entries.value.map(entry => entry.recipe))
  const activeRecipe = computed(() => recipes.value[activeIndex.value])

  watch(recipes, () => {
    activeIndex.value = Math.min(activeIndex.value, Math.max(0, recipes.value.length - 1))
  })
  watch([query, activeRecipe], () => { void nextTick(place) })
  watch(menuElement, (element) => {
    resizeObserver?.disconnect()
    if (element) resizeObserver?.observe(element)
  })

  /** Attributes that make the canvas a combobox while the slash menu is open. */
  const editorAttributes = computed<Record<string, string>>(() => {
    const slashOpen = open.value && origin.value === 'slash'
    if (!slashOpen) return { role: 'textbox', 'aria-multiline': 'true' }
    const attributes: Record<string, string> = {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': 'true',
      'aria-controls': id,
    }
    if (activeRecipe.value) attributes['aria-activedescendant'] = `${id}-${activeIndex.value}`
    return attributes
  })

  function place() {
    const instance = editor.value
    const root = options.editorRoot.value
    if (!instance || !root || !open.value) return
    if (selection?.$from.doc !== instance.state.doc) { close(false); return }
    const bounds = root.getBoundingClientRect()
    const anchor = origin.value === 'slash'
      ? instance.view.coordsAtPos(selection?.from ?? instance.state.selection.from)
      : { left: bounds.left + 12, bottom: bounds.top + 48, top: bounds.top + 48 }
    const below = globalThis.innerHeight - anchor.bottom - 20
    const above = anchor.top - 20
    const opensAbove = below < 240 && above > below
    const available = Math.max(160, Math.min(440, opensAbove ? above : below))
    const menu = menuElement()
    const height = Math.min(menu?.getBoundingClientRect().height || available, available)
    const top = opensAbove ? Math.max(12, anchor.top - height - 8) : anchor.bottom + 8
    position.value = {
      left: `${Math.max(
        8,
        Math.min(anchor.left, globalThis.innerWidth - (menu?.getBoundingClientRect().width || 320) - 12),
      )}px`,
      top: `${top}px`,
      maxHeight: `${available}px`,
    }
  }

  function dismissOutside(event: globalThis.PointerEvent) {
    if (!open.value || !(event.target instanceof globalThis.Node)) return
    const trigger = options.editorRoot.value?.querySelector('.ginko-editor__insert-trigger')
    if (!menuElement()?.contains(event.target) && !trigger?.contains(event.target)) close(false)
  }

  /** Follow the slash plugin state after each transaction. */
  function syncSlash(instance: Editor) {
    if (open.value && origin.value === 'button') return
    const range = slashKey.getState(instance.state)?.active
    if (!range || !options.canMutate() || instance.view.composing) {
      if (open.value) close(false, false)
      return
    }
    if (!open.value) void show('slash')
    selection = instance.state.selection
    if (query.value !== range.query) activeIndex.value = 0
    query.value = range.query
    void nextTick(place)
  }

  async function show(from: 'button' | 'slash') {
    const instance = editor.value
    if (!instance || !options.canMutate()) return
    selection = instance.state.selection
    origin.value = from
    query.value = ''
    activeIndex.value = 0
    error.value = null
    container.value = overlays.getContainer()
    overlays.open(owner, () => close(false))
    readContext()
    open.value = true
    const opening = selection
    await nextTick()
    if (!open.value || selection !== opening) return
    place()
    if (from === 'button') options.menu.value?.search?.focus()
  }

  function restoreSelection(target = selection) {
    const instance = editor.value
    if (!instance || !target || target.$from.doc !== instance.state.doc) return
    instance.view.dispatch(instance.state.tr.setSelection(target))
    instance.view.focus()
  }

  /** Offer an add action when the selection is inside a container item. */
  function readContext() {
    const instance = editor.value
    const kit = options.kit.value
    const found = instance && selection && kit ? containerAt(instance.state.doc, selection.from, kit) : undefined
    if (!found) {
      contextAction.value = undefined
      return
    }
    const { layout, item } = found
    const containerLabel = kit?.authoring[layout.node.attrs.tag]?.label ?? layout.node.attrs.tag
    contextAction.value = {
      container: layout.pos,
      after: item.index,
      recipe: {
        id: 'ginko.context.add-item',
        label: layout.config.addLabel ?? overlays.text('addItem'),
        description: containerLabel,
        group: 'context',
        icon: 'plus',
        source: '',
      },
    }
  }

  function close(restore = true, dismissSlash = true) {
    const previous = selection
    open.value = false
    contextAction.value = undefined
    overlays.release(owner)
    query.value = ''
    error.value = null
    selection = undefined
    const instance = editor.value
    if (dismissSlash && instance && slashKey.getState(instance.state)?.active) {
      instance.view.dispatch(instance.state.tr.setMeta(slashKey, 'dismiss'))
    }
    if (restore) restoreSelection(previous)
  }

  function toggle() {
    if (open.value) close()
    else void show('button')
  }

  function reveal() {
    void nextTick(() => menuElement()?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }))
  }

  function move(offset: number) {
    const count = recipes.value.length
    if (!count) return
    activeIndex.value = (activeIndex.value + offset + count) % count
    reveal()
  }

  function moveTo(index: number) {
    if (!recipes.value.length) return
    activeIndex.value = Math.max(0, Math.min(recipes.value.length - 1, index))
    reveal()
  }

  function remember(recipe: AuthoringRecipe) {
    recent.value = [recipe, ...recent.value.filter(entry => entry !== recipe)].slice(0, recentLimit)
  }

  async function insert(recipe: AuthoringRecipe | undefined) {
    const instance = editor.value
    if (!recipe || !instance || !selection || busy.value) return
    const selectionAtStart = selection
    const range = origin.value === 'slash' ? slashKey.getState(instance.state)?.active : undefined
    if (selectionAtStart.$from.doc !== instance.state.doc) { close(false); return }
    if (isImageRecipe(recipe)) {
      remember(recipe)
      restoreSelection()
      close(false)
      options.requestImage(range)
      return
    }
    const action = contextAction.value?.recipe === recipe ? contextAction.value : undefined
    busy.value = true
    error.value = null
    try {
      restoreSelection(selectionAtStart)
      const context = {
        ...options.operationContext,
        canMutate: () =>
          !options.isDisposed()
          && open.value
          && selection === selectionAtStart
          && options.canMutate(),
      }
      const result = action
        ? await addContainerItem(instance, action.container, { after: action.after, replaceRange: range }, context)
        : await runRecipeCommand(instance, recipe, context, range)
      if (options.isDisposed()) return
      if (result.ok) {
        if (!action) remember(recipe)
        close(false)
        instance.view.focus()
        return
      }
      if (!open.value || selection !== selectionAtStart) return
      if (result.reason !== 'stale') error.value = overlays.text('insertFailed')
    } finally {
      busy.value = false
    }
  }

  /** Menu navigation keys. Returns true when the menu handled the key. */
  function handleKeys(event: BrowserKeyboardEvent) {
    if (event.isComposing) return false
    if (event.key === 'Tab') {
      const preview = menuElement()?.querySelector<BrowserElement>('.ginko-editor__recipe-preview')
      if (preview?.contains(globalThis.document.activeElement)) {
        // Return from the preview to the place where the writer types.
        event.preventDefault()
        if (origin.value === 'slash') editor.value?.view.focus()
        else options.menu.value?.search?.focus()
        return true
      }
      if (preview && !event.shiftKey) {
        event.preventDefault()
        preview.focus()
        return true
      }
      close(false)
      return false
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      moveTo(event.key === 'Home' ? 0 : recipes.value.length - 1)
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return true
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      void insert(recipes.value[activeIndex.value])
      return true
    }
    return false
  }

  onMounted(() => {
    if (globalThis.ResizeObserver) resizeObserver = new globalThis.ResizeObserver(place)
    globalThis.document.addEventListener('pointerdown', dismissOutside)
    globalThis.addEventListener('resize', place)
    globalThis.addEventListener('scroll', place, true)
  })
  onBeforeUnmount(() => {
    globalThis.document.removeEventListener('pointerdown', dismissOutside)
    globalThis.removeEventListener('resize', place)
    globalThis.removeEventListener('scroll', place, true)
    resizeObserver?.disconnect()
  })

  return {
    id,
    open,
    origin,
    query,
    activeIndex,
    activeRecipe,
    recipes,
    groups,
    entries,
    error,
    busy,
    position,
    container,
    editorAttributes,
    show,
    close,
    toggle,
    insert,
    handleKeys,
    syncSlash,
  }
}

export type InsertMenu = ReturnType<typeof useInsertMenu>
