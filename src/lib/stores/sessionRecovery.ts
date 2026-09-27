import type { PathData } from './drawingState'

/**
 * Check if paths contain any recorded data
 */
export function hasRecordedData(paths: PathData[]): boolean {
  return paths.some((p) => p.points.length > 0)
}

/**
 * Get human-readable time since session was saved
 */
export function getSessionAge(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)

  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

/**
 * Get total point count across all paths
 */
export function getTotalPointCount(paths: PathData[]): number {
  return paths.reduce((sum, path) => sum + path.points.length, 0)
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
