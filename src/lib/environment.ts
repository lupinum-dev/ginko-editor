/**
 * Development checks follow Vue's convention. Consumer bundlers replace
 * `process.env.NODE_ENV`, so production builds remove the guarded code. Without
 * a bundler, the missing `process` global disables the check.
 */
export function isDevelopment(): boolean {
  try {
    // Node types exist in tests but not in the library declaration build.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- The consumer bundler defines this expression; the library build keeps it.
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}
