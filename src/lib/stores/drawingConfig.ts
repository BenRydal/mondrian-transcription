import { writable, get } from 'svelte/store'

export type RotationAngle = 0 | 90 | 180 | 270

interface DrawingConfig {
  strokeWeight: number
  splitPosition: number // percentage (0-100)
  exportSampleRate: number
  isTranscriptionMode: boolean
  speculateScale: number // optional scale for speculate mode
  isContinuousMode: boolean
  jumpSeconds: number // transcription mode: fast forward/rewind duration in seconds (5-60)
  speculateJumpSeconds: number
  floorPlanRotation: RotationAngle // rotation angle for floor plan display (0, 90, 180, 270)
  showSpaceTime: boolean
  spaceTimeSplit: number
}

const defaultConfig: DrawingConfig = {
  strokeWeight: 5,
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

export const SPLIT_POSITION_RANGE = { min: 30, max: 70 } as const
export const SPACE_TIME_SPLIT_RANGE = { min: 20, max: 80, step: 2 } as const

type LayoutConfig = Pick<DrawingConfig, 'isTranscriptionMode' | 'showSpaceTime' | 'spaceTimeSplit'>

export function hasLeftColumn(config: Omit<LayoutConfig, 'spaceTimeSplit'>) {
  return config.isTranscriptionMode || config.showSpaceTime
}

export function videoHeightPercent(config: LayoutConfig) {
  return config.isTranscriptionMode && config.showSpaceTime ? config.spaceTimeSplit : 100
}

export function getSplitPositionForMode() {
  const config = get(drawingConfig)
  return hasLeftColumn(config) ? config.splitPosition : 0
}

export function getVideoHeightPercent() {
  return videoHeightPercent(get(drawingConfig))
}

const ROTATION_ANGLES: RotationAngle[] = [0, 90, 180, 270]

export function rotateFloorPlan(direction: 'cw' | 'ccw') {
  drawingConfig.update((config) => {
    const currentIndex = ROTATION_ANGLES.indexOf(config.floorPlanRotation)
    const newIndex = direction === 'cw' ? (currentIndex + 1) % 4 : (currentIndex - 1 + 4) % 4
    return { ...config, floorPlanRotation: ROTATION_ANGLES[newIndex] }
  })
}
