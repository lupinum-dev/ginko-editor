import type { JsonRecord, JsonValue } from '../types'

export function isValidAttr(value?: null | string) {
  if (!value) {
    return false
  }
  const trimmed = String(value).trim()
  if (!trimmed) {
    return false
  }
  const lower = trimmed.toLowerCase()
  return lower !== 'null' && lower !== 'undefined'
}

export function sanitizeAssetUrl(url: string): null | string {
  const value = url.trim()
  if (!value) {
    return null
  }

  if (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/')
  ) {
    return value
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return value
    }
  } catch {
    return null
  }

  return null
}

export function sanitizeImageUrl(url: string): null | string {
  return url.trim().startsWith('data:image/') ? url.trim() : sanitizeAssetUrl(url)
}

export function sanitizeResolvedAssetUrl(url: string): null | string {
  const safe = sanitizeAssetUrl(url)
  if (safe) return safe
  const value = url.trim()
  try {
    return new URL(value).protocol === 'blob:' ? value : null
  } catch {
    return null
  }
}

/** Browser-only display URLs returned by an explicit host asset provider. */
export function sanitizeResolvedImageUrl(url: string): null | string {
  return sanitizeImageUrl(url) ?? sanitizeResolvedAssetUrl(url)
}

/** Preserve canonical media metadata across native rich-text clipboard HTML. */
export function readStoredMediaProps(element: { getAttribute: (name: string) => string | null }): JsonRecord | undefined {
  const source = element.getAttribute('data-ginko-props')
  if (!source) return undefined
  try {
    const value: unknown = JSON.parse(source, (_key: string, entry: unknown) => {
      if (typeof entry === 'number' && !Number.isFinite(entry)) throw new TypeError('Non-finite media property')
      return entry
    })
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    // JSON parsing supplies JSON values; the reviver rejects non-finite numbers.
    return value as JsonRecord
  } catch {
    return undefined
  }
}

export function cleanSpanProps(attrs?: Record<string, unknown> | null) {
  const props: Record<string, string> = {}
  if (isValidAttr(attrs?.style as string)) props.style = String(attrs!.style).trim()
  if (isValidAttr((attrs as Record<string, unknown>)?.class as string))
    props.class = String((attrs as Record<string, unknown>).class).trim()
  return props
}

export function normalizeProps(
  nodeProps: Record<string, unknown>,
  extraProps: object,
): Array<[string, JsonValue]> {
  return Object.entries({ ...nodeProps, ...extraProps })
    .map(([key, value]) => {
      if (key === 'className') {
        return [
          'class',
          typeof value === 'string' ? value : (value as Array<string>).join(' '),
        ] as [string, JsonValue]
      }
      return [key.trim(), value as JsonValue] as [string, JsonValue]
    })
    .filter(([key]) => Boolean(String(key).trim()))
}
