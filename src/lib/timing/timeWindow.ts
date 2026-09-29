interface Timed {
  time: number
}

export function lastIndexAtOrBefore(points: readonly Timed[], t: number): number {
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (points[mid].time <= t) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

export function trailRange(
  points: readonly Timed[],
  t: number,
  seconds: number
): { start: number; end: number } | null {
  const end = lastIndexAtOrBefore(points, t)
  if (end < 0 || seconds <= 0) return null
  const start = lastIndexAtOrBefore(points, t - seconds) + 1
  return start <= end ? { start, end } : null
}
