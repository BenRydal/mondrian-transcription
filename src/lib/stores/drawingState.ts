import { writable, get } from 'svelte/store'
import type p5 from 'p5'
import type { Point } from '../p5/types/sketch'
import { drawingConfig } from '../stores/drawingConfig'
import { shouldKeepPoint } from '../timing/sampling'
import {
  speculateClock,
  syncSpeculateClock,
  invalidateSpeculateClock,
} from '../timing/sessionClocks'

/** Autosave spots changed points by identity, so dev builds make in-place edits throw. */
export const freezePoint: (point: Point) => Point = import.meta.env.DEV
  ? (point) => Object.freeze(point)
  : (point) => point

export interface PathData {
  points: Point[]
  color: string
  pathId: number
  name?: string
  visible?: boolean
}

export interface DrawingState {
  isVideoPlaying: boolean
  isDrawing: boolean
  shouldTrackMouse: boolean
  paths: PathData[]
  imageWidth: number
  imageHeight: number
  videoTime: number
  imageElement: p5.Image | null
  currentPathId: number
  isJumping: boolean
}

const initialState: DrawingState = {
  isVideoPlaying: false,
  isDrawing: false,
  shouldTrackMouse: false,
  paths: [],
  imageWidth: 0,
  imageHeight: 0,
  videoTime: 0,
  imageElement: null,
  currentPathId: 0,
  isJumping: false,
}

function clearJumpingOnSeek(videoElement: HTMLVideoElement) {
  const onSeeked = () => {
    videoElement.removeEventListener('seeked', onSeeked)
    drawingState.update((state) => ({ ...state, isJumping: false }))
  }
  videoElement.addEventListener('seeked', onSeeked)
}

function syncClockToCurrentPath(state: DrawingState, now: number) {
  const currentPath = state.paths.find((p) => p.pathId === state.currentPathId)
  syncSpeculateClock(state.currentPathId, currentPath?.points.at(-1)?.time, now)
}

export function handleRewindSpeculateMode() {
  drawingState.update((state) => {
    const currentPathIndex = state.paths.findIndex((p) => p.pathId === state.currentPathId)
    if (currentPathIndex === -1) return state

    const updatedPaths = [...state.paths]
    const currentPath = updatedPaths[currentPathIndex]
    if (currentPath.points.length === 0) return state

    const now = performance.now()
    syncClockToCurrentPath(state, now)
    speculateClock.pause(now)
    const newTime = Math.max(
      0,
      speculateClock.timeAt(now) - get(drawingConfig).speculateJumpSeconds
    )
    speculateClock.seek(newTime, now)

    const updatedPoints = currentPath.points.filter((point) => point.time <= newTime)
    updatedPaths[currentPathIndex] = { ...currentPath, points: updatedPoints }

    return { ...state, shouldTrackMouse: false, isDrawing: false, paths: updatedPaths }
  })
}

export function handleForwardSpeculateMode() {
  drawingState.update((state) => {
    const currentPathIndex = state.paths.findIndex((p) => p.pathId === state.currentPathId)
    if (currentPathIndex === -1) return state

    const updatedPaths = [...state.paths]
    const currentPath = updatedPaths[currentPathIndex]
    const lastPoint = currentPath.points.at(-1)
    if (!lastPoint) return state

    const now = performance.now()
    syncClockToCurrentPath(state, now)
    const from = Math.max(speculateClock.timeAt(now), lastPoint.time)
    const newTime = from + get(drawingConfig).speculateJumpSeconds
    speculateClock.seek(newTime, now)

    const holdPoint = freezePoint({
      x: lastPoint.x,
      y: lastPoint.y,
      time: newTime,
      pathId: state.currentPathId,
    })
    updatedPaths[currentPathIndex] = { ...currentPath, points: [...currentPath.points, holdPoint] }

    return { ...state, paths: updatedPaths }
  })
}

export function handleForwardTranscription(videoElement: HTMLVideoElement) {
  drawingState.update((state) => {
    if (state.isJumping) return state
    if (!videoElement.duration || isNaN(videoElement.duration)) return state

    const { jumpSeconds } = get(drawingConfig)
    const currentTime = state.videoTime
    const currentPathIndex = state.paths.findIndex((p) => p.pathId === state.currentPathId)
    if (currentPathIndex === -1) return state

    const updatedPaths = [...state.paths]
    const currentPath = updatedPaths[currentPathIndex]
    const lastPoint = currentPath.points[currentPath.points.length - 1]
    if (!lastPoint) return state

    const newTime = Math.min(currentTime + jumpSeconds, videoElement.duration)
    videoElement.currentTime = newTime

    const updatedPoints = [...currentPath.points]
    if (newTime > lastPoint.time) {
      updatedPoints.push(
        freezePoint({ x: lastPoint.x, y: lastPoint.y, time: newTime, pathId: state.currentPathId })
      )
    }
    updatedPaths[currentPathIndex] = { ...currentPath, points: updatedPoints }

    return { ...state, isJumping: true, videoTime: newTime, paths: updatedPaths }
  })

  clearJumpingOnSeek(videoElement)
}

export function handleRewindTranscription(videoElement: HTMLVideoElement) {
  drawingState.update((state) => {
    if (state.isJumping) return state
    if (!videoElement.duration || isNaN(videoElement.duration)) return state

    const { jumpSeconds } = get(drawingConfig)
    const currentTime = state.videoTime
    const currentPathIndex = state.paths.findIndex((p) => p.pathId === state.currentPathId)
    if (currentPathIndex === -1) return state

    const newTime = Math.max(currentTime - jumpSeconds, 0)
    videoElement.currentTime = newTime
    videoElement.pause()

    const updatedPaths = [...state.paths]
    const currentPath = updatedPaths[currentPathIndex]
    const updatedPoints = currentPath.points.filter((point) => point.time <= newTime)
    updatedPaths[currentPathIndex] = { ...currentPath, points: updatedPoints }

    return {
      ...state,
      isJumping: true,
      shouldTrackMouse: false,
      isDrawing: false,
      isVideoPlaying: false,
      videoTime: newTime,
      paths: updatedPaths,
    }
  })

  clearJumpingOnSeek(videoElement)
}

export const drawingState = writable<DrawingState>(initialState)

export function toggleDrawing(videoElement?: HTMLVideoElement) {
  drawingState.update((state) => {
    const newShouldTrack = !state.shouldTrackMouse

    if (videoElement) {
      try {
        if (newShouldTrack) {
          const playPromise = videoElement.play()
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error('Error playing video:', error)
              drawingState.update((s) => ({
                ...s,
                shouldTrackMouse: false,
                isDrawing: false,
                isVideoPlaying: false,
              }))
            })
          }
        } else {
          videoElement.pause()
        }
      } catch (error) {
        console.error('Error handling video:', error)
        return {
          ...state,
          shouldTrackMouse: false,
          isDrawing: false,
          isVideoPlaying: false,
        }
      }
    }

    return {
      ...state,
      shouldTrackMouse: newShouldTrack,
      isDrawing: newShouldTrack,
      isVideoPlaying: newShouldTrack,
    }
  })
}

export function toggleDrawingNoVideo() {
  drawingState.update((state) => {
    const newShouldTrack = !state.shouldTrackMouse
    return {
      ...state,
      shouldTrackMouse: newShouldTrack,
      isDrawing: newShouldTrack,
    }
  })
}

export function createNewPath(color: string) {
  console.log('Creating new path with color', color)
  invalidateSpeculateClock()
  drawingState.update((state) => {
    // Restored paths can hold ids above currentPathId, so never reuse one.
    const newPathId = Math.max(state.currentPathId, ...state.paths.map((p) => p.pathId)) + 1
    return {
      ...state,
      currentPathId: newPathId,
      paths: [
        ...state.paths,
        {
          points: [],
          color,
          pathId: newPathId,
        },
      ],
    }
  })
}

/** Append points while recording, dropping any closer than the minimum interval in clock time. */
export function addPointsToCurrentPath(points: Point[]) {
  drawingState.update((state) => {
    if (!state.shouldTrackMouse || points.length === 0) return state

    const currentPathIndex = state.paths.findIndex((p) => p.pathId === state.currentPathId)
    if (currentPathIndex === -1) return state

    const currentPath = state.paths[currentPathIndex]
    const updatedPoints = [...currentPath.points]
    for (const point of points) {
      if (shouldKeepPoint(updatedPoints.at(-1)?.time, point.time)) {
        updatedPoints.push(freezePoint(point))
      }
    }
    if (updatedPoints.length === currentPath.points.length) return state

    const updatedPaths = [...state.paths]
    updatedPaths[currentPathIndex] = { ...currentPath, points: updatedPoints }
    return { ...state, paths: updatedPaths }
  })
}

/** Hold the last position until the stop time so stationary endings survive export. */
export function appendFinalPoint(time: number) {
  const state = get(drawingState)
  const lastPoint = state.paths.find((p) => p.pathId === state.currentPathId)?.points.at(-1)
  if (!lastPoint) return
  addPointsToCurrentPath([{ x: lastPoint.x, y: lastPoint.y, time, pathId: state.currentPathId }])
}

export function renamePathById(pathId: number, name: string) {
  drawingState.update((state) => {
    const pathIndex = state.paths.findIndex((p) => p.pathId === pathId)
    if (pathIndex === -1) return state

    const updatedPaths = [...state.paths]
    updatedPaths[pathIndex] = {
      ...updatedPaths[pathIndex],
      name: name.trim() || undefined,
    }

    return {
      ...state,
      paths: updatedPaths,
    }
  })
}

export function deletePathById(pathId: number) {
  invalidateSpeculateClock()
  drawingState.update((state) => {
    const updatedPaths = state.paths.filter((p) => p.pathId !== pathId)

    // If no paths remain, create a new empty path (consistent with Clear All behavior)
    const newPaths =
      updatedPaths.length === 0 ? [{ points: [], color: '#FF0000', pathId: 1 }] : updatedPaths

    const newCurrentPathId =
      updatedPaths.length === 0
        ? 1
        : state.currentPathId === pathId
          ? (updatedPaths.at(-1)?.pathId ?? 0)
          : state.currentPathId

    return {
      ...state,
      paths: newPaths,
      currentPathId: newCurrentPathId,
      shouldTrackMouse: false,
      isDrawing: false,
      isVideoPlaying: false,
    }
  })
}

export function togglePathVisibility(pathId: number) {
  drawingState.update((state) => {
    const pathIndex = state.paths.findIndex((p) => p.pathId === pathId)
    if (pathIndex === -1) return state

    const updatedPaths = [...state.paths]
    updatedPaths[pathIndex] = {
      ...updatedPaths[pathIndex],
      visible: updatedPaths[pathIndex].visible === false,
    }

    return {
      ...state,
      paths: updatedPaths,
    }
  })
}

export function updatePathColor(pathId: number, color: string) {
  drawingState.update((state) => {
    const pathIndex = state.paths.findIndex((p) => p.pathId === pathId)
    if (pathIndex === -1) return state

    const updatedPaths = [...state.paths]
    updatedPaths[pathIndex] = {
      ...updatedPaths[pathIndex],
      color,
    }

    return {
      ...state,
      paths: updatedPaths,
    }
  })
}
