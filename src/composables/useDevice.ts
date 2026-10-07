import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** A reactive media query. False during server rendering and without `matchMedia`. */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)
  let list: MediaQueryList | undefined
  const update = () => { matches.value = !!list?.matches }
  onMounted(() => {
    list = globalThis.matchMedia?.(query)
    update()
    list?.addEventListener?.('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener?.('change', update))
  return matches
}

/** A device whose primary input is a finger, where native selection menus and on-screen keyboards appear. */
export function useTouchDevice() {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}

/**
 * The height that an on-screen keyboard or browser bar covers at the bottom
 * of the layout viewport. Fixed elements move up by this inset to stay visible.
 */
export function useKeyboardInset(): Readonly<Ref<number>> {
  const inset = ref(0)
  let frame = 0
  const measure = () => {
    frame = 0
    const viewport = globalThis.visualViewport
    if (!viewport) return
    inset.value = Math.max(0, Math.round(globalThis.innerHeight - viewport.height - viewport.offsetTop))
  }
  const schedule = () => { frame ||= globalThis.requestAnimationFrame(measure) }
  onMounted(() => {
    measure()
    globalThis.visualViewport?.addEventListener('resize', schedule)
    globalThis.visualViewport?.addEventListener('scroll', schedule)
  })
  onBeforeUnmount(() => {
    if (frame) globalThis.cancelAnimationFrame(frame)
    globalThis.visualViewport?.removeEventListener('resize', schedule)
    globalThis.visualViewport?.removeEventListener('scroll', schedule)
  })
  return inset
}
