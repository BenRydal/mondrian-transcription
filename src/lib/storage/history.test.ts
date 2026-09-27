import { describe, expect, it } from 'vitest'
import type { PathSummary } from './chunks'
import { diffPaths, pathLabel } from './history'

const p = (pathId: number, sig: number, extra: Partial<PathSummary> = {}): PathSummary => ({
  pathId,
  color: '#f00',
  count: 10,
  sig,
  ...extra,
})

describe('diffPaths', () => {
  it('reports added, removed and changed paths with display labels', () => {
    const older = [p(1, 1), p(2, 2), p(3, 3, { name: 'Guide' })]
    const newer = [p(1, 1), p(2, 9), p(4, 4)]
    expect(diffPaths(newer, older)).toEqual([
      { pathId: 2, label: 'Path 2', change: 'changed' },
      { pathId: 4, label: 'Path 3', change: 'added' },
      { pathId: 3, label: 'Guide', change: 'removed' },
    ])
  })

  it('counts renames, recolours and visibility as changes, and ignores empty new paths', () => {
    const older = [p(1, 1), p(2, 2), p(3, 3)]
    const newer = [
      p(1, 1, { name: 'A' }),
      p(2, 2, { visible: false }),
      p(3, 3),
      p(5, 0, { count: 0 }),
    ]
    expect(diffPaths(newer, older).map((c) => c.pathId)).toEqual([1, 2])
  })

  it('returns nothing for the oldest entry', () => {
    expect(diffPaths([p(1, 1)], undefined)).toEqual([])
    expect(pathLabel([p(7, 1)], 7)).toBe('Path 1')
  })
})
