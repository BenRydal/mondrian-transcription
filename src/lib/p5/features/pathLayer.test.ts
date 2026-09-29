import { describe, expect, it } from 'vitest'
import {
  COMMIT_BATCH,
  COMMIT_BATCH_UNDER,
  imageToDisplay,
  isGeometryOnlyChange,
  layerState,
  planLayer,
  shouldCommit,
  traceDecimated,
  traceDots,
  type LayerKey,
  type LayerPathInput,
  type XY,
} from './pathLayer'
import { applyForwardRotation } from '../../utils/drawingUtils'
import type { RotationAngle } from '../../stores/drawingConfig'

const key: LayerKey = {
  width: 1600,
  height: 900,
  density: 2,
  rect: { x: 400, y: 0, w: 380, h: 450 },
  rotation: 0,
  imgW: 1000,
  imgH: 1200,
  strokeWeight: 5,
  continuous: true,
}

const pts = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => Object.freeze({ x: i + offset, y: 2 * i, time: i / 10 }))

const path = (
  pathId: number,
  points: readonly XY[] = pts(10),
  extra: Partial<LayerPathInput> = {}
): LayerPathInput => ({
  pathId,
  color: '#FF0000',
  points,
  ...extra,
})

function recorder() {
  const calls: string[] = []
  return {
    calls,
    moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`L${x},${y}`),
    arc: (x: number, y: number) => calls.push(`A${x},${y}`),
  }
}

describe('imageToDisplay', () => {
  it.each([0, 90, 180, 270] as RotationAngle[])('matches applyForwardRotation at %i°', (rot) => {
    const r = { x: 120, y: 30, w: 500, h: 420 }
    const m = imageToDisplay(1000, 1200, rot, r)
    for (const [x, y] of [
      [0, 0],
      [1000, 1200],
      [250, 900],
      [731.5, 12.25],
    ]) {
      const { nx, ny } = applyForwardRotation(x, y, 1000, 1200, rot)
      expect(m.a * x + m.c * y + m.e).toBeCloseTo(r.x + nx * r.w, 9)
      expect(m.b * x + m.d * y + m.f).toBeCloseTo(r.y + ny * r.h, 9)
    }
  })
})

describe('traceDecimated', () => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

  it('drops consecutive points on the same device pixel but keeps the first and last', () => {
    const points = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.3 },
      { x: 0.9, y: 0.9 },
      { x: 1.2, y: 0.5 },
      { x: 1.4, y: 0.6 },
      { x: 1.3, y: 0.7 },
    ]
    const sink = recorder()
    expect(traceDecimated(points, 0, points.length, identity, 1, sink)).toBe(3)
    expect(sink.calls).toEqual(['M0.1,0.1', 'L1.2,0.5', 'L1.3,0.7'])
  })

  it('decimates in device pixels, so a denser canvas keeps more', () => {
    const points = [
      { x: 0.1, y: 0 },
      { x: 0.6, y: 0 },
      { x: 0.7, y: 0 },
    ]
    expect(traceDecimated(points, 0, 3, identity, 1, recorder())).toBe(2)
    expect(traceDecimated(points, 0, 3, identity, 2, recorder())).toBe(3)
  })

  it('never drops points that move between pixels', () => {
    const points = pts(50)
    expect(traceDecimated(points, 0, 50, identity, 1, recorder())).toBe(50)
  })

  it('keeps a still path as a zero-length segment, never a lone moveTo', () => {
    const still = Array.from({ length: 600 }, () => ({ x: 5, y: 5 }))
    const sink = recorder()
    expect(traceDecimated(still, 0, still.length, identity, 1, sink)).toBe(2)
    expect(sink.calls).toEqual(['M5,5', 'L5,5'])
  })

  it('traces only the requested range', () => {
    const sink = recorder()
    traceDecimated(pts(10), 4, 7, identity, 1, sink)
    expect(sink.calls).toEqual(['M4,8', 'L5,10', 'L6,12'])
  })

  it('never alters the stored points', () => {
    const points = pts(20)
    const copy = JSON.stringify(points)
    traceDecimated(points, 0, 20, imageToDisplay(100, 100, 90, key.rect), 3, recorder())
    expect(JSON.stringify(points)).toBe(copy)
  })
})

describe('traceDots', () => {
  it('draws one circle per device pixel', () => {
    const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    const points = [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.2 },
      { x: 3, y: 3 },
    ]
    const sink = recorder()
    expect(traceDots(points, 0, 3, identity, 1, 2, sink)).toBe(2)
    expect(sink.calls).toEqual(['M2.1,0.1', 'A0.1,0.1', 'M5,3', 'A3,3'])
  })
})

describe('planLayer', () => {
  const held = (paths: LayerPathInput[]) => layerState(key, paths)

  it('rebuilds with nothing cached', () => {
    expect(planLayer(null, key, [path(1)])).toEqual({ kind: 'rebuild' })
  })

  it('does nothing when nothing changed, or only a name did', () => {
    const paths = [path(1), path(2)]
    expect(planLayer(held(paths), key, paths)).toEqual({ kind: 'none' })
    const renamed = [{ ...paths[0], name: 'Teacher' }, paths[1]]
    expect(planLayer(held(paths), key, renamed)).toEqual({ kind: 'none' })
  })

  it.each([
    ['canvas width', { width: 1400 }],
    ['canvas height', { height: 800 }],
    ['pixel density', { density: 1 }],
    ['image rect (splitter, panel)', { rect: { x: 300, y: 0, w: 380, h: 450 } }],
    ['rotation', { rotation: 90 as RotationAngle }],
    ['image size', { imgW: 800 }],
    ['stroke weight', { strokeWeight: 3 }],
    ['continuous mode', { continuous: false }],
  ])('rebuilds when the %s changes', (_, patch) => {
    const paths = [path(1)]
    expect(planLayer(held(paths), { ...key, ...patch }, paths)).toEqual({ kind: 'rebuild' })
  })

  it('appends the new tail when the top path grows', () => {
    const base = pts(10)
    const before = [path(1), path(2, base)]
    const after = [before[0], path(2, [...base, ...pts(3, 100)])]
    expect(planLayer(held(before), key, after)).toEqual({
      kind: 'append',
      index: 1,
      from: 10,
      onTop: true,
    })
  })

  it('marks growth under another visible path as not on top', () => {
    const base = pts(10)
    const before = [path(1, base), path(2)]
    const after = [path(1, [...base, ...pts(2, 50)]), before[1]]
    expect(planLayer(held(before), key, after)).toMatchObject({ kind: 'append', onTop: false })
  })

  it('treats paths above that draw nothing as not covering', () => {
    const base = pts(10)
    const before = [path(1, base), path(2, pts(5), { visible: false }), path(3, [])]
    const after = [path(1, [...base, ...pts(2, 50)]), before[1], before[2]]
    expect(planLayer(held(before), key, after)).toMatchObject({ kind: 'append', onTop: true })
  })

  it('absorbs a new empty path and appends once it starts recording', () => {
    const before = [path(1)]
    const withNew = [before[0], path(2, [])]
    expect(planLayer(held(before), key, withNew)).toEqual({ kind: 'none' })
    const recording = [before[0], path(2, pts(1))]
    expect(planLayer(held(withNew), key, recording)).toEqual({
      kind: 'append',
      index: 1,
      from: 0,
      onTop: true,
    })
  })

  it('rebuilds when a new path arrives with points (restore, import)', () => {
    const before = [path(1)]
    expect(planLayer(held(before), key, [before[0], path(2)])).toEqual({ kind: 'rebuild' })
  })

  it('rebuilds on rewind or truncation', () => {
    const before = [path(1, pts(10))]
    const rewound = [path(1, before[0].points.slice(0, 6))]
    expect(planLayer(held(before), key, rewound)).toEqual({ kind: 'rebuild' })
  })

  it('rebuilds when rewind is followed by new points of the same length', () => {
    const before = [path(1, pts(10))]
    const redone = [path(1, [...before[0].points.slice(0, 6), ...pts(4, 70)])]
    expect(planLayer(held(before), key, redone)).toEqual({ kind: 'rebuild' })
  })

  it('rebuilds on delete, restore or session switch', () => {
    const before = [path(1), path(2)]
    expect(planLayer(held(before), key, [before[1]])).toEqual({ kind: 'rebuild' })
    const restored = [path(1, pts(10)), path(2, pts(10))]
    expect(planLayer(held(before), key, restored)).toEqual({ kind: 'rebuild' })
  })

  it('rebuilds on colour or visibility changes', () => {
    const before = [path(1), path(2)]
    expect(planLayer(held(before), key, [{ ...before[0], color: '#00FF00' }, before[1]])).toEqual({
      kind: 'rebuild',
    })
    expect(planLayer(held(before), key, [before[0], { ...before[1], visible: false }])).toEqual({
      kind: 'rebuild',
    })
  })

  it('ignores points added to a hidden path', () => {
    const base = pts(10)
    const before = [path(1, base, { visible: false })]
    const after = [path(1, [...base, ...pts(2, 40)], { visible: false })]
    expect(planLayer(held(before), key, after)).toEqual({ kind: 'none' })
  })

  it('rebuilds when two paths grow at once', () => {
    const a = pts(5)
    const b = pts(5, 9)
    const before = [path(1, a), path(2, b)]
    const after = [path(1, [...a, ...pts(1, 60)]), path(2, [...b, ...pts(1, 70)])]
    expect(planLayer(held(before), key, after)).toEqual({ kind: 'rebuild' })
  })

  it('keeps appending from the held count while a tail stays uncommitted', () => {
    const base = pts(10)
    const before = [path(1, base)]
    const state = held(before)
    const grown1 = [path(1, [...base, ...pts(2, 30)])]
    const grown2 = [path(1, [...grown1[0].points, ...pts(2, 60)])]
    expect(planLayer(state, key, grown1)).toMatchObject({ kind: 'append', from: 10 })
    expect(planLayer(state, key, grown2)).toMatchObject({ kind: 'append', from: 10 })
  })
})

describe('shouldCommit', () => {
  it('commits everything once recording stops', () => {
    expect(shouldCommit(1, true, false)).toBe(true)
    expect(shouldCommit(1, false, false)).toBe(true)
  })

  it('batches while recording, longer when a commit means a rebuild', () => {
    expect(shouldCommit(COMMIT_BATCH - 1, true, true)).toBe(false)
    expect(shouldCommit(COMMIT_BATCH, true, true)).toBe(true)
    expect(shouldCommit(COMMIT_BATCH, false, true)).toBe(false)
    expect(shouldCommit(COMMIT_BATCH_UNDER, false, true)).toBe(true)
  })
})

describe('isGeometryOnlyChange', () => {
  it('is true for size, density and placement changes', () => {
    expect(isGeometryOnlyChange(key, { ...key, width: 1200 })).toBe(true)
    expect(isGeometryOnlyChange(key, { ...key, density: 1 })).toBe(true)
    expect(isGeometryOnlyChange(key, { ...key, rect: { ...key.rect, x: 10 } })).toBe(true)
  })

  it('is false when nothing changed or the drawing itself changed', () => {
    expect(isGeometryOnlyChange(key, { ...key })).toBe(false)
    expect(isGeometryOnlyChange(key, { ...key, width: 1200, rotation: 90 })).toBe(false)
    expect(isGeometryOnlyChange(key, { ...key, width: 1200, strokeWeight: 2 })).toBe(false)
    expect(isGeometryOnlyChange(key, { ...key, width: 1200, continuous: false })).toBe(false)
    expect(isGeometryOnlyChange(key, { ...key, width: 1200, imgH: 10 })).toBe(false)
  })
})
