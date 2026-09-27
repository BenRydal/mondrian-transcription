import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { addPointsToCurrentPath, drawingState, handleForwardSpeculateMode } from './drawingState'

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
