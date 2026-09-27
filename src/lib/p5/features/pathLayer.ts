import type { RotationAngle } from '../../stores/drawingConfig'

export type Rect = { x: number; y: number; w: number; h: number }
export type XY = { x: number; y: number }

/** x' = a·x + c·y + e, y' = b·x + d·y + f (canvas matrix order). */
export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }

/** Stored image coords to canvas CSS pixels inside the fitted, rotated floor-plan rect. */
export function imageToDisplay(
  imgW: number,
  imgH: number,
  rotation: RotationAngle,
  r: Rect
): Affine {
  const sx = r.w / imgW
  const sy = r.h / imgH
  switch (rotation) {
    case 0:
      return { a: sx, b: 0, c: 0, d: sy, e: r.x, f: r.y }
    case 90:
      return { a: 0, b: r.h / imgW, c: -r.w / imgH, d: 0, e: r.x + r.w, f: r.y }
    case 180:
      return { a: -sx, b: 0, c: 0, d: -sy, e: r.x + r.w, f: r.y + r.h }
    case 270:
      return { a: 0, b: -r.h / imgW, c: r.w / imgH, d: 0, e: r.x, f: r.y + r.h }
  }
}

export interface PolylineSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
}

export interface DotSink {
  moveTo(x: number, y: number): void
  arc(x: number, y: number, r: number, start: number, end: number): void
}

/** Trace points[start, end) as one polyline, skipping points on the last kept point's device
 * pixel; the first and last points are always kept. Returns the kept count. */
export function traceDecimated(
  points: readonly XY[],
  start: number,
  end: number,
  m: Affine,
  density: number,
  sink: PolylineSink
): number {
  let kept = 0
  let lastPx = NaN
  let lastPy = NaN
  for (let i = start; i < end; i++) {
    const p = points[i]
    const x = m.a * p.x + m.c * p.y + m.e
    const y = m.b * p.x + m.d * p.y + m.f
    const px = Math.floor(x * density)
    const py = Math.floor(y * density)
    if (px === lastPx && py === lastPy && i !== end - 1) continue
    if (kept === 0) sink.moveTo(x, y)
    else sink.lineTo(x, y)
    lastPx = px
    lastPy = py
    kept++
  }
  return kept
}

/** Discrete mode: one circle per point, skipping repeats on the same device pixel. */
export function traceDots(
  points: readonly XY[],
  start: number,
  end: number,
  m: Affine,
  density: number,
  radius: number,
  sink: DotSink
): number {
  let kept = 0
  let lastPx = NaN
  let lastPy = NaN
  for (let i = start; i < end; i++) {
    const p = points[i]
    const x = m.a * p.x + m.c * p.y + m.e
    const y = m.b * p.x + m.d * p.y + m.f
    const px = Math.floor(x * density)
    const py = Math.floor(y * density)
    if (px === lastPx && py === lastPy) continue
    sink.moveTo(x + radius, y)
    sink.arc(x, y, radius, 0, 2 * Math.PI)
    lastPx = px
    lastPy = py
    kept++
  }
  return kept
}

/** Everything besides the points that decides what the cached layer looks like. */
export interface LayerKey {
  width: number
  height: number
  density: number
  rect: Rect
  rotation: RotationAngle
  imgW: number
  imgH: number
  strokeWeight: number
  continuous: boolean
}

export interface LayerPathInput {
  pathId: number
  color: string
  visible?: boolean
  points: readonly XY[]
}

interface LayerPathState {
  pathId: number
  color: string
  visible: boolean
  count: number
  first: XY | undefined
  last: XY | undefined
}

export interface LayerState {
  key: LayerKey
  paths: LayerPathState[]
}

export type LayerPlan =
  | { kind: 'none' }
  | { kind: 'rebuild' }
  | { kind: 'append'; index: number; from: number; onTop: boolean }

const isVisible = (p: { visible?: boolean }) => p.visible !== false
const drawsSomething = (p: LayerPathInput) => isVisible(p) && p.points.length > 0

function sameKey(a: LayerKey, b: LayerKey): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.density === b.density &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.w === b.rect.w &&
    a.rect.h === b.rect.h &&
    a.rotation === b.rotation &&
    a.imgW === b.imgW &&
    a.imgH === b.imgH &&
    a.strokeWeight === b.strokeWeight &&
    a.continuous === b.continuous
  )
}

/** True when only the canvas size, density or image placement differ, e.g. mid-resize. */
export function isGeometryOnlyChange(a: LayerKey, b: LayerKey): boolean {
  return (
    !sameKey(a, b) &&
    a.rotation === b.rotation &&
    a.imgW === b.imgW &&
    a.imgH === b.imgH &&
    a.strokeWeight === b.strokeWeight &&
    a.continuous === b.continuous
  )
}

/** What the layer holds after drawing `paths`; `counts` overrides how many points each has in it. */
export function layerState(
  key: LayerKey,
  paths: readonly LayerPathInput[],
  counts?: readonly number[]
): LayerState {
  return {
    key,
    paths: paths.map((p, i) => {
      const count = counts?.[i] ?? p.points.length
      return {
        pathId: p.pathId,
        color: p.color,
        visible: isVisible(p),
        count,
        first: p.points[0],
        last: count > 0 ? p.points[count - 1] : undefined,
      }
    }),
  }
}

/** Compare the held layer with the next inputs. Points are never edited in place, so a path whose
 * held first and last points still sit at the same indices only grew at its end. */
export function planLayer(
  prev: LayerState | null,
  key: LayerKey,
  paths: readonly LayerPathInput[]
): LayerPlan {
  if (!prev || !sameKey(prev.key, key)) return { kind: 'rebuild' }
  const held = prev.paths
  if (paths.length < held.length) return { kind: 'rebuild' }
  for (let i = held.length; i < paths.length; i++) {
    if (drawsSomething(paths[i])) return { kind: 'rebuild' }
  }

  let grown = -1
  for (let i = 0; i < held.length; i++) {
    const was = held[i]
    const p = paths[i]
    if (p.pathId !== was.pathId || p.color !== was.color || isVisible(p) !== was.visible) {
      return { kind: 'rebuild' }
    }
    if (!was.visible) continue
    const n = p.points.length
    if (n < was.count) return { kind: 'rebuild' }
    if (was.count > 0 && (p.points[0] !== was.first || p.points[was.count - 1] !== was.last)) {
      return { kind: 'rebuild' }
    }
    if (n === was.count) continue
    if (grown !== -1) return { kind: 'rebuild' }
    grown = i
  }
  if (grown === -1) return { kind: 'none' }
  const onTop = paths.slice(grown + 1).every((p) => !drawsSomething(p))
  return { kind: 'append', index: grown, from: held[grown].count, onTop }
}

/** Points appended per commit while recording; the rest is drawn live on top each frame. */
export const COMMIT_BATCH = 128
/** A path under other paths commits by a full rebuild, so it waits for a longer tail. */
export const COMMIT_BATCH_UNDER = 2048

export function shouldCommit(tail: number, onTop: boolean, recording: boolean): boolean {
  if (!recording) return true
  return tail >= (onTop ? COMMIT_BATCH : COMMIT_BATCH_UNDER)
}

export interface LayerFrame {
  key: LayerKey
  transform: Affine
  paths: readonly LayerPathInput[]
  recording: boolean
}

/** Counters for profiling how often the cache is rebuilt, appended to, or bypassed. */
export const layerStats = { rebuilds: 0, appends: 0, liveTails: 0 }

/** Resizes rebuild once the geometry has been still this long; until then the cache is stretched. */
export const RESIZE_SETTLE_MS = 150

/** Committed path geometry cached in a CPU-backed canvas at device resolution. */
export class PathLayer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private state: LayerState | null = null
  private hasInk = false
  private lastKey: LayerKey | null = null
  private keyChangedAt = -Infinity
  private settleTimer: ReturnType<typeof setTimeout> | null = null

  /** `onSettle` must redraw, so a stretched frame is replaced once a resize stops. */
  constructor(private readonly onSettle: () => void = () => {}) {}

  /** Bring the cache up to date, blit it onto `target`, then draw any uncommitted tail live. */
  draw(target: CanvasRenderingContext2D, frame: LayerFrame, now = performance.now()) {
    if (!this.lastKey || !sameKey(this.lastKey, frame.key)) this.keyChangedAt = now
    this.lastKey = frame.key
    const plan = planLayer(this.state, frame.key, frame.paths)
    let live: { index: number; from: number } | null = null
    let stretchFrom: LayerKey | null = null
    if (plan.kind === 'rebuild' && this.canStretch(frame, now)) {
      stretchFrom = this.state!.key
      this.scheduleSettle(now)
    } else if (plan.kind === 'rebuild') {
      this.rebuild(frame)
    } else if (plan.kind === 'none') {
      this.state = layerState(frame.key, frame.paths)
    } else {
      const tail = frame.paths[plan.index].points.length - plan.from
      if (!shouldCommit(tail, plan.onTop, frame.recording)) {
        live = plan
      } else if (plan.onTop) {
        this.strokeRange(this.ctx!, frame, plan.index, plan.from)
        this.state = layerState(frame.key, frame.paths)
        this.hasInk = true
        layerStats.appends++
      } else {
        this.rebuild(frame)
      }
    }

    target.save()
    if (this.hasInk && this.canvas) {
      const base = target.getTransform()
      if (stretchFrom) this.stretchTransform(target, stretchFrom, frame.key)
      else target.setTransform(1, 0, 0, 1, 0, 0)
      target.drawImage(this.canvas, 0, 0)
      target.setTransform(base)
    }
    if (live) {
      this.strokeRange(target, frame, live.index, live.from)
      layerStats.liveTails++
    }
    target.restore()
  }

  private canStretch(frame: LayerFrame, now: number): boolean {
    const held = this.state
    if (!held || !this.hasInk || now - this.keyChangedAt >= RESIZE_SETTLE_MS) return false
    if (!isGeometryOnlyChange(held.key, frame.key)) return false
    return planLayer({ ...held, key: frame.key }, frame.key, frame.paths).kind === 'none'
  }

  private scheduleSettle(now: number) {
    if (this.settleTimer) clearTimeout(this.settleTimer)
    const wait = RESIZE_SETTLE_MS - (now - this.keyChangedAt)
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null
      this.onSettle()
    }, wait + 1)
  }

  /** Map the cache drawn for `from` onto the image rect of `to`. */
  private stretchTransform(target: CanvasRenderingContext2D, from: LayerKey, to: LayerKey) {
    const sx = to.rect.w / from.rect.w
    const sy = to.rect.h / from.rect.h
    const d = to.density
    target.setTransform(
      (d * sx) / from.density,
      0,
      0,
      (d * sy) / from.density,
      d * (to.rect.x - from.rect.x * sx),
      d * (to.rect.y - from.rect.y * sy)
    )
  }

  private rebuild(frame: LayerFrame) {
    const { width, height, density } = frame.key
    if (!this.canvas || !this.ctx) {
      this.canvas = document.createElement('canvas')
      // CPU-backed: rasterising long stroked paths on the GPU canvas path is far slower.
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.setTransform(density, 0, 0, density, 0, 0)
    this.hasInk = false
    frame.paths.forEach((path, i) => {
      if (!drawsSomething(path)) return
      this.strokeRange(ctx, frame, i, 0)
      this.hasInk = true
    })
    this.state = layerState(frame.key, frame.paths)
    layerStats.rebuilds++
  }

  private strokeRange(
    ctx: CanvasRenderingContext2D,
    frame: LayerFrame,
    index: number,
    from: number
  ) {
    const { points, color } = frame.paths[index]
    const { strokeWeight, continuous, density } = frame.key
    const m = frame.transform
    ctx.lineWidth = strokeWeight
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.beginPath()
    if (!continuous) {
      traceDots(points, from, points.length, m, density, strokeWeight / 2, ctx)
      ctx.stroke()
    } else if (points.length === 1) {
      const p = points[0]
      ctx.fillStyle = color
      ctx.arc(
        m.a * p.x + m.c * p.y + m.e,
        m.b * p.x + m.d * p.y + m.f,
        strokeWeight / 2,
        0,
        2 * Math.PI
      )
      ctx.fill()
    } else {
      traceDecimated(points, Math.max(0, from - 1), points.length, m, density, ctx)
      ctx.stroke()
    }
  }
}
