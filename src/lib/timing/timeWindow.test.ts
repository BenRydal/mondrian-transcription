import { describe, expect, it } from 'vitest'
import { lastIndexAtOrBefore, trailRange } from './timeWindow'

const pts = [0, 0.5, 1, 1.5, 2, 3, 5].map((time) => ({ time }))

describe('lastIndexAtOrBefore', () => {
  it('finds the last point at or before t', () => {
    expect(lastIndexAtOrBefore(pts, 1)).toBe(2)
    expect(lastIndexAtOrBefore(pts, 1.2)).toBe(2)
    expect(lastIndexAtOrBefore(pts, 99)).toBe(6)
  })

  it('returns -1 before the first point or for no points', () => {
    expect(lastIndexAtOrBefore(pts, -0.1)).toBe(-1)
    expect(lastIndexAtOrBefore([], 3)).toBe(-1)
  })

  it('matches a linear scan on a long path', () => {
    const long = Array.from({ length: 5000 }, (_, i) => ({ time: i * 0.013 }))
    for (const t of [-1, 0, 0.0131, 12.34, 64.99, 100]) {
      const linear = long.findLastIndex((p) => p.time <= t)
      expect(lastIndexAtOrBefore(long, t)).toBe(linear)
    }
  })
})

describe('trailRange', () => {
  it('covers the points in the last `seconds` up to t', () => {
    expect(trailRange(pts, 2, 1)).toEqual({ start: 3, end: 4 })
    expect(trailRange(pts, 3.5, 3)).toEqual({ start: 2, end: 5 })
  })

  it('is empty when off, before the path starts, or after a long gap', () => {
    expect(trailRange(pts, 2, 0)).toBeNull()
    expect(trailRange(pts, -1, 3)).toBeNull()
    expect(trailRange(pts, 4.5, 1)).toBeNull()
  })
})
