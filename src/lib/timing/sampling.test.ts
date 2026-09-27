import { describe, expect, it } from 'vitest'
import { SessionClock } from './clock'
import {
  resamplePath,
  sessionScale,
  shouldKeepPoint,
  thinByTime,
  type TimedPoint,
} from './sampling'

describe('thinning', () => {
  it('keeps the first point and drops points closer than 10 ms in clock time', () => {
    expect(shouldKeepPoint(undefined, 0)).toBe(true)
    expect(shouldKeepPoint(1, 1.009)).toBe(false)
    expect(shouldKeepPoint(1, 1.01)).toBe(true)
  })

  it('thins by time, never by count', () => {
    const points = [0, 0.004, 0.008, 0.012, 0.02, 0.5].map((time) => ({ x: time, y: 0, time }))
    expect(thinByTime(points).map((p) => p.time)).toEqual([0, 0.012, 0.5])
  })
})

describe('resamplePath', () => {
  it('interpolates linearly onto the k / rate grid within the path span', () => {
    const points = [
      { x: 0, y: 0, time: 0.06 },
      { x: 10, y: 20, time: 0.16 },
    ]
    const out = resamplePath(points, { rate: 20, holdGap: 1 })
    expect(out.map((p) => p.time)).toEqual([0.1, 0.15])
    expect(out[0].x).toBeCloseTo(4)
    expect(out[0].y).toBeCloseTo(8)
    expect(out[1].x).toBeCloseTo(9)
    expect(out[1].y).toBeCloseTo(18)
  })

  it('holds position across gaps where the pointer did not move', () => {
    const moving = [0, 1, 2, 3, 4, 5].map((i) => ({ x: i, y: 0, time: i * 0.01 }))
    const points = [...moving, { x: 100, y: 0, time: 1.05 }]
    const out = resamplePath(points, { rate: 4 })
    expect(out.map((p) => [p.time, p.x])).toEqual([
      [0, 0],
      [0.25, 5],
      [0.5, 5],
      [0.75, 5],
      [1, 5],
    ])
  })

  it('interpolates legacy pseudo-time paths whose every gap exceeds the hold gap', () => {
    const legacy = [0, 4, 8].map((time) => ({ x: time * 10, y: 0, time }))
    const out = resamplePath(legacy, { rate: 1, scale: sessionScale([legacy], 4) })
    expect(out.map((p) => p.x)).toEqual([0, 20, 40, 60, 80].map((x) => expect.closeTo(x)))
  })

  it('multiplies times by the scale before gridding, keeping the start offset', () => {
    const points = [
      { x: 0, y: 0, time: 3 },
      { x: 10, y: 0, time: 3.05 },
      { x: 20, y: 0, time: 3.1 },
    ]
    const out = resamplePath(points, { rate: 10, scale: 2 })
    expect(out.map((p) => p.time)).toEqual([6, 6.1, 6.2])
    expect(out.map((p) => p.x)).toEqual([0, 10, 20].map((x) => expect.closeTo(x)))
  })

  it('handles old pseudo-time paths and single points', () => {
    const legacy = [0, 4, 8, 12].map((time, i) => ({ x: i, y: i, time }))
    const legacyScale = sessionScale([legacy], 3)
    expect(resamplePath(legacy, { rate: 1, scale: legacyScale }).map((p) => p.time)).toEqual([
      0, 1, 2, 3,
    ])
    const single = [{ x: 1, y: 2, time: 7 }]
    expect(resamplePath(single, { rate: 10, scale: sessionScale([single], 5) })).toEqual([
      { x: 1, y: 2, time: 5 },
    ])
    expect(resamplePath([{ x: 1, y: 2, time: 0.33 }], { rate: 10 })).toEqual([
      { x: 1, y: 2, time: 0.3 },
    ])
    expect(resamplePath([], { rate: 10 })).toEqual([])
  })
})

/** Piecewise-linear trajectory: moves, then sits still from 2 s until the stop at 3 s. */
function trajectory(t: number) {
  const keys = [
    { t: 0, x: 0, y: 0 },
    { t: 0.5, x: 100, y: 50 },
    { t: 1.2, x: 40, y: 200 },
    { t: 2, x: 300, y: 120 },
  ]
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1]
      const b = keys[i]
      const f = (t - a.t) / (b.t - a.t)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
    }
  }
  return { x: 300, y: 120 }
}

/** Record like the canvas does: events stamped by the session clock, thinned, final point on stop. */
function recordSpeculate(clock: SessionClock, perfStart: number, eventHz: number, duration = 3) {
  const moveEnd = 2
  clock.start(perfStart)
  const raw: TimedPoint[] = []
  const eventCount = Math.round(moveEnd * eventHz)
  for (let i = 0; i <= eventCount; i++) {
    const timeStamp = perfStart + (i * 1000) / eventHz
    const time = clock.timeAt(timeStamp)
    if (!shouldKeepPoint(raw.at(-1)?.time, time)) continue
    raw.push({ ...trajectory(i / eventHz), time })
  }
  const stopStamp = perfStart + duration * 1000
  const last = raw[raw.length - 1]
  raw.push({ x: last.x, y: last.y, time: clock.timeAt(stopStamp) })
  clock.pause(stopStamp)
  return raw
}

function expectSamePoints(a: TimedPoint[], b: TimedPoint[]) {
  expect(a.length).toBe(b.length)
  a.forEach((p, i) => {
    expect(p.time).toBe(b[i].time)
    expect(p.x).toBeCloseTo(b[i].x, 9)
    expect(p.y).toBeCloseTo(b[i].y, 9)
  })
}

describe('frame-rate independence', () => {
  it('exports identical points for the same trajectory captured at 30 and 120 fps', () => {
    const at30 = recordSpeculate(new SessionClock(), 1000, 30)
    const at120 = recordSpeculate(new SessionClock(), 5000, 120)
    expect(at30.at(-1)!.time).toBeCloseTo(3)
    expect(at120.at(-1)!.time).toBeCloseTo(3)

    const out30 = resamplePath(at30, { rate: 10 })
    const out120 = resamplePath(at120, { rate: 10 })
    expect(out30).toHaveLength(31)
    expectSamePoints(out30, out120)
    expect(out30.at(-1)).toMatchObject({ x: 300, y: 120, time: 3 })
  })

  it('exports identical scaled points in speculate mode at both frame rates', () => {
    const at30 = recordSpeculate(new SessionClock(), 0, 30)
    const at120 = recordSpeculate(new SessionClock(), 0, 120)
    const out30 = resamplePath(at30, { rate: 5, scale: sessionScale([at30], 60) })
    const out120 = resamplePath(at120, { rate: 5, scale: sessionScale([at120], 60) })
    expectSamePoints(out30, out120)
  })

  it('puts two paths recorded over the same span on identical timestamps', () => {
    const clock = new SessionClock()
    const first = recordSpeculate(clock, 1000, 60)
    clock.seek(0, 20000)
    const second = recordSpeculate(clock, 20000, 90)
    expect(second[0].time).toBe(0)

    const a = resamplePath(first, { rate: 30 })
    const b = resamplePath(second, { rate: 30 })
    expect(a.map((p) => p.time)).toEqual(b.map((p) => p.time))
    expect(a.every((p, i) => p.time === i / 30)).toBe(true)
  })

  it('aligns paths from the same video span on the shared grid', () => {
    const phaseA = [3.004, 3.021, 3.039, 4.98].map((time) => ({ x: 1, y: 1, time }))
    const phaseB = [3.012, 3.029, 4.6, 4.991].map((time) => ({ x: 2, y: 2, time }))
    const a = resamplePath(phaseA, { rate: 10 }).map((p) => p.time)
    const b = resamplePath(phaseB, { rate: 10 }).map((p) => p.time)
    expect(a).toEqual(b)
    expect(a[0]).toBe(3.1)
    expect(a.at(-1)).toBe(4.9)
  })
})

describe('session-wide speculate scaling', () => {
  function recordTwoPaths() {
    const clock = new SessionClock()
    const short = recordSpeculate(clock, 1000, 60, 6)
    clock.seek(0, 20000)
    const long = recordSpeculate(clock, 20000, 60, 12)
    return { short, long }
  }

  it('uses one factor so paths of different lengths keep their ratio and share the grid', () => {
    const { short, long } = recordTwoPaths()
    const scale = sessionScale([short, long], 60)
    expect(scale).toBeCloseTo(5)

    const a = resamplePath(short, { rate: 10, scale })
    const b = resamplePath(long, { rate: 10, scale })
    expect(a.at(-1)!.time / b.at(-1)!.time).toBeCloseTo(0.5)
    expect(a.map((p) => p.time)).toEqual(b.slice(0, a.length).map((p) => p.time))
    expect(b.every((p, i) => p.time === i / 10)).toBe(true)
  })

  it('ends the longest path at the entered duration', () => {
    const { short, long } = recordTwoPaths()
    const scale = sessionScale([short, long], 45)
    expect(resamplePath(long, { rate: 4, scale }).at(-1)!.time).toBe(45)
    expect(resamplePath(short, { rate: 4, scale }).at(-1)!.time).toBe(22.5)
  })

  it('keeps a later-starting path offset by the same factor', () => {
    const late = [2, 3, 4].map((time) => ({ x: time, y: 0, time }))
    const scale = sessionScale([late, [{ x: 0, y: 0, time: 8 }]], 16)
    expect(resamplePath(late, { rate: 1, scale }).map((p) => p.time)).toEqual([4, 5, 6, 7, 8])
  })
})
