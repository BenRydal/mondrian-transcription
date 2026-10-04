import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import {
  addPointsToCurrentPath,
  createNewPath,
  deletePathById,
  drawingState,
  handleForwardSpeculateMode,
  PATH_COLORS,
  replacePathsWithImported,
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
      lastPathId: 1,
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

describe('path ids', () => {
  beforeEach(() => {
    drawingState.update((s) => ({ ...s, currentPathId: 0, lastPathId: 0, paths: [] }))
  })

  it('never reissues the id of a deleted path', () => {
    createNewPath('#f00')
    createNewPath('#0f0')
    deletePathById(2)
    createNewPath('#00f')
    expect(get(drawingState).paths.map((p) => p.pathId)).toEqual([1, 3])
  })

  it('gives the replacement empty path a fresh id when the last path is deleted', () => {
    createNewPath('#f00')
    deletePathById(1)
    expect(get(drawingState).paths.map((p) => p.pathId)).toEqual([2])
  })
})

describe('replacePathsWithImported', () => {
  beforeEach(() => {
    drawingState.update((s) => ({ ...s, currentPathId: 0, lastPathId: 0, paths: [] }))
  })

  const imported = (...names: string[]) =>
    names.map((name, i) => ({ name, points: [{ x: i, y: i * 2, time: i * 0.1 }] }))

  it('names the paths after their files and cycles the palette', () => {
    replacePathsWithImported(imported('Teacher', 'Student'))
    const paths = get(drawingState).paths
    expect(paths.map((p) => p.name)).toEqual(['Teacher', 'Student'])
    expect(paths.map((p) => p.color)).toEqual([PATH_COLORS[0], PATH_COLORS[1]])
  })

  // The id is stored per point by encodeChunk, so an unstamped point would autosave wrong.
  it('stamps every point with its own path id', () => {
    replacePathsWithImported(imported('Teacher', 'Student'))
    const paths = get(drawingState).paths
    expect(paths.map((p) => p.points.map((pt) => pt.pathId))).toEqual([[1], [2]])
  })

  it('continues ids past every id the session has used', () => {
    createNewPath('#f00')
    createNewPath('#0f0')
    deletePathById(2)
    replacePathsWithImported(imported('Teacher'))
    expect(get(drawingState).paths.map((p) => p.pathId)).toEqual([3])
    expect(get(drawingState).lastPathId).toBe(3)
  })

  // Recording must not append to imported data, so the caller starts a new path after
  // this; the last imported path is current only so that startNewPath's guard passes.
  it('leaves the last imported path current', () => {
    replacePathsWithImported(imported('Teacher', 'Student'))
    expect(get(drawingState).currentPathId).toBe(2)
  })

  it('stops recording and drops the previous paths', () => {
    createNewPath('#f00')
    addPointsToCurrentPath([{ x: 9, y: 9, time: 0, pathId: 1 }])
    replacePathsWithImported(imported('Teacher'))
    const state = get(drawingState)
    expect(state.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(state.shouldTrackMouse).toBe(false)
    expect(state.isDrawing).toBe(false)
  })

  it('freezes the imported points', () => {
    replacePathsWithImported(imported('Teacher'))
    expect(Object.isFrozen(get(drawingState).paths[0].points[0])).toBe(true)
  })

  // P5Wrapper.startNewPath() refuses to add a path when the current one is empty, and
  // the import relies on it to leave the imported paths as a backdrop. If this breaks,
  // recording silently appends to the last imported path instead.
  it('leaves a non-empty current path, so startNewPath will add a fresh one', () => {
    replacePathsWithImported(imported('Teacher'))
    const state = get(drawingState)
    const current = state.paths.find((p) => p.pathId === state.currentPathId)
    expect(current?.points.length).toBeGreaterThan(0)
  })

  it('drops a blank file name rather than storing it', () => {
    replacePathsWithImported([{ name: '  ', points: [{ x: 0, y: 0, time: 0 }] }])
    expect(get(drawingState).paths[0].name).toBeUndefined()
  })
})
