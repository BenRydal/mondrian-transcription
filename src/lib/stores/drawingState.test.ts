import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import {
  addPointsToCurrentPath,
  createNewPath,
  deletePathById,
  drawingState,
  handleForwardSpeculateMode,
} from './drawingState'
import { speculateClock, syncSpeculateClock } from '../timing/sessionClocks'

describe('stored points in dev builds', () => {
  beforeEach(() => {
    drawingState.update((s) => ({
      ...s,
      shouldTrackMouse: true,
      currentPathId: 1,
      paths: [{ pathId: 1, color: '#FF0000', points: [] }],
    }))
  })

  const stored = () => get(drawingState).paths[0].points

  it('runs with import.meta.env.DEV set', () => {
    expect(import.meta.env.DEV).toBe(true)
  })

  it('throws on an in-place edit of a recorded point', () => {
    addPointsToCurrentPath([{ x: 1, y: 2, time: 0.5, pathId: 1 }])
    const point = stored()[0]
    expect(Object.isFrozen(point)).toBe(true)
    expect(() => {
      point.x = 99
    }).toThrow(TypeError)
    expect(stored()[0].x).toBe(1)
  })

  it('freezes the held point added by fast forward', () => {
    addPointsToCurrentPath([{ x: 1, y: 2, time: 0.5, pathId: 1 }])
    handleForwardSpeculateMode()
    const hold = stored().at(-1)!
    expect(hold.time).toBeGreaterThan(0.5)
    expect(() => {
      hold.time = 0
    }).toThrow(TypeError)
  })
})

describe('new path start time', () => {
  beforeEach(() => {
    drawingState.update((s) => ({
      ...s,
      shouldTrackMouse: false,
      currentPathId: 1,
      paths: [
        {
          pathId: 1,
          color: '#FF0000',
          points: [
            { x: 1, y: 1, time: 0, pathId: 1 },
            { x: 2, y: 2, time: 42, pathId: 1 },
          ],
        },
      ],
    }))
  })

  const clockOnCurrentPath = (perfMs: number) => {
    const s = get(drawingState)
    const last = s.paths.find((p) => p.pathId === s.currentPathId)?.points.at(-1)?.time
    syncSpeculateClock(s.currentPathId, last, perfMs)
    return speculateClock.timeAt(perfMs)
  }

  it('starts a new path at 0:00 by default', () => {
    createNewPath('#00FF00')
    expect(clockOnCurrentPath(1)).toBe(0)
  })

  it('starts a new path at the given session time', () => {
    createNewPath('#00FF00', 42)
    expect(get(drawingState).currentPathId).toBe(2)
    expect(clockOnCurrentPath(2)).toBe(42)
  })

  it('forgets the start once paths are deleted, so a recreated id starts at 0:00', () => {
    createNewPath('#00FF00', 42)
    deletePathById(2)
    deletePathById(1)
    expect(clockOnCurrentPath(3)).toBe(0)
  })
})
