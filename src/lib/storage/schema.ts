import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type { PathData } from '$lib/stores/drawingState'
import type { RotationAngle } from '$lib/stores/drawingConfig'
import {
  CHUNK_SIZE,
  encodeChunk,
  summarize,
  type ChunkKey,
  type ChunkRecord,
  type PathManifest,
  type PathSummary,
} from './chunks'

export const DB_NAME = 'mondrian-autosave'
export const DB_VERSION = 2
export const MIGRATED_SESSION_ID = 'migrated-v1'

export interface SessionConfig {
  isTranscriptionMode: boolean
  exportSampleRate?: number
  strokeWeight: number
  speculateScale: number
  isContinuousMode: boolean
  floorPlanRotation?: RotationAngle
}

export interface VideoMeta {
  name: string
  size: number
  type: string
  duration?: number
}

export type VideoStatus = 'saved' | 'needs-reattach'
export type SnapshotKind = 'auto' | 'pinned'

export interface SnapshotMeta {
  id?: number
  sessionId: string
  kind: SnapshotKind
  label: string | null
  savedAt: number
  videoTime: number
  imageWidth: number
  imageHeight: number
  config: SessionConfig
  pathCount: number
  pointCount: number
  floorPlanKey: string | null
  floorPlanName: string | null
  videoKey: string | null
  video: (VideoMeta & { status: VideoStatus }) | null
  paths: PathSummary[]
}

export interface ManifestRecord {
  sessionId: string
  paths: PathManifest[]
}

export interface SessionRecord {
  id: string
  name: string | null
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  floorPlanName: string | null
  pathCount: number
  pointCount: number
  snapshotCount: number
  bytes: number
}

export interface SessionDbSchema extends DBSchema {
  sessions: { key: string; value: SessionRecord }
  snapshots: {
    key: number
    value: SnapshotMeta
    indexes: { bySession: string; byFloorPlan: string; byVideo: string }
  }
  manifests: { key: number; value: ManifestRecord; indexes: { bySession: string } }
  chunks: { key: ChunkKey; value: ChunkRecord }
  floorPlans: { key: string; value: Blob }
  videos: { key: string; value: Blob }
}

export type Db = IDBPDatabase<SessionDbSchema>
export const STORES = [
  'sessions',
  'snapshots',
  'manifests',
  'chunks',
  'floorPlans',
  'videos',
] as const

/** Fire a request whose failure surfaces through the transaction instead. */
export const quiet = (request: Promise<unknown>) => void request.catch(() => {})

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isValidPaths(paths: unknown): paths is PathData[] {
  if (!Array.isArray(paths)) return false
  return paths.every(
    (p) =>
      p &&
      isFiniteNumber(p.pathId) &&
      typeof p.color === 'string' &&
      Array.isArray(p.points) &&
      p.points.every(
        (pt: unknown) =>
          pt &&
          isFiniteNumber((pt as PathData['points'][number]).x) &&
          isFiniteNumber((pt as PathData['points'][number]).y) &&
          isFiniteNumber((pt as PathData['points'][number]).time)
      )
  )
}

export function isValidMeta(meta: unknown): meta is SnapshotMeta {
  const m = meta as SnapshotMeta | null
  return (
    !!m &&
    typeof m.sessionId === 'string' &&
    isFiniteNumber(m.savedAt) &&
    isFiniteNumber(m.pointCount) &&
    isFiniteNumber(m.videoTime) &&
    !!m.config &&
    typeof m.config.isTranscriptionMode === 'boolean'
  )
}

export function isValidManifest(record: unknown, pointCount: number): record is ManifestRecord {
  const r = record as ManifestRecord | undefined
  if (!r || !Array.isArray(r.paths)) return false
  let total = 0
  for (const p of r.paths) {
    if (!p || !isFiniteNumber(p.pathId) || typeof p.color !== 'string') return false
    if (!isFiniteNumber(p.count) || p.count < 0 || !Array.isArray(p.chunks)) return false
    if (p.chunks.length !== Math.ceil(p.count / CHUNK_SIZE)) return false
    if (!p.chunks.every(isFiniteNumber)) return false
    total += p.count
  }
  return total === pointCount
}

export function countPoints(paths: readonly { points: unknown[] }[]): number {
  return paths.reduce((sum, p) => sum + p.points.length, 0)
}

export function emptySession(id: string, now: number, name: string | null = null): SessionRecord {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    floorPlanName: null,
    pathCount: 0,
    pointCount: 0,
    snapshotCount: 0,
    bytes: 0,
  }
}

function hashChunk(data: Float64Array): number {
  const words = new Uint32Array(data.buffer, data.byteOffset, data.length * 2)
  let h = 0x811c9dc5
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193)
  return h >>> 0
}

function sameData(a: Float64Array, b: Float64Array) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

type AnyTx = IDBPTransaction<unknown, string[], 'versionchange'>

/**
 * Move v1 ring snapshots (full path copies in `snapshotPaths`) into one session of shared
 * chunks. Runs inside the version-change transaction, so it commits or rolls back whole.
 */
export async function migrateV1Snapshots(tx: AnyTx): Promise<void> {
  const snapshots = tx.objectStore('snapshots')
  const legacyPaths = tx.objectStore('snapshotPaths')
  const chunks = tx.objectStore('chunks')
  const metas = ((await snapshots.getAll()) as Array<Record<string, unknown>>).sort(
    (a, b) => (a.id as number) - (b.id as number)
  )
  const sessionId = MIGRATED_SESSION_ID
  const byHash = new Map<number, ChunkRecord[]>()
  let seq = 0
  let bytes = 0
  let latest: SnapshotMeta | null = null

  for (const old of metas) {
    const id = old.id as number
    if (typeof old.sessionId === 'string') continue
    const record = (await legacyPaths.get(id)) as { paths?: unknown } | undefined
    if (!record || !isValidPaths(record.paths)) {
      await snapshots.delete(id)
      continue
    }
    const manifests: PathManifest[] = record.paths.map((path) => {
      const ids: number[] = []
      for (let start = 0; start < path.points.length; start += CHUNK_SIZE) {
        const end = Math.min(path.points.length, start + CHUNK_SIZE)
        const encoded = encodeChunk(sessionId, seq, path.points, start, end)
        const hash = hashChunk(encoded.data)
        const existing = byHash.get(hash)?.find((c) => sameData(c.data, encoded.data))
        if (existing) {
          ids.push(existing.seq)
          continue
        }
        byHash.set(hash, [...(byHash.get(hash) ?? []), encoded])
        quiet(chunks.put(encoded))
        bytes += encoded.data.byteLength
        ids.push(seq++)
      }
      const m: PathManifest = {
        pathId: path.pathId,
        color: path.color,
        count: path.points.length,
        chunks: ids,
      }
      if (path.name !== undefined) m.name = path.name
      if (path.visible !== undefined) m.visible = path.visible
      return m
    })
    const meta = {
      ...old,
      sessionId,
      kind: 'auto',
      label: null,
      paths: manifests.map(summarize),
    } as unknown as SnapshotMeta
    await snapshots.put(meta)
    await tx.objectStore('manifests').put({ sessionId, paths: manifests }, id)
    latest = meta
  }

  if (latest) {
    const session = emptySession(sessionId, latest.savedAt, null)
    session.floorPlanName = latest.floorPlanName
    session.pathCount = latest.pathCount
    session.pointCount = latest.pointCount
    session.snapshotCount = await snapshots.count()
    session.bytes = bytes
    session.createdAt = Math.min(...metas.map((m) => m.savedAt as number).filter(isFiniteNumber))
    await tx.objectStore('sessions').put(session)
  }
}

export async function openSessionDb(name: string): Promise<Db> {
  return openDB<SessionDbSchema>(name, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('floorPlans')
        db.createObjectStore('videos')
      }
      if (oldVersion < 2) {
        db.createObjectStore('sessions', { keyPath: 'id' })
        db.createObjectStore('manifests').createIndex('bySession', 'sessionId')
        db.createObjectStore('chunks', { keyPath: ['sessionId', 'seq'] })
        const snapshots = tx.objectStore('snapshots')
        snapshots.createIndex('bySession', 'sessionId')
        snapshots.createIndex('byFloorPlan', 'floorPlanKey')
        snapshots.createIndex('byVideo', 'videoKey')
        const raw = db as unknown as IDBPDatabase
        if (raw.objectStoreNames.contains('snapshotPaths')) {
          await migrateV1Snapshots(tx as unknown as AnyTx)
          raw.deleteObjectStore('snapshotPaths')
        }
      }
    },
    blocking(_current, _next, event) {
      ;(event.target as IDBDatabase).close()
    },
  })
}
