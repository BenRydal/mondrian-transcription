import type p5 from 'p5'
import type { Point } from '../types/sketch'
import { get } from 'svelte/store'
import {
  drawingState,
  addPointToCurrentPath,
  toggleDrawing,
  toggleDrawingNoVideo,
} from '../../stores/drawingState'
import { drawingConfig, getSplitPositionForMode } from '../../stores/drawingConfig'
import { isInDrawableArea, convertToImageCoordinates } from '../../utils/drawingUtils'
import { getFittedImageDisplayRect } from '../../utils/drawingUtils'
import { TimeBasedSampler, AdaptiveSampler, IndexBasedSampler } from './samplers'

const initialConfig = get(drawingConfig)

// Fixed-interval sampler (original behavior for transcription mode)
export const timeSampler = new TimeBasedSampler(initialConfig.pollingRate / 1000)

// Adaptive sampler with heartbeat (used for both modes when adaptive is ON)
export const adaptiveSampler = new AdaptiveSampler(
  initialConfig.pollingRate / 1000, // activeInterval (fast sampling when moving)
  initialConfig.heartbeatInterval / 1000, // heartbeatInterval (slow sampling when stationary)
  2 // minMovement in pixels
)

// Fixed index-based sampler (original behavior for speculate mode)
export const indexSampler = new IndexBasedSampler(initialConfig.pollingRate)

export function setupDrawing(p5: p5) {
  drawingConfig.subscribe((config) => {
    timeSampler.setInterval(config.pollingRate / 1000)
    adaptiveSampler.setActiveInterval(config.pollingRate / 1000)
    adaptiveSampler.setHeartbeatInterval(config.heartbeatInterval / 1000)
    indexSampler.setStep(config.pollingRate)
  })

  const addCurrentPoint = () => {
    const state = get(drawingState)
    const config = get(drawingConfig)
    if (!state.shouldTrackMouse || !isInDrawableArea(p5, p5.mouseX, p5.mouseY)) return

    const curPath = state.paths.find((p) => p.pathId === state.currentPathId)
    if (!curPath) return

    const coords = convertToImageCoordinates(p5, p5.mouseX, p5.mouseY)

    let time: number
    let shouldAdd = false

    if (config.isTranscriptionMode) {
      time = state.videoTime
      if (config.useAdaptiveSampling) {
        // Adaptive sampling: fast when moving, heartbeat when stationary
        shouldAdd = adaptiveSampler.shouldSample(time, coords)
      } else {
        // Fixed interval sampling (original behavior)
        shouldAdd = timeSampler.shouldSample(time)
      }
    } else {
      // Speculate mode
      if (config.useAdaptiveSampling) {
        // Adaptive sampling with wall-clock time
        time = performance.now() / 1000
        shouldAdd = adaptiveSampler.shouldSample(time, coords)
      } else {
        // Fixed index-based sampling (original behavior)
        shouldAdd = indexSampler.shouldSample()
        time = indexSampler.getPseudoTime()
      }
    }

    if (!shouldAdd) return

    const point: Point = {
      ...coords,
      time,
      pathId: state.currentPathId,
    }

    addPointToCurrentPath(point)
  }

  const handleMousePressedVideo = (videoElement?: HTMLVideoElement) => {
    if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
      const state = get(drawingState)

      if (videoElement && videoElement.currentTime >= videoElement.duration - 0.1) {
        return
      }
      if (!state.shouldTrackMouse) {
        timeSampler.reset()
        adaptiveSampler.reset()
        indexSampler.reset()
      }
      toggleDrawing(videoElement)
    }
  }

  const handleMousePressedSpeculateMode = () => {
    if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
      toggleDrawingNoVideo()
    }
  }

  return {
    handleMousePressedVideo,
    handleMousePressedSpeculateMode,
    addCurrentPoint,
  }
}

export function drawPaths(p5: p5) {
  const state = get(drawingState)
  const config = get(drawingConfig)

  const imgW = state.imageWidth
  const imgH = state.imageHeight
  if (!imgW || !imgH) return

  const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH)
  const ENDPOINT_MARKER_SIZE = 15

  p5.push()

  const toDisplay = (pt: { x: number; y: number }) => ({
    x: r.x + (pt.x / imgW) * r.w,
    y: r.y + (pt.y / imgH) * r.h,
  })

  const isContinuousMode = config.isContinuousMode

  // Draw All paths
  state.paths.forEach((path) => {
    if (path.visible === false) return

    p5.strokeWeight(config.strokeWeight)
    p5.stroke(path.color)
    p5.noFill()

    if (isContinuousMode) {
      if (path.points.length > 1) {
        p5.beginShape()
        path.points.forEach((pt) => {
          const { x, y } = toDisplay(pt)
          p5.vertex(x, y)
        })
        p5.endShape()
      } else if (path.points.length === 1) {
        const { x, y } = toDisplay(path.points[0])
        p5.point(x, y)
      }
    } else {
      path.points.forEach((pt) => {
        const { x, y } = toDisplay(pt)
        p5.circle(x, y, config.strokeWeight)
      })
    }
  })

  // Determine active endpoint
  const activePath = state.paths.find((p) => p.pathId === state.currentPathId)
  const currentEndpoint = activePath?.points.length
    ? activePath.points[activePath.points.length - 1]
    : null

  // Draw pulsing endpoints
  state.paths.forEach((path) => {
    if (path.visible === false || path.points.length === 0) return

    let endpoint: { x: number; y: number } | null = null

    if (path.pathId === state.currentPathId) {
      endpoint = currentEndpoint!
    } else if (currentEndpoint) {
      if (config.isTranscriptionMode) {
        // Transcription mode: find closest point in time (all paths share video time)
        endpoint = path.points.reduce((closest, pt) => {
          const prevDiff = Math.abs(closest.time - currentEndpoint.time)
          const currDiff = Math.abs(pt.time - currentEndpoint.time)
          return currDiff < prevDiff ? pt : closest
        }, path.points[0])
      } else {
        // Speculate mode: sync by elapsed time (normalize from each path's start)
        const activeStartTime = activePath!.points[0].time
        const currentElapsed = currentEndpoint.time - activeStartTime

        const pathStartTime = path.points[0].time
        endpoint = path.points.reduce((closest, pt) => {
          const ptElapsed = pt.time - pathStartTime
          const closestElapsed = closest.time - pathStartTime
          return Math.abs(ptElapsed - currentElapsed) < Math.abs(closestElapsed - currentElapsed)
            ? pt
            : closest
        }, path.points[0])
      }
    } else {
      endpoint = path.points[0]
    }

    const display = toDisplay(endpoint)

    const pulseScale = (Math.sin(p5.frameCount * 0.05) + 1) * 0.25 + 0.5

    p5.noStroke()
    const c = p5.color(path.color)
    c.setAlpha(50)
    p5.fill(c)

    for (let i = 4; i > 0; i--) {
      const size = ENDPOINT_MARKER_SIZE * (1.5 + i * 0.5) * pulseScale
      p5.circle(display.x, display.y, size)
    }

    p5.circle(display.x, display.y, ENDPOINT_MARKER_SIZE * pulseScale)
    p5.fill(255)
    p5.circle(display.x, display.y, ENDPOINT_MARKER_SIZE * 0.5 * pulseScale)
  })

  p5.pop()
}
