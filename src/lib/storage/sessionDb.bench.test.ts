import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { PathData } from '$lib/stores/drawingState'
import { SessionDb } from './sessionDb'

const PATHS = 10
const SAVES = 30

function makePaths(total: number): PathData[] {
  const per = Math.floor(total / PATHS)
  return Array.from({ length: PATHS }, (_, p) => ({
    pathId: p + 1,
    color: '#FF0000',
    points: Array.from({ length: per }, (_, i) => ({ x: i, y: p, time: i / 30, pathId: p + 1 })),
  }))
}

async function measure(total: number) {
  let now = 1_000_000_000_000
  const db = await SessionDb.open({ dbName: `bench-${total}`, now: () => now })
  const paths = makePaths(total)
  const input = () => ({
    paths: paths.slice(),
    videoTime: 0,
    imageWidth: 1,
    imageHeight: 1,
    config: {
      isTranscriptionMode: false,
      strokeWeight: 1,
      speculateScale: 1,
      isContinuousMode: true,
    },
    floorPlan: null,
    video: null,
  })
  await db.save('s', input())
  let elapsed = 0
  let prep = 0
  for (let s = 0; s < SAVES; s++) {
    now += 1000
    const last = paths[3].points.at(-1)!
    const extra = Array.from({ length: 30 }, (_, i) => ({
      ...last,
      time: last.time + (i + 1) / 30,
    }))
    paths[3] = { ...paths[3], points: [...paths[3].points, ...extra] }
    const start = performance.now()
    const result = await db.save('s', input())
    elapsed += performance.now() - start
    prep += result.prepMs
    expect(result.chunksWritten).toBeLessThanOrEqual(2)
  }
  db.close()
  return { total, msPerSave: elapsed / SAVES, prepMs: prep / SAVES }
}

describe('save cost benchmark', () => {
  it('keeps the per-save cost roughly flat from 1k to 360k points', async () => {
    const results = []
    for (const total of [1_000, 60_000, 360_000]) results.push(await measure(total))
    console.table(results)
    const [small, , large] = results
    expect(large.msPerSave).toBeLessThan(Math.max(small.msPerSave * 6, 15))
    expect(large.prepMs).toBeLessThan(10)
  }, 60_000)
})
