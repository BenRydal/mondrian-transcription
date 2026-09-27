import { writable, get } from 'svelte/store'

export type RotationAngle = 0 | 90 | 180 | 270

interface DrawingConfig {
  strokeWeight: number
  strokeColor: string
  splitPosition: number // percentage (0-100)
  exportSampleRate: number // Hz - shared export grid for all paths
  isTranscriptionMode: boolean
  speculateScale: number // optional scale for speculate mode
  isContinuousMode: boolean
  jumpSeconds: number // transcription mode: fast forward/rewind duration in seconds (5-60)
  speculateJumpSeconds: number // speculate mode: fast forward/rewind duration in seconds
  floorPlanRotation: RotationAngle // rotation angle for floor plan display (0, 90, 180, 270)
  showSpaceTime: boolean
  spaceTimeSplit: number // transcription mode: video share of the left column height (%)
}

const defaultConfig: DrawingConfig = {
  strokeWeight: 5,
  strokeColor: '#000000',
  splitPosition: 50,
  exportSampleRate: 10,
  isTranscriptionMode: true,
  speculateScale: 1,
  isContinuousMode: true,
  jumpSeconds: 5,
  speculateJumpSeconds: 1,
  floorPlanRotation: 0,
  showSpaceTime: false,
  spaceTimeSplit: 55,
}

export const drawingConfig = writable<DrawingConfig>(defaultConfig)

export const updateStrokeWeight = (weight: number) => {
  drawingConfig.update((config) => ({ ...config, strokeWeight: weight }))
}

export const updateStrokeColor = (color: string) => {
  drawingConfig.update((config) => ({ ...config, strokeColor: color }))
}

export const updateSplitPosition = (position: number) => {
  drawingConfig.update((config) => ({ ...config, splitPosition: position }))
}

export const updateExportSampleRate = (rate: number) => {
  drawingConfig.update((config) => ({ ...config, exportSampleRate: rate }))
}

export function getSplitPositionForMode() {
  const { isTranscriptionMode, showSpaceTime, splitPosition } = get(drawingConfig)
  return isTranscriptionMode || showSpaceTime ? splitPosition : 0
}

/** Height (%) of the video slot in the left column; the 3D view takes the rest. */
export function getVideoHeightPercent() {
  const { isTranscriptionMode, showSpaceTime, spaceTimeSplit } = get(drawingConfig)
  return isTranscriptionMode && showSpaceTime ? spaceTimeSplit : 100
}

const ROTATION_ANGLES: RotationAngle[] = [0, 90, 180, 270]

export function rotateFloorPlan(direction: 'cw' | 'ccw') {
  drawingConfig.update((config) => {
    const currentIndex = ROTATION_ANGLES.indexOf(config.floorPlanRotation)
    const newIndex = direction === 'cw' ? (currentIndex + 1) % 4 : (currentIndex - 1 + 4) % 4
    return { ...config, floorPlanRotation: ROTATION_ANGLES[newIndex] }
  })
}
