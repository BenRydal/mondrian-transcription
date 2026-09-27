import type { Point } from '$lib/p5/types/sketch'
import type { PathData } from '$lib/stores/drawingState'

export const CHUNK_SIZE = 500
/** Each point is stored as x, y, time, pathId. */
export const CHUNK_STRIDE = 4

export interface ChunkRecord {
  sessionId: string
  seq: number
  n: number
  data: Float64Array
}

export type ChunkKey = [string, number]

export interface PathManifest {
  pathId: number
  name?: string
  color: string
  visible?: boolean
  count: number
  chunks: number[]
}

export interface PathSummary {
  pathId: number
  name?: string
  color: string
  visible?: boolean
  count: number
  /** Changes whenever any chunk of the path changes. */
  sig: number
}

/** Number of points held by chunk `index` of a path with `count` points. */
export function chunkLength(count: number, index: number): number {
  return Math.max(0, Math.min(CHUNK_SIZE, count - index * CHUNK_SIZE))
}

export function chunkCount(count: number): number {
  return Math.ceil(count / CHUNK_SIZE)
}

export function encodeChunk(
  sessionId: string,
  seq: number,
  points: readonly Point[],
  start: number,
  end: number
): ChunkRecord {
  const n = end - start
  const data = new Float64Array(n * CHUNK_STRIDE)
  for (let i = 0; i < n; i++) {
    const p = points[start + i]
    const o = i * CHUNK_STRIDE
    data[o] = p.x
    data[o + 1] = p.y
    data[o + 2] = p.time
    data[o + 3] = typeof p.pathId === 'number' ? p.pathId : NaN
  }
  return { sessionId, seq, n, data }
}

/** Decode into `out`; false when the record is malformed or holds non-finite coordinates. */
export function decodeChunkInto(
  record: unknown,
  expectedLength: number,
  fallbackPathId: number,
  out: Point[]
): boolean {
  const r = record as ChunkRecord | undefined
  if (!r || r.n !== expectedLength || !(r.data instanceof Float64Array)) return false
  if (r.data.length !== r.n * CHUNK_STRIDE) return false
  const d = r.data
  for (let i = 0; i < r.n; i++) {
    const o = i * CHUNK_STRIDE
    const x = d[o]
    const y = d[o + 1]
    const time = d[o + 2]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(time)) return false
    const pathId = Number.isFinite(d[o + 3]) ? d[o + 3] : fallbackPathId
    out.push({ x, y, time, pathId })
  }
  return true
}

export function pathSignature(chunks: readonly number[], count: number): number {
  let h = 0x811c9dc5 ^ count
  for (const seq of chunks) h = Math.imul(h ^ seq, 0x01000193)
  return h >>> 0
}

export function summarize(manifest: PathManifest): PathSummary {
  const { chunks, ...rest } = manifest
  return { ...rest, sig: pathSignature(chunks, manifest.count) }
}

interface ChunkRef {
  sessionId: string
  seq: number
  points: Point[]
}

const MAX_CANDIDATES = 4

/**
 * Remembers which stored chunk holds which run of point objects. Points are never mutated
 * in place, so identical object references mean identical content.
 */
export class ChunkRegistry {
  private byFirst = new WeakMap<Point, ChunkRef[]>()

  register(sessionId: string, seq: number, points: Point[]) {
    if (points.length === 0) return
    const list = this.byFirst.get(points[0]) ?? []
    list.unshift({ sessionId, seq, points })
    if (list.length > MAX_CANDIDATES) list.length = MAX_CANDIDATES
    this.byFirst.set(points[0], list)
  }

  find(
    sessionId: string,
    points: readonly Point[],
    start: number,
    end: number,
    isLive: (seq: number) => boolean
  ): number | null {
    const list = this.byFirst.get(points[start])
    if (!list) return null
    const n = end - start
    outer: for (const ref of list) {
      if (ref.sessionId !== sessionId || ref.points.length !== n || !isLive(ref.seq)) continue
      for (let i = 1; i < n; i++) if (ref.points[i] !== points[start + i]) continue outer
      return ref.seq
    }
    return null
  }
}

export interface ChunkPlan {
  manifests: PathManifest[]
  newChunks: ChunkRecord[]
  newRefs: Array<{ seq: number; points: Point[] }>
  nextSeq: number
}

/** Split paths into chunks, reusing stored chunks whose points are unchanged. */
export function planChunks(
  sessionId: string,
  paths: readonly PathData[],
  registry: ChunkRegistry,
  isLive: (seq: number) => boolean,
  firstSeq: number
): ChunkPlan {
  let nextSeq = firstSeq
  const newChunks: ChunkRecord[] = []
  const newRefs: ChunkPlan['newRefs'] = []
  const manifests = paths.map((path) => {
    const { points } = path
    const chunks: number[] = []
    for (let start = 0; start < points.length; start += CHUNK_SIZE) {
      const end = Math.min(points.length, start + CHUNK_SIZE)
      let seq = registry.find(sessionId, points, start, end, isLive)
      if (seq === null) {
        seq = nextSeq++
        newChunks.push(encodeChunk(sessionId, seq, points, start, end))
        newRefs.push({ seq, points: points.slice(start, end) })
      }
      chunks.push(seq)
    }
    const manifest: PathManifest = {
      pathId: path.pathId,
      color: path.color,
      count: points.length,
      chunks,
    }
    if (path.name !== undefined) manifest.name = path.name
    if (path.visible !== undefined) manifest.visible = path.visible
    return manifest
  })
  return { manifests, newChunks, newRefs, nextSeq }
}
