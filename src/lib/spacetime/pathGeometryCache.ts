import type p5 from 'p5'
import type { Point } from '$lib/p5/types/sketch'
import type { PathData } from '$lib/stores/drawingState'
import { chunkRanges, type Vec3 } from './geometry'

export type WebglP5 = p5 & {
  buildGeometry(callback: () => void): p5.Geometry
  freeGeometry(geometry: p5.Geometry): void
  worldToScreen(x: number, y: number, z: number): p5.Vector
}

const GEOMETRY_CHUNK_SIZE = 256

type Chunk = { first: Point; last: Point; geometry: p5.Geometry }

export class PathGeometryCache {
  private chunks = new Map<number, Chunk[]>()
  private key = ''

  freeAll(p: WebglP5) {
    for (const chunks of this.chunks.values()) for (const c of chunks) p.freeGeometry(c.geometry)
    this.chunks.clear()
  }

  invalidateUnless(p: WebglP5, key: string) {
    if (key === this.key) return
    this.freeAll(p)
    this.key = key
  }

  retainPaths(p: WebglP5, pathIds: ReadonlySet<number>) {
    for (const [id, chunks] of this.chunks) {
      if (pathIds.has(id)) continue
      for (const c of chunks) p.freeGeometry(c.geometry)
      this.chunks.delete(id)
    }
  }

  draw(p: WebglP5, path: PathData, toScene: (pt: Point) => Vec3) {
    const { points } = path
    const ranges = chunkRanges(points.length, GEOMETRY_CHUNK_SIZE)
    const cached = this.chunks.get(path.pathId) ?? []
    const kept: Chunk[] = []
    for (const [i, [start, end]] of ranges.entries()) {
      if (end - start < 2) {
        p.point(...toScene(points[start]))
        continue
      }
      if (end - start <= GEOMETRY_CHUNK_SIZE) {
        drawVertices(p, points, start, end, toScene)
        continue
      }
      let chunk = cached[i]
      if (!chunk || chunk.first !== points[start] || chunk.last !== points[end - 1]) {
        if (chunk) p.freeGeometry(chunk.geometry)
        const geometry = p.buildGeometry(() => {
          p.noFill()
          p.stroke(0)
          drawVertices(p, points, start, end, toScene)
        })
        chunk = { first: points[start], last: points[end - 1], geometry }
      }
      kept.push(chunk)
      p.model(chunk.geometry)
    }
    for (const stale of cached.slice(kept.length)) p.freeGeometry(stale.geometry)
    this.chunks.set(path.pathId, kept)
  }
}

function drawVertices(
  p: p5,
  points: Point[],
  start: number,
  end: number,
  toScene: (pt: Point) => Vec3
) {
  p.beginShape()
  for (let i = start; i < end; i++) p.vertex(...toScene(points[i]))
  p.endShape()
}
