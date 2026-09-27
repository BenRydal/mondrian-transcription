import { writable } from 'svelte/store'
import { clamp } from '$lib/utils/math'

export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.5, 2] as const

export const RECORDING_MODES = ['toggle', 'hold'] as const
export type RecordingMode = (typeof RECORDING_MODES)[number]

export const TRAIL_LENGTHS = [0, 1, 3, 5] as const

export const NEW_PATH_STARTS = ['zero', 'current'] as const
export type NewPathStart = (typeof NEW_PATH_STARTS)[number]

interface ViewPrefs {
  playbackRate: number
  recordingMode: RecordingMode
  trailSeconds: number
  newPathStart: NewPathStart
  openSections: string[]
}

const STORAGE_KEY = 'mondrian-view-prefs'

const isOneOf = <T>(list: readonly T[], value: unknown): value is T =>
  (list as readonly unknown[]).includes(value)

const browserStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

const defaultViewPrefs: ViewPrefs = {
  playbackRate: 1,
  recordingMode: 'toggle',
  trailSeconds: 3,
  newPathStart: 'zero',
  openSections: [],
}

export function sanitizeViewPrefs(raw: unknown): ViewPrefs {
  const prefs = { ...defaultViewPrefs, openSections: [] as string[] }
  if (!raw || typeof raw !== 'object') return prefs
  const r = raw as Record<string, unknown>
  if (isOneOf(PLAYBACK_RATES, r.playbackRate)) prefs.playbackRate = r.playbackRate
  if (isOneOf(RECORDING_MODES, r.recordingMode)) prefs.recordingMode = r.recordingMode
  if (isOneOf(TRAIL_LENGTHS, r.trailSeconds)) prefs.trailSeconds = r.trailSeconds
  if (isOneOf(NEW_PATH_STARTS, r.newPathStart)) prefs.newPathStart = r.newPathStart
  if (Array.isArray(r.openSections))
    prefs.openSections = r.openSections.filter((id): id is string => typeof id === 'string')
  return prefs
}

function load(): ViewPrefs {
  try {
    const text = browserStorage()?.getItem(STORAGE_KEY)
    return sanitizeViewPrefs(text ? JSON.parse(text) : null)
  } catch {
    return sanitizeViewPrefs(null)
  }
}

export const viewPrefs = writable<ViewPrefs>(load())

function saveIfStorageAllowed(prefs: ViewPrefs): boolean {
  try {
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}

viewPrefs.subscribe(saveIfStorageAllowed)

export function toggleSection(id: string) {
  viewPrefs.update((prefs) => ({
    ...prefs,
    openSections: prefs.openSections.includes(id)
      ? prefs.openSections.filter((open) => open !== id)
      : [...prefs.openSections, id],
  }))
}

export function stepPlaybackRate(
  rate: number,
  direction: 1 | -1,
  allowed: (rate: number) => boolean = () => true
): number {
  const rates = PLAYBACK_RATES.filter(allowed)
  if (rates.length === 0) return rate
  const i = rates.findIndex((r) => r >= rate)
  const current = i === -1 ? rates.length - 1 : rates[i] > rate && direction === 1 ? i - 1 : i
  const next = clamp(current + direction, 0, rates.length - 1)
  return rates[next]
}

export function formatRate(rate: number): string {
  return `${rate}×`
}
