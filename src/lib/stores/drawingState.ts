import type { VideoSource } from '../video/source'
import { writable, get } from 'svelte/store'
import type p5 from 'p5'
import type { Point } from '../p5/types/sketch'
import { drawingConfig } from '../stores/drawingConfig'
import { holdTimes, shouldKeepPoint } from '../timing/sampling'
import {
  speculateClock,
  syncSpeculateClock,
  invalidateSpeculateClock,
  setNewPathStart,
} from '../timing/sessionClocks'

export const freezePoint: (point: Point) => Point = import.meta.env.DEV
  ? (point) => Object.freeze(point)
  : (point) => point

export const PATH_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

export interface PathData {
  points: Point[]
  color: string
  pathId: number
  name?: string
  visible?: boolean
}

interface DrawingState {
  isVideoPlaying: boolean
  isDrawing: boolean
  shouldTrackMouse: boolean
  paths: PathData[]
  imageWidth: number
  imageHeight: number
  videoTime: number
  imageElement: p5.Image | null
  currentPathId: number
  // Highest pathId ever used in this session, so a deleted path's id is never reissued.
  lastPathId: number
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
  lastPathId: 0,
  isJumping: false,
}

function clearJumpingOnSeek(videoElement: VideoSource) {
  const onSeeked = () => {
    videoElement.removeEventListener('seeked', onSeeked)
    drawingState.update((state) => ({ ...state, isJumping: false }))
  }
  videoElement.addEventListener('seeked', onSeeked)
}

const syntheticPoints = new WeakSet<Point>()

export const STOPPED_TRACKING = {
  shouldTrackMouse: false,
  isDrawing: false,
  isVideoPlaying: false,
} as const

export function findCurrentPath(state: Pick<DrawingState, 'paths' | 'currentPathId'>) {
  return state.paths.find((p) => p.pathId === state.currentPathId)
}

function currentPathIndex(state: DrawingState) {
  return state.paths.findIndex((p) => p.pathId === state.currentPathId)
}

function replacePathAt(paths: PathData[], index: number, path: PathData): PathData[] {
  const updated = [...paths]
  updated[index] = path
  return updated
}

function truncateAfter(path: PathData, time: number): PathData {
  return { ...path, points: path.points.filter((point) => point.time <= time) }
}

function holdPoint(last: Point, time: number, pathId: number): Point {
  const point = freezePoint({ x: last.x, y: last.y, time, pathId })
  syntheticPoints.add(point)
  return point
}

export function nextPathId(state: Pick<DrawingState, 'paths' | 'currentPathId' | 'lastPathId'>) {
  return Math.max(state.lastPathId, state.currentPathId, ...state.paths.map((p) => p.pathId)) + 1
}

export function syncClockToCurrentPath(state: DrawingState, now: number) {
  syncSpeculateClock(state.currentPathId, findCurrentPath(state)?.points.at(-1)?.time, now)
}

const canJump = (state: DrawingState, video: VideoSource) =>
  !state.isJumping && !!video.duration && !isNaN(video.duration)

export function handleRewindSpeculateMode() {
  drawingState.update((state) => {
    const index = currentPathIndex(state)
    if (index === -1 || state.paths[index].points.length === 0) return state

    const now = performance.now()
    syncClockToCurrentPath(state, now)
    speculateClock.pause(now)
    const newTime = Math.max(
      0,
      speculateClock.timeAt(now) - get(drawingConfig).speculateJumpSeconds
    )
    speculateClock.seek(newTime, now)

    const paths = replacePathAt(state.paths, index, truncateAfter(state.paths[index], newTime))
    return { ...state, shouldTrackMouse: false, isDrawing: false, paths }
  })
}

export function handleForwardSpeculateMode() {
  drawingState.update((state) => {
    const index = currentPathIndex(state)
    const path = state.paths[index]
    const lastPoint = path?.points.at(-1)
    if (!lastPoint) return state

    const now = performance.now()
    syncClockToCurrentPath(state, now)
    const from = Math.max(speculateClock.timeAt(now), lastPoint.time)
    const newTime = from + get(drawingConfig).speculateJumpSeconds
    speculateClock.seek(newTime, now)

    const points = [...path.points, holdPoint(lastPoint, newTime, state.currentPathId)]
    return { ...state, paths: replacePathAt(state.paths, index, { ...path, points }) }
  })
}

export function handleForwardTranscription(videoElement: VideoSource) {
  drawingState.update((state) => {
    if (!canJump(state, videoElement)) return state
    const index = currentPathIndex(state)
    const path = state.paths[index]
    const lastPoint = path?.points.at(-1)
    if (!lastPoint) return state

    const newTime = Math.min(
      state.videoTime + get(drawingConfig).jumpSeconds,
      videoElement.duration
    )
    videoElement.currentTime = newTime

    const points =
      newTime > lastPoint.time
        ? [...path.points, holdPoint(lastPoint, newTime, state.currentPathId)]
        : [...path.points]
    const paths = replacePathAt(state.paths, index, { ...path, points })
    return { ...state, isJumping: true, videoTime: newTime, paths }
  })

  clearJumpingOnSeek(videoElement)
}

export function handleRewindTranscription(videoElement: VideoSource) {
  drawingState.update((state) => {
    if (!canJump(state, videoElement)) return state
    const index = currentPathIndex(state)
    if (index === -1) return state

    const newTime = Math.max(state.videoTime - get(drawingConfig).jumpSeconds, 0)
    videoElement.currentTime = newTime
    videoElement.pause()

    const paths = replacePathAt(state.paths, index, truncateAfter(state.paths[index], newTime))
    return { ...state, ...STOPPED_TRACKING, isJumping: true, videoTime: newTime, paths }
  })

  clearJumpingOnSeek(videoElement)
}

export function handleForward(source: VideoSource | null) {
  if (get(drawingConfig).isTranscriptionMode && source) handleForwardTranscription(source)
  else handleForwardSpeculateMode()
}

export function handleRewind(source: VideoSource | null) {
  if (get(drawingConfig).isTranscriptionMode && source) handleRewindTranscription(source)
  else handleRewindSpeculateMode()
}

export const drawingState = writable<DrawingState>(initialState)

export function toggleDrawing(videoElement?: VideoSource) {
  drawingState.update((state) => {
    const newShouldTrack = !state.shouldTrackMouse

    if (videoElement) {
      try {
        if (newShouldTrack) {
          const playPromise = videoElement.play()
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error('Error playing video:', error)
              drawingState.update((s) => ({ ...s, ...STOPPED_TRACKING }))
            })
          }
        } else {
          videoElement.pause()
        }
      } catch (error) {
        console.error('Error handling video:', error)
        return { ...state, ...STOPPED_TRACKING }
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

export function createNewPath(color: string, startTime = 0) {
  console.log('Creating new path with color', color)
  invalidateSpeculateClock()
  drawingState.update((state) => {
    const newPathId = nextPathId(state)
    setNewPathStart(newPathId, startTime)
    return {
      ...state,
      currentPathId: newPathId,
      lastPathId: newPathId,
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

export function addPointsToCurrentPath(points: Point[], synthetic = false) {
  drawingState.update((state) => {
    if (!state.shouldTrackMouse || points.length === 0) return state

    const index = currentPathIndex(state)
    if (index === -1) return state

    const currentPath = state.paths[index]
    const updatedPoints = [...currentPath.points]
    let changed = false
    for (const point of points) {
      const last = updatedPoints.at(-1)
      if (!shouldKeepPoint(last?.time, point.time)) {
        const replaces =
          !synthetic &&
          syntheticPoints.has(last!) &&
          point.time >= last!.time &&
          shouldKeepPoint(updatedPoints.at(-2)?.time, point.time)
        if (!replaces) continue
        updatedPoints.pop()
      }
      const stored = freezePoint(point)
      if (synthetic) syntheticPoints.add(stored)
      updatedPoints.push(stored)
      changed = true
    }
    if (!changed) return state

    const paths = replacePathAt(state.paths, index, { ...currentPath, points: updatedPoints })
    return { ...state, paths }
  })
}

export function appendFinalPoint(time: number) {
  const state = get(drawingState)
  const lastPoint = findCurrentPath(state)?.points.at(-1)
  if (!lastPoint) return
  addPointsToCurrentPath(
    [{ x: lastPoint.x, y: lastPoint.y, time, pathId: state.currentPathId }],
    true
  )
}

export function appendHoldPoints(now: number) {
  const state = get(drawingState)
  const lastPoint = findCurrentPath(state)?.points.at(-1)
  if (!state.shouldTrackMouse || !lastPoint) return
  const { x, y, pathId } = lastPoint
  addPointsToCurrentPath(
    holdTimes(lastPoint.time, now).map((time) => ({ x, y, time, pathId })),
    true
  )
}

function patchPathById(pathId: number, patch: (path: PathData) => Partial<PathData>) {
  drawingState.update((state) => {
    const index = state.paths.findIndex((p) => p.pathId === pathId)
    if (index === -1) return state
    const path = state.paths[index]
    return { ...state, paths: replacePathAt(state.paths, index, { ...path, ...patch(path) }) }
  })
}

export function renamePathById(pathId: number, name: string) {
  patchPathById(pathId, () => ({ name: name.trim() || undefined }))
}

export function deletePathById(pathId: number) {
  invalidateSpeculateClock()
  drawingState.update((state) => {
    const updatedPaths = state.paths.filter((p) => p.pathId !== pathId)
    const freshId = nextPathId(state)

    // If no paths remain, create a new empty path (consistent with Clear All behavior)
    const newPaths =
      updatedPaths.length === 0
        ? [{ points: [], color: PATH_COLORS[0], pathId: freshId }]
        : updatedPaths

    const newCurrentPathId =
      updatedPaths.length === 0
        ? freshId
        : state.currentPathId === pathId
          ? (updatedPaths.at(-1)?.pathId ?? 0)
          : state.currentPathId

    return {
      ...state,
      ...STOPPED_TRACKING,
      paths: newPaths,
      currentPathId: newCurrentPathId,
      lastPathId: Math.max(state.lastPathId, pathId, newCurrentPathId),
    }
  })
}

export function togglePathVisibility(pathId: number) {
  patchPathById(pathId, (path) => ({ visible: path.visible === false }))
}

export function updatePathColor(pathId: number, color: string) {
  patchPathById(pathId, () => ({ color }))
}
