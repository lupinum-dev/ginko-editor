// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { mount as mountVue } from '@vue/test-utils'
import GinkoEditor from '../src/GinkoEditor.vue'
import { insertAsset } from './helpers/assets'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDocumentExtensions } from '../src/lib/config/documentConfig'
import { createEditorCollaboration, parseCollaborationRecovery, readCollaborationRecovery, CollaborationConnectionError, CollaborationError,
  type CollaborationRecovery, type EditorCollaborationOptions } from '../src/collaboration'
import { SetNodePropertyStep, type CollaborationHead, type CollaborationSnapshot, type CollaborationTransport } from '../src/runtime'
import { server } from './collaboration-server'
import { applyTableOperation } from '../src/lib/nodeviews/table-operations'
import { TableMap } from '@tiptap/pm/tables'
import { Plugin } from '@tiptap/pm/state'

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const editors: Editor[] = []
const wrappers: ReturnType<typeof mountVue<typeof GinkoEditor>>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); editors.splice(0).forEach(editor => editor.destroy()) })

async function mount(snapshot: CollaborationSnapshot, transport: CollaborationTransport, clientId: string, recovery?: CollaborationRecovery,
  extra: Partial<EditorCollaborationOptions> = {}) {
  let saved: CollaborationRecovery | null = null
  const session = createEditorCollaboration({ snapshot, transport, clientId, recovery,
    onRecovery: value => { saved = structuredClone(value) }, ...extra })
  const editor = new Editor({ element: document.createElement('div'), content: session.initialDocument,
    extensions: [...createDocumentExtensions(), session.extension] })
  editors.push(editor)
  await vi.waitFor(() => expect(editor.isInitialized).toBe(true))
  await session.flush()
  // Recovery writes are throttled; reading the host copy first writes pending changes.
  return { editor, session, get recovery() { session.flushRecovery(); return saved } }
}

describe('collaborative editor lifecycle', () => {
  it('binds the Vue canvas to the shared document and treats source as a read-only projection', async () => {
    const backend = await server('Shared body.')
    const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/session', transport: backend.client().transport })
    const wrapper = mountVue(GinkoEditor, { props: { modelValue: 'Wrong host source.', collaboration: session } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.vm.getEditor()?.isInitialized).toBe(true))
    await session.flush()
    expect(wrapper.vm.getEditor()?.getText()).toBe('Shared body.')
    await wrapper.setProps({ modelValue: 'A stale host checkpoint.' })
    expect(wrapper.vm.getEditor()?.getText()).toBe('Shared body.')
    wrapper.vm.getEditor()!.commands.insertContent('New ')
    expect((await wrapper.vm.flush()).ok).toBe(true)
    expect(backend.markdown.trim()).toBe('New Shared body.')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(backend.markdown)
    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    const source = wrapper.get('textarea')
    expect(source.attributes('readonly')).toBeDefined()
    await source.setValue('Must not replace the room.')
    expect(wrapper.vm.getEditor()?.getText()).toBe('New Shared body.')
    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    expect(wrapper.vm.getEditor()?.getText()).toBe('New Shared body.')
  })

  it('converges concurrent body and independent property edits and preserves remote text on Undo', async () => {
    const backend = await server()
    const a = await mount(backend.snapshot, backend.client().transport, 'alice/session')
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    a.editor.view.dispatch(a.editor.state.tr.step(new SetNodePropertyStep(0, 'title', 'Alice')).insertText('A ', 2))
    b.editor.view.dispatch(b.editor.state.tr.step(new SetNodePropertyStep(0, 'tone', 'warning')).insertText('B ', 2))
    await Promise.all([a.session.flush(), b.session.flush()])
    await vi.waitFor(() => expect(a.editor.getJSON()).toEqual(b.editor.getJSON()))
    expect(a.editor.state.doc.firstChild?.attrs.props).toMatchObject({ title: 'Alice', tone: 'warning' })
    expect(a.editor.getText()).toContain('A ')
    expect(a.editor.getText()).toContain('B ')
    a.editor.commands.undo()
    await a.session.flush()
    await vi.waitFor(() => expect(a.editor.getJSON()).toEqual(b.editor.getJSON()))
    expect(a.editor.getText()).toContain('B ')
    expect(a.editor.getText()).not.toContain('A ')
    expect(a.editor.state.doc.firstChild?.attrs.props.tone).toBe('warning')
  })

  it('recovers an accepted batch after a lost acknowledgement without duplicating it', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    client.connection.loseAcknowledgement = true
    a.editor.commands.insertContent('Once ')
    await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
    expect(a.recovery?.steps.length).toBeGreaterThan(0)
    a.session.retry()
    await a.session.flush()
    expect(a.editor.getText()).toBe('Once Body.')
    expect(backend.markdown.trim()).toBe('Once Body.')
    expect(a.recovery).toBeNull()
  })

  it('preserves another writer’s cell text when adding a row and keeps shared layout fixed', async () => {
    const backend = await server('| Name | Value |\n| --- | --- |\n| One | Two |')
    const a = await mount(backend.snapshot, backend.client().transport, 'alice/session')
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    const table = b.editor.state.doc.firstChild!, map = TableMap.get(table)
    b.editor.view.dispatch(b.editor.state.tr.insertText('New ', 1 + map.map[2] + 2))
    expect(applyTableOperation(a.editor, 0, { type: 'add', axis: 'row', index: 1 })).toBe(true)
    await Promise.all([a.session.flush(), b.session.flush()])
    await vi.waitFor(() => expect(a.editor.getJSON()).toEqual(b.editor.getJSON()))
    expect(a.editor.getText()).toContain('New One')
    expect(applyTableOperation(a.editor, 0, { type: 'align', from: 0, to: 1, value: 'right' })).toBe(false)
    expect(applyTableOperation(a.editor, 0, { type: 'move', axis: 'row', from: 1, to: 2, direction: 1 })).toBe(false)
    expect(applyTableOperation(a.editor, 0, { type: 'add', axis: 'column', index: 1 })).toBe(false)
  })

  it('reports a refused media replacement without acknowledging the picker result', async () => {
    const backend = await server('![Original](/original.png)')
    const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/session', transport: backend.client().transport })
    const wrapper = mountVue(GinkoEditor, { props: { modelValue: '', collaboration: session } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.vm.getEditor()?.isInitialized).toBe(true))
    await session.flush()
    const editor = wrapper.vm.getEditor()!
    editor.commands.setNodeSelection(0)
    editor.registerPlugin(new Plugin({ filterTransaction: transaction => !transaction.docChanged }))
    expect(insertAsset(wrapper, 'image', { url: '/replacement.png' })).toBe(false)
    expect(editor.state.doc.firstChild?.attrs.props.src).toBe('/original.png')
  })

  it.each(['image-first', 'description-first'])('preserves an image description through asset replacement: %s', async order => {
    const backend = await server('![Original](/original.png)')
    const imageClient = backend.client(), descriptionClient = backend.client()
    const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/session', transport: imageClient.transport })
    const wrapper = mountVue(GinkoEditor, { props: { modelValue: '', collaboration: session } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.vm.getEditor()?.isInitialized).toBe(true))
    await session.flush()
    const description = await mount(backend.snapshot, descriptionClient.transport, 'bob/session')
    imageClient.connection.online = descriptionClient.connection.online = false
    wrapper.vm.getEditor()!.commands.setNodeSelection(0)
    expect(insertAsset(wrapper, 'image', { url: '/replacement.png' })).toBe(true)
    description.editor.view.dispatch(description.editor.state.tr.step(new SetNodePropertyStep(0, 'alt', 'A useful description')))
    const participants = [{ connection: imageClient.connection, session }, { connection: descriptionClient.connection, session: description.session }]
    if (order === 'description-first') participants.reverse()
    for (const participant of participants) {
      participant.connection.online = true
      participant.session.retry()
      await participant.session.flush()
    }
    await vi.waitFor(() => expect(wrapper.vm.getEditor()!.getJSON()).toEqual(description.editor.getJSON()))
    expect(wrapper.vm.getEditor()!.state.doc.firstChild?.attrs.props).toMatchObject({ src: '/replacement.png', alt: 'A useful description' })
    expect(backend.markdown).toContain('![A useful description](/replacement.png)')
  })

  it('does not split a multi-step transaction at a network batch boundary', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const batches: number[] = []
    const transport: CollaborationTransport = { ...client.transport, push(batch) {
      batches.push(batch.steps.length)
      return client.transport.push(batch)
    } }
    const a = await mount(backend.snapshot, transport, 'alice/session')
    for (let index = 0; index < 127; index++) a.editor.commands.insertContent('x')
    a.editor.view.dispatch(a.editor.state.tr.insertText('A', 1).insertText('B', 2))
    expect(a.recovery?.groups.at(-1)).toBe(2)
    await a.session.flush()
    expect(batches).toEqual([127, 2])
    expect(backend.markdown).toContain('AB')
  })

  it('stops before creating an escaped recovery copy that cannot reopen', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    client.connection.online = false
    const text = '\\'.repeat(120_000)
    for (let index = 0; index < 9; index++) {
      a.editor.view.dispatch(a.editor.state.tr.insertText(text, 1, a.editor.state.doc.content.size - 1))
    }
    expect(a.session.state.message).toContain('size limit')
    const recovery = a.recovery!
    expect(recovery.steps.length).toBeLessThan(9)
    expect(new TextEncoder().encode(JSON.stringify(recovery)).byteLength).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(() => createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'unused', transport: client.transport, recovery }))
      .not.toThrow()
  })

  it('can reopen a recovery enlarged by accepted remote text', async () => {
    const backend = await server('Left.\n\nRight.')
    const client = backend.client()
    let blockPush = false
    const transport: CollaborationTransport = { ...client.transport, push(batch) {
      if (blockPush) return Promise.reject(new CollaborationConnectionError())
      return client.transport.push(batch)
    } }
    const a = await mount(backend.snapshot, transport, 'alice/session')
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    client.connection.online = false
    const value = '"'.repeat(120_000)
    for (let index = 0; index < 7; index++) {
      a.editor.view.dispatch(a.editor.state.tr.insertText(value, 1, a.editor.state.doc.firstChild!.nodeSize - 1))
    }
    expect(new TextEncoder().encode(JSON.stringify(a.recovery)).byteLength).toBeLessThan(4 * 1024 * 1024)
    b.editor.view.dispatch(b.editor.state.tr.insertText(value, b.editor.state.doc.firstChild!.nodeSize + 1))
    await b.session.flush()
    client.connection.online = true
    blockPush = true
    a.session.retry()
    await vi.waitFor(() => expect(a.session.state.version).toBe(b.session.state.version))
    const recovery = a.recovery!
    expect(new TextEncoder().encode(JSON.stringify(recovery)).byteLength).toBeGreaterThan(4 * 1024 * 1024)
    expect(() => createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'unused', transport, recovery })).not.toThrow()
  })

  it('restores host-persisted pending changes and rebases them over later server edits', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    client.connection.online = false
    a.editor.commands.insertContent('Offline ')
    await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
    const recovery = a.recovery!
    a.editor.destroy()
    b.editor.commands.insertContent('Online ')
    await b.session.flush()
    const restored = await mount(backend.snapshot, backend.client().transport, 'unused-new-id', recovery)
    await vi.waitFor(() => expect(restored.editor.getJSON()).toEqual(b.editor.getJSON()))
    expect(restored.editor.getText()).toContain('Offline ')
    expect(restored.editor.getText()).toContain('Online ')
    expect(restored.recovery).toBeNull()
  })

  it('reads all history pages before sending its pending changes', async () => {
    const backend = await server('Body.')
    backend.pullLimit = 1
    const initial = backend.snapshot
    const a = await mount(initial, backend.client().transport, 'alice/session')
    for (let i = 0; i < 4; i++) { a.editor.commands.insertContent(String(i)); await a.session.flush() }
    const b = await mount(initial, backend.client().transport, 'bob/session')
    expect(b.editor.getText()).toBe(a.editor.getText())
    expect(b.session.state.version).toBe(4)
  })

  it('fences replaced documents and keeps pending edits available for recovery', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    client.connection.online = false
    a.editor.commands.insertContent('Keep ')
    await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
    await backend.replace()
    expect(a.session.state.status).toBe('stale')
    expect(a.session.canEdit).toBe(false)
    await expect(a.session.flush()).rejects.toThrow(/recovery/)
    expect(a.recovery?.document).toContain('Keep Body.')
    a.editor.commands.insertContent('Blocked ')
    expect(a.editor.getText()).toBe('Keep Body.')
    expect(() => createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/new', transport: client.transport, recovery: a.recovery! }))
      .toThrow(/older document/)
  })

  it('stops on authorization errors and a flush timeout keeps the unsent document', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    client.connection.online = false
    a.editor.commands.insertContent('Keep ')
    await expect(a.session.flush(30)).rejects.toThrow(/waiting for the server/)
    client.connection.online = true
    client.connection.deny = true
    a.session.retry()
    await expect(a.session.flush()).rejects.toThrow(/Access denied/)
    expect(a.session.canEdit).toBe(false)
    expect(a.recovery?.document).toContain('Keep Body.')
  })

  it('can retry when an older transport request never settles', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    let stalled = false
    const transport: CollaborationTransport = { ...client.transport,
      pull: head => stalled ? new Promise(() => {}) : client.transport.pull(head),
    }
    const a = await mount(backend.snapshot, transport, 'alice/session')
    stalled = true
    a.editor.commands.insertContent('Keep ')
    await expect(a.session.flush(80)).rejects.toThrow(/waiting for the server/)
    stalled = false
    a.session.retry()
    await a.session.flush()
    expect(backend.markdown.trim()).toBe('Keep Body.')
    expect(a.recovery).toBeNull()
  })

  it('ignores callbacks already queued by an obsolete subscription', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    let oldError: ((error: unknown) => void) | undefined
    let oldHead: ((head: CollaborationHead) => void) | undefined
    const transport: CollaborationTransport = { ...client.transport,
      subscribe(onHead, onError) {
        oldHead ??= onHead
        oldError ??= onError
        return client.transport.subscribe(onHead, onError)
      },
    }
    const a = await mount(backend.snapshot, transport, 'alice/session')
    a.session.retry()
    await a.session.flush()
    oldError!(new Error('Obsolete failure'))
    oldHead!({ ...backend.snapshot, epoch: 'obsolete-epoch' })
    expect(a.session.state.status).toBe('synced')
    expect(a.session.canEdit).toBe(true)
  })
})


describe('host recovery parser', () => {
  it('checks storage shape before returning a typed recovery copy', async () => {
    const room = await server('Body.')
    const copy: CollaborationRecovery = { format: 1, clientId: 'user/session', base: room.snapshot,
      document: room.snapshot.document, steps: [], groups: [] }
    expect(parseCollaborationRecovery(JSON.stringify(copy))).toEqual(copy)
    for (const invalid of [null, [], {}, { ...copy, steps: [null] }, { ...copy, groups: ['1'] },
      { ...copy, base: { ...copy.base, version: '0' } }]) {
      expect(() => parseCollaborationRecovery(JSON.stringify(invalid))).toThrow(/recovery/)
    }
  })
})

function bare(options: EditorCollaborationOptions) {
  const session = createEditorCollaboration(options)
  const editor = new Editor({ element: document.createElement('div'), content: session.initialDocument,
    extensions: [...createDocumentExtensions(), session.extension] })
  editors.push(editor)
  return { session, editor }
}

describe('collaboration failure handling', () => {
  it('reports a rejected push with a code and discards the pending changes on request', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    let reject = true
    const discarded: CollaborationRecovery[] = []
    const transport: CollaborationTransport = { ...client.transport, push(batch) {
      if (reject) return Promise.reject(new CollaborationError('content', 'The document is outside the host content policy.'))
      return client.transport.push(batch)
    } }
    const a = await mount(backend.snapshot, transport, 'alice/session', undefined, { onDiscard: value => { discarded.push(value) } })
    a.editor.commands.insertContent('Refused ')
    await vi.waitFor(() => expect(a.session.state).toMatchObject({ status: 'error', code: 'rejected' }))
    const failure = await a.session.flush().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CollaborationError)
    expect(failure).toMatchObject({ code: 'content' })
    expect(a.session.canEdit).toBe(false)
    reject = false
    const removed = a.session.discardPendingAndResync()
    expect(removed?.document).toContain('Refused Body.')
    expect(discarded).toHaveLength(1)
    expect(a.editor.getText()).toBe('Body.')
    await a.session.flush()
    expect(a.session.state).toMatchObject({ status: 'synced', pendingSteps: 0 })
    expect(a.recovery).toBeNull()
    a.editor.commands.insertContentAt(1, 'Accepted ')
    await a.session.flush()
    expect(backend.markdown.trim()).toBe('Accepted Body.')
  })

  it('keeps pending changes when the host cannot store the discarded copy', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session', undefined, { onDiscard: () => { throw new Error('Storage full') } })
    client.connection.online = false
    a.editor.commands.insertContent('Keep ')
    expect(() => a.session.discardPendingAndResync()).toThrow(/Storage full/)
    expect(a.editor.getText()).toBe('Keep Body.')
    expect(a.session.getRecovery()?.steps).toHaveLength(1)
  })

  it('treats a discarded batch that the server accepted late as ordinary history', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    client.connection.loseAcknowledgement = true
    a.editor.commands.insertContent('Late ')
    await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
    expect(a.session.discardPendingAndResync()).not.toBeNull()
    await a.session.flush()
    await b.session.flush()
    await vi.waitFor(() => expect(a.editor.getJSON()).toEqual(b.editor.getJSON()))
    expect(a.editor.getText()).toBe('Late Body.')
    a.editor.commands.insertContentAt(1, 'Next ')
    await a.session.flush()
    expect(backend.markdown.trim()).toBe('Next Late Body.')
  })

  it.each([
    ['HTTP 503', Object.assign(new Error('Service unavailable'), { status: 503 }), 'offline', 'unavailable'],
    ['fetch failure', new TypeError('Failed to fetch'), 'offline', 'unavailable'],
    ['unavailable code', new CollaborationError('unavailable', 'Try again later.'), 'offline', 'unavailable'],
    ['HTTP 403', Object.assign(new Error('Forbidden'), { status: 403 }), 'error', 'forbidden'],
    ['host forbidden code', Object.assign(new Error('Not a member'), { data: { code: 'forbidden', message: 'Not a member' } }), 'error', 'forbidden'],
    ['policy code', new CollaborationError('policy', 'Policy changed.'), 'stale', 'policy_mismatch'],
  ] as const)('classifies %s', async (_name, error, status, code) => {
    const backend = await server('Body.')
    const client = backend.client()
    let failing = true
    const transport: CollaborationTransport = { ...client.transport,
      pull: head => failing ? Promise.reject(error) : client.transport.pull(head) }
    const a = await mount(backend.snapshot, client.transport, 'alice/session')
    const { session, editor } = bare({ snapshot: backend.snapshot, clientId: 'bob/session', transport, backoff: { initialMs: 5, maxMs: 10 } })
    await vi.waitFor(() => expect(session.state).toMatchObject({ status, code }))
    failing = false
    if (status === 'offline') {
      a.editor.commands.insertContent('Remote ')
      await a.session.flush()
      await vi.waitFor(() => expect(editor.getText()).toBe('Remote Body.'))
      expect(session.state.code).toBeUndefined()
    } else {
      await new Promise(resolve => setTimeout(resolve, 30))
      expect(session.state.status).toBe(status)
    }
  })

  it('times out a hung request and retries automatically with jittered backoff', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    let hang = true
    const transport: CollaborationTransport = { ...client.transport,
      pull: head => hang ? new Promise(() => {}) : client.transport.pull(head) }
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      const { session, editor } = bare({ snapshot: backend.snapshot, clientId: 'alice/session', transport,
        requestTimeoutMs: 20, backoff: { initialMs: 10, maxMs: 40 } })
      await vi.waitFor(() => expect(session.state).toMatchObject({ status: 'offline', code: 'timeout' }))
      expect(random).toHaveBeenCalled()
      hang = false
      editor.commands.insertContent('After ')
      await session.flush(2000)
      expect(backend.markdown.trim()).toBe('After Body.')
    } finally {
      random.mockRestore()
    }
  })

  it('cuts a long retry wait short on a new head and on the browser online event', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session', undefined, { backoff: { initialMs: 60_000, maxMs: 60_000 } })
    const random = vi.spyOn(Math, 'random').mockReturnValue(1)
    try {
      client.connection.online = false
      a.editor.commands.insertContent('Queued ')
      await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
      client.connection.online = true
      window.dispatchEvent(new Event('online'))
      await a.session.flush(1000)
      expect(backend.markdown).toContain('Queued')
      client.connection.online = false
      a.editor.commands.insertContent('Again ')
      await vi.waitFor(() => expect(a.session.state.status).toBe('offline'))
      client.connection.online = true
      const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
      b.editor.commands.insertContent('Bob ')
      await b.session.flush()
      await a.session.flush(1000)
      expect(backend.markdown).toContain('Again')
    } finally {
      random.mockRestore()
    }
  })

  it('sends the protocol version and stops on a newer server protocol', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const seen: unknown[] = []
    let newer = false
    const transport: CollaborationTransport = { ...client.transport,
      async pull(head) {
        seen.push(head.protocolVersion)
        const reply = await client.transport.pull(head)
        return newer && reply.status === 'ok' ? { ...reply, update: { ...reply.update, protocolVersion: 2 as never } } : reply
      },
    }
    const a = await mount(backend.snapshot, transport, 'alice/session')
    expect(seen).toContain(1)
    newer = true
    a.editor.commands.insertContent('X')
    await vi.waitFor(() => expect(a.session.state).toMatchObject({ status: 'stale', code: 'schema_mismatch' }))
  })
})

describe('recovery writes', () => {
  it('throttles recovery writes and writes immediately when the page is hidden', async () => {
    const backend = await server('Body.')
    const client = backend.client()
    const writes: (CollaborationRecovery | null)[] = []
    const { session, editor } = bare({ snapshot: backend.snapshot, clientId: 'alice/session', transport: client.transport,
      recoveryDelayMs: 200, onRecovery: value => { writes.push(value) } })
    await session.flush()
    expect(writes).toEqual([])
    client.connection.online = false
    for (const letter of 'typing') editor.commands.insertContent(letter)
    expect(writes).toEqual([])
    await vi.waitFor(() => expect(writes).toHaveLength(1), { timeout: 1000 })
    expect(writes[0]?.document).toContain('typing')
    editor.commands.insertContent('!')
    window.dispatchEvent(new Event('pagehide'))
    expect(writes).toHaveLength(2)
    expect(writes[1]?.document).toContain('typing!')
    editor.commands.insertContent('?')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Reflect.deleteProperty(document, 'visibilityState')
    expect(writes.at(-1)?.document).toContain('typing!?')
    client.connection.online = true
    session.retry()
    await session.flush()
    expect(writes.at(-1)).toBeNull()
  })

  it('writes synchronously with a zero delay and skips remote-only changes', async () => {
    const backend = await server('Body.')
    let writes = 0
    const a = await mount(backend.snapshot, backend.client().transport, 'alice/session', undefined,
      { recoveryDelayMs: 0, onRecovery: () => { writes++ } })
    const b = await mount(backend.snapshot, backend.client().transport, 'bob/session')
    b.editor.commands.insertContent('Remote ')
    await b.session.flush()
    await vi.waitFor(() => expect(a.editor.getText()).toBe('Remote Body.'))
    expect(writes).toBe(0)
    a.editor.commands.insertContent('L')
    expect(writes).toBe(1)
  })

  it('does not serialize the whole document for each typed character', async () => {
    const backend = await server('Body.\n\n' + 'Long paragraph text. '.repeat(400))
    const client = backend.client()
    const a = await mount(backend.snapshot, client.transport, 'alice/session', undefined, { recoveryDelayMs: 10_000 })
    client.connection.online = false
    const prototype = Object.getPrototypeOf(a.editor.state.doc) as { toJSON: () => unknown }
    const original = prototype.toJSON
    let documents = 0
    prototype.toJSON = function (this: { type: { name: string } }) {
      if (this.type.name === 'doc') documents++
      return original.call(this)
    }
    try {
      for (let index = 0; index < 50; index++) a.editor.commands.insertContent('x')
    } finally {
      prototype.toJSON = original
    }
    expect(a.editor.getText()).toContain('x'.repeat(50))
    expect(documents).toBeLessThanOrEqual(3)
  })
})

describe('recovery from another schema revision', () => {
  it('converts an old pending document to Markdown and reports unreadable copies', async () => {
    const backend = await server('Body.')
    const current: CollaborationRecovery = { format: 1, clientId: 'user/session', base: backend.snapshot,
      document: backend.snapshot.document, steps: [], groups: [] }
    expect(await readCollaborationRecovery(JSON.stringify(current))).toMatchObject({ status: 'current' })
    const old = { ...current, base: { ...current.base, schemaRevision: 'ginko-editor-1' },
      document: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Offline draft.' }] }] }) }
    expect(await readCollaborationRecovery(JSON.stringify(old))).toMatchObject({ status: 'converted', schemaRevision: 'ginko-editor-1',
      markdown: expect.stringContaining('Offline draft.') })
    const binding = { ...old, document: JSON.stringify({ type: 'doc', content: [{ type: 'binding', attrs: { value: 'x' } }] }) }
    expect(await readCollaborationRecovery(JSON.stringify(binding))).toMatchObject({ status: 'unreadable', reason: 'content' })
    expect(await readCollaborationRecovery('{')).toMatchObject({ status: 'unreadable', reason: 'format' })
  })
})

it('keeps the retry wait while the writer continues offline', async () => {
  const backend = await server('Body.')
  const client = backend.client()
  let pulls = 0
  const transport = { ...client.transport, pull: (head: Parameters<typeof client.transport.pull>[0]) => { pulls += 1; return client.transport.pull(head) } }
  const session = createEditorCollaboration({ snapshot: backend.snapshot, transport, clientId: 'a/offline', backoff: { initialMs: 60_000, maxMs: 60_000 } })
  const editor = new Editor({ element: document.createElement('div'), content: session.initialDocument, extensions: [...createDocumentExtensions(), session.extension] })
  await vi.waitFor(() => expect(editor.isInitialized).toBe(true))
  await session.flush()
  const random = vi.spyOn(Math, 'random').mockReturnValue(1)
  client.connection.online = false
  editor.commands.insertContent('x')
  await vi.waitFor(() => expect(session.state.status).toBe('offline'))
  const before = pulls
  for (let index = 0; index < 5; index += 1) {
    editor.commands.insertContent('y')
    await new Promise(resolve => setTimeout(resolve, 60))
  }
  expect(pulls - before).toBe(0)
  expect(session.state.status).toBe('offline')
  random.mockRestore()
  editor.destroy()
})
