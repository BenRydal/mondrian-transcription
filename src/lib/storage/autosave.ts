import { writable, type Readable } from 'svelte/store'
import {
  SessionDb,
  type RestoredSession,
  type SnapshotInput,
  type SnapshotMeta,
  type VideoStatus,
} from './sessionDb'

export type AutosaveState =
  | 'starting'
  | 'idle'
  | 'saving'
  | 'saved'
  | 'error'
  | 'unavailable'
  | 'other-tab'

export interface AutosaveStatus {
  state: AutosaveState
  lastSavedAt: number | null
  videoStatus: VideoStatus | null
}

const LOCK_NAME = 'mondrian-autosave'

/** Trailing debounce that still fires within maxWait while changes keep arriving. */
export function createSaveScheduler(run: () => void, { delay = 500, maxWait = 1000 } = {}) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstPending: number | null = null

  function fire() {
    cancel()
    run()
  }
  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    firstPending = null
  }
  function schedule() {
    const now = Date.now()
    firstPending ??= now
    if (timer) clearTimeout(timer)
    timer = setTimeout(fire, Math.max(0, Math.min(delay, firstPending + maxWait - now)))
  }
  return {
    schedule,
    flush: fire,
    cancel,
    get pending() {
      return timer !== null
    },
  }
}

export interface AutosaveOptions {
  getSnapshot: () => SnapshotInput | null
  openDb?: () => Promise<SessionDb>
  locks?: LockManager | null
  storage?: Storage | null
  persist?: () => Promise<unknown>
  delay?: number
  maxWait?: number
}

function defaultPersist() {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage?.persist || !storage.persisted) return Promise.resolve(false)
  return storage.persisted().then((done) => done || storage.persist())
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createAutosave(opts: AutosaveOptions) {
  const status = writable<AutosaveStatus>({
    state: 'starting',
    lastSavedAt: null,
    videoStatus: null,
  })
  const openDb = opts.openDb ?? (() => SessionDb.open())
  const locks =
    opts.locks !== undefined
      ? opts.locks
      : typeof navigator !== 'undefined'
        ? (navigator.locks ?? null)
        : null
  let db: SessionDb | null = null
  let isOwner = false
  let unavailable = false
  let persistRequested = false
  let running: Promise<void> | null = null
  let dirty = false
  let releaseLock: (() => void) | null = null
  const abort = new AbortController()
  const scheduler = createSaveScheduler(() => void runSave(), opts)

  const setState = (state: AutosaveState) => status.update((s) => ({ ...s, state }))

  async function getDb(): Promise<SessionDb | null> {
    if (unavailable) return null
    if (db) return db
    try {
      db = await openDb()
      return db
    } catch (e) {
      console.warn('Autosave storage unavailable:', e)
      unavailable = true
      setState('unavailable')
      return null
    }
  }

  function acquireLock(): Promise<boolean> {
    if (!locks) return Promise.resolve(true)
    return new Promise((resolve) => {
      const hold = () => new Promise<void>((release) => (releaseLock = release))
      locks
        .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
          resolve(!!lock)
          return lock ? hold() : undefined
        })
        .catch(() => resolve(true))
    })
  }

  function waitForTakeover() {
    locks
      ?.request(LOCK_NAME, { signal: abort.signal }, async () => {
        isOwner = true
        setState('idle')
        scheduler.schedule()
        await new Promise<void>((release) => (releaseLock = release))
      })
      .catch(() => {})
  }

  async function saveOnce() {
    const snapshot = opts.getSnapshot()
    if (!snapshot) return
    const store = await getDb()
    if (!store) return
    if (!persistRequested) {
      persistRequested = true
      ;(opts.persist ?? defaultPersist)().catch(() => {})
    }
    setState('saving')
    try {
      const result = await store.save(snapshot)
      status.set({ state: 'saved', lastSavedAt: result.savedAt, videoStatus: result.videoStatus })
    } catch (e) {
      console.warn('Autosave failed:', e)
      db?.close()
      db = null
      setState('error')
    }
  }

  function runSave(): Promise<void> {
    if (!isOwner || unavailable) return Promise.resolve()
    if (running) {
      dirty = true
      return running
    }
    running = (async () => {
      do {
        dirty = false
        await saveOnce()
      } while (dirty)
      running = null
    })()
    return running
  }

  return {
    status: status as Readable<AutosaveStatus>,

    /** Opens storage, takes the single-writer lock, migrates legacy data, returns the latest session. */
    async init(): Promise<RestoredSession | null> {
      isOwner = await acquireLock()
      if (!isOwner) waitForTakeover()
      const store = await getDb()
      if (!store) return null
      setState(isOwner ? 'idle' : 'other-tab')
      const legacy = opts.storage !== undefined ? opts.storage : safeLocalStorage()
      if (isOwner && legacy) {
        await store.importLegacy(legacy).catch((e) => console.warn('Legacy import failed:', e))
      }
      try {
        return await store.loadLatest()
      } catch (e) {
        console.warn('Failed to read autosave:', e)
        return null
      }
    },

    schedule: () => scheduler.schedule(),
    flush: () => {
      scheduler.cancel()
      return runSave()
    },

    async clear() {
      scheduler.cancel()
      await running
      if (!isOwner) return
      const store = await getDb()
      await store?.clear().catch((e) => console.warn('Failed to clear autosave:', e))
      status.update((s) => ({ ...s, lastSavedAt: null, videoStatus: null }))
    },

    async listSnapshots(): Promise<SnapshotMeta[]> {
      const store = await getDb()
      return store ? store.listSnapshots() : []
    },

    async loadSnapshot(id: number): Promise<RestoredSession | null> {
      const store = await getDb()
      return store ? store.loadSnapshot(id) : null
    },

    destroy() {
      scheduler.cancel()
      abort.abort()
      releaseLock?.()
      db?.close()
    },
  }
}

export type Autosave = ReturnType<typeof createAutosave>
