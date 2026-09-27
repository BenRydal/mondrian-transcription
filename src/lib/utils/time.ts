/** m:ss.s, truncated to tenths so 59.96 s never shows as 0:60.0. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const tenths = Math.floor(seconds * 10 + 1e-6)
  const mins = Math.floor(tenths / 600)
  const rest = tenths % 600
  const secs = Math.floor(rest / 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${rest % 10}`
}
