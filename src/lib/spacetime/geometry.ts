import type { RotationAngle } from '$lib/stores/drawingConfig'
import { applyForwardRotation, getRotatedDimensions } from '$lib/utils/drawingUtils'
import { clamp, expDecay } from '$lib/utils/math'
import { formatHms } from '$lib/utils/time'
import { lastIndexAtOrBefore } from '$lib/timing/timeWindow'

export type Vec3 = [number, number, number]
export type TimedPoint = { x: number; y: number; time: number }

export const MIN_TIME_SPAN = 10
export const DEFAULT_PITCH = Math.PI / 5
export const MIN_PITCH = 0.05
export const MAX_PITCH = Math.PI / 2 - 0.01
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 3

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

export function timeExtent(paths: { points: TimedPoint[] }[], now: number, duration = 0): number {
  let max = Math.max(now, Number.isFinite(duration) ? duration : 0)
  for (const path of paths) {
    const last = path.points.at(-1)
    if (last && last.time > max) max = last.time
  }
  return Math.max(max, MIN_TIME_SPAN)
}

const NICE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

export function timeAxis(extent: number, target = 4): { span: number; ticks: number[] } {
  if (!(extent > 0)) return { span: 0, ticks: [0] }
  const raw = extent / target
  const step = NICE_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 3600) * 3600
  const count = Math.ceil(extent / step - 1e-9)
  return { span: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}

const AXIS_EASE_TAU = 0.1
const TICK_FADE_SECONDS = 0.25

export function easeSpan(
  shown: number,
  target: number,
  content: number,
  dt: number,
  tau = AXIS_EASE_TAU
): number {
  if (!(shown > 0) || !(tau > 0)) return target
  const next = target + (shown - target) * expDecay(dt, tau)
  const settled = Math.abs(next - target) <= target * 1e-3
  return Math.max(settled ? target : next, Math.min(content, target))
}

export function fadeTicks(
  alphas: ReadonlyMap<number, number>,
  shown: readonly number[],
  dt: number,
  seconds = TICK_FADE_SECONDS
): Map<number, number> {
  const step = seconds > 0 ? Math.max(0, dt) / seconds : Infinity
  const next = new Map<number, number>()
  for (const t of shown)
    next.set(t, alphas.size === 0 ? 1 : Math.min(1, (alphas.get(t) ?? 0) + step))
  for (const [t, a] of alphas) if (!next.has(t) && a - step > 0) next.set(t, a - step)
  return next
}

export function formatTick(seconds: number): string {
  return formatHms(Math.round(seconds))
}

export function liveHead<T extends TimedPoint>(
  points: readonly T[],
  now: number,
  recording: boolean
): TimedPoint | null {
  const last = points.at(-1)
  if (!recording || !last || !(now > last.time)) return null
  return { x: last.x, y: last.y, time: now }
}

export function markerPoint(
  points: readonly TimedPoint[],
  now: number,
  isCurrent: boolean,
  recording: boolean
): TimedPoint | null {
  if (isCurrent) return liveHead(points, now, recording) ?? points.at(-1) ?? null
  const i = lastIndexAtOrBefore(points, now)
  return i < 0 ? null : points[i]
}

export function chunkRanges(n: number, size: number): [number, number][] {
  const ranges: [number, number][] = []
  if (n < 2) return n === 1 ? [[0, 1]] : ranges
  for (let start = 0; start < n - 1; start += size) {
    ranges.push([start, Math.min(start + size + 1, n)])
  }
  return ranges
}

export function orbitEye(target: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const flat = Math.cos(pitch) * distance
  return [
    target[0] + flat * Math.sin(yaw),
    target[1] + flat * Math.cos(yaw),
    target[2] + Math.sin(pitch) * distance,
  ]
}

export type DragSample = { ms: number; yaw: number }

export const INERTIA_WINDOW_MS = 100
const INERTIA_TAU = 0.35
const MAX_INERTIA = 6

export function releaseVelocity(
  samples: readonly DragSample[],
  releaseMs: number,
  windowMs = INERTIA_WINDOW_MS
): number {
  const recent = samples.filter((s) => releaseMs - s.ms <= windowMs)
  if (recent.length < 2) return 0
  const seconds = (recent[recent.length - 1].ms - recent[0].ms) / 1000
  if (seconds <= 0) return 0
  const moved = recent.slice(1).reduce((sum, s) => sum + s.yaw, 0)
  return clamp(moved / seconds, -MAX_INERTIA, MAX_INERTIA)
}

export function coast(velocity: number, dt: number, tau = INERTIA_TAU, rest = 0.02): number {
  const next = velocity * expDecay(dt, tau)
  return Math.abs(next) < rest ? 0 : next
}
