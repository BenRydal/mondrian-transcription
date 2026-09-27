import type { RotationAngle } from '$lib/stores/drawingConfig'
import { applyForwardRotation, getRotatedDimensions } from '$lib/utils/drawingUtils'

export type Vec3 = [number, number, number]
type TimedPoint = { x: number; y: number; time: number }

export const MIN_TIME_SPAN = 10
export const DEFAULT_PITCH = Math.PI / 5
export const MIN_PITCH = 0.05
export const MAX_PITCH = Math.PI / 2 - 0.01
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 3

/** Image point to scene x/y (centred, rotated like the 2D floor plan) with raw time as z. */
export function toScenePoint(
  pt: TimedPoint,
  imgW: number,
  imgH: number,
  rotation: RotationAngle
): Vec3 {
  const { nx, ny } = applyForwardRotation(pt.x, pt.y, imgW, imgH, rotation)
  const { displayW, displayH } = getRotatedDimensions(imgW, imgH, rotation)
  return [(nx - 0.5) * displayW, (ny - 0.5) * displayH, pt.time]
}

/** Floor scale, time-axis height and camera distance that fit the scene into a view of any aspect. */
export function fitScene(
  viewW: number,
  viewH: number,
  imgW: number,
  imgH: number,
  rotation: RotationAngle
) {
  const footprint = Math.max(1, Math.min(viewW, viewH)) * 0.6
  const { displayW, displayH } = getRotatedDimensions(imgW, imgH, rotation)
  const scale = footprint / Math.max(displayW, displayH, 1)
  return {
    scale,
    floorW: displayW * scale,
    floorH: displayH * scale,
    height: footprint * 0.8,
    distance: footprint * 1.8 * Math.max(1, viewH / Math.max(1, viewW)),
  }
}

/** Latest time the scene must show: every path's end, the clock, and the video length. */
export function timeExtent(paths: { points: TimedPoint[] }[], now: number, duration = 0): number {
  let max = Math.max(now, Number.isFinite(duration) ? duration : 0)
  for (const path of paths) {
    const last = path.points.at(-1)
    if (last && last.time > max) max = last.time
  }
  return Math.max(max, MIN_TIME_SPAN)
}

export function timeToHeight(time: number, span: number, height: number): number {
  return span > 0 ? (time / span) * height : 0
}

const NICE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/** Axis span rounded up to a whole number of round steps, so it grows in jumps and its top is a tick. */
export function timeAxis(extent: number, target = 4): { span: number; ticks: number[] } {
  if (!(extent > 0)) return { span: 0, ticks: [0] }
  const raw = extent / target
  const step = NICE_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 3600) * 3600
  const count = Math.ceil(extent / step - 1e-9)
  return { span: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}

export function formatTick(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Index of the last point at or before `time` (points sorted by time); -1 if none. */
export function indexAtTime(points: TimedPoint[], time: number): number {
  let lo = 0
  let hi = points.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].time <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/** Split n points into fixed-size runs that share their end points, so strokes stay joined. */
export function chunkRanges(n: number, size: number): [number, number][] {
  const ranges: [number, number][] = []
  if (n < 2) return n === 1 ? [[0, 1]] : ranges
  for (let start = 0; start < n - 1; start += size) {
    ranges.push([start, Math.min(start + size + 1, n)])
  }
  return ranges
}

/** Camera eye for an orbit around `target`; +z is up (time) and yaw 0 looks from the floor plan's bottom edge. */
export function orbitEye(target: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const flat = Math.cos(pitch) * distance
  return [
    target[0] + flat * Math.sin(yaw),
    target[1] + flat * Math.cos(yaw),
    target[2] + Math.sin(pitch) * distance,
  ]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
