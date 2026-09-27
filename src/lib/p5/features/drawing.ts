import type p5 from 'p5'
import type { Point } from '../types/sketch'
import { get } from 'svelte/store'
import {
  drawingState,
  addPointsToCurrentPath,
  appendFinalPoint,
  toggleDrawing,
  toggleDrawingNoVideo,
  type PathData,
} from '../../stores/drawingState'
import { drawingConfig, getSplitPositionForMode } from '../../stores/drawingConfig'
import {
  isInDrawableArea,
  convertToImageCoordinates,
  getFittedImageDisplayRect,
  applyForwardRotation,
} from '../../utils/drawingUtils'
import { mediaClock, speculateClock, syncSpeculateClock } from '../../timing/sessionClocks'
import { lastIndexAtOrBefore, trailRange } from '../../timing/timeWindow'
import { viewPrefs } from '../../stores/viewPrefs'

type CanvasPos = { x: number; y: number }

export function observeVideo(video: HTMLVideoElement, perfMs: number) {
  mediaClock.observe(video.currentTime, perfMs, !video.paused, video.playbackRate)
}

function syncSpeculateClockToCurrentPath(perfMs: number) {
  const state = get(drawingState)
  const path = state.paths.find((p) => p.pathId === state.currentPathId)
  syncSpeculateClock(state.currentPathId, path?.points.at(-1)?.time, perfMs)
}

export function setupDrawing(p5: p5, getCanvas: () => HTMLCanvasElement | null) {
  const toCanvas = (e: PointerEvent): CanvasPos => {
    const rect = getCanvas()?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const isDrawableEvent = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.('[data-ui-element]')) return false
    const { x, y } = toCanvas(e)
    return isInDrawableArea(p5, x, y)
  }

  /** Record pointer samples, each stamped with the session clock at its own timeStamp. */
  const recordPointerEvent = (event: PointerEvent, video?: HTMLVideoElement | null) => {
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

  const startVideoTake = (event: PointerEvent, video: HTMLVideoElement) => {
    mediaClock.reset()
    toggleDrawing(video)
    recordPointerEvent(event, video)
  }

  const stopVideoTake = (event: PointerEvent, video: HTMLVideoElement) => {
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

  const isAtVideoEnd = (video: HTMLVideoElement) => video.currentTime >= video.duration - 0.1

  const handlePressVideo = (event: PointerEvent, video: HTMLVideoElement) => {
    if (!isDrawableEvent(event) || isAtVideoEnd(video)) return
    if (get(drawingState).shouldTrackMouse) stopVideoTake(event, video)
    else startVideoTake(event, video)
  }

  const handlePressSpeculate = (event: PointerEvent) => {
    if (!isDrawableEvent(event)) return
    syncSpeculateClockToCurrentPath(performance.now())
    if (get(drawingState).shouldTrackMouse) stopSpeculateTake(event)
    else startSpeculateTake(event)
  }

  /** Hold mode: start a take on press; returns whether one started. */
  const handleHoldStart = (event: PointerEvent, video: HTMLVideoElement | null): boolean => {
    if (get(drawingState).shouldTrackMouse || !isDrawableEvent(event)) return false
    if (get(drawingConfig).isTranscriptionMode) {
      if (!video || isAtVideoEnd(video)) return false
      startVideoTake(event, video)
    } else {
      syncSpeculateClockToCurrentPath(performance.now())
      startSpeculateTake(event)
    }
    return true
  }

  /** Hold mode: record the release sample, then stop with a final held point. */
  const handleHoldEnd = (event: PointerEvent, video: HTMLVideoElement | null) => {
    if (!get(drawingState).shouldTrackMouse) return
    recordPointerEvent(event, video)
    if (get(drawingConfig).isTranscriptionMode) {
      if (video) stopVideoTake(event, video)
    } else {
      stopSpeculateTake(event)
    }
  }

  const handleMove = (event: PointerEvent, video?: HTMLVideoElement | null) => {
    if ((event.target as HTMLElement | null)?.closest?.('[data-ui-element]')) return
    recordPointerEvent(event, video)
  }

  return { handlePressVideo, handlePressSpeculate, handleHoldStart, handleHoldEnd, handleMove }
}

/** Stop the current take (e.g. before switching paths), keeping a final held point. */
export function endCurrentTake(video?: HTMLVideoElement | null) {
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

export function drawPaths(p5: p5) {
  const state = get(drawingState)
  const config = get(drawingConfig)

  const { imageWidth: imgW, imageHeight: imgH } = state
  if (!imgW || !imgH) return

  const rotation = config.floorPlanRotation
  const rect = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH, rotation)

  // Convert stored original image coords to rotated display coords
  const toDisplay = (pt: { x: number; y: number }) => {
    const { nx, ny } = applyForwardRotation(pt.x, pt.y, imgW, imgH, rotation)
    return {
      x: rect.x + nx * rect.w,
      y: rect.y + ny * rect.h,
    }
  }

  p5.push()

  // Draw all path lines
  state.paths.forEach((path) => {
    drawPathLine(p5, path, toDisplay, config.strokeWeight, config.isContinuousMode)
  })

  // Draw pulsing endpoints
  const activePath = state.paths.find((p) => p.pathId === state.currentPathId)
  const currentEndpoint = activePath?.points.at(-1) ?? null
  const sessionTime = getSessionTime(config.isTranscriptionMode, state.videoTime)

  const { trailSeconds } = get(viewPrefs)
  if (trailSeconds > 0 && (state.isDrawing || state.isVideoPlaying)) {
    for (const path of state.paths) {
      if (path.pathId === state.currentPathId || path.visible === false) continue
      drawTrail(p5, path, sessionTime, trailSeconds, toDisplay, config.strokeWeight)
    }
  }

  state.paths.forEach((path) => {
    if (path.visible === false || path.points.length === 0) return

    const endpoint =
      path.pathId === state.currentPathId ? currentEndpoint! : findSyncedEndpoint(path, sessionTime)

    const { x, y } = toDisplay(endpoint)
    drawPulsingMarker(p5, x, y, path.color, state.isDrawing ? p5.frameCount : 0)
  })

  p5.pop()
}

/** Draw a single path as a continuous line or discrete points */
function drawPathLine(
  p5: p5,
  path: PathData,
  toDisplay: (pt: { x: number; y: number }) => { x: number; y: number },
  strokeWeight: number,
  isContinuousMode: boolean
) {
  if (path.visible === false) return

  p5.strokeWeight(strokeWeight)
  p5.stroke(path.color)
  p5.noFill()

  if (isContinuousMode) {
    if (path.points.length > 1) {
      p5.beginShape()
      path.points.forEach((pt) => p5.vertex(...(Object.values(toDisplay(pt)) as [number, number])))
      p5.endShape()
    } else if (path.points.length === 1) {
      const { x, y } = toDisplay(path.points[0])
      p5.point(x, y)
    }
  } else {
    path.points.forEach((pt) => {
      const { x, y } = toDisplay(pt)
      p5.circle(x, y, strokeWeight)
    })
  }
}

function getSessionTime(isTranscriptionMode: boolean, videoTime: number): number {
  return isTranscriptionMode ? videoTime : speculateNow()
}

/** Speculate session time now, synced to the current path's end the first time it is read. */
export function speculateNow(): number {
  const now = performance.now()
  syncSpeculateClockToCurrentPath(now)
  return speculateClock.timeAt(now)
}

/** Latest point of a path at or before the shared session time. */
function findSyncedEndpoint(path: PathData, sessionTime: number): Point {
  return path.points[Math.max(0, lastIndexAtOrBefore(path.points, sessionTime))]
}

const TRAIL_BANDS = 8

/** Recent history behind a path's marker, fading out towards its oldest end. */
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
  frameCount: number,
  markerSize: number = 15
) {
  const pulseScale = (Math.sin(frameCount * 0.05) + 1) * 0.25 + 0.5

  p5.noStroke()
  const c = p5.color(color)
  c.setAlpha(50)
  p5.fill(c)

  // Draw expanding rings
  for (let i = 4; i > 0; i--) {
    const size = markerSize * (1.5 + i * 0.5) * pulseScale
    p5.circle(x, y, size)
  }

  // Draw center dot
  p5.circle(x, y, markerSize * pulseScale)
  p5.fill(255)
  p5.circle(x, y, markerSize * 0.5 * pulseScale)
}
