// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Transform } from '@tiptap/pm/transform'
import { collab, receiveTransaction } from 'prosemirror-collab'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDocumentExtensions } from '../src/lib/config/documentConfig'
import { collaborationColor, createEditorCollaboration, type CollaborationPeer, type EditorCollaborationOptions } from '../src/collaboration'
import { createEditorSchema, readCollaborationPresence, type CollaborationPresenceChannel, type CollaborationPresenceUpdate,
  type CollaborationTransport } from '../src/runtime'
import { ConfirmedHistory, PresenceTracker, toConfirmedSelection, toLocalSelection } from '../src/lib/collaboration/presence'
import { presenceHub, server } from './collaboration-server'

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const editors: Editor[] = []
afterEach(() => { vi.useRealTimers(); editors.splice(0).forEach(editor => editor.destroy()) })

const schema = createEditorSchema()
const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('Hello world'))])

function update(overrides: Partial<CollaborationPresenceUpdate> = {}): CollaborationPresenceUpdate {
  return { protocolVersion: 1, clientId: 'bob/1', user: { name: 'Bob' }, epoch: 'epoch-1', version: 0,
    selection: { anchor: 7, head: 12 }, updatedAt: Date.now(), ...overrides }
}

async function open(backend: Awaited<ReturnType<typeof server>>, channel: CollaborationPresenceChannel | undefined, clientId: string,
  extra: Partial<EditorCollaborationOptions> = {}) {
  const client = backend.client()
  const transport: CollaborationTransport = { ...client.transport, ...(channel ? { presence: channel } : {}) }
  const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId, transport, ...extra })
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({ element, content: session.initialDocument, extensions: [...createDocumentExtensions(), session.extension] })
  editors.push(editor)
  await session.flush()
  return { editor, session, connection: client.connection }
}

describe('presence position mapping', () => {
  it('maps a remote selection through local unconfirmed steps and back', () => {
    let state = EditorState.create({ doc, plugins: [collab({ version: 0, clientID: 'alice' })] })
    state = state.apply(state.tr.insertText('Big ', 1))
    const history = new ConfirmedHistory(0)
    // Bob selected "world" (7..12) in the confirmed document.
    expect(toLocalSelection(state, history, { anchor: 7, head: 12 }, 0, 256)).toEqual({ anchor: 11, head: 16 })
    expect(state.doc.textBetween(11, 16)).toBe('world')
    // Alice's own caret inside her unconfirmed text maps to the insertion point.
    const local = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)))
    expect(toConfirmedSelection(local, doc.content.size)).toEqual({ anchor: 1, head: 1 })
    const after = local.apply(local.tr.setSelection(TextSelection.create(local.doc, 13)))
    expect(toConfirmedSelection(after, doc.content.size)).toEqual({ anchor: 9, head: 9 })
  })

  it('maps an older remote version through received history and hides newer or distant versions', () => {
    let state = EditorState.create({ doc, plugins: [collab({ version: 0, clientID: 'alice' })] })
    const remote = new Transform(doc).insert(1, schema.text('Hey '))
    state = state.apply(receiveTransaction(state, remote.steps, ['carol']))
    const history = new ConfirmedHistory(0)
    history.append(0, remote.mapping.maps)
    expect(toLocalSelection(state, history, { anchor: 7, head: 12 }, 0, 256)).toEqual({ anchor: 11, head: 16 })
    expect(toLocalSelection(state, history, { anchor: 1, head: 1 }, 2, 256)).toBeNull()
    expect(toLocalSelection(state, history, { anchor: 1, head: 1 }, 0, 0)).toBeNull()
    expect(toLocalSelection(state, new ConfirmedHistory(1), { anchor: 1, head: 1 }, 0, 256)).toBeNull()
    expect(toLocalSelection(state, history, { anchor: 900, head: 900 }, 1, 256)).toEqual({ anchor: state.doc.content.size, head: state.doc.content.size })
  })

  it('rejects malformed presence records and unsafe colors', () => {
    expect(readCollaborationPresence(update())).toMatchObject({ user: { name: 'Bob', color: collaborationColor('bob/1') } })
    expect(readCollaborationPresence({ ...update(), protocolVersion: 2 })).toBeNull()
    expect(readCollaborationPresence({ ...update(), selection: { anchor: -1, head: 2 } })).toBeNull()
    expect(readCollaborationPresence({ ...update(), version: 1.5 })).toBeNull()
    expect(readCollaborationPresence(update({ user: { name: 'B', color: 'red;background:url(x)' } }))?.user.color).toBe(collaborationColor('bob/1'))
    expect(readCollaborationPresence(update({ user: { name: 'B', color: '#12abef' } }))?.user.color).toBe('#12abef')
    expect(readCollaborationPresence(update({ user: { name: ' x'.repeat(100) } }))?.user.name.length).toBeLessThanOrEqual(64)
    expect(collaborationColor('alice/1')).toBe(collaborationColor('alice/1'))
  })
})

describe('presence tracker timing', () => {
  function tracker(channel: CollaborationPresenceChannel, getState: () => EditorState) {
    return new PresenceTracker({ clientId: 'alice/1', epoch: 'epoch-1', channel, user: { name: 'Alice' }, history: new ConfirmedHistory(0),
      getState, getConfirmedSize: () => doc.content.size, redraw: () => {} })
  }

  it('throttles selection updates, sends heartbeats and leaves on stop', () => {
    vi.useFakeTimers()
    const published: CollaborationPresenceUpdate[] = []
    const left: string[] = []
    let state = EditorState.create({ doc, plugins: [collab({ version: 0, clientID: 'alice/1' })] })
    const presence = tracker({ publish: value => { published.push(value) }, subscribe: () => () => {}, leave: id => { left.push(id) } }, () => state)
    presence.start()
    vi.advanceTimersByTime(0)
    expect(published).toHaveLength(1)
    for (let position = 2; position < 10; position++) {
      state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, position)))
      presence.changed()
      vi.advanceTimersByTime(10)
    }
    expect(published).toHaveLength(1)
    vi.advanceTimersByTime(100)
    expect(published).toHaveLength(2)
    expect(published[1]!.selection).toEqual({ anchor: 9, head: 9 })
    presence.changed()
    vi.advanceTimersByTime(200)
    expect(published).toHaveLength(2)
    vi.advanceTimersByTime(10_000)
    expect(published).toHaveLength(3)
    presence.stop()
    expect(left).toEqual(['alice/1'])
  })

  it('expires peers that stop updating and ignores its own record', () => {
    vi.useFakeTimers()
    let deliver: (updates: readonly CollaborationPresenceUpdate[]) => void = () => {}
    const state = EditorState.create({ doc, plugins: [collab({ version: 0, clientID: 'alice/1' })] })
    const presence = tracker({ publish: () => {}, subscribe: callback => { deliver = callback; return () => {} } }, () => state)
    const seen: (readonly CollaborationPeer[])[] = []
    presence.onPeersChange(peers => { seen.push(peers) })
    presence.start()
    deliver([update(), update({ clientId: 'alice/1' }), update({ clientId: 'old/1', epoch: 'epoch-0' })])
    expect(presence.peers.map(peer => peer.clientId)).toEqual(['bob/1'])
    vi.advanceTimersByTime(20_000)
    deliver([update()])
    vi.advanceTimersByTime(15_000)
    expect(presence.peers).toHaveLength(1)
    vi.advanceTimersByTime(20_000)
    expect(presence.peers).toHaveLength(0)
    expect(seen.at(-1)).toEqual([])
    presence.stop()
  })
})

describe('remote carets in the editor', () => {
  it('renders mapped carets and selections with hidden labels and exposes peers', async () => {
    const backend = await server('Hello world')
    const hub = presenceHub()
    const alice = await open(backend, hub.channel(), 'alice/1', { user: { name: 'Alice', color: '#aa3300' } })
    const bob = await open(backend, hub.channel(), 'bob/1', { user: { name: 'Bob' } })
    const lists: string[][] = []
    const stop = bob.session.onPeersChange(peers => { lists.push(peers.map(peer => peer.user.name)) })
    alice.editor.commands.setTextSelection({ from: 7, to: 12 })
    await vi.waitFor(() => expect(bob.editor.view.dom.querySelector('.ginko-collab-selection')?.textContent).toBe('world'))
    const caret = bob.editor.view.dom.querySelector('.ginko-collab-caret') as HTMLElement
    expect(caret.getAttribute('aria-hidden')).toBe('true')
    expect(caret.getAttribute('contenteditable')).toBe('false')
    expect(caret.style.getPropertyValue('--ginko-collab-color')).toBe('#aa3300')
    expect(caret.querySelector('.ginko-collab-caret__label')?.textContent).toBe('Alice')
    expect(bob.session.peers).toMatchObject([{ clientId: 'alice/1', user: { name: 'Alice' }, selection: { anchor: 7, head: 12 } }])
    expect(lists.at(-1)).toEqual(['Alice'])
    // Bob's unsent text before Alice's selection moves her highlight in Bob's view only.
    bob.connection.online = false
    bob.editor.commands.insertContentAt(1, 'Big ')
    await vi.waitFor(() => expect(bob.editor.view.dom.querySelector('.ginko-collab-selection')?.textContent).toBe('world'))
    expect(bob.editor.getText()).toBe('Big Hello world')
    expect(hub.records.get('bob/1')?.version).toBe(0)
    // Alice sees Bob's caret at the confirmed position before his unsent text.
    await vi.waitFor(() => expect(hub.records.get('bob/1')?.selection).toEqual({ anchor: 1, head: 1 }))
    stop()
    alice.session.close()
    await vi.waitFor(() => expect(bob.editor.view.dom.querySelector('.ginko-collab-caret')).toBeNull())
    expect(bob.session.peers).toEqual([])
  })

  it('keeps editing working when the presence channel fails', async () => {
    const backend = await server('Hello world')
    const failing: CollaborationPresenceChannel = {
      publish: () => Promise.reject(new Error('Presence down')),
      subscribe: () => { throw new Error('Presence down') },
    }
    const alice = await open(backend, failing, 'alice/1', { user: { name: 'Alice' } })
    alice.editor.commands.insertContentAt(1, 'Still ')
    await alice.session.flush()
    expect(backend.markdown.trim()).toBe('Still Hello world')
    expect(alice.session.peers).toEqual([])
  })

  it('does not publish without a user or when presence is off', async () => {
    const backend = await server('Hello world')
    const hub = presenceHub()
    const viewer = await open(backend, hub.channel(), 'viewer/1')
    await open(backend, hub.channel(), 'off/1', { user: { name: 'Off' }, presence: false })
    viewer.editor.commands.setTextSelection(3)
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(hub.published).toEqual([])
  })
})
