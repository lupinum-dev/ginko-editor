// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { mount as mountVue } from '@vue/test-utils'
import GinkoEditor from '../src/GinkoEditor.vue'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDocumentExtensions } from '../src/lib/config/documentConfig'
import { createEditorCollaboration, CollaborationConnectionError, type CollaborationRecovery } from '../src/collaboration'
import { applyCollaborationSteps, createCollaborationSnapshot, fenceMismatch, SetNodePropertyStep,
  type CollaborationHead, type CollaborationSnapshot, type CollaborationTransport, type CollaborationReply } from '../src/runtime'
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'
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
const policy: PortableComponentPolicyV2 = { version: 2, components: {
  note: { kind: 'block', props: {
    title: { types: ['string'], required: true, allowedValues: null },
    tone: { types: ['string'], required: false, allowedValues: ['info', 'warning'] },
  }, slots: ['default'], allowedParents: null, allowedChildren: null, media: null },
} }

async function server(source = '<note title="Original">\nBody.\n</note>') {
  const content = { epoch: 'epoch-1', policyRevision: 'notes-1', policy }
  let checkpoint = await createCollaborationSnapshot(source, content)
  const entries: { step: string; clientId: string }[] = []
  const subscribers = new Set<(head: CollaborationHead) => void>()
  let tail = Promise.resolve()
  let pullLimit = 128
  function read(head: CollaborationHead): CollaborationReply {
    const mismatch = fenceMismatch(head, checkpoint.snapshot)
    if (mismatch) return { status: 'stale', head: checkpoint.snapshot, reason: mismatch }
    const rows = entries.slice(head.version, head.version + pullLimit)
    return { status: 'ok', update: { ...checkpoint.snapshot, fromVersion: head.version,
      version: head.version + rows.length, steps: rows.map(row => row.step), clientIds: rows.map(row => row.clientId) } }
  }
  return {
    get snapshot() { return checkpoint.snapshot },
    get markdown() { return checkpoint.markdown },
    set pullLimit(value: number) { pullLimit = value },
    async replace() {
      checkpoint = await createCollaborationSnapshot('Replaced.', { ...content, epoch: 'epoch-2' })
      entries.splice(0)
      for (const notify of subscribers) notify(checkpoint.snapshot)
    },
    client() {
      const connection = { online: true, deny: false, loseAcknowledgement: false }
      function connected() {
        if (!connection.online) throw new CollaborationConnectionError()
        if (connection.deny) throw new Error('Access denied.')
      }
      const transport: CollaborationTransport = {
        subscribe(onHead) { subscribers.add(onHead); onHead(checkpoint.snapshot); return () => { subscribers.delete(onHead) } },
        async pull(head) { connected(); return read(head) },
        async push(batch) {
          connected()
          const result = tail.then(async () => {
            connected()
            if (!fenceMismatch(batch, checkpoint.snapshot) && batch.version === checkpoint.snapshot.version) {
              checkpoint = await applyCollaborationSteps(checkpoint.snapshot, batch, content)
              entries.push(...batch.steps.map(step => ({ step, clientId: batch.clientId })))
              for (const notify of subscribers) notify(checkpoint.snapshot)
            }
            if (connection.loseAcknowledgement) {
              connection.loseAcknowledgement = false
              throw new CollaborationConnectionError('The acknowledgement was lost.')
            }
            return read(batch)
          })
          tail = result.then(() => {}, () => {})
          return result
        },
      }
      return { connection, transport }
    },
  }
}

async function mount(snapshot: CollaborationSnapshot, transport: CollaborationTransport, clientId: string, recovery?: CollaborationRecovery) {
  let saved: CollaborationRecovery | null = null
  const session = createEditorCollaboration({ snapshot, transport, clientId, recovery,
    onRecovery: value => { saved = structuredClone(value) } })
  const editor = new Editor({ element: document.createElement('div'), content: session.initialDocument,
    extensions: [...createDocumentExtensions(), session.extension] })
  editors.push(editor)
  await vi.waitFor(() => expect(editor.isInitialized).toBe(true))
  await session.flush()
  return { editor, session, get recovery() { return saved } }
}

describe('collaborative editor lifecycle', () => {
  it('binds the Vue canvas to the shared document and treats source as a read-only projection', async () => {
    const backend = await server('Shared body.')
    const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/session', transport: backend.client().transport })
    const wrapper = mountVue(GinkoEditor, { props: { modelValue: 'Wrong host source.', collaboration: session } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.vm.editor?.isInitialized).toBe(true))
    await session.flush()
    expect(wrapper.vm.editor?.getText()).toBe('Shared body.')
    await wrapper.setProps({ modelValue: 'A stale host checkpoint.' })
    expect(wrapper.vm.editor?.getText()).toBe('Shared body.')
    wrapper.vm.editor!.commands.insertContent('New ')
    expect((await wrapper.vm.flush()).ok).toBe(true)
    expect(backend.markdown.trim()).toBe('New Shared body.')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(backend.markdown)
    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    const source = wrapper.get('textarea')
    expect(source.attributes('readonly')).toBeDefined()
    await source.setValue('Must not replace the room.')
    expect(wrapper.vm.editor?.getText()).toBe('New Shared body.')
    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    expect(wrapper.vm.editor?.getText()).toBe('New Shared body.')
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
    await vi.waitFor(() => expect(wrapper.vm.editor?.isInitialized).toBe(true))
    await session.flush()
    const editor = wrapper.vm.editor!
    editor.commands.setNodeSelection(0)
    editor.registerPlugin(new Plugin({ filterTransaction: transaction => !transaction.docChanged }))
    expect(wrapper.vm.insertImageAsset({ url: '/replacement.png' })).toBe(false)
    expect(editor.state.doc.firstChild?.attrs.props.src).toBe('/original.png')
  })

  it.each(['image-first', 'description-first'])('preserves an image description through asset replacement: %s', async order => {
    const backend = await server('![Original](/original.png)')
    const imageClient = backend.client(), descriptionClient = backend.client()
    const session = createEditorCollaboration({ snapshot: backend.snapshot, clientId: 'alice/session', transport: imageClient.transport })
    const wrapper = mountVue(GinkoEditor, { props: { modelValue: '', collaboration: session } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.vm.editor?.isInitialized).toBe(true))
    await session.flush()
    const description = await mount(backend.snapshot, descriptionClient.transport, 'bob/session')
    imageClient.connection.online = descriptionClient.connection.online = false
    wrapper.vm.editor!.commands.setNodeSelection(0)
    expect(wrapper.vm.insertImageAsset({ url: '/replacement.png' })).toBe(true)
    description.editor.view.dispatch(description.editor.state.tr.step(new SetNodePropertyStep(0, 'alt', 'A useful description')))
    const participants = [{ connection: imageClient.connection, session }, { connection: descriptionClient.connection, session: description.session }]
    if (order === 'description-first') participants.reverse()
    for (const participant of participants) {
      participant.connection.online = true
      participant.session.retry()
      await participant.session.flush()
    }
    await vi.waitFor(() => expect(wrapper.vm.editor!.getJSON()).toEqual(description.editor.getJSON()))
    expect(wrapper.vm.editor!.state.doc.firstChild?.attrs.props).toMatchObject({ src: '/replacement.png', alt: 'A useful description' })
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
