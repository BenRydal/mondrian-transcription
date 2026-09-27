import type { IDBPTransaction, StoreNames } from 'idb'
import type { Point } from '$lib/p5/types/sketch'
import type { PathData } from '$lib/stores/drawingState'
import {
  CHUNK_STRIDE,
  ChunkRegistry,
  chunkLength,
  decodeChunkInto,
  planChunks,
  summarize,
  type ChunkRecord,
  type PathManifest,
} from './chunks'
import { selectRetained } from './retention'
import { randomId } from '$lib/utils/id'
import { countRecordedPaths, getTotalPointCount } from '$lib/stores/sessionRecovery'
import {
  DB_NAME,
  STORES,
  emptySession,
  isValidManifest,
  isValidMeta,
  isValidPaths,
  isYouTubeRef,
  openSessionDb,
  queueInTx,
  type Db,
  type ManifestRecord,
  type SessionConfig,
  type SessionDbSchema,
  type SessionRecord,
  type SnapshotKind,
  type SnapshotMeta,
  type VideoMeta,
  type VideoStatus,
  type YouTubeVideoRef,
} from './schema'

export {
  type SessionConfig,
  type SessionRecord,
  type SnapshotMeta,
  type VideoMeta,
  type VideoStatus,
  type YouTubeVideoRef,
}
export const LEGACY_STORAGE_KEY = 'mondrian-session'

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
  videoSource?: YouTubeVideoRef | null
}

interface SaveOptions {
  kind?: SnapshotKind
  label?: string | null
}

export interface RestoredSession {
  meta: SnapshotMeta
  paths: PathData[]
  floorPlan: Blob | null
  video: Blob | null
}

export interface SaveResult {
  id: number | null
  savedAt: number
  videoStatus: VideoStatus | null
  skipped: boolean
  evicted: number
  chunksWritten: number
  prepMs: number
}

export interface SessionBundle {
  session: SessionRecord
  snapshots: Array<{ meta: SnapshotMeta; manifest: ManifestRecord }>
  chunks: ChunkRecord[]
  floorPlans: Map<string, Blob>
  videos: Map<string, Blob>
}

interface SessionDbOptions {
  dbName?: string
  estimate?: () => Promise<{ usage?: number; quota?: number }>
  now?: () => number
}

export class StorageUnavailableError extends Error {}

function isQuotaError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

const BYTES_PER_POINT = CHUNK_STRIDE * 8
const VIDEO_QUOTA_SHARE = 0.8

interface IndexEntry {
  id: number
  savedAt: number
  pinned: boolean
  floorPlanKey: string | null
  videoKey: string | null
}

interface SessionIndex {
  sessionId: string
  refs: Map<number, number>
  chunkBytes: number
  entries: IndexEntry[]
  nextSeq: number
  lastSig: string | null
}

type WriteTx = IDBPTransaction<SessionDbSchema, typeof STORES, 'readwrite'>
type ReadTx = IDBPTransaction<SessionDbSchema, StoreNames<SessionDbSchema>[], 'readonly'>

const byNewest = (a: { id?: number }, b: { id?: number }) => (b.id ?? 0) - (a.id ?? 0)

function toEntry(meta: SnapshotMeta): IndexEntry {
  return {
    id: meta.id!,
    savedAt: meta.savedAt,
    pinned: meta.kind === 'pinned',
    floorPlanKey: meta.floorPlanKey,
    videoKey: meta.videoKey,
  }
}

function snapshotSig(manifests: PathManifest[], meta: SnapshotMeta): string {
  return JSON.stringify([
    manifests,
    meta.videoTime,
    meta.imageWidth,
    meta.imageHeight,
    meta.config,
    meta.floorPlanKey,
    meta.videoKey,
    meta.video,
    meta.videoSource ?? null,
  ])
}

function forEachChunk(paths: PathManifest[], fn: (seq: number, length: number) => void) {
  for (const p of paths) p.chunks.forEach((seq, i) => fn(seq, chunkLength(p.count, i)))
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

function chunkRange(sessionId: string) {
  return IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity])
}

type BlobStore = 'floorPlans' | 'videos'

async function putBlobIfAbsent(tx: WriteTx, store: BlobStore, key: string, blob: Blob) {
  const target = tx.objectStore(store)
  if ((await target.getKey(key)) === undefined) await target.put(blob, key)
}

function abortIfActive(tx: { abort(): void }): boolean {
  try {
    tx.abort()
    return true
  } catch {
    return false
  }
}

async function abortAndThrow(
  tx: { abort(): void; error: DOMException | null },
  e: unknown
): Promise<never> {
  abortIfActive(tx)
  throw tx.error ?? e
}

export class SessionDb {
  private rejectedVideos = new Set<string>()
  private registry = new ChunkRegistry()
  private indexes = new Map<string, SessionIndex>()
  private tail: Promise<unknown> = Promise.resolve()

  private constructor(
    private db: Db,
    private opts: SessionDbOptions
  ) {}

  static async open(opts: SessionDbOptions = {}): Promise<SessionDb> {
    if (typeof indexedDB === 'undefined') throw new StorageUnavailableError('No IndexedDB')
    try {
      return new SessionDb(await openSessionDb(opts.dbName ?? DB_NAME), opts)
    } catch (e) {
      throw new StorageUnavailableError(String(e))
    }
  }

  close() {
    this.db.close()
  }

  private now() {
    return this.opts.now?.() ?? Date.now()
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn)
    this.tail = run.catch(() => {})
    return run
  }

  invalidate(sessionId: string) {
    this.indexes.delete(sessionId)
  }

  private async ensureIndex(sessionId: string): Promise<SessionIndex> {
    const cached = this.indexes.get(sessionId)
    if (cached) return cached
    const tx = this.db.transaction(['snapshots', 'manifests', 'chunks'], 'readwrite')
    const metas = await tx.objectStore('snapshots').index('bySession').getAll(sessionId)
    const manifests = await tx.objectStore('manifests').index('bySession').getAll(sessionId)
    const latest = metas.reduce<SnapshotMeta | null>((a, m) => (a && a.id! > m.id! ? a : m), null)
    const latestManifest = latest ? await tx.objectStore('manifests').get(latest.id!) : undefined
    const refs = new Map<number, number>()
    const lengths = new Map<number, number>()
    for (const m of manifests) {
      forEachChunk(m.paths, (seq, length) => {
        refs.set(seq, (refs.get(seq) ?? 0) + 1)
        lengths.set(seq, length)
      })
    }
    let maxSeq = -1
    const chunks = tx.objectStore('chunks')
    for (const key of await chunks.getAllKeys(chunkRange(sessionId))) {
      maxSeq = Math.max(maxSeq, key[1])
      const orphaned = !refs.has(key[1])
      if (orphaned) queueInTx(chunks.delete(key))
    }
    await tx.done
    for (const seq of refs.keys()) maxSeq = Math.max(maxSeq, seq)
    let chunkBytes = 0
    for (const length of lengths.values()) chunkBytes += length * BYTES_PER_POINT
    const index: SessionIndex = {
      sessionId,
      refs,
      chunkBytes,
      entries: metas.map(toEntry).sort((a, b) => a.id - b.id),
      nextSeq: maxSeq + 1,
      lastSig: latest && latestManifest ? snapshotSig(latestManifest.paths, latest) : null,
    }
    this.indexes.set(sessionId, index)
    return index
  }

  private async inWriteTx<T>(work: (tx: WriteTx) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(STORES, 'readwrite')
    tx.done.catch(() => {})
    try {
      const result = await work(tx)
      await tx.done
      return result
    } catch (e) {
      return abortAndThrow(tx, e)
    }
  }

  private async videoFits(video: NonNullable<SnapshotInput['video']>): Promise<boolean> {
    if (this.rejectedVideos.has(video.key)) return false
    if ((await this.db.getKey('videos', video.key)) !== undefined) return true
    return video.blob.size < (await availableBytes(this.opts)) * VIDEO_QUOTA_SHARE
  }

  save(sessionId: string, input: SnapshotInput, opts: SaveOptions = {}): Promise<SaveResult> {
    return this.enqueue(async () => {
      const index = await this.ensureIndex(sessionId)
      let video = input.video
      if (video && !(await this.videoFits(video))) {
        this.rejectedVideos.add(video.key)
        video = null
      }
      try {
        return await this.write(index, input, video, opts)
      } catch (e) {
        if (!isQuotaError(e)) throw e
      }
      const evicted = await this.evictNow(index)
      try {
        return { ...(await this.write(index, input, video, opts)), evicted }
      } catch (e) {
        if (!video || !isQuotaError(e)) throw e
        this.rejectedVideos.add(video.key)
        return { ...(await this.write(index, input, null, opts)), evicted }
      }
    })
  }

  private async write(
    index: SessionIndex,
    input: SnapshotInput,
    video: SnapshotInput['video'],
    opts: SaveOptions
  ): Promise<SaveResult> {
    const started = performance.now()
    const { sessionId } = index
    const kind = opts.kind ?? 'auto'
    const savedAt = input.savedAt ?? this.now()
    const isLive = (seq: number) => (index.refs.get(seq) ?? 0) > 0
    const plan = planChunks(sessionId, input.paths, this.registry, isLive, index.nextSeq)
    const videoMeta = input.video
      ? { ...input.video.meta, status: (video ? 'saved' : 'needs-reattach') as VideoStatus }
      : null
    const meta: SnapshotMeta = {
      sessionId,
      kind,
      label: opts.label ?? null,
      savedAt,
      videoTime: input.videoTime,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      config: input.config,
      pathCount: countRecordedPaths(input.paths),
      pointCount: getTotalPointCount(input.paths),
      floorPlanKey: input.floorPlan?.key ?? null,
      floorPlanName: input.floorPlan?.name ?? null,
      videoKey: video?.key ?? null,
      video: videoMeta,
      paths: plan.manifests.map(summarize),
    }
    if (input.videoSource) meta.videoSource = input.videoSource
    const sig = snapshotSig(plan.manifests, meta)
    const last = index.entries.at(-1)
    if (kind === 'auto' && last && sig === index.lastSig) {
      return {
        id: last.id,
        savedAt: last.savedAt,
        videoStatus: videoMeta?.status ?? null,
        skipped: true,
        evicted: 0,
        chunksWritten: 0,
        prepMs: performance.now() - started,
      }
    }

    const committed = await this.inWriteTx(async (tx) => {
      const chunks = tx.objectStore('chunks')
      for (const chunk of plan.newChunks) queueInTx(chunks.put(chunk))
      const prepMs = performance.now() - started
      if (input.floorPlan) {
        await putBlobIfAbsent(tx, 'floorPlans', input.floorPlan.key, input.floorPlan.blob)
      }
      if (video) await putBlobIfAbsent(tx, 'videos', video.key, video.blob)
      const id = await tx.objectStore('snapshots').add(meta)
      meta.id = id
      await tx.objectStore('manifests').put({ sessionId, paths: plan.manifests }, id)

      const deltas = new Map<number, number>()
      forEachChunk(plan.manifests, (seq) => deltas.set(seq, (deltas.get(seq) ?? 0) + 1))
      const entries = [...index.entries, toEntry(meta)]
      const keep = selectRetained(entries, savedAt)
      const dropped = entries.filter((e) => !keep.has(e.id))
      const freed = await this.deleteInTx(tx, index, dropped, deltas)
      const assetBytes = (input.floorPlan?.blob.size ?? 0) + (video?.blob.size ?? 0)
      const newBytes = plan.newChunks.reduce((s, c) => s + c.data.byteLength, 0)
      await this.updateSession(tx, sessionId, (s) => ({
        ...s,
        updatedAt: Math.max(s.updatedAt, savedAt),
        floorPlanName: meta.floorPlanName ?? s.floorPlanName,
        pathCount: meta.pathCount,
        pointCount: meta.pointCount,
        snapshotCount: entries.length - dropped.length,
        bytes: index.chunkBytes + newBytes - freed + assetBytes,
      }))
      return {
        id,
        prepMs,
        deltas,
        byteDelta: newBytes - freed,
        kept: entries.filter((e) => keep.has(e.id)),
      }
    })
    this.commit(index, committed.deltas, committed.byteDelta, committed.kept)
    index.nextSeq = plan.nextSeq
    index.lastSig = sig
    for (const ref of plan.newRefs) this.registry.register(sessionId, ref.seq, ref.points)
    return {
      id: committed.id,
      savedAt,
      videoStatus: videoMeta?.status ?? null,
      skipped: false,
      evicted: 0,
      chunksWritten: plan.newChunks.length,
      prepMs: committed.prepMs,
    }
  }

  private async updateSession(
    tx: WriteTx,
    sessionId: string,
    update: (s: SessionRecord) => SessionRecord
  ) {
    const store = tx.objectStore('sessions')
    const current = (await store.get(sessionId)) ?? emptySession(sessionId, this.now())
    await store.put(update(current))
  }

  private async deleteInTx(
    tx: WriteTx,
    index: SessionIndex,
    dropped: IndexEntry[],
    deltas: Map<number, number>
  ): Promise<number> {
    const manifests = tx.objectStore('manifests')
    const snapshots = tx.objectStore('snapshots')
    const lengths = new Map<number, number>()
    for (const entry of dropped) {
      const manifest = await manifests.get(entry.id)
      queueInTx(snapshots.delete(entry.id))
      queueInTx(manifests.delete(entry.id))
      if (!manifest) continue
      forEachChunk(manifest.paths, (seq, length) => {
        deltas.set(seq, (deltas.get(seq) ?? 0) - 1)
        lengths.set(seq, length)
      })
    }
    let freed = 0
    for (const [seq, delta] of deltas) {
      if (delta < 0 && (index.refs.get(seq) ?? 0) + delta <= 0) {
        queueInTx(tx.objectStore('chunks').delete([index.sessionId, seq]))
        freed += (lengths.get(seq) ?? 0) * BYTES_PER_POINT
      }
    }
    await this.collectBlobs(
      tx,
      dropped.map((e) => e.floorPlanKey),
      dropped.map((e) => e.videoKey)
    )
    return freed
  }

  private async collectBlobs(
    tx: WriteTx,
    floorPlanKeys: (string | null)[],
    videoKeys: (string | null)[]
  ) {
    const snapshots = tx.objectStore('snapshots')
    const sweeps = [
      ['floorPlans', 'byFloorPlan', floorPlanKeys],
      ['videos', 'byVideo', videoKeys],
    ] as const
    for (const [store, index, keys] of sweeps) {
      for (const key of new Set(keys)) {
        if (key && (await snapshots.index(index).count(key)) === 0) {
          await tx.objectStore(store).delete(key)
        }
      }
    }
  }

  private commit(
    index: SessionIndex,
    deltas: Map<number, number>,
    byteDelta: number,
    entries: IndexEntry[]
  ) {
    for (const [seq, delta] of deltas) {
      const count = (index.refs.get(seq) ?? 0) + delta
      if (count > 0) index.refs.set(seq, count)
      else index.refs.delete(seq)
    }
    index.chunkBytes += byteDelta
    index.entries = entries
  }

  private async deleteEntries(index: SessionIndex, dropped: IndexEntry[]): Promise<void> {
    if (dropped.length === 0) return
    const { deltas, freed, entries } = await this.inWriteTx(async (tx) => {
      const deltas = new Map<number, number>()
      const freed = await this.deleteInTx(tx, index, dropped, deltas)
      const ids = new Set(dropped.map((e) => e.id))
      const entries = index.entries.filter((e) => !ids.has(e.id))
      await this.updateSession(tx, index.sessionId, (s) => ({
        ...s,
        snapshotCount: entries.length,
        bytes: Math.max(0, s.bytes - freed),
      }))
      return { deltas, freed, entries }
    })
    this.commit(index, deltas, -freed, entries)
    index.lastSig = null
  }

  private async evictNow(index: SessionIndex): Promise<number> {
    const newest = index.entries.at(-1)?.id
    const candidates = index.entries.filter((e) => !e.pinned && e.id !== newest)
    const dropped = candidates.slice(0, Math.ceil(candidates.length / 2))
    await this.deleteEntries(index, dropped)
    return dropped.length
  }

  evictAutosaves(sessionId: string): Promise<number> {
    return this.enqueue(async () => this.evictNow(await this.ensureIndex(sessionId)))
  }

  deleteSnapshot(id: number): Promise<boolean> {
    return this.enqueue(async () => {
      const meta = await this.db.get('snapshots', id)
      if (!meta) return false
      const index = await this.ensureIndex(meta.sessionId)
      const entry = index.entries.find((e) => e.id === id)
      if (!entry) return false
      await this.deleteEntries(index, [entry])
      return true
    })
  }

  renameSnapshot(id: number, label: string | null): Promise<void> {
    return this.enqueue(async () => {
      const tx = this.db.transaction('snapshots', 'readwrite')
      const meta = await tx.store.get(id)
      if (meta) await tx.store.put({ ...meta, label: label?.trim() || null })
      await tx.done
    })
  }

  private async validManifest(tx: ReadTx, meta: SnapshotMeta | undefined) {
    if (!meta || !isValidMeta(meta)) return null
    const manifest = await tx.objectStore('manifests').get(meta.id!)
    return isValidManifest(manifest, meta.pointCount) ? manifest : null
  }

  private async loadEntry(tx: ReadTx, meta: SnapshotMeta): Promise<RestoredSession | null> {
    const manifest = await this.validManifest(tx, meta)
    if (!manifest) return null
    const paths: PathData[] = []
    for (const p of manifest.paths) {
      const points = await this.readPathPoints(tx, meta.sessionId, p)
      if (!points) return null
      paths.push(toPathData(p, points))
    }
    const floorPlan = meta.floorPlanKey
      ? ((await tx.objectStore('floorPlans').get(meta.floorPlanKey)) ?? null)
      : null
    if (meta.floorPlanKey && !floorPlan) return null
    const video = meta.videoKey
      ? ((await tx.objectStore('videos').get(meta.videoKey)) ?? null)
      : null
    if (meta.video && !video) meta.video = { ...meta.video, status: 'needs-reattach' }
    if (meta.videoSource !== undefined && !isYouTubeRef(meta.videoSource)) delete meta.videoSource
    return { meta, paths, floorPlan, video }
  }

  private async readPathPoints(
    tx: ReadTx,
    sessionId: string,
    manifest: PathManifest
  ): Promise<Point[] | null> {
    const store = tx.objectStore('chunks')
    const records = await Promise.all(manifest.chunks.map((seq) => store.get([sessionId, seq])))
    const points: Point[] = []
    for (let i = 0; i < records.length; i++) {
      const start = points.length
      if (!decodeChunkInto(records[i], chunkLength(manifest.count, i), manifest.pathId, points)) {
        return null
      }
      this.registry.register(sessionId, manifest.chunks[i], points.slice(start))
    }
    return points
  }

  private readTx(): ReadTx {
    return this.db.transaction(
      ['snapshots', 'manifests', 'chunks', 'floorPlans', 'videos'],
      'readonly'
    ) as unknown as ReadTx
  }

  async loadLatest(sessionId: string): Promise<RestoredSession | null> {
    const tx = this.readTx()
    const metas = await tx.objectStore('snapshots').index('bySession').getAll(sessionId)
    for (const meta of metas.sort(byNewest)) {
      const session = await this.loadEntry(tx, meta)
      if (session) return session
    }
    return null
  }

  async loadSnapshot(id: number): Promise<RestoredSession | null> {
    const tx = this.readTx()
    const meta = await tx.objectStore('snapshots').get(id)
    return meta ? this.loadEntry(tx, meta) : null
  }

  async loadPath(id: number, pathId: number): Promise<PathData | null> {
    const tx = this.readTx()
    const meta = await tx.objectStore('snapshots').get(id)
    const p = (await this.validManifest(tx, meta))?.paths.find((m) => m.pathId === pathId)
    if (!meta || !p) return null
    const points = await this.readPathPoints(tx, meta.sessionId, p)
    return points ? toPathData(p, points) : null
  }

  async listSnapshots(sessionId: string): Promise<SnapshotMeta[]> {
    const all = await this.db.getAllFromIndex('snapshots', 'bySession', sessionId)
    return all.sort(byNewest).filter((m) => m.pathCount > 0)
  }

  async listSessions(): Promise<SessionRecord[]> {
    return (await this.db.getAll('sessions')).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return (await this.db.get('sessions', id)) ?? null
  }

  async lastOpenedSessionId(): Promise<string | null> {
    const sessions = await this.db.getAll('sessions')
    sessions.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    return sessions[0]?.id ?? null
  }

  createSession(name: string | null = null): Promise<SessionRecord> {
    return this.enqueue(async () => {
      const session = emptySession(randomId(), this.now(), name)
      await this.db.put('sessions', session)
      return session
    })
  }

  private patchSession(id: string, patch: (s: SessionRecord) => SessionRecord) {
    return this.enqueue(async () => {
      const tx = this.db.transaction('sessions', 'readwrite')
      const current = await tx.store.get(id)
      if (current) await tx.store.put(patch(current))
      await tx.done
    })
  }

  touchSession(id: string): Promise<void> {
    return this.patchSession(id, (s) => ({ ...s, lastOpenedAt: this.now() }))
  }

  renameSession(id: string, name: string): Promise<void> {
    return this.patchSession(id, (s) => ({ ...s, name: name.trim() || null }))
  }

  deleteSession(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.inWriteTx(async (tx) => {
        const snapshots = tx.objectStore('snapshots')
        const metas = await snapshots.index('bySession').getAll(id)
        for (const meta of metas) queueInTx(snapshots.delete(meta.id!))
        const manifests = tx.objectStore('manifests')
        for (const key of await manifests.index('bySession').getAllKeys(id)) {
          queueInTx(manifests.delete(key))
        }
        await tx.objectStore('chunks').delete(chunkRange(id))
        await tx.objectStore('sessions').delete(id)
        await this.collectBlobs(
          tx,
          metas.map((m) => m.floorPlanKey),
          metas.map((m) => m.videoKey)
        )
      })
      this.indexes.delete(id)
    })
  }

  async exportSession(id: string): Promise<SessionBundle | null> {
    const tx = this.db.transaction(STORES, 'readonly')
    const session = await tx.objectStore('sessions').get(id)
    if (!session) return null
    const metas = (await tx.objectStore('snapshots').index('bySession').getAll(id)).sort(
      (a, b) => a.id! - b.id!
    )
    const snapshots: SessionBundle['snapshots'] = []
    for (const meta of metas) {
      const manifest = await tx.objectStore('manifests').get(meta.id!)
      if (manifest) snapshots.push({ meta, manifest })
    }
    const chunks = await tx.objectStore('chunks').getAll(chunkRange(id))
    const floorPlans = new Map<string, Blob>()
    const videos = new Map<string, Blob>()
    const collect = async (store: BlobStore, key: string | null, into: Map<string, Blob>) => {
      if (!key || into.has(key)) return
      const blob = await tx.objectStore(store).get(key)
      if (blob) into.set(key, blob)
    }
    for (const { meta } of snapshots) {
      await collect('floorPlans', meta.floorPlanKey, floorPlans)
      await collect('videos', meta.videoKey, videos)
    }
    return { session, snapshots, chunks, floorPlans, videos }
  }

  importSession(bundle: SessionBundle): Promise<SessionRecord> {
    return this.enqueue(async () => {
      const id = randomId()
      const now = this.now()
      const session: SessionRecord = { ...bundle.session, id, lastOpenedAt: now }
      return this.inWriteTx(async (tx) => {
        for (const chunk of bundle.chunks)
          queueInTx(tx.objectStore('chunks').put({ ...chunk, sessionId: id }))
        for (const [key, blob] of bundle.floorPlans) {
          await putBlobIfAbsent(tx, 'floorPlans', key, blob)
        }
        for (const [key, blob] of bundle.videos) await putBlobIfAbsent(tx, 'videos', key, blob)
        for (const { meta, manifest } of bundle.snapshots) {
          const copy: SnapshotMeta = { ...meta, sessionId: id }
          delete copy.id
          if (copy.videoKey && !bundle.videos.has(copy.videoKey)) {
            copy.videoKey = null
            if (copy.video) copy.video = { ...copy.video, status: 'needs-reattach' }
          }
          const newSnapshotId = await tx.objectStore('snapshots').add(copy)
          await tx.objectStore('manifests').put({ ...manifest, sessionId: id }, newSnapshotId)
        }
        await tx.objectStore('sessions').put(session)
        return session
      })
    })
  }

  async importLegacy(storage: Storage): Promise<string | null> {
    const raw = storage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const legacy = JSON.parse(raw)
    if (!isValidPaths(legacy?.paths) || !legacy.config) return null
    const timestamp = Number.isFinite(legacy.timestamp) ? legacy.timestamp : this.now()
    const sessionId = `legacy-${timestamp}`
    const exists = (await this.db.getKey('sessions', sessionId)) !== undefined
    if (!exists && getTotalPointCount(legacy.paths) > 0) {
      const floorPlan =
        typeof legacy.floorPlanDataUrl === 'string'
          ? await (await fetch(legacy.floorPlanDataUrl)).blob()
          : null
      await this.save(sessionId, {
        paths: legacy.paths,
        videoTime: legacy.videoTime ?? 0,
        imageWidth: legacy.imageWidth ?? 0,
        imageHeight: legacy.imageHeight ?? 0,
        config: legacy.config,
        savedAt: timestamp,
        floorPlan: floorPlan
          ? { key: `legacy-${timestamp}`, blob: floorPlan, name: 'Restored floor plan' }
          : null,
        video: null,
      })
      await this.patchSession(sessionId, (s) => ({
        ...s,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp,
      }))
    }
    storage.removeItem(LEGACY_STORAGE_KEY)
    return exists || getTotalPointCount(legacy.paths) > 0 ? sessionId : null
  }
}

function toPathData(manifest: PathManifest, points: Point[]): PathData {
  const path: PathData = { points, color: manifest.color, pathId: manifest.pathId }
  if (manifest.name !== undefined) path.name = manifest.name
  if (manifest.visible !== undefined) path.visible = manifest.visible
  return path
}
