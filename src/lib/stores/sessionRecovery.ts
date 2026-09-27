type HasPoints = { points: readonly unknown[] }

/**
 * Check if paths contain any recorded data
 */
export function hasRecordedData<T extends HasPoints>(paths: readonly T[]): boolean {
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
export function getTotalPointCount<T extends HasPoints>(paths: readonly T[]): number {
  return paths.reduce((sum, path) => sum + path.points.length, 0)
}

export function countRecordedPaths<T extends HasPoints>(paths: readonly T[]): number {
  return paths.filter((p) => p.points.length > 0).length
}
