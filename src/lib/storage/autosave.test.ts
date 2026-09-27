import 'fake-indexeddb/auto'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, createSaveScheduler } from './autosave'
import { SessionDb, StorageUnavailableError, type SnapshotInput } from './sessionDb'

let dbCount = 0
const freshName = () => `autosave-db-${++dbCount}`

function snapshot(points: number): SnapshotInput {
  return {
    paths: [
      {
        pathId: 1,
        color: '#FF0000',
        points: Array.from({ length: points }, (_, i) => ({
          x: i,
          y: i,
          time: i / 100,
          pathId: 1,
        })),
      },
    ],
    videoTime: 0,
    imageWidth: 10,
    imageHeight: 10,
    config: {
      isTranscriptionMode: false,
      strokeWeight: 5,
      speculateScale: 1,
      isContinuousMode: true,
    },
    floorPlan: null,
    video: null,
  }
}

/** Minimal single-process LockManager: exclusive locks, ifAvailable, and abort signals. */
class FakeLocks {
  private held = new Set<string>()
  private queue: Array<{ name: string; grant: () => void }> = []

  request(
    name: string,
    options: { ifAvailable?: boolean; signal?: AbortSignal },
    cb: (lock: { name: string } | null) => unknown
  ): Promise<unknown> {
    if (this.held.has(name)) {
      if (options.ifAvailable) return Promise.resolve(cb(null))
      return new Promise((resolve, reject) => {
        const entry = { name, grant: () => resolve(this.run(name, cb)) }
        this.queue.push(entry)
        options.signal?.addEventListener('abort', () => {
          this.queue = this.queue.filter((e) => e !== entry)
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    }
    return this.run(name, cb)
  }

  private async run(name: string, cb: (lock: { name: string }) => unknown) {
    this.held.add(name)
    try {
      return await cb({ name })
    } finally {
      this.held.delete(name)
      const next = this.queue.find((e) => e.name === name)
      if (next) {
        this.queue = this.queue.filter((e) => e !== next)
        next.grant()
      }
    }
  }
}

describe('createSaveScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after the debounce delay when changes stop', () => {
    const run = vi.fn()
    const s = createSaveScheduler(run, { delay: 500, maxWait: 1000 })
    s.schedule()
    vi.advanceTimersByTime(200)
    s.schedule()
    vi.advanceTimersByTime(499)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('still saves within maxWait while changes arrive every frame (recording)', () => {
    const run = vi.fn()
    const s = createSaveScheduler(run, { delay: 500, maxWait: 1000 })
    const fireTimes: number[] = []
    run.mockImplementation(() => fireTimes.push(Date.now()))
    const start = Date.now()
    for (let t = 0; t < 3000; t += 16) {
      s.schedule()
      vi.advanceTimersByTime(16)
    }
    expect(fireTimes.length).toBeGreaterThanOrEqual(2)
    expect(fireTimes[0] - start).toBeLessThanOrEqual(1000)
    for (let i = 1; i < fireTimes.length; i++) {
      expect(fireTimes[i] - fireTimes[i - 1]).toBeLessThanOrEqual(1016)
    }
  })

  it('flush runs immediately and cancels the pending timer', () => {
    const run = vi.fn()
    const s = createSaveScheduler(run)
    s.schedule()
    s.flush()
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('createAutosave', () => {
  it('lands a save during recording within about a second of the first change', async () => {
    const name = freshName()
    let points = 1
    const autosave = createAutosave({
      getSnapshot: () => snapshot(points),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist: async () => true,
      delay: 500,
      maxWait: 1000,
    })
    await autosave.init()
    const start = Date.now()
    let savedAt: number | null = null
    const stop = autosave.status.subscribe((s) => {
      if (s.state === 'saved' && savedAt === null) savedAt = Date.now()
    })
    while (savedAt === null && Date.now() - start < 3000) {
      points++
      autosave.schedule()
      await new Promise((r) => setTimeout(r, 16))
    }
    stop()
    expect(savedAt).not.toBeNull()
    expect(savedAt! - start).toBeLessThan(1300)
    autosave.destroy()

    const db = await SessionDb.open({ dbName: name })
    expect((await db.loadLatest())!.meta.pointCount).toBeGreaterThan(1)
    db.close()
  })

  it('flush writes the latest state and requests persistence once', async () => {
    const name = freshName()
    let points = 2
    const persist = vi.fn(async () => true)
    const autosave = createAutosave({
      getSnapshot: () => snapshot(points),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist,
    })
    await autosave.init()
    await autosave.flush()
    points = 5
    await autosave.flush()
    expect(persist).toHaveBeenCalledTimes(1)
    expect(get(autosave.status).state).toBe('saved')
    autosave.destroy()
    const db = await SessionDb.open({ dbName: name })
    expect((await db.loadLatest())!.meta.pointCount).toBe(5)
    db.close()
  })

  it('does not save when there is no data', async () => {
    const persist = vi.fn(async () => true)
    const autosave = createAutosave({
      getSnapshot: () => null,
      openDb: () => SessionDb.open({ dbName: freshName() }),
      locks: null,
      storage: null,
      persist,
    })
    await autosave.init()
    await autosave.flush()
    expect(get(autosave.status).lastSavedAt).toBeNull()
    expect(persist).not.toHaveBeenCalled()
    autosave.destroy()
  })

  it('lets only one tab write; the second takes over when the first closes', async () => {
    const name = freshName()
    const locks = new FakeLocks() as unknown as LockManager
    const make = (points: number) =>
      createAutosave({
        getSnapshot: () => snapshot(points),
        openDb: () => SessionDb.open({ dbName: name }),
        locks,
        storage: null,
        persist: async () => true,
        delay: 10,
        maxWait: 20,
      })
    const first = make(3)
    const second = make(9)
    await first.init()
    await second.init()
    expect(get(first.status).state).toBe('idle')
    expect(get(second.status).state).toBe('other-tab')

    await first.flush()
    await second.flush()
    const db = await SessionDb.open({ dbName: name })
    expect((await db.loadLatest())!.meta.pointCount).toBe(3)

    first.destroy()
    await vi.waitFor(() => expect(get(second.status).state).toBe('saved'))
    expect((await db.loadLatest())!.meta.pointCount).toBe(9)
    db.close()
    second.destroy()
  })

  it('reports unavailable storage once and never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const openDb = vi.fn(() => Promise.reject(new StorageUnavailableError('blocked')))
    const autosave = createAutosave({
      getSnapshot: () => snapshot(3),
      openDb,
      locks: null,
      storage: null,
    })
    expect(await autosave.init()).toBeNull()
    await autosave.flush()
    await autosave.flush()
    expect(get(autosave.status).state).toBe('unavailable')
    expect(openDb).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    autosave.destroy()
  })

  it('keeps an older snapshot loadable by id after flushing a newer one', async () => {
    const name = freshName()
    let points = 3
    const autosave = createAutosave({
      getSnapshot: () => snapshot(points),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist: async () => true,
    })
    await autosave.init()
    await autosave.flush()
    const [older] = await autosave.listSnapshots()

    points = 9
    await autosave.flush()
    const listed = await autosave.listSnapshots()
    expect(listed.map((m) => m.pointCount)).toEqual([9, 3])

    const restored = await autosave.loadSnapshot(older.id!)
    expect(restored!.meta.pointCount).toBe(3)
    autosave.destroy()
  })

  it('listSnapshots and loadSnapshot report empty/null when storage is unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const autosave = createAutosave({
      getSnapshot: () => snapshot(3),
      openDb: () => Promise.reject(new StorageUnavailableError('blocked')),
      locks: null,
      storage: null,
    })
    expect(await autosave.listSnapshots()).toEqual([])
    expect(await autosave.loadSnapshot(1)).toBeNull()
    warn.mockRestore()
    autosave.destroy()
  })

  it('migrates a legacy localStorage session during init', async () => {
    const values = new Map<string, string>([
      [
        'mondrian-session',
        JSON.stringify({ ...snapshot(4), floorPlanDataUrl: null, timestamp: 42 }),
      ],
    ])
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      removeItem: (k: string) => void values.delete(k),
    } as unknown as Storage
    const autosave = createAutosave({
      getSnapshot: () => null,
      openDb: () => SessionDb.open({ dbName: freshName() }),
      locks: null,
      storage,
    })
    const restored = await autosave.init()
    expect(restored!.meta.pointCount).toBe(4)
    expect(restored!.meta.savedAt).toBe(42)
    expect(values.has('mondrian-session')).toBe(false)
    autosave.destroy()
  })
})
