import { defaultMessages, type EditorMessages } from './messages'
export { defaultMessages, type EditorMessages } from './messages'
import type { Editor } from '@tiptap/core'
import { computed, ref, watch, type Ref } from 'vue'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { commitEditorTransaction, type EditorOperationContext } from '../lib/editor-operations'

export type EditorCommand =
  | { kind: 'undo' | 'redo' | 'paragraph' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock' | 'divider' | 'image' | 'file' | 'video' | 'insert' }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: 'mark'; mark: 'bold' | 'italic' | 'strike' | 'code' }
  | { kind: 'link'; href?: string }
  | { kind: 'table'; rows: number; columns: number }

export type EditorToolbarItem = EditorCommand | { kind: 'menu'; label: string; items: readonly EditorCommand[] }
export type EditorToolbarGroup = readonly EditorToolbarItem[]
export type EditorShortcuts = Partial<Record<'duplicate' | 'undo' | 'redo' | 'bold' | 'italic' | 'strike' | 'code', string | false>>
export interface EditorAction {
  id: string
  label: string
  shortcut?: string
  active: boolean
  disabled: boolean
  pending: boolean
  available: boolean
  value?: string
  /** True means the command was accepted; asset completion remains asynchronous. */
  run: () => Promise<boolean>
}
export interface EditorActions {
  get: (command: EditorCommand) => EditorAction
  text: (key: keyof typeof defaultMessages) => string
  capture: () => EditorActions
  isCurrent: () => boolean
}



export const defaultToolbarItems: readonly EditorToolbarGroup[] = [
  [{ kind: 'undo' }, { kind: 'redo' }],
  [{ kind: 'menu', label: 'textStyle', items: [{ kind: 'paragraph' }, ...([1, 2, 3, 4, 5, 6] as const).map(level => ({ kind: 'heading' as const, level }))] },
    { kind: 'menu', label: 'lists', items: [{ kind: 'bulletList' }, { kind: 'orderedList' }] }],
  [{ kind: 'mark', mark: 'bold' }, { kind: 'mark', mark: 'italic' }, { kind: 'mark', mark: 'strike' }, { kind: 'mark', mark: 'code' }, { kind: 'link' }],
  [{ kind: 'codeBlock' }, { kind: 'table', rows: 3, columns: 3 }, { kind: 'image' },
    { kind: 'menu', label: 'more', items: [{ kind: 'blockquote' }, { kind: 'divider' }, { kind: 'file' }, { kind: 'video' }, { kind: 'insert' }] }],
]

export function formatShortcut(value: string, mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
  return value.split('-').map(key => key === 'Mod' ? mac ? '⌘' : 'Ctrl' : key === 'Alt' ? mac ? '⌥' : 'Alt' : key === 'Shift' ? mac ? '⇧' : 'Shift' : key === 'ArrowUp' ? '↑' : key === 'ArrowDown' ? '↓' : key.toUpperCase()).join(mac ? '' : '+')
}

export function matchesShortcut(event: KeyboardEvent, value: string | false | undefined) {
  if (!value || event.isComposing) return false
  const keys = value.toLowerCase().split('-'), key = keys.pop()
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  return event.key.toLowerCase() === key && event.altKey === keys.includes('alt') && event.shiftKey === keys.includes('shift')
    && event.metaKey === (keys.includes('meta') || (mac && keys.includes('mod')))
    && event.ctrlKey === (keys.includes('ctrl') || (!mac && keys.includes('mod')))
}

const textShortcutCommands = {
  undo: { kind: 'undo' }, redo: { kind: 'redo' },
  bold: { kind: 'mark', mark: 'bold' }, italic: { kind: 'mark', mark: 'italic' },
  strike: { kind: 'mark', mark: 'strike' }, code: { kind: 'mark', mark: 'code' },
} as const satisfies Record<string, EditorCommand>
const textShortcuts = { undo: 'Mod-z', redo: 'Mod-Shift-z', bold: 'Mod-b', italic: 'Mod-i', strike: 'Mod-Shift-s', code: 'Mod-e' } as const
// These native TipTap history aliases must honor the same override policy.
const nativeAliases: Partial<Record<keyof typeof textShortcuts, readonly string[]>> = { undo: ['Mod-я'], redo: ['Mod-y', 'Mod-Shift-я'] }
const matchesNativeShortcut = (event: KeyboardEvent, key: keyof typeof textShortcuts) => [textShortcuts[key], ...nativeAliases[key] ?? []].some(binding => matchesShortcut(event, binding))

export function hasCustomActionShortcut(event: KeyboardEvent, shortcuts?: EditorShortcuts): boolean {
  return (Object.keys(textShortcuts) as (keyof typeof textShortcuts)[]).some(key => typeof shortcuts?.[key] === 'string' && matchesShortcut(event, shortcuts[key]))
}

/** Capture-phase routing keeps UI, shortcuts, and policy validation in agreement. */
export function handleActionShortcut(editor: Editor, event: KeyboardEvent, actions: EditorActions, shortcuts?: EditorShortcuts): boolean {
  if (event.defaultPrevented || event.isComposing || !editor.isEditable || editor.isDestroyed) return false
  const target = event.target
  if (target instanceof Element && (target.closest('input, textarea, select, [role="combobox"]') || !editor.view.dom.contains(target))) return false
  const keys = Object.keys(textShortcuts) as (keyof typeof textShortcuts)[]
  // Resolve custom bindings first, so moving one command onto another default
  // does not cause the old command to intercept it.
  const command = keys.find(key => typeof shortcuts?.[key] === 'string' && matchesShortcut(event, shortcuts[key]))
    ?? keys.find(key => shortcuts?.[key] === undefined && matchesNativeShortcut(event, key))
  if (command) {
    event.preventDefault(); event.stopPropagation()
    void actions.get(textShortcutCommands[command]).run()
    return true
  }
  if (keys.some(key => shortcuts?.[key] !== undefined && matchesNativeShortcut(event, key))) {
    event.preventDefault(); event.stopPropagation()
    return true
  }
  return false
}

type CommandHostActions = {
  image: () => void
  file: () => void
  video: () => void
  insert: () => void
  mediaEnabled: (kind: 'image' | 'file' | 'video') => boolean
}

function execute(instance: Editor, command: EditorCommand, dry: boolean, capture?: (tr: Transaction) => void, host?: CommandHostActions) {
  const chain = dry ? instance.can().chain() : capture ? instance.chain().command(({ tr }) => { tr.setMeta('preventDispatch', true); capture(tr); return true }) : instance.chain().focus()
  switch (command.kind) {
    case 'undo': return chain.undo().run()
    case 'redo': return chain.redo().run()
    case 'paragraph': return chain.setParagraph().run()
    case 'heading': return chain.setHeading({ level: command.level }).run()
    case 'mark': return chain.toggleMark(command.mark).run()
    case 'bulletList': return chain.toggleBulletList().run()
    case 'orderedList': return chain.toggleOrderedList().run()
    case 'blockquote': return chain.toggleBlockquote().run()
    case 'codeBlock': return chain.toggleCodeBlock().run()
    case 'divider': return chain.setHorizontalRule().run()
    case 'link': {
      const href = command.href ?? 'https://example.com'
      if (href && !instance.can().setLink({ href })) return false
      if (command.href === '') return chain.extendMarkRange('link').unsetLink().run()
      if (command.href && instance.state.selection.empty && !instance.isActive('link')) return chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
      return chain.extendMarkRange('link').setLink({ href }).run()
    }
    case 'table':
      if (![command.rows, command.columns].every(value => Number.isInteger(value) && value >= 1 && value <= 20)) return false
      return chain.insertTable({ rows: command.rows, cols: command.columns, withHeaderRow: true }).run()
    case 'image': case 'file': case 'video':
      if (!host?.mediaEnabled(command.kind)) return false
      if (!dry) host[command.kind]()
      return true
    case 'insert': if (!host) return false; if (!dry) host.insert(); return true
  }
}

/** Build the same native document edit used by toolbar actions, without dispatching it. */
export function buildEditorCommandTransaction(editor: Editor, command: EditorCommand): Transaction | undefined {
  if (['undo', 'redo', 'image', 'file', 'video', 'insert'].includes(command.kind)) return undefined
  let transaction: Transaction | undefined
  if (!execute(editor, command, false, tr => { transaction = tr })) return undefined
  transaction?.setMeta('preventDispatch', false)
  return transaction
}

export function useEditorActions(editor: Ref<Editor | undefined>, options: CommandHostActions & {
  enabled: () => boolean
  messages: () => EditorMessages | undefined
  shortcuts: () => EditorShortcuts | undefined
  context: EditorOperationContext
}) {
  const revision = ref(0)
  const pendingAction = ref<string>()
  watch(editor, (instance, _, cleanup) => {
    const refresh = () => { revision.value++ }
    instance?.on('transaction', refresh)
    cleanup(() => instance?.off('transaction', refresh))
  }, { immediate: true })
  const shortcuts: Partial<Record<string, string>> = textShortcuts
  const text = (key: keyof typeof defaultMessages) => options.messages()?.[key] ?? defaultMessages[key]
  const actions = computed<EditorActions>(() => {
    void revision.value
    void pendingAction.value
    function create(snapshot?: EditorState): EditorActions {
      const isCurrent = () => !snapshot || (!!editor.value && editor.value.state.doc === snapshot.doc && editor.value.state.selection.eq(snapshot.selection))
      return { text, isCurrent, capture: () => create(editor.value?.state), get(command) {
      const instance = editor.value
      const key = command.kind === 'mark' ? command.mark : command.kind
      const shortcut = options.shortcuts()?.[key as keyof EditorShortcuts] ?? shortcuts[key]
      const label = command.kind === 'heading' ? `${text('heading')} ${command.level}` : text(key)
      const active = !!instance && (command.kind === 'mark' ? instance.isActive(command.mark) : command.kind === 'heading' ? instance.isActive('heading', { level: command.level }) : instance.isActive(command.kind))
      const disabled = !!pendingAction.value || !instance || !isCurrent() || !options.enabled() || !execute(instance, command, true, undefined, options)
      const available = !(['image', 'file', 'video'] as string[]).includes(command.kind) || options.mediaEnabled(command.kind as 'image' | 'file' | 'video')
      return { id: command.kind === 'heading' ? `heading-${command.level}` : key, label, shortcut: shortcut ? formatShortcut(shortcut) : undefined, active, disabled, pending: pendingAction.value === key, available,
        value: command.kind === 'link' && instance ? instance.getAttributes('link').href : undefined,
        async run() {
          const current = editor.value
          if (!current || pendingAction.value || !isCurrent() || !options.enabled() || !execute(current, command, true, undefined, options)) return false
          if (['undo', 'redo', 'image', 'file', 'video', 'insert'].includes(command.kind)) return execute(current, command, false, undefined, options)
          const transaction = buildEditorCommandTransaction(current, command)
          if (!transaction) return false
          // Formatting at an empty caret changes the marks for subsequent
          // typing, not the document. It must not enter structural validation.
          if (!transaction.docChanged && transaction.storedMarksSet) {
            current.view.dispatch(transaction)
            current.view.focus()
            return true
          }
          pendingAction.value = key
          try { return (await commitEditorTransaction(current, transaction, options.context)).ok }
          finally { pendingAction.value = undefined }
        },
      }
    } }
    }
    return create()
  })
  return actions
}
