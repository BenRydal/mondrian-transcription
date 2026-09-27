import { describe, expect, it } from 'vitest'
import { selectRetained, type RetentionEntry } from './retention'

const S = 1000
const M = 60 * S
const H = 60 * M
const D = 24 * H
// A round epoch-aligned "now" keeps bucket arithmetic easy to reason about.
const NOW = 1_000 * D

function series(fromAge: number, toAge: number, step: number, startId = 1): RetentionEntry[] {
  const out: RetentionEntry[] = []
  let id = startId
  for (let age = fromAge; age >= toAge; age -= step) {
    out.push({ id: id++, savedAt: NOW - age, pinned: false })
  }
  return out
}

/** Simulate saving every `step` ms for `duration`, thinning after each save. */
function simulate(duration: number, step: number) {
  let kept: RetentionEntry[] = []
  let id = 0
  const start = NOW - duration
  for (let t = start; t <= NOW; t += step) {
    kept.push({ id: ++id, savedAt: t, pinned: false })
    const keep = selectRetained(kept, t)
    kept = kept.filter((e) => keep.has(e.id))
  }
  return kept
}

describe('selectRetained', () => {
  it('keeps everything from the last minute', () => {
    const entries = series(59 * S, 0, S)
    expect(selectRetained(entries, NOW).size).toBe(entries.length)
  })

  it('keeps one per minute between 1 and 15 minutes old', () => {
    const entries = series(15 * M - S, M, S)
    const kept = selectRetained(entries, NOW)
    // 14 minutes of age span, plus the newest-overall entry which is also a bucket winner.
    expect(kept.size).toBeGreaterThanOrEqual(14)
    expect(kept.size).toBeLessThanOrEqual(15)
    const minutes = new Set(
      entries.filter((e) => kept.has(e.id)).map((e) => Math.floor(e.savedAt / M))
    )
    expect(minutes.size).toBe(kept.size)
  })

  it('keeps the newest entry within each bucket', () => {
    const entries: RetentionEntry[] = [
      { id: 1, savedAt: NOW - 5 * M + 1 * S, pinned: false },
      { id: 2, savedAt: NOW - 5 * M + 30 * S, pinned: false },
      { id: 3, savedAt: NOW - 5 * M + 50 * S, pinned: false },
      { id: 4, savedAt: NOW, pinned: false },
    ]
    expect([...selectRetained(entries, NOW)].sort()).toEqual([3, 4])
  })

  it('treats an entry exactly 1 minute old as the per-minute tier', () => {
    const now = NOW + 30 * S
    const entries: RetentionEntry[] = [
      { id: 1, savedAt: now - 80 * S, pinned: false },
      { id: 2, savedAt: now - M, pinned: false },
      { id: 3, savedAt: now - M + 1, pinned: false },
      { id: 9, savedAt: now, pinned: false },
    ]
    const kept = selectRetained(entries, now)
    expect(kept.has(3)).toBe(true)
    expect(kept.has(2)).toBe(true)
    // id 1 shares a minute bucket with id 2 and is older, so it is thinned.
    expect(kept.has(1)).toBe(false)
  })

  it('thins a 2-hour drawing session to about one per tier bucket', () => {
    const kept = simulate(2 * H, S)
    const ages = kept.map((e) => NOW - e.savedAt)
    const lastMinute = ages.filter((a) => a < M).length
    const perMinute = ages.filter((a) => a >= M && a < 15 * M).length
    const perTen = ages.filter((a) => a >= 15 * M && a < 2 * H).length
    expect(lastMinute).toBe(60)
    expect(perMinute).toBeGreaterThanOrEqual(13)
    expect(perMinute).toBeLessThanOrEqual(15)
    expect(perTen).toBeGreaterThanOrEqual(10)
    expect(perTen).toBeLessThanOrEqual(12)
    expect(kept.length).toBeLessThan(90)
  })

  it('thins older history to hourly within a week and daily beyond', () => {
    const entries = [...series(30 * D, 7 * D, 20 * M), ...series(7 * D - M, 2 * H, 20 * M, 100_000)]
    const kept = entries.filter((e) => selectRetained(entries, NOW).has(e.id))
    const daily = kept.filter((e) => NOW - e.savedAt >= 7 * D)
    const hourly = kept.filter((e) => NOW - e.savedAt < 7 * D)
    expect(new Set(daily.map((e) => Math.floor(e.savedAt / D))).size).toBe(daily.length)
    expect(daily.length).toBeGreaterThanOrEqual(23)
    expect(daily.length).toBeLessThanOrEqual(24)
    expect(new Set(hourly.map((e) => Math.floor(e.savedAt / H))).size).toBe(hourly.length)
  })

  it('never drops pinned entries, however old or crowded', () => {
    const entries: RetentionEntry[] = [
      ...series(3 * D, 3 * D - 10 * M, M),
      { id: 500, savedAt: NOW - 3 * D + 5 * S, pinned: true },
      { id: 501, savedAt: NOW - 3 * D + 6 * S, pinned: true },
      { id: 502, savedAt: NOW - 40 * D, pinned: true },
    ]
    const kept = selectRetained(entries, NOW)
    expect(kept.has(500) && kept.has(501) && kept.has(502)).toBe(true)
  })

  it('does not let pinned entries crowd autosaves out of a bucket', () => {
    const entries: RetentionEntry[] = [
      { id: 1, savedAt: NOW - 5 * M + S, pinned: false },
      { id: 2, savedAt: NOW - 5 * M + 2 * S, pinned: true },
      { id: 3, savedAt: NOW, pinned: false },
    ]
    expect([...selectRetained(entries, NOW)].sort()).toEqual([1, 2, 3])
  })

  it('keeps future-dated entries (clock skew) and the newest id even if its clock went back', () => {
    const entries: RetentionEntry[] = [
      { id: 1, savedAt: NOW + 10 * M, pinned: false },
      { id: 2, savedAt: NOW - 3 * H + 10 * S, pinned: false },
      { id: 3, savedAt: NOW - 3 * H, pinned: false },
    ]
    const kept = selectRetained(entries, NOW)
    expect(kept.has(1)).toBe(true)
    expect(kept.has(3)).toBe(true)
    expect(kept.has(2)).toBe(true)
  })

  it('handles empty input and a single entry', () => {
    expect(selectRetained([], NOW).size).toBe(0)
    expect([...selectRetained([{ id: 7, savedAt: 0, pinned: false }], NOW)]).toEqual([7])
  })
})
