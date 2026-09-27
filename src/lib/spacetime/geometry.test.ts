import { describe, expect, it } from 'vitest'
import type { RotationAngle } from '$lib/stores/drawingConfig'
import {
  chunkRanges,
  fitScene,
  formatTick,
  indexAtTime,
  MIN_TIME_SPAN,
  orbitEye,
  timeAxis,
  timeExtent,
  timeToHeight,
  toScenePoint,
} from './geometry'

const W = 400
const H = 200
const ROTATIONS: RotationAngle[] = [0, 90, 180, 270]

/** Rotate a centred unrotated point the way the 3D floor plane is rotated (rotateZ, y down). */
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

describe('timeExtent and timeToHeight', () => {
  const paths = [
    {
      points: [
        { x: 0, y: 0, time: 4 },
        { x: 0, y: 0, time: 42 },
      ],
    },
    { points: [] },
  ]

  it('covers the latest point, the clock and the video length', () => {
    expect(timeExtent(paths, 5)).toBe(42)
    expect(timeExtent(paths, 60)).toBe(60)
    expect(timeExtent(paths, 5, 120)).toBe(120)
  })

  it('never collapses below the minimum span', () => {
    expect(timeExtent([], 0)).toBe(MIN_TIME_SPAN)
    expect(timeExtent([], 0, Number.NaN)).toBe(MIN_TIME_SPAN)
  })

  it('maps time linearly onto the axis height', () => {
    expect(timeToHeight(0, 60, 300)).toBe(0)
    expect(timeToHeight(30, 60, 300)).toBe(150)
    expect(timeToHeight(60, 60, 300)).toBe(300)
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

describe('indexAtTime', () => {
  const pts = [0, 1, 2, 5].map((time) => ({ x: 0, y: 0, time }))

  it('finds the last point at or before the time', () => {
    expect(indexAtTime(pts, -1)).toBe(-1)
    expect(indexAtTime(pts, 0)).toBe(0)
    expect(indexAtTime(pts, 3)).toBe(2)
    expect(indexAtTime(pts, 99)).toBe(3)
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
