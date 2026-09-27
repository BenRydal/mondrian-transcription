import { MediaClock, SessionClock } from './clock'

export const speculateClock = new SessionClock()
export const mediaClock = new MediaClock()

let speculateClockPathId: number | null = null
let newPathStart: { pathId: number; time: number } | null = null

export function syncSpeculateClock(pathId: number, lastTime: number | undefined, perfMs: number) {
  if (speculateClockPathId === pathId) return
  const start = newPathStart?.pathId === pathId ? newPathStart.time : 0
  speculateClock.pause(perfMs)
  speculateClock.seek(lastTime ?? start, perfMs)
  speculateClockPathId = pathId
}

export function setNewPathStart(pathId: number, time: number) {
  newPathStart = time > 0 ? { pathId, time } : null
}

export function invalidateSpeculateClock() {
  speculateClockPathId = null
  newPathStart = null
}
