import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type { PathData } from '$lib/stores/drawingState'
import type { RotationAngle } from '$lib/stores/drawingConfig'

export const DB_NAME = 'mondrian-autosave'
const DB_VERSION = 1
// Blobs are deduped by key, so a bigger ring only adds small metadata/path rows.
export const RING_SIZE = 10
export const LEGACY_STORAGE_KEY = 'mondrian-session'

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

export interface SnapshotMeta {
  id?: number
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
}

export interface AssetInput<T extends Blob = Blob> {
  key: string
  blob: T
  name: string
}

export interface SnapshotInput {
  paths: PathData[]
  videoTime: number
  imageWidth: number
  imageHeight: number
  config: SessionConfig
  savedAt?: number
  floorPlan: AssetInput | null
  video: (AssetInput & { meta: VideoMeta }) | null
}

export interface RestoredSession {
  meta: SnapshotMeta
  paths: PathData[]
  floorPlan: Blob | null
  video: Blob | null
}

export interface SaveResult {
  savedAt: number
  videoStatus: VideoStatus | null
}

interface SessionDbSchema extends DBSchema {
  snapshots: { key: number; value: SnapshotMeta }
  snapshotPaths: { key: number; value: { paths: PathData[] } }
  floorPlans: { key: string; value: Blob }
  videos: { key: string; value: Blob }
}

type Db = IDBPDatabase<SessionDbSchema>
const STORES = ['snapshots', 'snapshotPaths', 'floorPlans', 'videos'] as const

export interface SessionDbOptions {
  dbName?: string
  ringSize?: number
  estimate?: () => Promise<{ usage?: number; quota?: number }>
}

export class StorageUnavailableError extends Error {}

export function isQuotaError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isValidPaths(paths: unknown): paths is PathData[] {
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

function isValidMeta(meta: unknown): meta is SnapshotMeta {
  const m = meta as SnapshotMeta | null
  return (
    !!m &&
    isFiniteNumber(m.savedAt) &&
    isFiniteNumber(m.pointCount) &&
    isFiniteNumber(m.videoTime) &&
    !!m.config &&
    typeof m.config.isTranscriptionMode === 'boolean'
  )
}

export function countPoints(paths: PathData[]): number {
  return paths.reduce((sum, p) => sum + p.points.length, 0)
}

async function availableBytes(opts: SessionDbOptions): Promise<number> {
  const estimate =
    opts.estimate ??
    (typeof navigator !== 'undefined' && navigator.storage?.estimate
      ? () => navigator.storage.estimate()
      : null)
  if (!estimate) return Infinity
  try {
    const { usage = 0, quota } = await estimate()
    return quota === undefined ? Infinity : quota - usage
  } catch {
    return Infinity
  }
}

export class SessionDb {
  private rejectedVideos = new Set<string>()

  private constructor(
    private db: Db,
    private opts: SessionDbOptions
  ) {}

  static async open(opts: SessionDbOptions = {}): Promise<SessionDb> {
    if (typeof indexedDB === 'undefined') throw new StorageUnavailableError('No IndexedDB')
    try {
      const db = await openDB<SessionDbSchema>(opts.dbName ?? DB_NAME, DB_VERSION, {
        upgrade(db) {
          db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true })
          db.createObjectStore('snapshotPaths')
          db.createObjectStore('floorPlans')
          db.createObjectStore('videos')
        },
        blocking() {
          db.close()
        },
      })
      return new SessionDb(db, opts)
    } catch (e) {
      throw new StorageUnavailableError(String(e))
    }
  }

  close() {
    this.db.close()
  }

  private async videoFits(video: NonNullable<SnapshotInput['video']>): Promise<boolean> {
    if (this.rejectedVideos.has(video.key)) return false
    if ((await this.db.getKey('videos', video.key)) !== undefined) return true
    const margin = 0.8
    return video.blob.size < (await availableBytes(this.opts)) * margin
  }

  /** Write one snapshot atomically; drops the video (never the paths) when it will not fit. */
  async save(input: SnapshotInput): Promise<SaveResult> {
    let video = input.video
    if (video && !(await this.videoFits(video))) {
      this.rejectedVideos.add(video.key)
      video = null
    }
    try {
      return await this.write(input, video)
    } catch (e) {
      if (!video || !isQuotaError(e)) throw e
      this.rejectedVideos.add(video.key)
      return await this.write(input, null)
    }
  }

  private async write(input: SnapshotInput, video: SnapshotInput['video']): Promise<SaveResult> {
    const savedAt = input.savedAt ?? Date.now()
    const videoMeta = input.video
      ? { ...input.video.meta, status: (video ? 'saved' : 'needs-reattach') as VideoStatus }
      : null
    const meta: SnapshotMeta = {
      savedAt,
      videoTime: input.videoTime,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      config: input.config,
      pathCount: input.paths.filter((p) => p.points.length > 0).length,
      pointCount: countPoints(input.paths),
      floorPlanKey: input.floorPlan?.key ?? null,
      floorPlanName: input.floorPlan?.name ?? null,
      videoKey: video?.key ?? null,
      video: videoMeta,
    }

    const tx = this.db.transaction(STORES, 'readwrite')
    tx.done.catch(() => {})
    try {
      const snapshots = tx.objectStore('snapshots')
      const floorPlans = tx.objectStore('floorPlans')
      const videos = tx.objectStore('videos')
      if (input.floorPlan && (await floorPlans.getKey(input.floorPlan.key)) === undefined) {
        await floorPlans.put(input.floorPlan.blob, input.floorPlan.key)
      }
      if (video && (await videos.getKey(video.key)) === undefined) {
        await videos.put(video.blob, video.key)
      }
      const id = await snapshots.add(meta)
      await tx.objectStore('snapshotPaths').put({ paths: input.paths }, id)

      const all = (await snapshots.getAll()).sort(byNewest)
      const keep = all.slice(0, this.opts.ringSize ?? RING_SIZE)
      for (const old of all.slice(keep.length)) {
        await snapshots.delete(old.id!)
        await tx.objectStore('snapshotPaths').delete(old.id!)
      }
      const usedPlans = new Set(keep.map((m) => m.floorPlanKey))
      const usedVideos = new Set(keep.map((m) => m.videoKey))
      for (const key of await floorPlans.getAllKeys()) {
        if (!usedPlans.has(key)) await floorPlans.delete(key)
      }
      for (const key of await videos.getAllKeys()) {
        if (!usedVideos.has(key)) await videos.delete(key)
      }
      await tx.done
    } catch (e) {
      try {
        tx.abort()
      } catch {
        // Already aborted or committed.
      }
      throw tx.error ?? e
    }
    return { savedAt, videoStatus: videoMeta?.status ?? null }
  }

  private async loadEntry(
    tx: IDBPTransaction<SessionDbSchema, typeof STORES, 'readonly'>,
    meta: SnapshotMeta
  ): Promise<RestoredSession | null> {
    if (!isValidMeta(meta)) return null
    const record = await tx.objectStore('snapshotPaths').get(meta.id!)
    if (!record || !isValidPaths(record.paths)) return null
    if (countPoints(record.paths) !== meta.pointCount) return null
    const floorPlan = meta.floorPlanKey
      ? ((await tx.objectStore('floorPlans').get(meta.floorPlanKey)) ?? null)
      : null
    if (meta.floorPlanKey && !floorPlan) return null
    const video = meta.videoKey
      ? ((await tx.objectStore('videos').get(meta.videoKey)) ?? null)
      : null
    if (meta.video && !video) meta.video = { ...meta.video, status: 'needs-reattach' }
    return { meta, paths: record.paths, floorPlan, video }
  }

  /** Newest snapshot that passes validation, with its blobs; corrupt ones are skipped. */
  async loadLatest(): Promise<RestoredSession | null> {
    const tx = this.db.transaction(STORES, 'readonly')
    const metas = (await tx.objectStore('snapshots').getAll()).sort(byNewest)
    for (const meta of metas) {
      const session = await this.loadEntry(tx, meta)
      if (session) return session
    }
    return null
  }

  /** Non-empty snapshots, newest first, for the Saved Versions list. */
  async listSnapshots(): Promise<SnapshotMeta[]> {
    const all = await this.db.getAll('snapshots')
    return all.sort(byNewest).filter((m) => m.pathCount > 0)
  }

  /** Load one specific snapshot by id, with its blobs; null if missing or corrupt. */
  async loadSnapshot(id: number): Promise<RestoredSession | null> {
    const tx = this.db.transaction(STORES, 'readonly')
    const meta = await tx.objectStore('snapshots').get(id)
    if (!meta) return null
    return this.loadEntry(tx, meta)
  }

  async clear(): Promise<void> {
    const tx = this.db.transaction(STORES, 'readwrite')
    await Promise.all([...STORES.map((s) => tx.objectStore(s).clear()), tx.done])
  }

  /** Import a pre-IndexedDB localStorage session; the key is removed only after the write commits. */
  async importLegacy(storage: Storage): Promise<boolean> {
    const raw = storage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return false
    const legacy = JSON.parse(raw)
    if (!isValidPaths(legacy?.paths) || !legacy.config) return false
    if (countPoints(legacy.paths) > 0) {
      const floorPlan =
        typeof legacy.floorPlanDataUrl === 'string'
          ? await (await fetch(legacy.floorPlanDataUrl)).blob()
          : null
      await this.save({
        paths: legacy.paths,
        videoTime: legacy.videoTime ?? 0,
        imageWidth: legacy.imageWidth ?? 0,
        imageHeight: legacy.imageHeight ?? 0,
        config: legacy.config,
        savedAt: isFiniteNumber(legacy.timestamp) ? legacy.timestamp : Date.now(),
        floorPlan: floorPlan
          ? { key: `legacy-${legacy.timestamp}`, blob: floorPlan, name: 'Restored floor plan' }
          : null,
        video: null,
      })
    }
    storage.removeItem(LEGACY_STORAGE_KEY)
    return true
  }
}

// Order by insertion id, not savedAt, so a wall-clock jump cannot evict the newest save.
function byNewest(a: SnapshotMeta, b: SnapshotMeta) {
  return (b.id ?? 0) - (a.id ?? 0)
}
