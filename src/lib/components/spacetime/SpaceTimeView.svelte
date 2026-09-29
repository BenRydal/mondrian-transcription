<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { P5Canvas, type SketchFn } from 'svelte-p5'
  import { createRedrawRequester, setLooping } from '$lib/p5/loop'
  import { drawingState, type PathData } from '$lib/stores/drawingState'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import { PathGeometryCache, type WebglP5 } from '$lib/spacetime/pathGeometryCache'
  import { isShortcutEvent } from '$lib/utils/keyboard'
  import { clamp } from '$lib/utils/math'
  import { prefersReducedMotion, pulseClock, pulseScale } from '$lib/utils/pulse'
  import {
    coast,
    DEFAULT_PITCH,
    type DragSample,
    easeSpan,
    fadeTicks,
    INERTIA_WINDOW_MS,
    fitScene,
    formatTick,
    liveHead,
    markerPoint,
    MAX_PITCH,
    MAX_ZOOM,
    MIN_PITCH,
    MIN_ZOOM,
    orbitEye,
    releaseVelocity,
    timeAxis,
    timeExtent,
    toScenePoint,
    type TimedPoint,
    type Vec3,
  } from '$lib/spacetime/geometry'
  import IconPause from '~icons/material-symbols/pause'
  import IconPlay from '~icons/material-symbols/play-arrow'

  let { getNow, class: className = '' }: { getNow: () => number; class?: string } = $props()

  const SPIN_RADIANS_PER_SECOND = 0.25
  const DRAG_RADIANS_PER_PIXEL = 0.008
  const MAX_FRAME_DT = 0.05
  const TICK_FADE_IN_REACH = 1.02
  const UNCAPPED_FPS = 1000
  const HALO_ALPHA = 60
  const HALO_SCALE = 2.5

  let container: HTMLDivElement
  let instance = $state.raw<WebglP5 | null>(null)
  let spinning = $state(true)
  let dragging = false
  let reducedMotion = false
  let inertia = 0
  let dragSamples: DragSample[] = []
  let lastFrameMs: number | null = null
  let yaw = 0
  let pitch = DEFAULT_PITCH
  let zoom = 1
  let labels = $state.raw<{ text: string; x: number; y: number; opacity: number }[]>([])
  let shownSpan = 0
  let tickAlphas = new Map<number, number>()
  let axisEasing = false
  const hasFloorPlan = $derived(!!$drawingState.imageElement)

  const geometryCache = new PathGeometryCache()

  const sketch: SketchFn<WebglP5> = (p) => {
    p.setup = () => {
      p.createCanvas(
        Math.max(1, container.clientWidth),
        Math.max(1, container.clientHeight),
        p.WEBGL
      )
      p.frameRate(UNCAPPED_FPS)
      ready = true
      syncLoop(p)
    }

    p.draw = () => {
      const nowMs = performance.now()
      const dt = lastFrameMs === null ? 0 : Math.min(MAX_FRAME_DT, (nowMs - lastFrameMs) / 1000)
      lastFrameMs = p.isLooping() ? nowMs : null
      if (spinning && !dragging) yaw += dt * SPIN_RADIANS_PER_SECOND
      if (inertia && !dragging) {
        yaw += inertia * dt
        inertia = coast(inertia, dt)
        if (!inertia) syncLoop(p)
      }

      p.background(255)
      const state = get(drawingState)
      const config = get(drawingConfig)
      const { imageElement: img, imageWidth: imgW, imageHeight: imgH } = state
      if (!img || !imgW || !imgH) {
        labels = []
        return
      }

      const rotation = config.floorPlanRotation
      geometryCache.invalidateUnless(p, `${imgW}x${imgH}@${rotation}`)
      geometryCache.retainPaths(p, new Set(state.paths.map((path) => path.pathId)))

      const fit = fitScene(p.width, p.height, imgW, imgH, rotation)
      const now = getNow()
      const extent = timeExtent(state.paths, now)
      const axis = timeAxis(extent)
      const ease = reducedMotion ? Infinity : dt
      shownSpan = easeSpan(shownSpan, axis.span, extent, ease)
      const shownTicks = axis.ticks.filter((t) => t <= shownSpan * TICK_FADE_IN_REACH)
      tickAlphas = fadeTicks(tickAlphas, shownTicks, ease)
      const easing = shownSpan !== axis.span || [...tickAlphas.values()].some((a) => a < 1)
      if (easing !== axisEasing) {
        axisEasing = easing
        syncLoop(p)
      }
      const zScale = fit.height / shownSpan
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
      for (const [t, opacity] of tickAlphas) {
        if (t > shownSpan * TICK_FADE_IN_REACH) continue
        const z = t * zScale
        p.stroke(120, 255 * opacity)
        p.line(left, top, z, left - tickLen, top, z)
        const s = p.worldToScreen(left - tickLen * 1.5, top, z)
        nextLabels.push({ text: formatTick(t), x: s.x, y: s.y, opacity })
      }
      labels = nextLabels

      const toScene = (pt: TimedPoint) => toScenePoint(pt, imgW, imgH, rotation)
      const headOf = (path: PathData) =>
        path.pathId === state.currentPathId
          ? liveHead(path.points, now, state.shouldTrackMouse)
          : null
      p.push()
      p.scale(fit.scale, fit.scale, zScale)
      p.noFill()
      for (const path of state.paths) {
        if (path.visible === false || path.points.length === 0) continue
        const isCurrent = path.pathId === state.currentPathId
        p.stroke(path.color)
        p.strokeWeight(isCurrent ? 3.5 : 1.5)
        geometryCache.draw(p, path, toScene)
        const head = headOf(path)
        if (head) p.line(...toScene(path.points.at(-1)!), ...toScene(head))
      }
      p.pop()

      const pulse = pulseScale(pulseClock(state.isDrawing, reducedMotion))
      const floorMark = Math.max(fit.floorW, fit.floorH) * 0.03
      for (const path of state.paths) {
        if (path.visible === false) continue
        const isCurrent = path.pathId === state.currentPathId
        const at = markerPoint(path.points, now, isCurrent, state.shouldTrackMouse)
        if (!at) continue
        const [x, y, t] = toScene(at)
        const [sx, sy, sz] = [x * fit.scale, y * fit.scale, t * zScale]
        const faint = p.color(path.color)
        faint.setAlpha(isCurrent ? 160 : 110)
        p.stroke(faint)
        p.strokeWeight(1)
        p.line(sx, sy, 0, sx, sy, sz)
        const radius = isCurrent ? 5 : 3.5
        p.push()
        p.translate(sx, sy, sz)
        p.noStroke()
        p.fill(path.color)
        p.sphere(radius * (pulse + 0.25), 12, 8)
        faint.setAlpha(HALO_ALPHA)
        p.fill(faint)
        p.sphere(radius * HALO_SCALE * pulse, 12, 8)
        p.pop()
        p.push()
        p.translate(sx, sy, 0.5)
        p.fill(path.color)
        p.stroke(isCurrent ? 20 : 255)
        p.strokeWeight(isCurrent ? 2 : 1)
        p.circle(0, 0, isCurrent ? floorMark * 1.4 : floorMark)
        p.pop()
      }
    }
  }

  function setSpinning(value: boolean) {
    spinning = value
    syncLoop()
  }

  function resetCamera() {
    yaw = 0
    inertia = 0
    pitch = DEFAULT_PITCH
    zoom = 1
    requestRedraw()
  }

  let ready = false
  const requestRedraw = createRedrawRequester(() => (ready ? instance : null))

  function syncLoop(p: WebglP5 | null = instance) {
    if (!p) return
    const { isDrawing, isVideoPlaying } = get(drawingState)
    const animate =
      (spinning && hasFloorPlan) ||
      dragging ||
      inertia !== 0 ||
      axisEasing ||
      isDrawing ||
      isVideoPlaying
    setLooping(p, animate, () => (lastFrameMs = null))
    requestRedraw()
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button') || !e.isPrimary) return
    dragging = true
    spinning = false
    inertia = 0
    dragSamples = []
    container.setPointerCapture(e.pointerId)
    syncLoop()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !e.isPrimary) return
    const dYaw = -e.movementX * DRAG_RADIANS_PER_PIXEL
    yaw += dYaw
    dragSamples = dragSamples.filter((d) => e.timeStamp - d.ms <= INERTIA_WINDOW_MS)
    dragSamples.push({ ms: e.timeStamp, yaw: dYaw })
    pitch = clamp(pitch + e.movementY * DRAG_RADIANS_PER_PIXEL, MIN_PITCH, MAX_PITCH)
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    inertia = reducedMotion ? 0 : releaseVelocity(dragSamples, e.timeStamp)
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
    reducedMotion = prefersReducedMotion()
    spinning = !reducedMotion

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
      if (instance) geometryCache.freeAll(instance)
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
    <span
      class="space-time__tick"
      style:left="{label.x}px"
      style:top="{label.y}px"
      style:opacity={label.opacity}>{label.text}</span
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
