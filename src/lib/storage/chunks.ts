import type { Point } from '$lib/p5/types/sketch'
import type { PathData } from '$lib/stores/drawingState'

export const CHUNK_SIZE = 500
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
  sig: number
}

export function chunkLength(count: number, index: number): number {
  return Math.max(0, Math.min(CHUNK_SIZE, count - index * CHUNK_SIZE))
}

export function chunkCount(count: number): number {
  return Math.ceil(count / CHUNK_SIZE)
}

export function forEachChunkRange(count: number, fn: (start: number, end: number) => void) {
  for (let start = 0; start < count; start += CHUNK_SIZE)
    fn(start, Math.min(count, start + CHUNK_SIZE))
}

export function manifestFor(path: PathData, chunks: number[]): PathManifest {
  const manifest: PathManifest = {
    pathId: path.pathId,
    color: path.color,
    count: path.points.length,
    chunks,
  }
  if (path.name !== undefined) manifest.name = path.name
  if (path.visible !== undefined) manifest.visible = path.visible
  return manifest
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

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export function fnv1a(values: ArrayLike<number>, seed = FNV_OFFSET): number {
  let h = seed
  for (let i = 0; i < values.length; i++) h = Math.imul(h ^ values[i], FNV_PRIME)
  return h >>> 0
}

function pathSignature(chunks: readonly number[], count: number): number {
  return fnv1a(chunks, FNV_OFFSET ^ count)
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

interface ChunkPlan {
  manifests: PathManifest[]
  newChunks: ChunkRecord[]
  newRefs: Array<{ seq: number; points: Point[] }>
  nextSeq: number
}

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
    forEachChunkRange(points.length, (start, end) => {
      let seq = registry.find(sessionId, points, start, end, isLive)
      if (seq === null) {
        seq = nextSeq++
        newChunks.push(encodeChunk(sessionId, seq, points, start, end))
        newRefs.push({ seq, points: points.slice(start, end) })
      }
      chunks.push(seq)
    })
    return manifestFor(path, chunks)
  })
  return { manifests, newChunks, newRefs, nextSeq }
}
