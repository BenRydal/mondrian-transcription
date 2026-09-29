import { describe, expect, it } from 'vitest'
import type { PathData } from '$lib/stores/drawingState'
import { PathGeometryCache, type WebglP5 } from './pathGeometryCache'

const LINES = 0x0001

function fakeP5() {
  const shapes: { kind: number | undefined; vertices: number[][]; built: boolean }[] = []
  let building = false
  const p = {
    LINES,
    beginShape: (kind?: number) => shapes.push({ kind, vertices: [], built: building }),
    vertex: (...v: number[]) => shapes.at(-1)!.vertices.push(v),
    endShape: () => {},
    buildGeometry: (cb: () => void) => {
      building = true
      cb()
      building = false
      return {}
    },
    model: () => {},
    freeGeometry: () => {},
    point: () => {},
    noFill: () => {},
    stroke: () => {},
  }
  return { p: p as unknown as WebglP5, shapes }
}

// A self-crossing loop long enough to fill one cached chunk.
const loopPath = (n: number): PathData => ({
  pathId: 1,
  color: '#f00',
  points: Array.from({ length: n }, (_, i) => ({
    x: Math.cos(i / 5) * 100,
    y: Math.sin(i / 3) * 100,
    time: i * 0.1,
    pathId: 1,
  })),
})

describe('PathGeometryCache', () => {
  it('builds cached chunks as line segments between consecutive points, never a PATH', () => {
    const { p, shapes } = fakeP5()
    const path = loopPath(300)
    new PathGeometryCache().draw(p, path, (pt) => [pt.x, pt.y, pt.time])

    const cached = shapes.filter((s) => s.built)
    expect(cached).toHaveLength(1)
    expect(shapes.every((s) => s.kind === LINES)).toBe(true)

    const expected = path.points.slice(0, 257).flatMap((pt, i, all) =>
      i === 0
        ? []
        : [
            [all[i - 1].x, all[i - 1].y, all[i - 1].time],
            [pt.x, pt.y, pt.time],
          ]
    )
    expect(cached[0].vertices).toEqual(expected)
  })
})
