<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ToolbarRoot, ToolbarButton, ToolbarSeparator, TooltipProvider, DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, PopoverRoot, PopoverTrigger, PopoverContent, PopoverPortal } from 'reka-ui'
import type { EditorActions, EditorToolbarGroup, EditorCommand } from './commands'
import { defaultMessages, defaultToolbarItems } from './commands'
import { createEditorOverlayController, editorOverlayKey } from './context'
import GinkoActionButton from './GinkoActionButton.vue'
import GinkoToolbarIcon from './GinkoToolbarIcon.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ actions: EditorActions; items?: readonly EditorToolbarGroup[]; compact?: boolean }>()
const toolbarRoot = ref<InstanceType<typeof ToolbarRoot>>()
const rootElement = () => { const element: unknown = toolbarRoot.value?.$el; return typeof globalThis.HTMLElement !== 'undefined' && element instanceof globalThis.HTMLElement ? element : undefined }
const inheritedUi = inject(editorOverlayKey, undefined)
const ui = inheritedUi ?? createEditorOverlayController({ getContainer: rootElement, getThemeElement: rootElement })
const emit = defineEmits<{ 'open-change': [open: boolean] }>()
const panel = ref<string>()
const captured = shallowRef<EditorActions>()
const owner = {}
const href = ref(''), error = ref(''), rows = ref(3), columns = ref(3)
const groups = computed(() => (props.items ?? defaultToolbarItems).map(group => group.filter(item => item.kind === 'menu' || props.actions.get(item).available)))
function setOpen(id: string, open: boolean, command?: EditorCommand) {
  captured.value = open ? props.actions.capture() : undefined
  if (open && command?.kind === 'link') href.value = captured.value?.get({ kind: 'link' }).value ?? ''
  if (open && command?.kind === 'table') { rows.value = command.rows; columns.value = command.columns }
  panel.value = open ? id : undefined
}
watch(panel, value => {
  emit('open-change', !!value)
  error.value = ''
  if (value) ui?.open(owner, () => { panel.value = undefined })
  else ui?.release(owner)
})
watch(() => props.actions, () => { if (captured.value && !captured.value.isCurrent()) panel.value = undefined })
onBeforeUnmount(() => { ui.release(owner); if (!inheritedUi) ui.destroy() })
function menuLabel(label: string) { return label in defaultMessages ? props.actions.text(label as keyof typeof defaultMessages) : label }
async function run(command: EditorCommand) { const result = await (captured.value ?? props.actions).get(command).run(); if (result) panel.value = undefined; return result }
async function applyLink(remove = false) {
  const value = remove ? '' : href.value.trim()
  if ((!remove && !value) || !await run({ kind: 'link', href: value })) error.value = props.actions.text('invalidLink')
}
</script>
<template>
  <TooltipProvider :delay-duration="350">
    <ToolbarRoot
      ref="toolbarRoot"
      v-bind="$attrs"
      class="ginko-toolbar"
      :class="{ 'ginko-toolbar--compact': compact }"
      :aria-label="actions.text('formatting')"
    >
      <template
        v-for="(group, groupIndex) in groups"
        :key="groupIndex"
      >
        <ToolbarSeparator
          v-if="groupIndex"
          class="ginko-toolbar__separator"
        />
        <div class="ginko-toolbar__group">
          <template
            v-for="(item, itemIndex) in group"
            :key="itemIndex"
          >
            <slot
              :name="item.kind === 'mark' ? item.mark : item.kind"
              :action="item.kind === 'menu' ? undefined : actions.get(item)"
              :actions="actions"
            >
              <DropdownMenuRoot
                v-if="item.kind === 'menu'"
                :open="panel === `${groupIndex}-${itemIndex}`"
                @update:open="setOpen(`${groupIndex}-${itemIndex}`, $event)"
              >
                <DropdownMenuTrigger as-child>
                  <ToolbarButton
                    class="ginko-control"
                    :aria-label="menuLabel(item.label)"
                    :title="menuLabel(item.label)"
                    @mousedown.prevent
                  >
                    <GinkoToolbarIcon :name="item.label === 'lists' ? 'bullets' : item.label === 'more' ? 'more' : 'paragraph'" />
                    <GinkoToolbarIcon
                      v-if="item.label !== 'more'"
                      name="chevron"
                    />
                  </ToolbarButton>
                </DropdownMenuTrigger>
                <DropdownMenuPortal :to="ui?.getContainer()">
                  <DropdownMenuContent
                    class="ginko-menu"
                    :side-offset="6"
                    align="start"
                  >
                    <DropdownMenuItem
                      v-for="command in item.items.filter(command => actions.get(command).available)"
                      :key="actions.get(command).id"
                      class="ginko-menu__item"
                      :disabled="actions.get(command).disabled"
                      :data-active="actions.get(command).active || undefined"
                      @select="run(command)"
                    >
                      <GinkoToolbarIcon :name="actions.get(command).id" />{{ actions.get(command).label }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
              <PopoverRoot
                v-else-if="item.kind === 'link' || item.kind === 'table'"
                :open="panel === `${groupIndex}-${itemIndex}`"
                @update:open="setOpen(`${groupIndex}-${itemIndex}`, $event, item)"
              >
                <PopoverTrigger as-child>
                  <ToolbarButton
                    class="ginko-control"
                    :aria-label="actions.get(item).label"
                    :aria-pressed="actions.get(item).active"
                    :disabled="actions.get(item).disabled"
                    :title="actions.get(item).label"
                    @mousedown.prevent
                  >
                    <GinkoToolbarIcon :name="item.kind" />
                  </ToolbarButton>
                </PopoverTrigger>
                <PopoverPortal :to="ui?.getContainer()">
                  <PopoverContent
                    class="ginko-menu ginko-toolbar__form"
                    :side-offset="6"
                    align="start"
                    :aria-label="actions.get(item).label"
                    @escape-key-down="panel = undefined"
                  >
                    <form
                      v-if="item.kind === 'link'"
                      @submit.prevent="applyLink()"
                    >
                      <label>{{ actions.text('linkAddress') }}<input
                        v-model="href"
                        type="text"
                        placeholder="https://…"
                        :aria-label="actions.text('linkAddress')"
                      ></label>
                      <p
                        v-if="error"
                        role="alert"
                      >
                        {{ error }}
                      </p>
                      <div class="ginko-toolbar__form-actions">
                        <button
                          type="button"
                          class="ginko-control"
                          @click="applyLink(true)"
                        >
                          {{ actions.text('removeLink') }}
                        </button><button
                          class="ginko-button"
                          type="submit"
                        >
                          {{ actions.text('apply') }}
                        </button>
                      </div>
                    </form>
                    <form
                      v-else
                      @submit.prevent="run({ kind: 'table', rows, columns })"
                    >
                      <strong>{{ actions.text('table') }}</strong>
                      <div
                        class="ginko-table-size"
                        role="group"
                        :aria-label="actions.text('table')"
                      >
                        <button
                          v-for="cell in 25"
                          :key="cell"
                          type="button"
                          :aria-label="`${Math.ceil(cell / 5)} × ${(cell - 1) % 5 + 1}`"
                          :data-active="Math.ceil(cell / 5) <= rows && (cell - 1) % 5 < columns || undefined"
                          @mouseenter="rows = Math.ceil(cell / 5); columns = (cell - 1) % 5 + 1"
                          @click="run({ kind: 'table', rows: Math.ceil(cell / 5), columns: (cell - 1) % 5 + 1 })"
                        />
                      </div>
                      <div class="ginko-toolbar__dimensions">
                        <label>{{ actions.text('rows') }}<input
                          v-model.number="rows"
                          type="number"
                          min="1"
                          max="20"
                        ></label><label>{{ actions.text('columns') }}<input
                          v-model.number="columns"
                          type="number"
                          min="1"
                          max="20"
                        ></label>
                      </div>
                      <button
                        class="ginko-button"
                        type="submit"
                      >
                        {{ actions.text('table') }} · {{ columns }} × {{ rows }}
                      </button>
                    </form>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
              <GinkoActionButton
                v-else
                :action="actions.get(item)"
                :label="item.kind === 'image' && !compact"
              />
            </slot>
          </template>
        </div>
      </template>
    </ToolbarRoot>
  </TooltipProvider>
</template>
