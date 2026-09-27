import { writable, type Readable } from 'svelte/store'
import {
  SessionDb,
  type RestoredSession,
  type SaveResult,
  type SessionBundle,
  type SessionRecord,
  type SnapshotInput,
  type SnapshotMeta,
  type VideoStatus,
} from './sessionDb'
import type { PathData } from '$lib/stores/drawingState'

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
  sessionId: string | null
}

const SAVE_DELAY_MS = 500
const SAVE_MAX_WAIT_MS = 1000
const LOCK_PREFIX = 'mondrian-autosave:'
const MIGRATE_LOCK = 'mondrian-autosave-migrate'

export class SessionBusyError extends Error {
  constructor() {
    super('This session is open in another tab.')
  }
}

export function createSaveScheduler(
  run: () => void,
  { delay = SAVE_DELAY_MS, maxWait = SAVE_MAX_WAIT_MS } = {}
) {
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

interface AutosaveOptions {
  getSnapshot: () => SnapshotInput | null
  openDb?: () => Promise<SessionDb>
  locks?: LockManager | null
  storage?: Storage | null
  persist?: () => Promise<unknown>
  onNotice?: (message: string) => void
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

interface LockHandle {
  release: () => void
}

function holdUntilReleased() {
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  return { held, release: () => release() }
}

export function createAutosave(opts: AutosaveOptions) {
  const status = writable<AutosaveStatus>({
    state: 'starting',
    lastSavedAt: null,
    videoStatus: null,
    sessionId: null,
  })
  const openDb = opts.openDb ?? (() => SessionDb.open())
  const locks =
    opts.locks !== undefined
      ? opts.locks
      : typeof navigator !== 'undefined'
        ? (navigator.locks ?? null)
        : null
  let db: SessionDb | null = null
  let sessionId: string | null = null
  let isOwner = false
  let unavailable = false
  let persistRequested = false
  let running: Promise<void> | null = null
  let dirty = false
  let lock: LockHandle | null = null
  let destroyed = false
  let leavingSession = false
  let nextSessionName: string | null = null
  const scheduler = createSaveScheduler(() => void runSave(), opts)

  const setState = (state: AutosaveState) => status.update((s) => ({ ...s, state }))
  const notice = (message: string) => opts.onNotice?.(message)

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

  function lockSession(id: string): Promise<boolean> {
    lock?.release()
    lock = null
    if (!locks) return Promise.resolve(true)
    const name = LOCK_PREFIX + id
    return new Promise((resolve) => {
      const { held, release } = holdUntilReleased()
      const handle: LockHandle = { release }
      lock = handle
      locks
        .request(name, { ifAvailable: true }, (granted) => {
          resolve(!!granted)
          if (granted) return held
          if (lock === handle) waitForTakeover(id, name)
          return undefined
        })
        .catch(() => resolve(true))
    })
  }

  function waitForTakeover(id: string, name: string) {
    const abort = new AbortController()
    const { held, release } = holdUntilReleased()
    const handle: LockHandle = {
      release: () => {
        abort.abort()
        release()
      },
    }
    lock = handle
    locks
      ?.request(name, { signal: abort.signal }, () => {
        if (lock !== handle || sessionId !== id || destroyed) return
        isOwner = true
        db?.invalidate(id)
        setState('idle')
        scheduler.schedule()
        return held
      })
      .catch(() => {})
  }

  async function openSession(id: string | null) {
    sessionId = id
    nextSessionName = null
    status.update((s) => ({ ...s, sessionId: id, lastSavedAt: null, videoStatus: null }))
    if (id === null) {
      lock?.release()
      lock = null
      isOwner = true
    } else {
      isOwner = await lockSession(id)
      if (isOwner) {
        db?.invalidate(id)
        await db?.touchSession(id)
      }
    }
    if (!unavailable) setState(isOwner ? 'idle' : 'other-tab')
  }

  async function ensureSession(store: SessionDb): Promise<string> {
    if (sessionId) return sessionId
    const created = await store.createSession(nextSessionName)
    await openSession(created.id)
    return created.id
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
      const id = await ensureSession(store)
      const result = await store.save(id, snapshot)
      report(result)
    } catch (e) {
      console.warn('Autosave failed:', e)
      db?.close()
      db = null
      setState('error')
    }
  }

  function seen(session: RestoredSession | null) {
    if (session) status.update((s) => ({ ...s, lastSavedAt: session.meta.savedAt }))
    return session
  }

  function report(result: SaveResult) {
    status.update((s) => ({
      ...s,
      state: 'saved',
      lastSavedAt: result.savedAt,
      videoStatus: result.videoStatus,
    }))
    if (result.evicted > 0) {
      notice(
        `Storage is full, so ${result.evicted} older autosaves were removed. Checkpoints were kept.`
      )
    }
  }

  function runSave(): Promise<void> {
    if (!isOwner || unavailable || leavingSession) return Promise.resolve()
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

  async function settle() {
    scheduler.cancel()
    await runSave()
  }

  async function ownedStore(): Promise<SessionDb | null> {
    return isOwner && !leavingSession ? getDb() : null
  }

  async function transition<T>(fn: () => Promise<T>): Promise<T> {
    await settle()
    leavingSession = true
    try {
      return await fn()
    } finally {
      leavingSession = false
    }
  }

  return {
    status: status as Readable<AutosaveStatus>,

    async init(): Promise<RestoredSession | null> {
      const store = await getDb()
      if (!store) return null
      const legacy = opts.storage !== undefined ? opts.storage : safeLocalStorage()
      if (legacy) {
        const migrate = () =>
          store.importLegacy(legacy).catch((e) => console.warn('Legacy import failed:', e))
        await (locks ? locks.request(MIGRATE_LOCK, migrate) : migrate())
      }
      await openSession(await store.lastOpenedSessionId())
      if (!sessionId) return null
      try {
        return seen(await store.loadLatest(sessionId))
      } catch (e) {
        console.warn('Failed to read autosave:', e)
        return null
      }
    },

    get sessionId() {
      return sessionId
    },
    get canWrite() {
      return isOwner && !unavailable
    },

    schedule: () => scheduler.schedule(),
    flush: () => {
      scheduler.cancel()
      return runSave()
    },

    async checkpoint(label: string | null): Promise<SaveResult | null> {
      const snapshot = opts.getSnapshot()
      if (!snapshot) return null
      const store = await ownedStore()
      if (!store) {
        notice('Checkpoints are paused while this session is open in another tab.')
        return null
      }
      try {
        const result = await store.save(await ensureSession(store), snapshot, {
          kind: 'pinned',
          label: label?.trim() || null,
        })
        report(result)
        return result
      } catch (e) {
        console.warn('Checkpoint failed:', e)
        notice('Could not save a checkpoint. Use Export to keep your work.')
        return null
      }
    },

    async listSnapshots(): Promise<SnapshotMeta[]> {
      const store = await getDb()
      return store && sessionId ? store.listSnapshots(sessionId) : []
    },

    async loadSnapshot(id: number): Promise<RestoredSession | null> {
      const store = await getDb()
      return store ? store.loadSnapshot(id) : null
    },

    async loadPath(id: number, pathId: number): Promise<PathData | null> {
      const store = await getDb()
      return store ? store.loadPath(id, pathId) : null
    },

    async renameSnapshot(id: number, label: string | null) {
      await (await ownedStore())?.renameSnapshot(id, label)
    },

    async deleteSnapshot(id: number) {
      await (await ownedStore())?.deleteSnapshot(id)
    },

    async listSessions(): Promise<SessionRecord[]> {
      const store = await getDb()
      return store ? store.listSessions() : []
    },

    switchSession(id: string): Promise<RestoredSession | null> {
      return transition(async () => {
        await openSession(id)
        const store = await getDb()
        return store ? seen(await store.loadLatest(id)) : null
      })
    },

    newSession(name: string | null = null): Promise<void> {
      return transition(async () => {
        await openSession(null)
        nextSessionName = name
      })
    },

    async renameSession(id: string, name: string) {
      await (await getDb())?.renameSession(id, name)
    },

    async deleteSession(id: string) {
      const store = await getDb()
      if (!store) return
      if (id === sessionId) {
        if (!isOwner) throw new SessionBusyError()
        await transition(async () => {
          await store.deleteSession(id)
          await openSession(null)
        })
        return
      }
      const remove = async (granted: unknown) => {
        if (!granted) throw new SessionBusyError()
        await store.deleteSession(id)
      }
      await (locks ? locks.request(LOCK_PREFIX + id, { ifAvailable: true }, remove) : remove(true))
    },

    async exportSession(id: string): Promise<SessionBundle | null> {
      if (id === sessionId) await settle()
      const store = await getDb()
      return store ? store.exportSession(id) : null
    },

    async importSession(bundle: SessionBundle): Promise<RestoredSession | null> {
      const store = await getDb()
      if (!store) return null
      const created = await store.importSession(bundle)
      return transition(async () => {
        await openSession(created.id)
        return seen(await store.loadLatest(created.id))
      })
    },

    async storageEstimate(): Promise<{ usage: number; quota: number } | null> {
      try {
        const estimate = await navigator.storage?.estimate?.()
        if (!estimate?.quota) return null
        return { usage: estimate.usage ?? 0, quota: estimate.quota }
      } catch {
        return null
      }
    },

    destroy() {
      destroyed = true
      scheduler.cancel()
      lock?.release()
      db?.close()
    },
  }
}
