import type { PortableComponentPolicyV2 } from '@lupinum/ginko-content/cms-contract'
import { CollaborationConnectionError } from '../src/collaboration'
import { applyCollaborationSteps, createCollaborationSnapshot, fenceMismatch,
  type CollaborationHead, type CollaborationPresenceChannel, type CollaborationPresenceUpdate, type CollaborationReply,
  type CollaborationTransport } from '../src/runtime'

export const policy: PortableComponentPolicyV2 = { version: 2, components: {
  note: { kind: 'block', props: {
    title: { types: ['string'], required: true, allowedValues: null },
    tone: { types: ['string'], required: false, allowedValues: ['info', 'warning'] },
  }, slots: ['default'], allowedParents: null, allowedChildren: null, media: null },
} }

/** In-memory authority with the same validation as a host backend. */
export async function server(source = '<note title="Original">\nBody.\n</note>') {
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

/** Ephemeral presence records shared by all clients of one document. */
export function presenceHub() {
  const records = new Map<string, CollaborationPresenceUpdate>()
  const subscribers = new Set<(updates: readonly CollaborationPresenceUpdate[]) => void>()
  const published: CollaborationPresenceUpdate[] = []
  const notify = () => { for (const subscriber of subscribers) subscriber([...records.values()]) }
  return {
    records,
    published,
    channel(): CollaborationPresenceChannel {
      return {
        publish(update) { published.push(update); records.set(update.clientId, update); notify() },
        subscribe(onPeers) { subscribers.add(onPeers); onPeers([...records.values()]); return () => { subscribers.delete(onPeers) } },
        leave(clientId) { records.delete(clientId); notify() },
      }
    },
  }
}
