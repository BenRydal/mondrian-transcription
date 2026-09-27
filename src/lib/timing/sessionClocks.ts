import { MediaClock, SessionClock } from './clock'

export const speculateClock = new SessionClock()
export const mediaClock = new MediaClock()

let speculateClockPathId: number | null = null

/** Point the speculate clock at a path's end the first time that path becomes current. */
export function syncSpeculateClock(pathId: number, lastTime: number | undefined, perfMs: number) {
  if (speculateClockPathId === pathId) return
  speculateClock.pause(perfMs)
  speculateClock.seek(lastTime ?? 0, perfMs)
  speculateClockPathId = pathId
}

export function invalidateSpeculateClock() {
  speculateClockPathId = null
}
