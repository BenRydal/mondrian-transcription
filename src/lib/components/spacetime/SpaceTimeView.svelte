<script lang="ts">
  import type p5 from 'p5'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { P5Canvas, type SketchFn } from 'svelte-p5'
  import { drawingState, type PathData } from '$lib/stores/drawingState'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import type { Point } from '$lib/p5/types/sketch'
  import { isShortcutEvent } from '$lib/utils/keyboard'
  import {
    chunkRanges,
    clamp,
    DEFAULT_PITCH,
    fitScene,
    formatTick,
    indexAtTime,
    MAX_PITCH,
    MAX_ZOOM,
    MIN_PITCH,
    MIN_ZOOM,
    orbitEye,
    timeAxis,
    timeExtent,
    toScenePoint,
    type Vec3,
  } from '$lib/spacetime/geometry'
  import IconPause from '~icons/material-symbols/pause'
  import IconPlay from '~icons/material-symbols/play-arrow'

  let {
    getNow,
    getDuration = () => 0,
    class: className = '',
  }: { getNow: () => number; getDuration?: () => number; class?: string } = $props()

  const SPIN_RADIANS_PER_SECOND = 0.25
  const DRAG_RADIANS_PER_PIXEL = 0.008
  const CHUNK_SIZE = 256
  const NOW_COLOR = '#6d28d9'

  let container: HTMLDivElement
  let instance = $state.raw<P5 | null>(null)
  let spinning = $state(true)
  let dragging = false
  let yaw = 0
  let pitch = DEFAULT_PITCH
  let zoom = 1
  let labels = $state.raw<{ text: string; x: number; y: number }[]>([])
  const hasFloorPlan = $derived(!!$drawingState.imageElement)

  // p5 2.x APIs missing from @types/p5 (1.x), which is what the project type-checks against.
  type P5 = p5 & {
    buildGeometry(callback: () => void): p5.Geometry
    freeGeometry(geometry: p5.Geometry): void
    worldToScreen(x: number, y: number, z: number): p5.Vector
  }

  type Chunk = { first: Point; last: Point; geometry: p5.Geometry }
  const chunkCache = new Map<number, Chunk[]>()
  let cacheKey = ''

  function freeAll(p: P5) {
    for (const chunks of chunkCache.values()) for (const c of chunks) p.freeGeometry(c.geometry)
    chunkCache.clear()
  }

  const sketch: SketchFn<P5> = (p) => {
    let lastFrameMs = performance.now()

    const vertices = (
      points: Point[],
      start: number,
      end: number,
      toScene: (pt: Point) => Vec3
    ) => {
      p.beginShape()
      for (let i = start; i < end; i++) p.vertex(...toScene(points[i]))
      p.endShape()
    }

    /** Draw a path from cached chunks, rebuilding only chunks whose points changed. */
    const drawPath = (path: PathData, toScene: (pt: Point) => Vec3) => {
      const { points } = path
      const ranges = chunkRanges(points.length, CHUNK_SIZE)
      const cached = chunkCache.get(path.pathId) ?? []
      const kept: Chunk[] = []
      for (const [i, [start, end]] of ranges.entries()) {
        if (end - start < 2) {
          p.point(...toScene(points[start]))
          continue
        }
        if (end - start <= CHUNK_SIZE) {
          vertices(points, start, end, toScene)
          continue
        }
        let chunk = cached[i]
        if (!chunk || chunk.first !== points[start] || chunk.last !== points[end - 1]) {
          if (chunk) p.freeGeometry(chunk.geometry)
          const geometry = p.buildGeometry(() => {
            p.noFill()
            p.stroke(0)
            vertices(points, start, end, toScene)
          })
          chunk = { first: points[start], last: points[end - 1], geometry }
        }
        kept.push(chunk)
        p.model(chunk.geometry)
      }
      for (const stale of cached.slice(kept.length)) p.freeGeometry(stale.geometry)
      chunkCache.set(path.pathId, kept)
    }

    p.setup = () => {
      p.createCanvas(
        Math.max(1, container.clientWidth),
        Math.max(1, container.clientHeight),
        p.WEBGL
      )
      p.frameRate(30)
      ready = true
      syncLoop(p)
    }

    p.draw = () => {
      const nowMs = performance.now()
      const dt = Math.min(0.1, (nowMs - lastFrameMs) / 1000)
      lastFrameMs = nowMs
      if (spinning && !dragging) yaw += dt * SPIN_RADIANS_PER_SECOND

      p.background(255)
      const state = get(drawingState)
      const config = get(drawingConfig)
      const { imageElement: img, imageWidth: imgW, imageHeight: imgH } = state
      if (!img || !imgW || !imgH) {
        labels = []
        return
      }

      const rotation = config.floorPlanRotation
      const key = `${imgW}x${imgH}@${rotation}`
      if (key !== cacheKey) {
        freeAll(p)
        cacheKey = key
      }
      const livePathIds = new Set(state.paths.map((path) => path.pathId))
      for (const [id, chunks] of chunkCache) {
        if (livePathIds.has(id)) continue
        for (const c of chunks) p.freeGeometry(c.geometry)
        chunkCache.delete(id)
      }

      const fit = fitScene(p.width, p.height, imgW, imgH, rotation)
      const now = getNow()
      const { span, ticks } = timeAxis(timeExtent(state.paths, now, getDuration()))
      const zScale = fit.height / span
      const distance = fit.distance / zoom
      const target: Vec3 = [0, 0, fit.height * 0.4]
      const eye = orbitEye(target, yaw, pitch, distance)
      p.perspective(Math.PI / 4, p.width / p.height, distance * 0.05, distance * 10)
      p.camera(...eye, ...target, 0, 0, -1)

      const left = -fit.floorW / 2
      const top = -fit.floorH / 2

      p.push()
      p.rotateZ((rotation * Math.PI) / 180)
      p.noStroke()
      p.texture(img)
      p.plane(imgW * fit.scale, imgH * fit.scale, 1, 1)
      p.pop()

      p.stroke(160)
      p.strokeWeight(1)
      p.noFill()
      p.rect(left, top, fit.floorW, fit.floorH)
      p.stroke(120)
      p.line(left, top, 0, left, top, fit.height)
      const tickLen = Math.max(fit.floorW, fit.floorH) * 0.03
      const nextLabels: typeof labels = []
      for (const t of ticks) {
        const z = t * zScale
        p.line(left, top, z, left - tickLen, top, z)
        const s = p.worldToScreen(left - tickLen * 1.5, top, z)
        nextLabels.push({ text: formatTick(t), x: s.x, y: s.y })
      }
      labels = nextLabels

      const toScene = (pt: Point) => toScenePoint(pt, imgW, imgH, rotation)
      p.push()
      p.scale(fit.scale, fit.scale, zScale)
      p.noFill()
      for (const path of state.paths) {
        if (path.visible === false || path.points.length === 0) continue
        const isCurrent = path.pathId === state.currentPathId
        p.stroke(path.color)
        p.strokeWeight(isCurrent ? 3.5 : 1.5)
        drawPath(path, toScene)
      }
      p.pop()

      const zNow = now * zScale
      for (const path of state.paths) {
        if (path.visible === false || path.points.length === 0) continue
        const isCurrent = path.pathId === state.currentPathId
        const i = isCurrent ? path.points.length - 1 : Math.max(0, indexAtTime(path.points, now))
        const [x, y, t] = toScene(path.points[i])
        const [sx, sy, sz] = [x * fit.scale, y * fit.scale, t * zScale]
        const faint = p.color(path.color)
        faint.setAlpha(90)
        p.stroke(faint)
        p.strokeWeight(1)
        p.line(sx, sy, 0, sx, sy, sz)
        p.push()
        p.translate(sx, sy, sz)
        p.noStroke()
        p.fill(path.color)
        p.sphere(isCurrent ? 5 : 3.5, 12, 8)
        p.pop()
      }

      p.push()
      p.translate(0, 0, zNow)
      const nowFill = p.color(NOW_COLOR)
      nowFill.setAlpha(16)
      p.noStroke()
      p.fill(nowFill)
      p.plane(fit.floorW, fit.floorH, 1, 1)
      p.noFill()
      p.stroke(NOW_COLOR)
      p.strokeWeight(1.5)
      p.rect(left, top, fit.floorW, fit.floorH)
      p.pop()
    }
  }

  function setSpinning(value: boolean) {
    spinning = value
    syncLoop()
  }

  function resetCamera() {
    yaw = 0
    pitch = DEFAULT_PITCH
    zoom = 1
    requestRedraw()
  }

  let ready = false
  let redrawQueued = false
  function requestRedraw() {
    if (redrawQueued) return
    redrawQueued = true
    requestAnimationFrame(() => {
      redrawQueued = false
      if (ready && instance && !instance.isLooping()) instance.redraw()
    })
  }

  /** Animate only while something moves; otherwise redraw on demand. */
  function syncLoop(p: P5 | null = instance) {
    if (!p) return
    const { isDrawing, isVideoPlaying } = get(drawingState)
    const animate = (spinning && hasFloorPlan) || dragging || isDrawing || isVideoPlaying
    if (animate && !p.isLooping()) p.loop()
    else if (!animate && p.isLooping()) p.noLoop()
    requestRedraw()
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button') || !e.isPrimary) return
    dragging = true
    spinning = false
    container.setPointerCapture(e.pointerId)
    syncLoop()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !e.isPrimary) return
    yaw -= e.movementX * DRAG_RADIANS_PER_PIXEL
    pitch = clamp(pitch + e.movementY * DRAG_RADIANS_PER_PIXEL, MIN_PITCH, MAX_PITCH)
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId)
    syncLoop()
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM)
    spinning = false
    syncLoop()
  }

  onMount(() => {
    spinning = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 's' || !isShortcutEvent(e)) return
      e.preventDefault()
      setSpinning(!spinning)
    }
    window.addEventListener('keydown', onKeydown)
    container.addEventListener('wheel', onWheel, { passive: false })

    const resize = new ResizeObserver(() => {
      if (!instance) return
      instance.resizeCanvas(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight))
      requestRedraw()
    })
    resize.observe(container)

    const unsubState = drawingState.subscribe(() => syncLoop())
    const unsubConfig = drawingConfig.subscribe(requestRedraw)

    return () => {
      window.removeEventListener('keydown', onKeydown)
      container.removeEventListener('wheel', onWheel)
      resize.disconnect()
      unsubState()
      unsubConfig()
      if (instance) freeAll(instance)
    }
  })

  $effect(() => {
    if (instance) syncLoop()
  })
</script>

<div
  bind:this={container}
  class="space-time @container {className}"
  data-ui-element
  role="img"
  aria-label="3D space-time view of the recorded paths. Drag to rotate, scroll to zoom, double-click to reset."
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  ondblclick={resetCamera}
>
  <P5Canvas {sketch} bind:instance />

  {#each labels as label (label.text)}
    <span class="space-time__tick" style:left="{label.x}px" style:top="{label.y}px"
      >{label.text}</span
    >
  {/each}

  <div class="absolute top-2 left-2 rounded bg-base-100/80 px-1 text-xs pointer-events-none">
    <span class="font-semibold">Space-time</span>
    <span class="hidden @2xs:inline text-base-content/60">time rises upward</span>
  </div>

  {#if hasFloorPlan}
    <button
      class="btn btn-sm btn-circle absolute top-2 right-2"
      onclick={() => setSpinning(!spinning)}
      aria-label={spinning ? 'Pause spinning' : 'Resume spinning'}
      aria-pressed={!spinning}
      title="{spinning ? 'Pause' : 'Resume'} spinning (S)"
    >
      {#if spinning}<IconPause class="h-4 w-4" />{:else}<IconPlay class="h-4 w-4" />{/if}
    </button>
    <p
      class="absolute bottom-2 left-2 rounded bg-base-100/80 px-1 text-xs text-base-content/60 pointer-events-none"
    >
      Drag to rotate · double-click to reset
    </p>
  {:else}
    <p
      class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-base-content/40 pointer-events-none"
    >
      Paths appear here in 3D once a floor plan is loaded
    </p>
  {/if}
</div>

<style>
  .space-time {
    position: absolute;
    overflow: hidden;
    background: #fff;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .space-time:active {
    cursor: grabbing;
  }

  .space-time__tick {
    position: absolute;
    transform: translate(-100%, -50%);
    font-size: 0.6875rem;
    line-height: 1;
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
