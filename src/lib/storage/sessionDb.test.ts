import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import type { PathData } from '$lib/stores/drawingState'
import { CHUNK_SIZE } from './chunks'
import { MIGRATED_SESSION_ID } from './schema'
import { LEGACY_STORAGE_KEY, SessionDb, type SnapshotInput } from './sessionDb'

let dbCount = 0
const freshName = () => `test-db-${++dbCount}`
const SID = 'session-a'
const MIN = 60_000
const T0 = 1_000 * 24 * 60 * MIN

function makePath(pointCount: number, pathId = 1, offset = 0): PathData {
  const points = Array.from({ length: pointCount }, (_, i) => ({
    x: i + offset,
    y: i * 2,
    time: i * 0.01,
    pathId,
  }))
  return { points, color: '#FF0000', pathId }
}
const makePaths = (pointCount: number, pathId = 1) => [makePath(pointCount, pathId)]

function makeInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    paths: makePaths(3),
    videoTime: 1.5,
    imageWidth: 640,
    imageHeight: 480,
    config: {
      isTranscriptionMode: true,
      exportSampleRate: 10,
      strokeWeight: 5,
      speculateScale: 1,
      isContinuousMode: true,
      floorPlanRotation: 90,
    },
    floorPlan: {
      key: 'fp-1',
      blob: new Blob(['png-bytes'], { type: 'image/png' }),
      name: 'plan.png',
    },
    video: null,
    ...overrides,
  }
}

function makeVideo(bytes = 'video-bytes', key = 'v-1') {
  const file = new File([bytes], 'clip.mp4', { type: 'video/mp4' })
  return {
    key,
    blob: file,
    name: file.name,
    meta: { name: file.name, size: file.size, type: file.type, duration: 12.5 },
  }
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

const originalPut = IDBObjectStore.prototype.put
afterEach(() => {
  IDBObjectStore.prototype.put = originalPut
})

/** Count puts per store while `fn` runs. */
async function countPuts(fn: () => Promise<unknown>): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
    counts[this.name] = (counts[this.name] ?? 0) + 1
    return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>)
  }
  try {
    await fn()
  } finally {
    IDBObjectStore.prototype.put = originalPut
  }
  return counts
}

/** Every chunk referenced by a manifest exists, and no chunk is unreferenced. */
async function assertChunksConsistent(name: string) {
  const raw = await openDB(name)
  const manifests = await raw.getAll('manifests')
  const keys = new Set(
    ((await raw.getAllKeys('chunks')) as [string, number][]).map(([s, q]) => `${s}:${q}`)
  )
  const referenced = new Set<string>()
  for (const m of manifests) {
    for (const p of m.paths) for (const seq of p.chunks) referenced.add(`${m.sessionId}:${seq}`)
  }
  raw.close()
  for (const key of referenced) expect(keys.has(key), `missing chunk ${key}`).toBe(true)
  for (const key of keys) expect(referenced.has(key), `orphan chunk ${key}`).toBe(true)
  return { chunks: keys.size, manifests: manifests.length }
}

describe('SessionDb chunked storage', () => {
  it('round-trips multi-chunk paths, path metadata, config and blobs', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const paths = [
      { ...makePath(1234, 1), name: 'Teacher', visible: false },
      makePath(CHUNK_SIZE, 2),
      makePath(0, 3),
    ]
    const input = makeInput({ paths, video: makeVideo() })
    const result = await db.save(SID, input)
    expect(result.videoStatus).toBe('saved')
    expect(result.chunksWritten).toBe(3 + 1)

    const restored = await db.loadLatest(SID)
    expect(restored!.paths).toEqual(paths)
    expect(restored!.meta.config).toEqual(input.config)
    expect(restored!.meta.pathCount).toBe(2)
    expect(restored!.meta.pointCount).toBe(1234 + CHUNK_SIZE)
    expect(restored!.meta.paths.map((p) => p.count)).toEqual([1234, CHUNK_SIZE, 0])
    expect(await restored!.floorPlan!.text()).toBe('png-bytes')
    expect(await restored!.video!.text()).toBe('video-bytes')
    expect(restored!.meta.video).toMatchObject({ name: 'clip.mp4', status: 'saved' })
    db.close()
  })

  it('writes only the changed open chunk when one path grows', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const paths = Array.from({ length: 10 }, (_, i) => makePath(2_000 + i, i + 1))
    await db.save(SID, makeInput({ paths }))

    const grown = paths.map((p, i) =>
      i === 4 ? { ...p, points: [...p.points, { x: 1, y: 1, time: 99, pathId: 5 }] } : p
    )
    let chunksWritten = 0
    const puts = await countPuts(async () => {
      chunksWritten = (await db.save(SID, makeInput({ paths: grown }))).chunksWritten
    })
    expect(chunksWritten).toBe(1)
    expect(puts.chunks).toBe(1)
    expect(puts.manifests).toBe(1)
    expect((await db.loadLatest(SID))!.paths).toEqual(grown)
    db.close()
  })

  it('writes no chunks for a rename or recolour', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const paths = [makePath(1500)]
    await db.save(SID, makeInput({ paths }))
    const renamed = [{ ...paths[0], name: 'Student A', color: '#00FF00' }]
    const result = await db.save(SID, makeInput({ paths: renamed }))
    expect(result.chunksWritten).toBe(0)
    expect((await db.loadLatest(SID))!.paths).toEqual(renamed)
    db.close()
  })

  it('reuses chunks after a restore so the next save writes nothing new', async () => {
    const name = freshName()
    const first = await SessionDb.open({ dbName: name })
    await first.save(SID, makeInput({ paths: [makePath(3000)] }))
    first.close()

    const db = await SessionDb.open({ dbName: name })
    const restored = await db.loadLatest(SID)
    const result = await db.save(SID, makeInput({ paths: restored!.paths, videoTime: 7 }))
    expect(result.chunksWritten).toBe(0)
    db.close()
  })

  it('skips an autosave identical to the previous snapshot', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const input = makeInput({ paths: [makePath(10)] })
    const a = await db.save(SID, input)
    const b = await db.save(SID, input)
    expect(b.skipped).toBe(true)
    expect(b.id).toBe(a.id)
    const pinned = await db.save(SID, input, { kind: 'pinned', label: 'Mine' })
    expect(pinned.skipped).toBe(false)
    expect((await db.listSnapshots(SID)).length).toBe(2)
    db.close()
  })

  it('truncation writes new chunks and never alters chunks older snapshots use', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    const full = makePath(1200)
    await db.save(SID, makeInput({ paths: [full] }))
    const [older] = await db.listSnapshots(SID)

    const rewound = { ...full, points: full.points.filter((p) => p.time <= 7) }
    expect(rewound.points.length).toBe(701)
    const r = await db.save(SID, makeInput({ paths: [rewound] }))
    // Chunk 0 is shared; chunk 1 is now a 201-point open chunk.
    expect(r.chunksWritten).toBe(1)
    const regrown = {
      ...rewound,
      points: [...rewound.points, ...makePath(400, 1, 5000).points],
    }
    await db.save(SID, makeInput({ paths: [regrown] }))

    expect((await db.loadLatest(SID))!.paths).toEqual([regrown])
    expect((await db.loadSnapshot(older.id!))!.paths).toEqual([full])
    const [, middle] = await db.listSnapshots(SID)
    expect((await db.loadSnapshot(middle.id!))!.paths).toEqual([rewound])
    db.close()
    await assertChunksConsistent(name)
  })

  it('stores a changed middle point as a new chunk for that range only', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const path = makePath(2000)
    await db.save(SID, makeInput({ paths: [path] }))
    const points = [...path.points]
    points[750] = { ...points[750], x: -1 }
    const result = await db.save(SID, makeInput({ paths: [{ ...path, points }] }))
    expect(result.chunksWritten).toBe(1)
    expect((await db.loadLatest(SID))!.paths[0].points[750].x).toBe(-1)
    db.close()
  })

  it('thins autosaves by tier and garbage-collects only unreferenced chunks', async () => {
    const name = freshName()
    let now = T0
    const db = await SessionDb.open({ dbName: name, now: () => now })
    const pathA = makePath(0, 1)
    const pathB = makePath(900, 2)
    for (let i = 0; i < 2 * 60 * 6; i++) {
      now = T0 + i * 10_000
      pathA.points = [...pathA.points, { x: i, y: i, time: i, pathId: 1 }]
      if (i === 30) await db.save(SID, makeInput({ paths: [pathA, pathB] }), { kind: 'pinned' })
      else await db.save(SID, makeInput({ paths: [pathA, pathB] }))
    }
    const listed = await db.listSnapshots(SID)
    expect(listed.length).toBeGreaterThan(20)
    expect(listed.length).toBeLessThan(40)
    expect(listed.filter((m) => m.kind === 'pinned').length).toBe(1)
    const { chunks } = await assertChunksConsistent(name)
    // pathB's two chunks are shared by every snapshot.
    expect(chunks).toBeLessThan(listed.length * 2 + 2)
    for (const meta of listed) expect(await db.loadSnapshot(meta.id!)).not.toBeNull()
    db.close()
  })

  it('loads a single path without the others', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const paths = [makePath(700, 1), makePath(40, 2), makePath(5, 3)]
    const { id } = await db.save(SID, makeInput({ paths }))
    expect(await db.loadPath(id!, 2)).toEqual(paths[1])
    expect(await db.loadPath(id!, 9)).toBeNull()
    db.close()
  })

  it('skips a snapshot with a missing or corrupt chunk and falls back to the previous one', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    const base = makePath(600)
    await db.save(SID, makeInput({ paths: [base] }))
    const grown = { ...base, points: [...base.points, ...makePath(10, 1, 900).points] }
    await db.save(SID, makeInput({ paths: [grown] }))
    const grown2 = { ...grown, points: [...grown.points, ...makePath(10, 1, 950).points] }
    await db.save(SID, makeInput({ paths: [grown2] }))
    db.close()

    const raw = await openDB(name)
    const manifests = await raw.getAll('manifests')
    const newest = manifests.at(-1)!
    const middle = manifests.at(-2)!
    const newestOpen = newest.paths[0].chunks[1]
    const middleOpen = middle.paths[0].chunks[1]
    await raw.delete('chunks', [SID, newestOpen])
    const record = await raw.get('chunks', [SID, middleOpen])
    record.data[2] = NaN
    await raw.put('chunks', record)
    raw.close()

    const reopened = await SessionDb.open({ dbName: name })
    const restored = await reopened.loadLatest(SID)
    expect(restored!.paths).toEqual([base])
    const listed = await reopened.listSnapshots(SID)
    expect(await reopened.loadSnapshot(listed[0].id!)).toBeNull()
    reopened.close()
  })

  it('skips a snapshot whose manifest does not match its point count', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(SID, makeInput({ paths: makePaths(2) }))
    await db.save(SID, makeInput({ paths: makePaths(6) }))
    db.close()
    const raw = await openDB(name)
    const keys = (await raw.getAllKeys('manifests')) as number[]
    const latest = await raw.get('manifests', keys.at(-1)!)
    latest.paths[0].count = 5
    await raw.put('manifests', latest, keys.at(-1)!)
    raw.close()
    const reopened = await SessionDb.open({ dbName: name })
    expect((await reopened.loadLatest(SID))!.meta.pointCount).toBe(2)
    reopened.close()
  })

  it('on a full disk evicts the oldest autosaves, never pinned ones, then retries once', async () => {
    const name = freshName()
    let now = T0
    const db = await SessionDb.open({ dbName: name, now: () => now })
    const path = makePath(0)
    const ids: number[] = []
    for (let i = 0; i < 8; i++) {
      now = T0 + i * 1000
      path.points = [...path.points, { x: i, y: i, time: i, pathId: 1 }]
      const kind = i === 0 || i === 3 ? 'pinned' : 'auto'
      ids.push((await db.save(SID, makeInput({ paths: [path] }), { kind })).id!)
    }
    let failures = 1
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
      if (this.name === 'chunks' && failures-- > 0) {
        throw new DOMException('full', 'QuotaExceededError')
      }
      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
    path.points = [...path.points, { x: 9, y: 9, time: 9, pathId: 1 }]
    now = T0 + 9000
    const result = await db.save(SID, makeInput({ paths: [path] }))
    expect(result.evicted).toBe(3)
    const remaining = (await db.listSnapshots(SID)).map((m) => m.id!).reverse()
    // Autosaves were ids[1,2,4,5,6,7]; the oldest half (excluding the newest) went first.
    expect(remaining).toEqual([ids[0], ids[3], ids[5], ids[6], ids[7], result.id])
    db.close()
    await assertChunksConsistent(name)
  })

  it('drops the video when eviction and a retry cannot make room', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
      if (this.name === 'videos') throw new DOMException('full', 'QuotaExceededError')
      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
    const result = await db.save(SID, makeInput({ video: makeVideo() }))
    expect(result.videoStatus).toBe('needs-reattach')
    const restored = await db.loadLatest(SID)
    expect(restored!.paths).toEqual(makePaths(3))
    expect(restored!.floorPlan).not.toBeNull()
    expect(restored!.video).toBeNull()
    const again = await db.save(SID, makeInput({ video: makeVideo(), paths: makePaths(8) }))
    expect(again.videoStatus).toBe('needs-reattach')
    db.close()
  })

  it('drops the video up front when the estimate says it will not fit', async () => {
    const db = await SessionDb.open({
      dbName: freshName(),
      estimate: async () => ({ usage: 0, quota: 5 }),
    })
    const result = await db.save(SID, makeInput({ video: makeVideo('x'.repeat(100)) }))
    expect(result.videoStatus).toBe('needs-reattach')
    expect((await db.loadLatest(SID))!.meta.video).toMatchObject({ status: 'needs-reattach' })
    db.close()
  })

  it('leaves no partial snapshot when a write fails for another reason', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(SID, makeInput({ paths: makePaths(2) }))
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
      if (this.name === 'manifests') throw new DOMException('boom', 'UnknownError')
      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
    await expect(db.save(SID, makeInput({ paths: makePaths(5) }))).rejects.toThrow()
    IDBObjectStore.prototype.put = originalPut
    expect((await db.loadLatest(SID))!.meta.pointCount).toBe(2)
    // The in-memory index is unchanged, so later saves still work.
    await db.save(SID, makeInput({ paths: makePaths(7) }))
    expect((await db.loadLatest(SID))!.meta.pointCount).toBe(7)
    db.close()
    const raw = await openDB(name)
    expect(await raw.count('snapshots')).toBe(2)
    raw.close()
    await assertChunksConsistent(name)
  })
})

describe('SessionDb YouTube sources', () => {
  const youtube = {
    kind: 'youtube' as const,
    videoId: 'iiMjfVOj8po',
    title: 'Jordan',
    aspect: 4 / 3,
  }

  it('stores a YouTube source as its id, with no video blob, and restores it', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    const result = await db.save(SID, makeInput({ videoTime: 12.4, videoSource: youtube }))
    expect(result.videoStatus).toBeNull()
    const restored = (await db.loadLatest(SID))!
    expect(restored.meta.videoSource).toEqual(youtube)
    expect(restored.meta.videoTime).toBe(12.4)
    expect(restored.meta.video).toBeNull()
    expect(restored.video).toBeNull()
    db.close()
    const raw = await openDB(name)
    expect(await raw.count('videos')).toBe(0)
    raw.close()
  })

  it('saves again when only the video source changes', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const paths = makePaths(3)
    await db.save(SID, makeInput({ paths }))
    const second = await db.save(SID, makeInput({ paths, videoSource: youtube }))
    expect(second.skipped).toBe(false)
    const third = await db.save(SID, makeInput({ paths, videoSource: youtube }))
    expect(third.skipped).toBe(true)
    db.close()
  })

  it('still loads snapshots saved before the field existed, local video included', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    await db.save(SID, makeInput({ video: makeVideo() }))
    const restored = (await db.loadLatest(SID))!
    expect('videoSource' in restored.meta).toBe(false)
    expect(await restored.video!.text()).toBe('video-bytes')
    db.close()
  })

  it('drops a malformed video source instead of failing the restore', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const bad = { kind: 'youtube', videoId: '<script>' } as unknown as typeof youtube
    await db.save(SID, makeInput({ videoSource: bad }))
    const restored = (await db.loadLatest(SID))!
    expect(restored.meta.videoSource).toBeUndefined()
    expect(restored.paths).toEqual(makePaths(3))
    db.close()
  })
})

describe('SessionDb checkpoints and sessions', () => {
  it('renames and deletes pinned checkpoints, collecting their chunks', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    const { id } = await db.save(SID, makeInput({ paths: [makePath(800)] }), {
      kind: 'pinned',
      label: 'Before Clear All',
    })
    await db.save(SID, makeInput({ paths: [makePath(20, 2)] }))
    await db.renameSnapshot(id!, '  Warm-up  ')
    expect((await db.listSnapshots(SID)).at(-1)!.label).toBe('Warm-up')
    expect(await db.deleteSnapshot(id!)).toBe(true)
    expect((await db.listSnapshots(SID)).length).toBe(1)
    db.close()
    const { chunks } = await assertChunksConsistent(name)
    expect(chunks).toBe(1)
  })

  it('keeps sessions separate and deletes one without touching the other', async () => {
    const name = freshName()
    let clock = T0
    const db = await SessionDb.open({ dbName: name, now: () => (clock += 1000) })
    const a = await db.createSession('Lab A')
    const b = await db.createSession(null)
    const shared = { key: 'fp-shared', blob: new Blob(['shared']), name: 'lab.png' }
    await db.save(a.id, makeInput({ paths: [makePath(900)], floorPlan: shared }))
    await db.save(b.id, makeInput({ paths: [makePath(30)], floorPlan: shared }))
    await db.save(b.id, makeInput({ paths: [makePath(40)], floorPlan: null, video: makeVideo() }))

    const sessions = await db.listSessions()
    expect(sessions.map((s) => s.id)).toEqual([b.id, a.id])
    expect(sessions[1]).toMatchObject({ name: 'Lab A', floorPlanName: 'lab.png', pointCount: 900 })
    expect(sessions[1].bytes).toBeGreaterThan(900 * 32)
    await db.renameSession(b.id, 'Lab B')
    await db.touchSession(a.id)
    expect(await db.lastOpenedSessionId()).toBe(a.id)

    await db.deleteSession(b.id)
    expect((await db.listSessions()).map((s) => s.name)).toEqual(['Lab A'])
    expect(await db.loadLatest(b.id)).toBeNull()
    expect((await db.loadLatest(a.id))!.paths).toEqual([makePath(900)])
    db.close()
    const raw = await openDB(name)
    expect(await raw.getAllKeys('floorPlans')).toEqual(['fp-shared'])
    expect(await raw.count('videos')).toBe(0)
    raw.close()
    await assertChunksConsistent(name)
  })
})

describe('SessionDb migrations', () => {
  async function seedV1(name: string, snapshots: Array<{ paths: PathData[]; savedAt: number }>) {
    const raw = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('snapshotPaths')
        db.createObjectStore('floorPlans')
        db.createObjectStore('videos')
      },
    })
    await raw.put('floorPlans', new Blob(['v1-png']), 'fp-v1')
    const ids: number[] = []
    for (const s of snapshots) {
      const pointCount = s.paths.reduce((n, p) => n + p.points.length, 0)
      const id = (await raw.add('snapshots', {
        savedAt: s.savedAt,
        videoTime: 2,
        imageWidth: 10,
        imageHeight: 10,
        config: makeInput().config,
        pathCount: s.paths.length,
        pointCount,
        floorPlanKey: 'fp-v1',
        floorPlanName: 'v1.png',
        videoKey: null,
        video: null,
      })) as number
      await raw.put('snapshotPaths', { paths: s.paths }, id)
      ids.push(id)
    }
    raw.close()
    return ids
  }

  it('migrates the v1 ring into one session, preserving every snapshot and sharing chunks', async () => {
    const name = freshName()
    const base = makePath(1600)
    const history = Array.from({ length: 10 }, (_, i) => ({
      paths: [{ ...base, points: base.points.slice(0, 1000 + i * 50) }, makePath(3, 2)],
      savedAt: T0 + i * 1000,
    }))
    history.push({ paths: [{ points: [{ x: 'bad' }] } as unknown as PathData], savedAt: T0 + 1 })
    const ids = await seedV1(name, history)

    const db = await SessionDb.open({ dbName: name })
    const sessions = await db.listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ id: MIGRATED_SESSION_ID, floorPlanName: 'v1.png' })
    const listed = await db.listSnapshots(MIGRATED_SESSION_ID)
    expect(listed.map((m) => m.id)).toEqual(ids.slice(0, 10).reverse())
    for (let i = 0; i < 10; i++) {
      const restored = await db.loadSnapshot(ids[i])
      expect(restored!.paths).toEqual(history[i].paths)
      expect(restored!.meta.savedAt).toBe(T0 + i * 1000)
      expect(await restored!.floorPlan!.text()).toBe('v1-png')
    }
    db.close()

    const raw = await openDB(name)
    expect(raw.objectStoreNames.contains('snapshotPaths')).toBe(false)
    const { chunks } = await assertChunksConsistent(name)
    // Naive copies would need 10 * (3 + 1) chunks; the shared first two chunks are stored once.
    expect(chunks).toBeLessThan(20)
    raw.close()
  })

  it('does not re-run or duplicate the v1 migration on later opens', async () => {
    const name = freshName()
    await seedV1(name, [{ paths: makePaths(10), savedAt: T0 }])
    ;(await SessionDb.open({ dbName: name })).close()
    const db = await SessionDb.open({ dbName: name })
    expect(await db.listSessions()).toHaveLength(1)
    expect(await db.listSnapshots(MIGRATED_SESSION_ID)).toHaveLength(1)
    db.close()
  })

  it('imports a legacy localStorage session and removes the key only after it is written', async () => {
    const storage = new MemoryStorage()
    const legacy = {
      paths: makePaths(4),
      videoTime: 3,
      config: {
        isTranscriptionMode: false,
        pollingRate: 20,
        strokeWeight: 4,
        speculateScale: 30,
        isContinuousMode: true,
      },
      floorPlanDataUrl: 'data:image/png;base64,' + btoa('legacy-png'),
      imageWidth: 100,
      imageHeight: 50,
      timestamp: 1_700_000_000_000,
    }
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))

    const db = await SessionDb.open({ dbName: freshName() })
    const sessionId = await db.importLegacy(storage)
    expect(sessionId).toBe('legacy-1700000000000')
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull()

    const restored = await db.loadLatest(sessionId!)
    expect(restored!.paths).toEqual(legacy.paths)
    expect(restored!.meta.savedAt).toBe(legacy.timestamp)
    expect(restored!.meta.config).toMatchObject({ isTranscriptionMode: false, pollingRate: 20 })
    expect(await restored!.floorPlan!.text()).toBe('legacy-png')
    // Dated by its own timestamp, so newer sessions still open first.
    expect(await db.getSession(sessionId!)).toMatchObject({
      updatedAt: legacy.timestamp,
      lastOpenedAt: legacy.timestamp,
    })

    // Idempotent: the same payload again (e.g. a removeItem that never landed) adds nothing.
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))
    expect(await db.importLegacy(storage)).toBe(sessionId)
    expect(await db.listSessions()).toHaveLength(1)
    expect(await db.listSnapshots(sessionId!)).toHaveLength(1)
    db.close()
  })

  it('keeps the legacy key when the IndexedDB write fails', async () => {
    const storage = new MemoryStorage()
    storage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ paths: makePaths(2), config: { isTranscriptionMode: true }, timestamp: 1 })
    )
    const db = await SessionDb.open({ dbName: freshName() })
    const originalAdd = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = () => {
      throw new DOMException('nope', 'UnknownError')
    }
    try {
      await expect(db.importLegacy(storage)).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.add = originalAdd
    }
    expect(storage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull()
    db.close()
  })
})
