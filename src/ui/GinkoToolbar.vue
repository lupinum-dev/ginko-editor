<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import GinkoToolbarIcon from './GinkoToolbarIcon.vue'

const props = defineProps<{
  editor: Editor
  enableFiles: boolean
  enableImages: boolean
  enableVideo: boolean
}>()
const emit = defineEmits<{
  'request-file': []
  'request-image': []
  'request-video': []
}>()

type Panel = 'headings' | 'lists' | 'link'
const open = ref<Panel>()
const id = useId()
const toolbarRoot = ref<globalThis.HTMLElement>()
const linkInput = ref<globalThis.HTMLInputElement>()
const linkUrl = ref('')
const linkError = ref('')
let linkSnapshot: Pick<Editor['state'], 'doc' | 'selection'> | undefined
// The host can supply a non-reactive TipTap instance; derive button state on every transaction.
const revision = ref(0)
const headingLevels = [1, 2, 3, 4, 5, 6] as const
const currentHeading = computed(() => {
  void revision.value
  return headingLevels.find(level => props.editor.isActive('heading', { level }))
})
const blocks = computed(() => {
  void revision.value
  return [
    { label: 'Block quote', icon: 'quote' as const, active: props.editor.isActive('blockquote'), enabled: props.editor.can().toggleBlockquote(), run: () => props.editor.chain().focus().toggleBlockquote().run() },
    { label: 'Code block', icon: 'codeBlock' as const, active: props.editor.isActive('codeBlock'), enabled: props.editor.can().toggleCodeBlock(), run: () => props.editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Divider', icon: 'divider' as const, active: false, enabled: props.editor.can().setHorizontalRule(), run: () => props.editor.chain().focus().setHorizontalRule().run() },
  ]
})
const marks = computed(() => {
  void revision.value
  return [
    { label: 'Bold', icon: 'bold' as const, shortcut: '⌘/Ctrl B', active: props.editor.isActive('bold'), enabled: props.editor.can().toggleBold(), run: () => props.editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: 'italic' as const, shortcut: '⌘/Ctrl I', active: props.editor.isActive('italic'), enabled: props.editor.can().toggleItalic(), run: () => props.editor.chain().focus().toggleItalic().run() },
    { label: 'Strikethrough', icon: 'strike' as const, shortcut: '⌘/Ctrl Shift S', active: props.editor.isActive('strike'), enabled: props.editor.can().toggleStrike(), run: () => props.editor.chain().focus().toggleStrike().run() },
    { label: 'Inline code', icon: 'code' as const, shortcut: '⌘/Ctrl E', active: props.editor.isActive('code'), enabled: props.editor.can().toggleCode(), run: () => props.editor.chain().focus().toggleCode().run() },
  ]
})
function trigger(panel: Panel) { return toolbarRoot.value?.querySelector<globalThis.HTMLButtonElement>(`[data-panel="${panel}"]`) }
function close(restoreFocus = false) {
  const panel = open.value
  open.value = undefined; linkSnapshot = undefined
  if (restoreFocus && panel) trigger(panel)?.focus()
}
function menuItems() { return [...(toolbarRoot.value?.querySelectorAll<globalThis.HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? [])] }
async function toggle(panel: Panel, last = false) {
  if (open.value === panel) { close(); return }
  open.value = panel; linkSnapshot = undefined
  if (panel === 'link') {
    const href: unknown = props.editor.getAttributes('link').href
    linkUrl.value = typeof href === 'string' ? href : ''
    linkError.value = ''; linkSnapshot = { doc: props.editor.state.doc, selection: props.editor.state.selection }
  }
  await nextTick()
  if (open.value !== panel) return
  if (panel === 'link') { linkInput.value?.focus(); linkInput.value?.select() }
  else { const items = menuItems(); (last ? items.at(-1) : items[0])?.focus() }
}
function openWithArrow(event: globalThis.KeyboardEvent, panel: Panel) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  if (open.value === panel) { const items = menuItems(); (event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus() }
  else void toggle(panel, event.key === 'ArrowUp')
}
function navigateMenu(event: globalThis.KeyboardEvent) {
  if (event.key === 'Tab') { close(true); return }
  const items = menuItems(), index = items.indexOf(globalThis.document.activeElement as globalThis.HTMLButtonElement)
  let next: number
  if (event.key === 'ArrowDown') next = (index + 1) % items.length
  else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else return
  event.preventDefault(); items[next]?.focus()
}
function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && open.value) { event.preventDefault(); event.stopPropagation(); close(true) }
}
function dismiss(event: globalThis.PointerEvent) {
  if (event.target instanceof globalThis.Node && !toolbarRoot.value?.contains(event.target)) close()
}
function focusout(event: globalThis.FocusEvent) {
  if (event.relatedTarget instanceof globalThis.Node && !toolbarRoot.value?.contains(event.relatedTarget)) close()
}
function preserveSelection(event: globalThis.MouseEvent) {
  // Buttons should not collapse the browser text selection before their command.
  if (event.button === 0 && event.target instanceof globalThis.Element && event.target.closest('button')) event.preventDefault()
}
function setHeading(level?: typeof headingLevels[number]) {
  close()
  if (level) props.editor.chain().focus().setHeading({ level }).run()
  else props.editor.chain().focus().setParagraph().run()
}
function setList(ordered: boolean) {
  close()
  if (ordered) props.editor.chain().focus().toggleOrderedList().run()
  else props.editor.chain().focus().toggleBulletList().run()
}
function applyLink(remove = false) {
  const editor = props.editor
  if (!linkSnapshot || editor.state.doc !== linkSnapshot.doc || !editor.state.selection.eq(linkSnapshot.selection) || !editor.isEditable) { close(); return }
  const href = linkUrl.value.trim()
  if (remove) { close(); editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
  if (!href || !editor.can().setLink({ href })) { linkError.value = 'Enter a valid link.'; return }
  const insertText = editor.state.selection.empty && !editor.isActive('link')
  close()
  if (insertText) editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
  else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}
watch(() => props.editor, (editor, _, onCleanup) => {
  close()
  const refresh = () => {
    revision.value += 1
    if (!editor.isEditable || (linkSnapshot && (editor.state.doc !== linkSnapshot.doc || !editor.state.selection.eq(linkSnapshot.selection)))) close()
  }
  editor.on('transaction', refresh)
  editor.on('update', refresh)
  onCleanup(() => { editor.off('transaction', refresh); editor.off('update', refresh) })
}, { immediate: true })
onMounted(() => globalThis.document.addEventListener('pointerdown', dismiss))
onBeforeUnmount(() => globalThis.document.removeEventListener('pointerdown', dismiss))
</script>

<template>
  <div
    ref="toolbarRoot"
    class="ginko-editor__toolbar"
    role="group"
    aria-label="Rich text formatting tools"
    @mousedown="preserveSelection"
    @keydown="keydown"
    @focusout="focusout"
  >
    <div
      class="ginko-editor__toolbar-group"
      role="group"
      aria-label="History"
    >
      <button
        type="button"
        aria-label="Undo"
        title="Undo (⌘/Ctrl Z)"
        :disabled="!editor.isEditable || !editor.can().undo()"
        @click="close(); editor.chain().focus().undo().run()"
      >
        <GinkoToolbarIcon name="undo" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (⌘/Ctrl Shift Z)"
        :disabled="!editor.isEditable || !editor.can().redo()"
        @click="close(); editor.chain().focus().redo().run()"
      >
        <GinkoToolbarIcon name="redo" />
      </button>
    </div>

    <div
      class="ginko-editor__toolbar-group"
      role="group"
      aria-label="Block formatting"
    >
      <div class="ginko-editor__toolbar-dropdown">
        <button
          type="button"
          data-panel="headings"
          aria-label="Text style"
          title="Text style"
          aria-haspopup="menu"
          :aria-expanded="open === 'headings'"
          :aria-controls="`${id}-headings`"
          :disabled="!editor.isEditable"
          @click="toggle('headings')"
          @keydown="openWithArrow($event, 'headings')"
        >
          <GinkoToolbarIcon name="heading" /><span
            v-if="currentHeading"
            class="ginko-editor__heading-level"
          >{{ currentHeading }}</span><GinkoToolbarIcon
            name="chevron"
            class="ginko-editor__chevron"
          />
        </button>
        <div
          v-if="open === 'headings'"
          :id="`${id}-headings`"
          class="ginko-editor__toolbar-popover"
          role="menu"
          aria-label="Text style"
          @keydown="navigateMenu"
        >
          <button
            type="button"
            role="menuitemradio"
            tabindex="-1"
            :aria-checked="editor.isActive('paragraph')"
            :disabled="!editor.isActive('paragraph') && !editor.can().setParagraph()"
            @click="setHeading()"
          >
            <GinkoToolbarIcon name="paragraph" /><span>Normal text</span>
          </button>
          <button
            v-for="level in headingLevels"
            :key="level"
            type="button"
            role="menuitemradio"
            tabindex="-1"
            :aria-checked="editor.isActive('heading', { level })"
            :disabled="!editor.isActive('heading', { level }) && !editor.can().setHeading({ level })"
            @click="setHeading(level)"
          >
            <span class="ginko-editor__heading-icon">H{{ level }}</span><span>Heading {{ level }}</span>
          </button>
        </div>
      </div>
      <div class="ginko-editor__toolbar-dropdown">
        <button
          type="button"
          data-panel="lists"
          aria-label="Lists"
          title="Lists"
          aria-haspopup="menu"
          :aria-expanded="open === 'lists'"
          :aria-controls="`${id}-lists`"
          :aria-pressed="editor.isActive('bulletList') || editor.isActive('orderedList')"
          :disabled="!editor.isEditable"
          @click="toggle('lists')"
          @keydown="openWithArrow($event, 'lists')"
        >
          <GinkoToolbarIcon :name="editor.isActive('orderedList') ? 'ordered' : 'bullets'" /><GinkoToolbarIcon
            name="chevron"
            class="ginko-editor__chevron"
          />
        </button>
        <div
          v-if="open === 'lists'"
          :id="`${id}-lists`"
          class="ginko-editor__toolbar-popover"
          role="menu"
          aria-label="Lists"
          @keydown="navigateMenu"
        >
          <button
            type="button"
            role="menuitemradio"
            tabindex="-1"
            :aria-checked="editor.isActive('bulletList')"
            :disabled="!editor.can().toggleBulletList()"
            @click="setList(false)"
          >
            <GinkoToolbarIcon name="bullets" /><span>Bullet list</span>
          </button>
          <button
            type="button"
            role="menuitemradio"
            tabindex="-1"
            :aria-checked="editor.isActive('orderedList')"
            :disabled="!editor.can().toggleOrderedList()"
            @click="setList(true)"
          >
            <GinkoToolbarIcon name="ordered" /><span>Numbered list</span>
          </button>
        </div>
      </div>
      <button
        v-for="action in blocks"
        :key="action.label"
        type="button"
        :aria-label="action.label"
        :title="action.label"
        :aria-pressed="action.label === 'Divider' ? undefined : action.active"
        :disabled="!editor.isEditable || !action.enabled"
        @click="close(); action.run()"
      >
        <GinkoToolbarIcon :name="action.icon" />
      </button>
    </div>

    <div
      class="ginko-editor__toolbar-group"
      role="group"
      aria-label="Text formatting"
    >
      <button
        v-for="action in marks"
        :key="action.label"
        type="button"
        :aria-label="action.label"
        :title="`${action.label} (${action.shortcut})`"
        :aria-pressed="action.active"
        :disabled="!editor.isEditable || !action.enabled"
        @click="close(); action.run()"
      >
        <GinkoToolbarIcon :name="action.icon" />
      </button>
      <div class="ginko-editor__toolbar-dropdown ginko-editor__toolbar-link">
        <button
          type="button"
          data-panel="link"
          aria-label="Link"
          title="Add or edit link"
          aria-haspopup="dialog"
          :aria-expanded="open === 'link'"
          :aria-controls="`${id}-link`"
          :aria-pressed="editor.isActive('link')"
          :disabled="!editor.isEditable || !editor.can().setLink({ href: 'https://example.com' })"
          @click="toggle('link')"
        >
          <GinkoToolbarIcon name="link" />
        </button>
        <form
          v-if="open === 'link'"
          :id="`${id}-link`"
          class="ginko-editor__toolbar-popover ginko-editor__link-form"
          role="dialog"
          aria-label="Edit link"
          @submit.prevent="applyLink()"
        >
          <label :for="`${id}-url`">Link destination</label>
          <input
            :id="`${id}-url`"
            ref="linkInput"
            v-model="linkUrl"
            type="text"
            inputmode="url"
            autocomplete="off"
            placeholder="https://example.com"
            :aria-invalid="!!linkError"
            :aria-describedby="linkError ? `${id}-link-error` : undefined"
            @input="linkError = ''"
          >
          <p
            v-if="linkError"
            :id="`${id}-link-error`"
            role="alert"
          >
            {{ linkError }}
          </p>
          <div class="ginko-editor__link-actions">
            <button
              v-if="editor.isActive('link')"
              type="button"
              @click="applyLink(true)"
            >
              Remove link
            </button>
            <button
              type="button"
              @click="close(true)"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="ginko-editor__link-apply"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="enableImages || enableFiles || enableVideo"
      class="ginko-editor__toolbar-group ginko-editor__toolbar-media"
      role="group"
      aria-label="Insert media"
    >
      <button
        v-if="enableImages"
        type="button"
        aria-label="Add image"
        title="Add image"
        :disabled="!editor.isEditable"
        @click="close(); emit('request-image')"
      >
        <GinkoToolbarIcon name="image" /><span>Add</span>
      </button>
      <button
        v-if="enableFiles"
        type="button"
        aria-label="Add file"
        title="Add file"
        :disabled="!editor.isEditable"
        @click="close(); emit('request-file')"
      >
        <GinkoToolbarIcon name="file" />
      </button>
      <button
        v-if="enableVideo"
        type="button"
        aria-label="Add video"
        title="Add video"
        :disabled="!editor.isEditable"
        @click="close(); emit('request-video')"
      >
        <GinkoToolbarIcon name="video" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ginko-editor__toolbar { position: relative; z-index: 8; display: flex; flex-wrap: wrap; align-items: center; gap: .25rem 0; border-bottom: 1px solid var(--ginko-border); padding: .4rem .5rem; color: var(--ginko-text); }
.ginko-editor__toolbar-group { display: flex; align-items: center; gap: .125rem; padding-inline: .35rem; }
.ginko-editor__toolbar-group + .ginko-editor__toolbar-group { border-inline-start: 1px solid var(--ginko-border); }
.ginko-editor__toolbar button { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; min-width: 2rem; min-height: 2rem; border: 0; border-radius: .4rem; background: transparent; color: inherit; cursor: pointer; padding: .35rem .45rem; font: inherit; font-size: .8125rem; font-weight: 500; line-height: 1.25; white-space: nowrap; }
.ginko-editor__toolbar button:not(:disabled):hover, .ginko-editor__toolbar button[aria-pressed='true'], .ginko-editor__toolbar button[aria-expanded='true'], .ginko-editor__toolbar button[aria-checked='true'] { background: var(--ginko-muted); }
.ginko-editor__toolbar button:disabled { opacity: .35; cursor: default; }
.ginko-editor__toolbar button:focus-visible, .ginko-editor__toolbar input:focus-visible { outline: 2px solid var(--ginko-text); outline-offset: 2px; }
.ginko-editor__toolbar svg { flex: 0 0 auto; }
.ginko-editor__chevron { width: .75rem; height: .75rem; opacity: .65; }
.ginko-editor__heading-level { margin-inline-start: -.35rem; font-size: .65rem; align-self: end; }
.ginko-editor__toolbar-dropdown { position: relative; }
.ginko-editor__toolbar-popover { position: absolute; z-index: 30; inset-block-start: calc(100% + .55rem); inset-inline-start: 0; display: grid; gap: .15rem; min-width: 12rem; max-height: min(26rem, 60vh); overflow-y: auto; border: 1px solid var(--ginko-border); border-radius: .65rem; background: var(--ginko-bg); color: var(--ginko-text); box-shadow: 0 .4rem 1.2rem rgb(0 0 0 / .1); padding: .35rem; }
.ginko-editor__toolbar-popover button { justify-content: start; min-height: 2.25rem; gap: .7rem; padding-inline: .6rem; }
.ginko-editor__toolbar-popover button[aria-checked='true']::after { content: '✓'; margin-inline-start: auto; }
.ginko-editor__heading-icon { width: 1.125rem; font-weight: 650; letter-spacing: -.04em; }
.ginko-editor__toolbar-media { margin-inline-start: auto; }
.ginko-editor__toolbar-link .ginko-editor__toolbar-popover { inset-inline-start: auto; inset-inline-end: 0; }
.ginko-editor__link-form { width: min(20rem, calc(100vw - 3rem)); gap: .6rem; padding: .8rem; }
.ginko-editor__link-form label { font-size: .8rem; font-weight: 600; }
.ginko-editor__link-form input { box-sizing: border-box; min-width: 0; width: 100%; border: 1px solid var(--ginko-border); border-radius: .35rem; padding: .55rem .6rem; background: var(--ginko-bg); color: inherit; font: inherit; font-size: .875rem; }
.ginko-editor__link-form p { margin: 0; color: var(--ginko-danger, #b42318); font-size: .8rem; }
.ginko-editor__link-actions { display: flex; justify-content: end; gap: .2rem; }
.ginko-editor__link-actions .ginko-editor__link-apply { background: var(--ginko-muted); font-weight: 600; }
@media (max-width: 40rem), (pointer: coarse) {
  .ginko-editor__toolbar button { min-width: 2.75rem; min-height: 2.75rem; }
  .ginko-editor__toolbar-group { padding-inline: .2rem; }
  .ginko-editor__toolbar-media { margin-inline-start: 0; }
}
@media (max-width: 30rem) {
  .ginko-editor__toolbar-dropdown { position: static; }
  .ginko-editor__toolbar-popover, .ginko-editor__toolbar-link .ginko-editor__toolbar-popover { inset-inline: .5rem; min-width: 0; width: auto; }
}
</style>
