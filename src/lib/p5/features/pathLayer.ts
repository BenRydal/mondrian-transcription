import type { RotationAngle } from '../../stores/drawingConfig'

export type Rect = { x: number; y: number; w: number; h: number }
export type XY = { x: number; y: number }

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }

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

export function applyAffine(m: Affine, p: XY): XY {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

interface PolylineSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
}

interface DotSink {
  moveTo(x: number, y: number): void
  arc(x: number, y: number, r: number, start: number, end: number): void
}

export function traceDecimated(
  points: readonly XY[],
  start: number,
  end: number,
  m: Affine,
  density: number,
  sink: PolylineSink
): number {
  return forEachDistinctPixel(points, start, end, m, density, true, (x, y, kept) =>
    kept === 0 ? sink.moveTo(x, y) : sink.lineTo(x, y)
  )
}

export function traceDots(
  points: readonly XY[],
  start: number,
  end: number,
  m: Affine,
  density: number,
  radius: number,
  sink: DotSink
): number {
  return forEachDistinctPixel(points, start, end, m, density, false, (x, y) => {
    sink.moveTo(x + radius, y)
    sink.arc(x, y, radius, 0, 2 * Math.PI)
  })
}

function forEachDistinctPixel(
  points: readonly XY[],
  start: number,
  end: number,
  m: Affine,
  density: number,
  keepLast: boolean,
  visit: (x: number, y: number, kept: number) => void
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
    if (px === lastPx && py === lastPy && !(keepLast && i === end - 1)) continue
    visit(x, y, kept)
    lastPx = px
    lastPy = py
    kept++
  }
  return kept
}

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

interface LayerState {
  key: LayerKey
  paths: LayerPathState[]
}

type LayerPlan =
  | { kind: 'none' }
  | { kind: 'rebuild' }
  | { kind: 'append'; index: number; from: number; onTop: boolean }

const CPU_BACKED: CanvasRenderingContext2DSettings = { willReadFrequently: true }

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

const onlyGrewAtEnd = (p: LayerPathInput, was: LayerPathState) =>
  was.count === 0 || (p.points[0] === was.first && p.points[was.count - 1] === was.last)

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
    if (!onlyGrewAtEnd(p, was)) return { kind: 'rebuild' }
    if (n === was.count) continue
    if (grown !== -1) return { kind: 'rebuild' }
    grown = i
  }
  if (grown === -1) return { kind: 'none' }
  const onTop = paths.slice(grown + 1).every((p) => !drawsSomething(p))
  return { kind: 'append', index: grown, from: held[grown].count, onTop }
}

export const COMMIT_BATCH = 128
export const COMMIT_BATCH_UNDER = 2048

export function shouldCommit(tail: number, onTop: boolean, recording: boolean): boolean {
  if (!recording) return true
  return tail >= (onTop ? COMMIT_BATCH : COMMIT_BATCH_UNDER)
}

interface LayerFrame {
  key: LayerKey
  transform: Affine
  paths: readonly LayerPathInput[]
  recording: boolean
}

const RESIZE_SETTLE_MS = 150

export class PathLayer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private state: LayerState | null = null
  private hasInk = false
  private lastKey: LayerKey | null = null
  private keyChangedAt = -Infinity
  private settleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly onSettle: () => void = () => {}) {}

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
      this.ctx = this.canvas.getContext('2d', CPU_BACKED)!
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
      const { x, y } = applyAffine(m, points[0])
      ctx.fillStyle = color
      ctx.arc(x, y, strokeWeight / 2, 0, 2 * Math.PI)
      ctx.fill()
    } else {
      traceDecimated(points, Math.max(0, from - 1), points.length, m, density, ctx)
      ctx.stroke()
    }
  }
}
