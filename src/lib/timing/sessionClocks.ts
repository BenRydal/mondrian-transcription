import { MediaClock, SessionClock } from './clock'

export const speculateClock = new SessionClock()
export const mediaClock = new MediaClock()

let speculateClockPathId: number | null = null
let newPathStart: { pathId: number; time: number } | null = null

/** Point the speculate clock at a path's end (its start while empty) when it first becomes current. */
export function syncSpeculateClock(pathId: number, lastTime: number | undefined, perfMs: number) {
  if (speculateClockPathId === pathId) return
  const start = newPathStart?.pathId === pathId ? newPathStart.time : 0
  speculateClock.pause(perfMs)
  speculateClock.seek(lastTime ?? start, perfMs)
  speculateClockPathId = pathId
}

/** Start a newly created, still empty path at `time` on the session clock instead of 0. */
export function setNewPathStart(pathId: number, time: number) {
  newPathStart = time > 0 ? { pathId, time } : null
}

export function invalidateSpeculateClock() {
  speculateClockPathId = null
  newPathStart = null
}
