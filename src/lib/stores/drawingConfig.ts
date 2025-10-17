import { writable, get } from 'svelte/store'

interface DrawingConfig {
  strokeWeight: number
  strokeColor: string
  splitPosition: number // percentage (0-100)
  pollingRate: number // milliseconds
  isTranscriptionMode: boolean
  speculateScale: number // optional scale for speculate mode
}

const defaultConfig: DrawingConfig = {
  strokeWeight: 5,
  strokeColor: '#000000',
  splitPosition: 50,
  pollingRate: 4,
  isTranscriptionMode: true,
  speculateScale: 1,
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

export const updatePollingRate = (rate: number) => {
  drawingConfig.update((config) => ({ ...config, pollingRate: rate }))
}

export function getSplitPositionForMode() {
  const { isTranscriptionMode, splitPosition } = get(drawingConfig)
  return isTranscriptionMode ? splitPosition : 0
}
