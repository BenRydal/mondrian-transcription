import { isAtVideoEnd, type VideoSource } from '../../video/source'
import type p5 from 'p5'
import type { Point } from '../types/sketch'
import { get } from 'svelte/store'
import {
  drawingState,
  addPointsToCurrentPath,
  appendFinalPoint,
  appendHoldPoints,
  findCurrentPath,
  syncClockToCurrentPath,
  toggleDrawing,
  toggleDrawingNoVideo,
  type PathData,
} from '../../stores/drawingState'
import { drawingConfig, getSplitPositionForMode } from '../../stores/drawingConfig'
import {
  isInDrawableArea,
  convertToImageCoordinates,
  getFittedImageDisplayRect,
} from '../../utils/drawingUtils'
import { mediaClock, speculateClock } from '../../timing/sessionClocks'
import { lastIndexAtOrBefore, trailRange } from '../../timing/timeWindow'
import { viewPrefs } from '../../stores/viewPrefs'
import { applyAffine, imageToDisplay, type PathLayer } from './pathLayer'
import { pulseClock, pulseScale } from '../../utils/pulse'

type CanvasPos = { x: number; y: number }

const isOverUi = (e: PointerEvent) =>
  !!(e.target as HTMLElement | null)?.closest?.('[data-ui-element]')

export function observeVideo(video: VideoSource, perfMs: number) {
  mediaClock.observe(video.currentTime, perfMs, !video.paused, video.playbackRate)
}

export function setupDrawing(p5: p5, getCanvas: () => HTMLCanvasElement | null) {
  const toCanvas = (e: PointerEvent): CanvasPos => {
    const rect = getCanvas()?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const isDrawableEvent = (e: PointerEvent) => {
    if (isOverUi(e)) return false
    const { x, y } = toCanvas(e)
    return isInDrawableArea(p5, x, y)
  }

  const recordPointerEvent = (event: PointerEvent, video?: VideoSource | null) => {
    const state = get(drawingState)
    if (!state.shouldTrackMouse) return
    const { isTranscriptionMode } = get(drawingConfig)

    let clockTime: (perfMs: number) => number
    if (isTranscriptionMode) {
      if (!video || video.paused) return
      observeVideo(video, performance.now())
      clockTime = (ms) => mediaClock.timeAt(ms)
    } else {
      clockTime = (ms) => speculateClock.timeAt(ms)
    }

    const coalesced = event.getCoalescedEvents?.() ?? []
    const samples = coalesced.length > 0 ? coalesced : [event]
    const points: Point[] = []
    for (const e of samples) {
      const { x, y } = toCanvas(e)
      if (!isInDrawableArea(p5, x, y)) continue
      points.push({
        ...convertToImageCoordinates(p5, x, y),
        time: clockTime(e.timeStamp),
        pathId: state.currentPathId,
      })
    }
    addPointsToCurrentPath(points)
  }

  const startVideoTake = (event: PointerEvent, video: VideoSource) => {
    mediaClock.reset()
    toggleDrawing(video)
    recordPointerEvent(event, video)
  }

  const stopVideoTake = (event: PointerEvent, video: VideoSource) => {
    observeVideo(video, performance.now())
    appendFinalPoint(mediaClock.timeAt(event.timeStamp))
    toggleDrawing(video)
  }

  const startSpeculateTake = (event: PointerEvent) => {
    speculateClock.start(event.timeStamp)
    toggleDrawingNoVideo()
    recordPointerEvent(event)
  }

  const stopSpeculateTake = (event: PointerEvent) => {
    appendFinalPoint(speculateClock.timeAt(event.timeStamp))
    speculateClock.pause(event.timeStamp)
    toggleDrawingNoVideo()
  }

  const handlePressVideo = (event: PointerEvent, video: VideoSource) => {
    if (!isDrawableEvent(event) || isAtVideoEnd(video)) return
    if (get(drawingState).shouldTrackMouse) stopVideoTake(event, video)
    else startVideoTake(event, video)
  }

  const handlePressSpeculate = (event: PointerEvent) => {
    if (!isDrawableEvent(event)) return
    syncClockToCurrentPath(get(drawingState), performance.now())
    if (get(drawingState).shouldTrackMouse) stopSpeculateTake(event)
    else startSpeculateTake(event)
  }

  const handleHoldStart = (event: PointerEvent, video: VideoSource | null): boolean => {
    if (get(drawingState).shouldTrackMouse || !isDrawableEvent(event)) return false
    if (get(drawingConfig).isTranscriptionMode) {
      if (!video || isAtVideoEnd(video)) return false
      startVideoTake(event, video)
    } else {
      syncClockToCurrentPath(get(drawingState), performance.now())
      startSpeculateTake(event)
    }
    return true
  }

  const handleHoldEnd = (event: PointerEvent, video: VideoSource | null) => {
    if (!get(drawingState).shouldTrackMouse) return
    recordPointerEvent(event, video)
    if (get(drawingConfig).isTranscriptionMode) {
      if (video) stopVideoTake(event, video)
    } else {
      stopSpeculateTake(event)
    }
  }

  const handleMove = (event: PointerEvent, video?: VideoSource | null) => {
    if (isOverUi(event)) return
    recordPointerEvent(event, video)
  }

  return { handlePressVideo, handlePressSpeculate, handleHoldStart, handleHoldEnd, handleMove }
}

export function endCurrentTake(video?: VideoSource | null) {
  if (!get(drawingState).shouldTrackMouse) return
  const now = performance.now()
  if (get(drawingConfig).isTranscriptionMode) {
    if (video) {
      observeVideo(video, now)
      appendFinalPoint(mediaClock.timeAt(now))
    }
  } else {
    appendFinalPoint(speculateClock.timeAt(now))
    speculateClock.pause(now)
  }
}

function recordingClockTime(video: VideoSource | null | undefined, perfMs: number) {
  if (!get(drawingState).shouldTrackMouse) return null
  if (get(drawingConfig).isTranscriptionMode) {
    if (!video || video.paused) return null
    observeVideo(video, perfMs)
    return mediaClock.timeAt(perfMs)
  }
  return speculateClock.running ? speculateClock.timeAt(perfMs) : null
}

export function sampleHold(video?: VideoSource | null, perfMs = performance.now()) {
  const now = recordingClockTime(video, perfMs)
  if (now !== null) appendHoldPoints(now)
}

export function drawPaths(p5: p5, layer: PathLayer) {
  const state = get(drawingState)
  const config = get(drawingConfig)

  const { imageWidth: imgW, imageHeight: imgH } = state
  if (!imgW || !imgH) return

  const rotation = config.floorPlanRotation
  const rect = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH, rotation)
  const m = imageToDisplay(imgW, imgH, rotation, rect)
  const toDisplay = (pt: { x: number; y: number }) => applyAffine(m, pt)

  const ctx = p5.drawingContext as CanvasRenderingContext2D
  layer.draw(ctx, {
    key: {
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      density: p5.pixelDensity(),
      rect,
      rotation,
      imgW,
      imgH,
      strokeWeight: config.strokeWeight,
      continuous: config.isContinuousMode,
    },
    transform: m,
    paths: state.paths,
    recording: state.shouldTrackMouse,
  })

  p5.push()

  // Draw pulsing endpoints
  const currentEndpoint = findCurrentPath(state)?.points.at(-1) ?? null
  const sessionTime = getSessionTime(config.isTranscriptionMode, state.videoTime)

  const { trailSeconds } = get(viewPrefs)
  if (trailSeconds > 0 && (state.isDrawing || state.isVideoPlaying)) {
    for (const path of state.paths) {
      if (path.pathId === state.currentPathId || path.visible === false) continue
      drawTrail(p5, path, sessionTime, trailSeconds, toDisplay, config.strokeWeight)
    }
  }

  const pulse = pulseScale(pulseClock(state.isDrawing))
  state.paths.forEach((path) => {
    if (path.visible === false || path.points.length === 0) return

    const endpoint =
      path.pathId === state.currentPathId ? currentEndpoint : findSyncedEndpoint(path, sessionTime)
    if (!endpoint) return

    const { x, y } = toDisplay(endpoint)
    drawPulsingMarker(p5, x, y, path.color, pulse)
  })

  p5.pop()
}

function getSessionTime(isTranscriptionMode: boolean, videoTime: number): number {
  return isTranscriptionMode ? videoTime : speculateNow()
}

export function speculateNow(): number {
  const now = performance.now()
  syncClockToCurrentPath(get(drawingState), now)
  return speculateClock.timeAt(now)
}

function findSyncedEndpoint(path: PathData, sessionTime: number): Point | null {
  return path.points[lastIndexAtOrBefore(path.points, sessionTime)] ?? null
}

const TRAIL_BANDS = 8

function drawTrail(
  p5: p5,
  path: PathData,
  sessionTime: number,
  seconds: number,
  toDisplay: (pt: { x: number; y: number }) => { x: number; y: number },
  strokeWeight: number
) {
  const range = trailRange(path.points, sessionTime, seconds)
  if (!range || range.end === range.start) return
  const { points } = path
  const tStart = sessionTime - seconds
  const band = (i: number) =>
    Math.min(TRAIL_BANDS - 1, Math.floor(((points[i].time - tStart) / seconds) * TRAIL_BANDS))
  const color = p5.color(path.color)

  p5.noFill()
  p5.strokeWeight(strokeWeight * 2)
  let i = range.start
  while (i < range.end) {
    const b = band(i + 1)
    color.setAlpha((255 * (b + 1)) / TRAIL_BANDS)
    p5.stroke(color)
    p5.beginShape()
    const first = toDisplay(points[i])
    p5.vertex(first.x, first.y)
    while (i < range.end && band(i + 1) === b) {
      i++
      const { x, y } = toDisplay(points[i])
      p5.vertex(x, y)
    }
    p5.endShape()
  }
}

/** Draw a pulsing marker at the given position */
function drawPulsingMarker(
  p5: p5,
  x: number,
  y: number,
  color: string,
  pulse: number,
  markerSize: number = 15
) {
  p5.noStroke()
  const c = p5.color(color)
  c.setAlpha(50)
  p5.fill(c)

  // Draw expanding rings
  for (let i = 4; i > 0; i--) {
    const size = markerSize * (1.5 + i * 0.5) * pulse
    p5.circle(x, y, size)
  }

  // Draw center dot
  p5.circle(x, y, markerSize * pulse)
  p5.fill(255)
  p5.circle(x, y, markerSize * 0.5 * pulse)
}
