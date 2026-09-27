import { writable } from 'svelte/store'

export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.5, 2] as const

export const RECORDING_MODES = ['toggle', 'hold'] as const
export type RecordingMode = (typeof RECORDING_MODES)[number]

export const TRAIL_LENGTHS = [0, 1, 3, 5] as const

export const NEW_PATH_STARTS = ['zero', 'current'] as const
export type NewPathStart = (typeof NEW_PATH_STARTS)[number]

export interface ViewPrefs {
  playbackRate: number
  recordingMode: RecordingMode
  trailSeconds: number
  /** Speculate: a new path starts at 0:00 or at the session clock's current time. */
  newPathStart: NewPathStart
}

const STORAGE_KEY = 'mondrian-view-prefs'

// Node exposes a warning-emitting localStorage global, so only touch it in a browser.
const storage = () => (typeof window === 'undefined' ? null : window.localStorage)

export const defaultViewPrefs: ViewPrefs = {
  playbackRate: 1,
  recordingMode: 'toggle',
  trailSeconds: 3,
  newPathStart: 'zero',
}

/** Drop unknown or invalid values so a stale or hand-edited entry can't break the app. */
export function sanitizeViewPrefs(raw: unknown): ViewPrefs {
  const prefs = { ...defaultViewPrefs }
  if (!raw || typeof raw !== 'object') return prefs
  const r = raw as Record<string, unknown>
  if ((PLAYBACK_RATES as readonly unknown[]).includes(r.playbackRate)) {
    prefs.playbackRate = r.playbackRate as number
  }
  if ((RECORDING_MODES as readonly unknown[]).includes(r.recordingMode)) {
    prefs.recordingMode = r.recordingMode as RecordingMode
  }
  if ((TRAIL_LENGTHS as readonly unknown[]).includes(r.trailSeconds)) {
    prefs.trailSeconds = r.trailSeconds as number
  }
  if ((NEW_PATH_STARTS as readonly unknown[]).includes(r.newPathStart)) {
    prefs.newPathStart = r.newPathStart as NewPathStart
  }
  return prefs
}

function load(): ViewPrefs {
  try {
    const text = storage()?.getItem(STORAGE_KEY)
    return sanitizeViewPrefs(text ? JSON.parse(text) : null)
  } catch {
    return { ...defaultViewPrefs }
  }
}

/** Per-browser view settings; kept out of session snapshots on purpose. */
export const viewPrefs = writable<ViewPrefs>(load())

viewPrefs.subscribe((prefs) => {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode or blocked storage: the preference just won't survive a reload.
  }
})

/** Next allowed rate in the list, clamped at both ends. */
export function stepPlaybackRate(
  rate: number,
  direction: 1 | -1,
  allowed: (rate: number) => boolean = () => true
): number {
  const rates = PLAYBACK_RATES.filter(allowed)
  if (rates.length === 0) return rate
  const i = rates.findIndex((r) => r >= rate)
  const current = i === -1 ? rates.length - 1 : rates[i] > rate && direction === 1 ? i - 1 : i
  const next = Math.min(rates.length - 1, Math.max(0, current + direction))
  return rates[next]
}

export function formatRate(rate: number): string {
  return `${rate}×`
}
