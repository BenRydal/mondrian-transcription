import type { PathSummary } from './chunks'
import type { SessionRecord } from './schema'

export function sessionName(s: Pick<SessionRecord, 'name' | 'floorPlanName'> | null): string {
  return s?.name || s?.floorPlanName || 'Untitled session'
}

interface PathChange {
  pathId: number
  label: string
  change: 'added' | 'removed' | 'changed'
}

export function pathLabel(
  paths: readonly Pick<PathSummary, 'pathId' | 'name'>[],
  pathId: number
): string {
  const index = paths.findIndex((p) => p.pathId === pathId)
  return paths[index]?.name || `Path ${index + 1}`
}

export function diffPaths(
  newer: readonly PathSummary[] = [],
  older: readonly PathSummary[] | undefined
): PathChange[] {
  if (!older) return []
  const before = new Map(older.map((p) => [p.pathId, p]))
  const changes: PathChange[] = []
  for (const p of newer) {
    const prev = before.get(p.pathId)
    const label = pathLabel(newer, p.pathId)
    if (!prev) {
      if (p.count > 0) changes.push({ pathId: p.pathId, label, change: 'added' })
    } else if (
      prev.sig !== p.sig ||
      prev.color !== p.color ||
      prev.name !== p.name ||
      prev.visible !== p.visible
    ) {
      changes.push({ pathId: p.pathId, label, change: 'changed' })
    }
    before.delete(p.pathId)
  }
  for (const p of before.values()) {
    if (p.count > 0) {
      changes.push({ pathId: p.pathId, label: pathLabel(older, p.pathId), change: 'removed' })
    }
  }
  return changes
}
