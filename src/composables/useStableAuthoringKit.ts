import { shallowRef, watch, type ShallowRef } from 'vue'

import type { AuthoringKit } from '../authoring'

const fingerprints = new WeakMap<object, { kit: string; policy: string }>()

/** JSON with sorted object keys, so equal kits from separate objects compare equal. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(
      Object.keys(item as Record<string, unknown>).sort().map(key => [key, (item as Record<string, unknown>)[key]]),
    )
  }) ?? ''
}

function fingerprint(kit: AuthoringKit | undefined) {
  if (!kit) return { kit: '', policy: '' }
  let known = fingerprints.get(kit)
  if (!known) {
    known = { kit: stableJson(kit), policy: stableJson(kit.policy) }
    // Kits from createAuthoringKit are frozen; the cache stays valid for their lifetime.
    if (Object.isFrozen(kit)) fingerprints.set(kit, known)
  }
  return known
}

export interface StableAuthoringKit {
  /** Changes identity only when the kit content changes. */
  kit: ShallowRef<AuthoringKit | undefined>
  /** Increments only when the Content policy changes. */
  policyRevision: ShallowRef<number>
}

/**
 * Hosts often pass a new, equal kit object on each render. Keep the previous
 * object until the content changes, so equal kits do not reload the document,
 * abort uploads, or close a shared session.
 */
export function useStableAuthoringKit(getKit: () => AuthoringKit | undefined): StableAuthoringKit {
  const kit = shallowRef(getKit())
  const policyRevision = shallowRef(0)
  let current = fingerprint(kit.value)
  watch(getKit, (next) => {
    if (next === kit.value) return
    const nextFingerprint = fingerprint(next)
    if (nextFingerprint.kit === current.kit) return
    const policyChanged = nextFingerprint.policy !== current.policy
    current = nextFingerprint
    kit.value = next
    if (policyChanged) policyRevision.value += 1
  }, { flush: 'sync' })
  return { kit, policyRevision }
}
