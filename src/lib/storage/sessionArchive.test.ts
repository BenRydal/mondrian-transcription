import 'fake-indexeddb/auto'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { PathData } from '$lib/stores/drawingState'
import { ArchiveError, packSession, unpackSession } from './sessionArchive'
import { SessionDb, type SnapshotInput } from './sessionDb'

let dbCount = 0
const freshName = () => `archive-db-${++dbCount}`

function path(n: number, pathId: number): PathData {
  return {
    pathId,
    color: '#123456',
    name: `P${pathId}`,
    points: Array.from({ length: n }, (_, i) => ({ x: i, y: -i, time: i / 10, pathId })),
  }
}

function input(paths: PathData[], video = false): SnapshotInput {
  return {
    paths,
    videoTime: 4,
    imageWidth: 800,
    imageHeight: 600,
    config: {
      isTranscriptionMode: true,
      strokeWeight: 3,
      speculateScale: 1,
      isContinuousMode: false,
    },
    floorPlan: { key: 'fp', blob: new Blob(['plan'], { type: 'image/png' }), name: 'room.png' },
    video: video
      ? {
          key: 'vid',
          blob: new Blob(['movie'], { type: 'video/mp4' }),
          name: 'clip.mp4',
          meta: { name: 'clip.mp4', size: 5, type: 'video/mp4' },
        }
      : null,
  }
}

describe('session archive', () => {
  // The ZIP sniff in pathImport already reads the file, so it hands these bytes straight
  // over rather than making a second copy of a possibly huge archive.
  it('unpacks from raw bytes as well as a Blob', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const source = await db.createSession('Lab')
    await db.save(source.id, input([path(10, 1)]))
    const archive = await packSession((await db.exportSession(source.id))!)
    db.close()

    const fromBytes = await unpackSession(new Uint8Array(await archive.arrayBuffer()))
    const fromBlob = await unpackSession(archive)
    expect(fromBytes.session).toEqual(fromBlob.session)
    expect(fromBytes.chunks).toEqual(fromBlob.chunks)
  })

  it('round-trips a session with its whole history into a new session', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const source = await db.createSession('Lab')
    const a = path(1200, 1)
    await db.save(source.id, input([a]), { kind: 'pinned', label: 'Start' })
    const b = path(30, 2)
    await db.save(source.id, input([{ ...a, points: a.points.slice(0, 900) }, b], true))

    const blob = await packSession((await db.exportSession(source.id))!)
    const imported = await db.importSession(await unpackSession(blob))
    expect(imported.id).not.toBe(source.id)
    expect(imported.name).toBe('Lab')

    const before = await db.listSnapshots(source.id)
    const after = await db.listSnapshots(imported.id)
    expect(after.map((m) => [m.kind, m.label, m.pointCount, m.savedAt])).toEqual(
      before.map((m) => [m.kind, m.label, m.pointCount, m.savedAt])
    )
    for (let i = 0; i < before.length; i++) {
      const x = (await db.loadSnapshot(before[i].id!))!
      const y = (await db.loadSnapshot(after[i].id!))!
      expect(y.paths).toEqual(x.paths)
      expect(await y.floorPlan!.text()).toBe('plan')
      expect(y.meta.config).toEqual(x.meta.config)
    }
    expect(await (await db.loadLatest(imported.id))!.video!.text()).toBe('movie')

    await db.deleteSession(source.id)
    expect((await db.loadLatest(imported.id))!.paths[1]).toEqual(b)
    db.close()
  })

  it('carries a YouTube source through export and import', async () => {
    const db = await SessionDb.open({ dbName: freshName() })
    const source = await db.createSession("Michael Jordan's Last Shot")
    const videoSource = { kind: 'youtube' as const, videoId: 'iiMjfVOj8po', title: 'Jordan' }
    await db.save(source.id, { ...input([path(40, 1)]), videoTime: 9.5, videoSource })

    const blob = await packSession((await db.exportSession(source.id))!)
    const imported = await db.importSession(await unpackSession(blob))
    const restored = (await db.loadLatest(imported.id))!
    expect(restored.meta.videoSource).toEqual(videoSource)
    expect(restored.meta.videoTime).toBe(9.5)
    expect(restored.video).toBeNull()
    expect(imported.name).toBe("Michael Jordan's Last Shot")
    db.close()
  })

  it('rejects files that are not archives, newer versions and missing chunks', async () => {
    const reject = (data: Uint8Array) =>
      expect(unpackSession(new Blob([data as Uint8Array<ArrayBuffer>]))).rejects.toBeInstanceOf(
        ArchiveError
      )
    await reject(strToU8('not a zip'))
    await reject(zipSync({ 'other.json': strToU8('{}') }))
    await reject(
      zipSync({
        'session.json': strToU8(
          JSON.stringify({ format: 'mondrian-session', version: 99, byteOrder: 'little' })
        ),
      })
    )

    const db = await SessionDb.open({ dbName: freshName() })
    const s = await db.createSession()
    await db.save(s.id, input([path(700, 1)]))
    const bundle = (await db.exportSession(s.id))!
    bundle.chunks = bundle.chunks.slice(1)
    await expect(unpackSession(await packSession(bundle))).rejects.toThrow(/Chunk/)
    db.close()
  })
})
