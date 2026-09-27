import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import type { PathData } from '$lib/stores/drawingState'
import { LEGACY_STORAGE_KEY, RING_SIZE, SessionDb, type SnapshotInput } from './sessionDb'

let dbCount = 0
const freshName = () => `test-db-${++dbCount}`

function makePaths(pointCount: number, pathId = 1): PathData[] {
  const points = Array.from({ length: pointCount }, (_, i) => ({
    x: i,
    y: i * 2,
    time: i * 0.01,
    pathId,
  }))
  return [{ points, color: '#FF0000', pathId }]
}

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

describe('SessionDb', () => {
  it('round-trips paths, config and blobs', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const input = makeInput({ video: makeVideo() })
    const result = await db.save(input)
    expect(result.videoStatus).toBe('saved')

    const restored = await db.loadLatest()
    expect(restored).not.toBeNull()
    expect(restored!.paths).toEqual(input.paths)
    expect(restored!.meta.config).toEqual(input.config)
    expect(restored!.meta.videoTime).toBe(1.5)
    expect(restored!.meta.pathCount).toBe(1)
    expect(restored!.meta.floorPlanName).toBe('plan.png')
    expect(await restored!.floorPlan!.text()).toBe('png-bytes')
    expect(restored!.floorPlan!.type).toBe('image/png')
    expect(await restored!.video!.text()).toBe('video-bytes')
    expect(restored!.meta.video).toMatchObject({
      name: 'clip.mp4',
      duration: 12.5,
      status: 'saved',
    })
    db.close()
  })

  it('keeps only the newest ring of snapshots and drops unreferenced blobs', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name, ringSize: 3 })
    for (let i = 1; i <= 5; i++) {
      await db.save(
        makeInput({
          paths: makePaths(i),
          floorPlan: { key: `fp-${i}`, blob: new Blob([`plan-${i}`]), name: `p${i}` },
        })
      )
    }
    db.close()

    const raw = await openDB(name)
    const metas = await raw.getAll('snapshots')
    expect(metas.map((m) => m.pointCount)).toEqual([3, 4, 5])
    expect((await raw.getAllKeys('snapshotPaths')).length).toBe(3)
    expect(await raw.getAllKeys('floorPlans')).toEqual(['fp-3', 'fp-4', 'fp-5'])
    raw.close()

    const reopened = await SessionDb.open({ dbName: name, ringSize: 3 })
    expect((await reopened.loadLatest())!.meta.pointCount).toBe(5)
    reopened.close()
  })

  it('stores a shared floor plan blob once across snapshots', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(makeInput())
    await db.save(makeInput({ paths: makePaths(9) }))
    db.close()
    const raw = await openDB(name)
    expect(await raw.getAllKeys('floorPlans')).toEqual(['fp-1'])
    raw.close()
  })

  it('skips a corrupt latest snapshot and restores the previous one', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(makeInput({ paths: makePaths(4) }))
    await db.save(makeInput({ paths: makePaths(7) }))
    db.close()

    const raw = await openDB(name, 1)
    const latestId = Math.max(...((await raw.getAllKeys('snapshots')) as number[]))
    await raw.put('snapshotPaths', { paths: [{ points: [{ x: 'bad' }] }] }, latestId)
    raw.close()

    const reopened = await SessionDb.open({ dbName: name })
    const restored = await reopened.loadLatest()
    expect(restored!.meta.pointCount).toBe(4)
    expect(restored!.paths).toEqual(makePaths(4))
    reopened.close()
  })

  it('skips a snapshot whose point count does not match its paths', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(makeInput({ paths: makePaths(2) }))
    await db.save(makeInput({ paths: makePaths(6) }))
    db.close()

    const raw = await openDB(name, 1)
    const latestId = Math.max(...((await raw.getAllKeys('snapshots')) as number[]))
    await raw.put('snapshotPaths', { paths: makePaths(5) }, latestId)
    raw.close()

    const reopened = await SessionDb.open({ dbName: name })
    expect((await reopened.loadLatest())!.meta.pointCount).toBe(2)
    reopened.close()
  })

  it('drops the video but keeps paths and floor plan when the estimate says it will not fit', async () => {
    const db = await SessionDb.open({
      dbName: freshName(),
      estimate: async () => ({ usage: 0, quota: 5 }),
    })
    const result = await db.save(makeInput({ video: makeVideo('x'.repeat(100)) }))
    expect(result.videoStatus).toBe('needs-reattach')
    const restored = await db.loadLatest()
    expect(restored!.paths).toEqual(makePaths(3))
    expect(restored!.floorPlan).not.toBeNull()
    expect(restored!.video).toBeNull()
    expect(restored!.meta.video).toMatchObject({
      name: 'clip.mp4',
      size: 100,
      status: 'needs-reattach',
    })
    db.close()
  })

  it('retries without the video when the write fails with QuotaExceededError', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'videos') throw new DOMException('full', 'QuotaExceededError')
      return originalPut.apply(this, args)
    }
    try {
      const result = await db.save(makeInput({ video: makeVideo() }))
      expect(result.videoStatus).toBe('needs-reattach')
      const restored = await db.loadLatest()
      expect(restored!.paths).toEqual(makePaths(3))
      expect(restored!.floorPlan).not.toBeNull()
      expect(restored!.video).toBeNull()

      const again = await db.save(makeInput({ video: makeVideo(), paths: makePaths(8) }))
      expect(again.videoStatus).toBe('needs-reattach')
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
    db.close()
  })

  it('leaves no partial snapshot when a write fails for another reason', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    await db.save(makeInput({ paths: makePaths(2) }))
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'snapshotPaths') throw new DOMException('boom', 'UnknownError')
      return originalPut.apply(this, args)
    }
    try {
      await expect(db.save(makeInput({ paths: makePaths(5) }))).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
    const restored = await db.loadLatest()
    expect(restored!.meta.pointCount).toBe(2)
    db.close()
    const raw = await openDB(name)
    expect(await raw.count('snapshots')).toBe(1)
    raw.close()
  })

  it('imports a legacy localStorage session and removes the key only after it is written', async () => {
    const storage = new MemoryStorage()
    const legacy = {
      paths: makePaths(4),
      videoTime: 3,
      config: {
        isTranscriptionMode: false,
        pollingRate: 20,
        useAdaptiveSampling: true,
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
    expect(await db.importLegacy(storage)).toBe(true)
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull()

    const restored = await db.loadLatest()
    expect(restored!.paths).toEqual(legacy.paths)
    expect(restored!.meta.savedAt).toBe(legacy.timestamp)
    expect(restored!.meta.config).toMatchObject({ isTranscriptionMode: false, pollingRate: 20 })
    expect(restored!.meta.config.exportSampleRate).toBeUndefined()
    expect(await restored!.floorPlan!.text()).toBe('legacy-png')
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

  it('keeps the default ring size', async () => {
    const name = freshName()
    const db = await SessionDb.open({ dbName: name })
    for (let i = 1; i <= RING_SIZE + 2; i++) {
      await db.save(makeInput({ paths: makePaths(i) }))
    }
    const listed = await db.listSnapshots()
    expect(listed.length).toBe(RING_SIZE)
    expect(listed[0].pointCount).toBe(RING_SIZE + 2)
    db.close()
  })

  it('lists non-empty snapshots newest first and excludes empty ones', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    await db.save(makeInput({ paths: makePaths(3) }))
    await db.save(makeInput({ paths: makePaths(0) }))
    await db.save(makeInput({ paths: makePaths(5) }))
    const listed = await db.listSnapshots()
    expect(listed.map((m) => m.pointCount)).toEqual([5, 3])
    db.close()
  })

  it('loads a specific older snapshot by id while newer ones exist', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    await db.save(makeInput({ paths: makePaths(3) }))
    await db.save(makeInput({ paths: makePaths(7) }))
    const [newest, older] = await db.listSnapshots()
    expect(newest.pointCount).toBe(7)

    const restored = await db.loadSnapshot(older.id!)
    expect(restored!.meta.pointCount).toBe(3)
    expect(restored!.paths).toEqual(makePaths(3))

    expect(await db.loadSnapshot(-1)).toBeNull()
    db.close()
  })

  it('clears every store', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    await db.save(makeInput({ video: makeVideo() }))
    await db.clear()
    expect(await db.loadLatest()).toBeNull()
    db.close()
  })
})
