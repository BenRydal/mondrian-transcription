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
  const { isTranscriptionMode, splitPosition } = get(drawingConfig)
  return isTranscriptionMode ? splitPosition : 0
}

const ROTATION_ANGLES: RotationAngle[] = [0, 90, 180, 270]

export function rotateFloorPlan(direction: 'cw' | 'ccw') {
  drawingConfig.update((config) => {
    const currentIndex = ROTATION_ANGLES.indexOf(config.floorPlanRotation)
    const newIndex =
      direction === 'cw'
        ? (currentIndex + 1) % 4
        : (currentIndex - 1 + 4) % 4
    return { ...config, floorPlanRotation: ROTATION_ANGLES[newIndex] }
  })
}
