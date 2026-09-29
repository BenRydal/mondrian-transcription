import { describe, expect, it } from 'vitest'
import type { RotationAngle } from '$lib/stores/drawingConfig'
import {
  chunkRanges,
  coast,
  easeSpan,
  fadeTicks,
  fitScene,
  formatTick,
  liveHead,
  markerPoint,
  MIN_TIME_SPAN,
  orbitEye,
  releaseVelocity,
  timeAxis,
  timeExtent,
  toScenePoint,
} from './geometry'

const W = 400
const H = 200
const ROTATIONS: RotationAngle[] = [0, 90, 180, 270]

function rotateLikePlane(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
}

describe('toScenePoint', () => {
  it('centres the floor plan and keeps time as z', () => {
    expect(toScenePoint({ x: 0, y: 0, time: 3 }, W, H, 0)).toEqual([-200, -100, 3])
    expect(toScenePoint({ x: 200, y: 100, time: 0 }, W, H, 0)).toEqual([0, 0, 0])
  })

  it.each(ROTATIONS)('lands on the textured plane rotated by %i degrees', (rotation) => {
    for (const [x, y] of [
      [0, 0],
      [W, 0],
      [W, H],
      [50, 150],
    ]) {
      const [sx, sy] = toScenePoint({ x, y, time: 0 }, W, H, rotation)
      const [px, py] = rotateLikePlane(x - W / 2, y - H / 2, rotation)
      expect(sx).toBeCloseTo(px)
      expect(sy).toBeCloseTo(py)
    }
  })

  it('puts the image top-left at the display top-right after a 90 degree turn', () => {
    const [x, y] = toScenePoint({ x: 0, y: 0, time: 0 }, W, H, 90)
    expect(x).toBeCloseTo(H / 2)
    expect(y).toBeCloseTo(-W / 2)
  })
})

describe('fitScene', () => {
  it('fits the longer rotated side into the view footprint', () => {
    const upright = fitScene(1000, 500, W, H, 0)
    expect(upright.floorW).toBeCloseTo(300)
    expect(upright.floorH).toBeCloseTo(150)
    const turned = fitScene(1000, 500, W, H, 90)
    expect(turned.floorW).toBeCloseTo(150)
    expect(turned.floorH).toBeCloseTo(300)
    expect(turned.height).toBeCloseTo(240)
  })

  it('backs the camera off in tall, narrow views so the width still fits', () => {
    const wide = fitScene(800, 400, W, H, 0)
    const tall = fitScene(200, 800, W, H, 0)
    expect(wide.distance / wide.floorW).toBeCloseTo(tall.distance / tall.floorW / 4)
  })
})

describe('timeExtent', () => {
  const paths = [
    {
      points: [
        { x: 0, y: 0, time: 4 },
        { x: 0, y: 0, time: 42 },
      ],
    },
    { points: [] },
  ]

  it('covers the latest point and the clock', () => {
    expect(timeExtent(paths, 5)).toBe(42)
    expect(timeExtent(paths, 60)).toBe(60)
  })

  it('grows with what is recorded rather than the video length', () => {
    const recorded = [{ points: [{ x: 0, y: 0, time: 30 }] }]
    expect(timeExtent(recorded, 12)).toBe(30)
    recorded[0].points.push({ x: 0, y: 0, time: 75 })
    expect(timeExtent(recorded, 12)).toBe(75)
  })

  it('never collapses below the minimum span', () => {
    expect(timeExtent([], 0)).toBe(MIN_TIME_SPAN)
    expect(timeExtent([], Number.NaN)).toBe(MIN_TIME_SPAN)
  })
})

describe('timeAxis', () => {
  it('rounds the axis up to a labelled tick so the top is always marked', () => {
    expect(timeAxis(10)).toEqual({ span: 10, ticks: [0, 5, 10] })
    expect(timeAxis(14)).toEqual({ span: 15, ticks: [0, 5, 10, 15] })
    expect(timeAxis(60)).toEqual({ span: 60, ticks: [0, 15, 30, 45, 60] })
    expect(timeAxis(100)).toEqual({ span: 120, ticks: [0, 30, 60, 90, 120] })
  })

  it('always contains the extent and ends on its last tick', () => {
    for (const extent of [0.5, 7, 10.01, 13, 20.01, 59, 61, 299, 1234, 5000, 90000]) {
      const { span, ticks } = timeAxis(extent, 4)
      expect(span).toBeGreaterThanOrEqual(extent)
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)).toBe(span)
      expect(ticks.length).toBeGreaterThanOrEqual(2)
      expect(ticks.length).toBeLessThanOrEqual(9)
    }
  })

  it('grows in steps and never shrinks while the extent grows', () => {
    const spans = new Set<number>()
    let previous = 0
    for (let extent = 10; extent <= 400; extent += 0.05) {
      const { span } = timeAxis(extent)
      expect(span).toBeGreaterThanOrEqual(previous)
      previous = span
      spans.add(span)
    }
    expect(spans.size).toBeLessThan(40)
  })

  it('scales to long sessions', () => {
    const { span, ticks } = timeAxis(3 * 3600)
    expect(ticks[1]).toBe(3600)
    expect(span).toBe(3 * 3600)
  })

  it('handles an empty extent', () => {
    expect(timeAxis(0)).toEqual({ span: 0, ticks: [0] })
  })
})

describe('formatTick', () => {
  it('formats minutes and hours', () => {
    expect(formatTick(0)).toBe('0:00')
    expect(formatTick(75)).toBe('1:15')
    expect(formatTick(3725)).toBe('1:02:05')
  })
})

describe('chunkRanges', () => {
  it('covers every point with runs that share end points', () => {
    expect(chunkRanges(0, 3)).toEqual([])
    expect(chunkRanges(1, 3)).toEqual([[0, 1]])
    expect(chunkRanges(7, 3)).toEqual([
      [0, 4],
      [3, 7],
    ])
    expect(chunkRanges(8, 3)).toEqual([
      [0, 4],
      [3, 7],
      [6, 8],
    ])
  })

  it('keeps full chunks stable as points are appended', () => {
    const before = chunkRanges(10, 4)
    const after = chunkRanges(25, 4)
    expect(after.slice(0, before.length - 1)).toEqual(before.slice(0, -1))
  })
})

describe('orbitEye', () => {
  it('looks from the bottom edge at yaw 0 and from above at high pitch', () => {
    const [x, y, z] = orbitEye([0, 0, 10], 0, 0, 100)
    expect([x, y, z]).toEqual([0, 100, 10])
    const top = orbitEye([0, 0, 0], 1, Math.PI / 2, 100)
    expect(top[2]).toBeCloseTo(100)
    expect(Math.hypot(top[0], top[1])).toBeCloseTo(0)
  })

  it('keeps the eye at the orbit distance', () => {
    const eye = orbitEye([1, 2, 3], 2.1, 0.7, 50)
    expect(Math.hypot(eye[0] - 1, eye[1] - 2, eye[2] - 3)).toBeCloseTo(50)
  })
})

describe('liveHead', () => {
  const points = [
    { x: 1, y: 2, time: 3 },
    { x: 4, y: 5, time: 6 },
  ]

  it('extends the last position up to the clock while recording', () => {
    expect(liveHead(points, 7.5, true)).toEqual({ x: 4, y: 5, time: 7.5 })
  })

  it('is absent when not recording, empty, or the clock is not past the end', () => {
    expect(liveHead(points, 7.5, false)).toBeNull()
    expect(liveHead([], 7.5, true)).toBeNull()
    expect(liveHead(points, 6, true)).toBeNull()
  })
})

describe('drag inertia', () => {
  const drag = (endMs: number, step = 0.02) =>
    Array.from({ length: 10 }, (_, i) => ({ ms: endMs - 90 + i * 10, yaw: step }))

  it('takes the release velocity from the last moves', () => {
    expect(releaseVelocity(drag(1000), 1000)).toBeCloseTo(2)
    expect(releaseVelocity(drag(1000, -0.01), 1005)).toBeCloseTo(-1)
  })

  it('has no velocity if the pointer rested before release or barely moved', () => {
    expect(releaseVelocity(drag(1000), 1300)).toBe(0)
    expect(releaseVelocity([{ ms: 1000, yaw: 0.5 }], 1000)).toBe(0)
    expect(releaseVelocity(drag(1000, 1), 1000)).toBe(6)
  })

  it('decays exponentially and comes to rest, at any frame rate', () => {
    const run = (fps: number) => {
      let v = 2
      let yaw = 0
      let t = 0
      while (v !== 0) {
        yaw += v / fps
        v = coast(v, 1 / fps)
        t += 1 / fps
      }
      return { yaw, t }
    }
    const at60 = run(60)
    const at144 = run(144)
    expect(at60.t).toBeLessThan(2.5)
    expect(at60.yaw).toBeCloseTo(2 * 0.35, 1)
    expect(Math.abs(at60.yaw - at144.yaw)).toBeLessThan(0.02)
    expect(coast(-1, 0.35)).toBeCloseTo(-Math.exp(-1))
  })
})

describe('axis easing', () => {
  const settle = (shown: number, target: number, content: number, fps: number) => {
    const trace = [shown]
    for (let i = 0; i < fps; i++) trace.push(easeSpan(trace.at(-1)!, target, content, 1 / fps))
    return trace
  }

  it('reaches the target within about 300 ms and then holds it exactly', () => {
    const up = settle(10, 15, 10.2, 60)
    expect(Math.abs(up[18] - 15)).toBeLessThan(0.05 * 5)
    expect(up.at(-1)).toBe(15)
    const down = settle(30, 15, 12, 120)
    expect(down.at(-1)).toBe(15)
  })

  it('moves monotonically, never below the content or past the target', () => {
    for (const fps of [30, 60, 144]) {
      const up = settle(10, 15, 12, fps)
      up.slice(1).forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(up[i])
        expect(v).toBeGreaterThanOrEqual(12)
        expect(v).toBeLessThanOrEqual(15)
      })
      const down = settle(30, 15, 14, fps)
      down.slice(1).forEach((v, i) => {
        expect(v).toBeLessThanOrEqual(down[i])
        expect(v).toBeGreaterThanOrEqual(15)
      })
    }
  })

  it('snaps on the first frame and when easing is disabled', () => {
    expect(easeSpan(0, 20, 12, 1 / 60)).toBe(20)
    expect(easeSpan(10, 20, 12, Infinity)).toBe(20)
    expect(easeSpan(10, 20, 12, 0)).toBe(12)
  })
})

describe('tick fading', () => {
  it('shows the first ticks at full opacity', () => {
    expect([...fadeTicks(new Map(), [0, 5, 10], 0)]).toEqual([
      [0, 1],
      [5, 1],
      [10, 1],
    ])
  })

  it('fades new ticks in and dropped ticks out, then forgets them', () => {
    let alphas = fadeTicks(new Map(), [0, 5, 10], 0)
    alphas = fadeTicks(alphas, [0, 10], 0.1)
    expect(alphas.get(0)).toBe(1)
    expect(alphas.get(5)).toBeCloseTo(0.6)
    alphas = fadeTicks(alphas, [0, 10, 20], 0.1)
    expect(alphas.get(20)).toBeCloseTo(0.4)
    expect(alphas.get(5)).toBeCloseTo(0.2)
    alphas = fadeTicks(alphas, [0, 10, 20], 0.2)
    expect(alphas.has(5)).toBe(false)
    expect(alphas.get(20)).toBe(1)
  })
})

describe('markerPoint', () => {
  const points = [
    { x: 1, y: 1, time: 2 },
    { x: 2, y: 2, time: 4 },
    { x: 3, y: 3, time: 6 },
  ]

  it('puts other paths at their last point at or before now, and hides unstarted ones', () => {
    expect(markerPoint(points, 5, false, true)).toBe(points[1])
    expect(markerPoint(points, 9, false, false)).toBe(points[2])
    expect(markerPoint(points, 1, false, false)).toBeNull()
    expect(markerPoint([], 1, false, false)).toBeNull()
  })

  it('puts the current path at its end, or its live head while recording', () => {
    expect(markerPoint(points, 1, true, false)).toBe(points[2])
    expect(markerPoint(points, 7, true, true)).toEqual({ x: 3, y: 3, time: 7 })
    expect(markerPoint([], 7, true, true)).toBeNull()
  })
})
