// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDocumentExtensions } from '../src/lib/config/documentConfig'
import { CollaborationConnectionError, createEditorCollaboration, type EditorCollaborationSession } from '../src/collaboration'
import {
  applyCollaborationSteps, createCollaborationSnapshot, decodeCollaborationDocument, fenceMismatch,
  SetComponentVariantStep, SetNodeAttributeStep, SetNodePropertyStep,
  type CollaborationCheckpoint, type CollaborationHead, type CollaborationReply, type CollaborationTransport,
} from '../src/runtime'

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList
})
const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.useRealTimers(); vi.restoreAllMocks() })

const component: PortableComponentPolicyV2['components'][string] = { kind: 'block', props: {
  title: { types: ['string'], required: true, allowedValues: null },
  tone: { types: ['string'], required: false, allowedValues: ['info', 'warning'] },
}, slots: ['default'], allowedParents: null, allowedChildren: null, media: null }
const policy: PortableComponentPolicyV2 = { version: 2, components: { note: component, tip: component } }
const content = { policy }
// No periods: Content reads text such as "here.De" as a bare domain link and
// refuses it. That is a conversion issue, not a merge issue.
const source = [
  '<note title="Original" tone="info">\nBody text here\n</note>',
  'First paragraph',
  '```ts [a.ts]\nconst x = 1\n```',
  'Last paragraph',
].join('\n\n')

/** Small deterministic PRNG (mulberry32). */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Authority plus a network that delivers requests, replies and head notices in random order. */
async function world(rng: () => number) {
  let checkpoint: CollaborationCheckpoint = await createCollaborationSnapshot(source, { ...content, epoch: 'e1', policyRevision: 'p1' })
  const log: { step: string; clientId: string }[] = []
  const rejected: unknown[] = []
  const heads = new Set<(head: CollaborationHead) => void>()
  const queue: (() => void)[] = []
  let tail = Promise.resolve()
  function read(head: CollaborationHead): CollaborationReply {
    const mismatch = fenceMismatch(head, checkpoint.snapshot)
    if (mismatch) return { status: 'stale', head: checkpoint.snapshot, reason: mismatch }
    const rows = log.slice(head.version, head.version + 16)
    const { epoch, schemaRevision, policyRevision } = checkpoint.snapshot
    return { status: 'ok', update: { epoch, schemaRevision, policyRevision, fromVersion: head.version, version: head.version + rows.length,
      steps: rows.map(row => row.step), clientIds: rows.map(row => row.clientId) } }
  }
  function send<T>(work: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => { queue.push(() => { Promise.resolve().then(work).then(resolve, reject) }) })
  }
  function transport(link: { online: boolean }): CollaborationTransport {
    const offline = () => { if (!link.online) throw new CollaborationConnectionError() }
    return {
      subscribe(onHead) {
        const notify = (head: CollaborationHead) => { queue.push(() => { if (link.online) onHead(head) }) }
        heads.add(notify)
        notify(checkpoint.snapshot)
        return () => { heads.delete(notify) }
      },
      pull: head => send(async () => { offline(); return read(head) }),
      push: batch => send(() => {
        offline()
        const result = tail.then(async () => {
          if (!fenceMismatch(batch, checkpoint.snapshot) && batch.version === checkpoint.snapshot.version) {
            try {
              checkpoint = await applyCollaborationSteps(checkpoint.snapshot, batch, content)
            } catch (error) {
              rejected.push(error)
              throw error
            }
            log.push(...batch.steps.map(step => ({ step, clientId: batch.clientId })))
            for (const notify of heads) notify(checkpoint.snapshot)
          }
          // A lost acknowledgement: accepted, but the client sees a connection failure.
          if (rng() < 0.05) throw new CollaborationConnectionError('The acknowledgement was lost.')
          return read(batch)
        })
        tail = result.then(() => {}, () => {})
        return result
      }),
    }
  }
  return {
    queue, rejected, transport,
    get snapshot() { return checkpoint.snapshot },
    get stepTypes() { return log.map(row => (JSON.parse(row.step) as { stepType: string }).stepType) },
    deliver(count: number) {
      for (let index = 0; index < count && queue.length; index++) queue.splice(Math.floor(rng() * queue.length), 1)[0]!()
    },
  }
}

function textblocks(doc: Node) {
  const blocks: { pos: number; node: Node }[] = []
  doc.descendants((node, pos) => { if (node.isTextblock) blocks.push({ pos, node }) })
  return blocks
}

function edit(editor: Editor, rng: () => number) {
  const pick = <T>(items: readonly T[]) => items[Math.floor(rng() * items.length)]!
  const { state } = editor
  const tr = state.tr
  const blocks = textblocks(state.doc)
  const block = pick(blocks)
  const start = block.pos + 1, size = block.node.content.size
  const element = state.doc.firstChild?.type.name === 'element' ? state.doc.firstChild : undefined
  let code = -1
  state.doc.forEach((node, offset) => { if (node.type.name === 'codeBlock') code = offset })
  switch (pick(['insert', 'insert', 'insert', 'delete', 'bold', 'split', 'property', 'variant', 'attribute'] as const)) {
    case 'insert':
      tr.insertText(pick(['a', 'bc', 'Def', 'x1']), start + Math.floor(rng() * (size + 1)))
      break
    case 'delete': {
      if (size < 2) return
      const from = start + Math.floor(rng() * (size - 1))
      tr.delete(from, Math.min(start + size, from + 1 + Math.floor(rng() * 3)))
      break
    }
    case 'bold': {
      if (size < 2 || block.node.type.name !== 'paragraph') return
      const from = start + Math.floor(rng() * (size - 1))
      tr.addMark(from, from + 1, state.schema.marks.bold!.create())
      break
    }
    case 'split':
      if (block.node.type.name !== 'paragraph' || size < 2) return
      tr.split(start + 1 + Math.floor(rng() * (size - 1)))
      break
    case 'property':
      if (!element) return
      tr.step(rng() < 0.5 ? new SetNodePropertyStep(0, 'title', pick(['Alpha', 'Beta', 'Gamma'])) : new SetNodePropertyStep(0, 'tone', pick(['info', 'warning'])))
      break
    case 'variant': {
      if (!element) return
      const tag = element.attrs.tag === 'note' ? 'tip' : 'note'
      tr.step(new SetComponentVariantStep(0, tag, { ...element.attrs.props.$, sourceName: tag }))
      break
    }
    case 'attribute':
      if (code < 0) return
      tr.step(rng() < 0.5 ? new SetNodeAttributeStep(code, 'language', pick(['ts', 'js'])) : new SetNodeAttributeStep(code, 'filename', pick(['a.ts', 'b.ts'])))
      break
  }
  if (tr.docChanged) editor.view.dispatch(tr)
}

async function run(seed: number) {
  const rng = random(seed)
  // Backoff jitter uses Math.random; seed it too so a failing seed replays exactly.
  vi.spyOn(Math, 'random').mockImplementation(random(seed ^ 0x9e3779b9))
  const network = await world(rng)
  const clients: { editor: Editor; session: EditorCollaborationSession; link: { online: boolean } }[] = []
  for (const name of ['alice', 'bob', 'carol']) {
    const link = { online: true }
    const session = createEditorCollaboration({ snapshot: network.snapshot, clientId: `${name}/${seed}`, transport: network.transport(link),
      backoff: { initialMs: 5, maxMs: 40 }, requestTimeoutMs: 60_000 })
    const editor = new Editor({ element: document.createElement('div'), content: session.initialDocument,
      extensions: [...createDocumentExtensions(), session.extension] })
    editors.push(editor)
    clients.push({ editor, session, link })
  }
  await vi.advanceTimersByTimeAsync(10)
  for (let round = 0; round < 80; round++) {
    const client = clients[Math.floor(rng() * clients.length)]!
    if (rng() < 0.08) client.link.online = !client.link.online
    if (client.session.canEdit && rng() < 0.8) edit(client.editor, rng)
    network.deliver(Math.floor(rng() * 4))
    await vi.advanceTimersByTimeAsync(Math.floor(rng() * 30))
  }
  for (const client of clients) client.link.online = true
  for (let settle = 0; settle < 400; settle++) {
    network.deliver(network.queue.length)
    await vi.advanceTimersByTimeAsync(50)
    const done = !network.queue.length && clients.every(({ session }) => session.state.status === 'synced'
      && !session.state.pendingSteps && session.state.version === network.snapshot.version)
    if (done) break
  }
  return { network, clients }
}

const exercised = new Set<string>()

describe('randomized multi-client convergence', () => {
  it.each(Array.from({ length: Number(process.env.CONVERGE_SEEDS ?? 40) }, (_, index) => index + 1))('converges with delayed and reordered delivery, seed %i', async seed => {
    vi.useFakeTimers()
    const { network, clients } = await run(seed)
    expect(network.rejected).toEqual([])
    for (const { session } of clients) {
      expect(session.state).toMatchObject({ status: 'synced', pendingSteps: 0, version: network.snapshot.version })
    }
    const server = decodeCollaborationDocument(network.snapshot.document).toJSON()
    for (const { editor } of clients) expect(editor.getJSON()).toEqual(server)
    expect(network.snapshot.version).toBeGreaterThan(10)
    for (const stepType of network.stepTypes) exercised.add(stepType)
  })

  it('exercised text, mark, structure and every custom step', () => {
    expect([...exercised].sort()).toEqual(expect.arrayContaining(['addMark', 'ginkoSetComponentVariantV1',
      'ginkoSetNodeAttributeV1', 'ginkoSetNodePropertyV1', 'replace']))
  })
})
