import { clamp } from '$lib/utils/math'

export interface TimedPoint {
  x: number
  y: number
  time: number
}

const MIN_POINT_INTERVAL = 0.01
const HOLD_GAP = 0.1
const HOLD_INTERVAL = 0.1

export function shouldKeepPoint(
  prevTime: number | undefined,
  time: number,
  minInterval = MIN_POINT_INTERVAL
): boolean {
  return prevTime === undefined || time - prevTime >= minInterval
}

export function holdTimes(lastTime: number, now: number, interval = HOLD_INTERVAL): number[] {
  const times: number[] = []
  if (!(interval > 0) || !Number.isFinite(now)) return times
  for (let k = 1; lastTime + k * interval <= now + 1e-9; k++) times.push(lastTime + k * interval)
  return times
}

export function thinByTime<T extends TimedPoint>(
  points: T[],
  minInterval = MIN_POINT_INTERVAL
): T[] {
  const kept: T[] = []
  for (const p of points) {
    if (shouldKeepPoint(kept.at(-1)?.time, p.time, minInterval)) kept.push(p)
  }
  return kept
}

interface ResampleOptions {
  rate: number
  scale?: number
  holdGap?: number
}

/** Latest recorded time across every path, or 0 when nothing has been recorded. */
export function sessionEnd(paths: TimedPoint[][]): number {
  let end = 0
  for (const path of paths) for (const p of path) end = Math.max(end, p.time)
  return end
}

export function sessionScale(paths: TimedPoint[][], duration: number): number {
  const end = sessionEnd(paths)
  return end > 0 ? duration / end : 1
}

export function resamplePath(points: TimedPoint[], options: ResampleOptions): TimedPoint[] {
  const { rate, scale = 1, holdGap = HOLD_GAP } = options
  if (points.length === 0 || !(rate > 0) || !(scale > 0)) return []

  const sorted = [...points].sort((a, b) => a.time - b.time)
  const t0 = sorted[0].time
  const t1 = sorted[sorted.length - 1].time

  const gap = Math.max(holdGap, 2 * medianGap(sorted))
  const toOut = (t: number) => t * scale
  const toRaw = (tau: number) => tau / scale

  const eps = 1e-9
  let kStart = Math.ceil(toOut(t0) * rate - eps)
  let kEnd = Math.floor(toOut(t1) * rate + eps)
  if (kEnd < kStart) kStart = kEnd = Math.round(toOut(t0) * rate)

  const result: TimedPoint[] = []
  let seg = 0
  for (let k = kStart; k <= kEnd; k++) {
    const time = k / rate + 0
    const raw = clamp(toRaw(time), t0, t1)
    while (seg < sorted.length - 2 && sorted[seg + 1].time <= raw) seg++
    result.push({ ...positionAt(sorted, seg, raw, gap), time })
  }
  return result
}

function medianGap(sorted: TimedPoint[]): number {
  const gaps = sorted.slice(1).map((p, i) => p.time - sorted[i].time)
  if (gaps.length === 0) return 0
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)]
}

function positionAt(sorted: TimedPoint[], seg: number, raw: number, holdGap: number) {
  const a = sorted[seg]
  const b = sorted[Math.min(seg + 1, sorted.length - 1)]
  const dt = b.time - a.time
  if (raw >= b.time) return { x: b.x, y: b.y }
  if (dt <= 0 || raw <= a.time || dt > holdGap) return { x: a.x, y: a.y }
  const f = (raw - a.time) / dt
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
