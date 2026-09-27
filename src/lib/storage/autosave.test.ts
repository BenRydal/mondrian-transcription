import 'fake-indexeddb/auto'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, createSaveScheduler } from './autosave'
import { SessionDb, StorageUnavailableError, type SnapshotInput } from './sessionDb'

let dbCount = 0
const freshName = () => `autosave-db-${++dbCount}`

async function latestPointCount(db: SessionDb, sessionId?: string | null) {
  const id = sessionId ?? (await db.lastOpenedSessionId())
  return id ? (await db.loadLatest(id))?.meta.pointCount : undefined
}

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

class FakeLocks {
  private held = new Set<string>()
  private queue: Array<{ name: string; grant: () => void }> = []

  request(
    name: string,
    optionsOrCb: { ifAvailable?: boolean; signal?: AbortSignal } | ((lock: unknown) => unknown),
    maybeCb?: (lock: { name: string } | null) => unknown
  ): Promise<unknown> {
    const options = typeof optionsOrCb === 'function' ? {} : optionsOrCb
    const cb = (maybeCb ?? optionsOrCb) as (lock: { name: string } | null) => unknown
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
    expect(await latestPointCount(db)).toBeGreaterThan(1)
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
    expect(await latestPointCount(db)).toBe(5)
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

  it('lets only one tab write a session; the second takes over when the first closes', async () => {
    const name = freshName()
    const seed = await SessionDb.open({ dbName: name })
    await seed.createSession('Shared')
    seed.close()
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
    expect(await latestPointCount(db, first.sessionId)).toBe(3)

    first.destroy()
    await vi.waitFor(() => expect(get(second.status).state).toBe('saved'))
    expect(await latestPointCount(db, first.sessionId)).toBe(9)
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

  it('pins a checkpoint of the state at call time, even if it changes before the write', async () => {
    const name = freshName()
    let points = 4
    const autosave = createAutosave({
      getSnapshot: () => snapshot(points),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist: async () => true,
    })
    await autosave.init()
    const pending = autosave.checkpoint('  Before Clear All ')
    points = 1
    const result = await pending
    expect(result!.skipped).toBe(false)
    await autosave.flush()
    const [latest, pinned] = await autosave.listSnapshots()
    expect(latest).toMatchObject({ kind: 'auto', pointCount: 1 })
    expect(pinned).toMatchObject({ kind: 'pinned', label: 'Before Clear All', pointCount: 4 })
    autosave.destroy()
  })

  it('locks per session: a second tab can start its own session while the first keeps writing', async () => {
    const name = freshName()
    const seed = await SessionDb.open({ dbName: name })
    const shared = await seed.createSession('Shared')
    seed.close()
    const locks = new FakeLocks() as unknown as LockManager
    let secondPoints = 7
    const make = (getPoints: () => number) =>
      createAutosave({
        getSnapshot: () => snapshot(getPoints()),
        openDb: () => SessionDb.open({ dbName: name }),
        locks,
        storage: null,
        persist: async () => true,
      })
    const first = make(() => 3)
    const second = make(() => secondPoints)
    await first.init()
    await second.init()
    expect(get(second.status).state).toBe('other-tab')
    expect(await second.checkpoint('nope')).toBeNull()

    await second.newSession()
    expect(get(second.status).state).toBe('idle')
    await second.flush()
    await first.flush()
    const other = second.sessionId!
    expect(other).not.toBe(shared.id)

    await expect(second.deleteSession(shared.id)).rejects.toThrow(/another tab/)
    await expect(first.deleteSession(other)).rejects.toThrow(/another tab/)

    const db = await SessionDb.open({ dbName: name })
    expect(await latestPointCount(db, shared.id)).toBe(3)
    expect(await latestPointCount(db, other)).toBe(7)
    expect((await db.listSessions()).length).toBe(2)
    db.close()

    secondPoints = 8
    first.destroy()
    second.destroy()
  })

  it('switches sessions without saving the old live state into the new one', async () => {
    const name = freshName()
    let clock = Date.now() - 10_000
    const seed = await SessionDb.open({ dbName: name, now: () => (clock += 1000) })
    const a = await seed.createSession('A')
    await seed.save(a.id, snapshot(5))
    const b = await seed.createSession('B')
    await seed.save(b.id, snapshot(11))
    seed.close()
    let live = 0
    const cache = new Map<number, SnapshotInput>()
    const memo = (n: number) => cache.get(n) ?? cache.set(n, snapshot(n)).get(n)!
    const autosave = createAutosave({
      getSnapshot: () => (live ? memo(live) : null),
      openDb: () => SessionDb.open({ dbName: name, now: () => (clock += 1000) }),
      locks: new FakeLocks() as unknown as LockManager,
      storage: null,
      persist: async () => true,
      delay: 1,
      maxWait: 1,
    })
    const restored = await autosave.init()
    expect(autosave.sessionId).toBe(b.id)
    live = restored!.meta.pointCount + 1
    const switching = autosave.switchSession(a.id)
    autosave.schedule()
    const other = await switching
    expect(other!.meta.pointCount).toBe(5)
    live = 6
    await autosave.flush()

    const db = await SessionDb.open({ dbName: name })
    expect((await db.listSnapshots(a.id)).map((m) => m.pointCount)).toEqual([6, 5])
    expect((await db.listSnapshots(b.id)).map((m) => m.pointCount)).toEqual([12, 11])
    expect(await db.lastOpenedSessionId()).toBe(a.id)
    db.close()
    autosave.destroy()
  })

  it('names a new session on its first save, e.g. after an example', async () => {
    const name = freshName()
    let points = 3
    const autosave = createAutosave({
      getSnapshot: () => (points ? snapshot(points) : null),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist: async () => true,
    })
    await autosave.init()
    await autosave.flush()
    points = 0
    await autosave.newSession("Michael Jordan's Last Shot")
    await autosave.flush()
    expect(await autosave.listSessions()).toHaveLength(1)
    points = 4
    await autosave.flush()
    await autosave.newSession()
    points = 5
    await autosave.flush()
    const names = (await autosave.listSessions()).map((s) => s.name)
    expect(names.sort()).toEqual([null, null, "Michael Jordan's Last Shot"].sort())
    autosave.destroy()
  })

  it('deleting the current session starts a fresh one on the next save', async () => {
    const name = freshName()
    let points = 3
    const autosave = createAutosave({
      getSnapshot: () => (points ? snapshot(points) : null),
      openDb: () => SessionDb.open({ dbName: name }),
      locks: null,
      storage: null,
      persist: async () => true,
    })
    await autosave.init()
    await autosave.flush()
    const first = autosave.sessionId!
    await autosave.deleteSession(first)
    expect(autosave.sessionId).toBeNull()
    points = 0
    await autosave.flush()
    expect(await autosave.listSessions()).toEqual([])
    points = 2
    await autosave.flush()
    const sessions = await autosave.listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).not.toBe(first)
    autosave.destroy()
  })
})
