import { strFromU8, strToU8, unzip, type AsyncZippable, type Unzipped } from 'fflate'
import { zipBlob } from '$lib/utils/zip'
import { CHUNK_STRIDE, chunkLength, type ChunkRecord } from './chunks'
import {
  isValidManifest,
  type ManifestRecord,
  type SessionRecord,
  type SnapshotMeta,
} from './schema'
import type { SessionBundle } from './sessionDb'

const ARCHIVE_FORMAT = 'mondrian-session'
const ARCHIVE_VERSION = 1
export const MAX_ARCHIVE_VIDEO_BYTES = 512 * 1024 ** 2

interface ArchiveAsset {
  key: string
  type: string
  file: string
}

interface ArchiveManifest {
  format: typeof ARCHIVE_FORMAT
  version: number
  byteOrder: 'little'
  exportedAt: number
  session: SessionRecord
  snapshots: Array<{ meta: SnapshotMeta; manifest: ManifestRecord }>
  chunks: Array<{ seq: number; n: number; file: string }>
  floorPlans: ArchiveAsset[]
  videos: ArchiveAsset[]
  omittedVideos: string[]
}

export class ArchiveError extends Error {}

const unzipAsync = (data: Uint8Array) =>
  new Promise<Unzipped>((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)))
  )

async function blobBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

export async function packSession(bundle: SessionBundle): Promise<Blob> {
  const files: AsyncZippable = {}
  const chunks = bundle.chunks.map((c) => {
    const file = `chunks/${c.seq}.f64`
    files[file] = new Uint8Array(c.data.buffer, c.data.byteOffset, c.data.byteLength)
    return { seq: c.seq, n: c.n, file }
  })
  const assets = async (blobs: Map<string, Blob>, prefix: string) => {
    const out: ArchiveAsset[] = []
    for (const [key, blob] of blobs) {
      const file = `assets/${prefix}-${out.length}`
      files[file] = await blobBytes(blob)
      out.push({ key, type: blob.type, file })
    }
    return out
  }
  const videoBytes = [...bundle.videos.values()].reduce((s, b) => s + b.size, 0)
  const keepVideos = videoBytes <= MAX_ARCHIVE_VIDEO_BYTES
  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    byteOrder: 'little',
    exportedAt: Date.now(),
    session: bundle.session,
    snapshots: bundle.snapshots,
    chunks,
    floorPlans: await assets(bundle.floorPlans, 'floorplan'),
    videos: keepVideos ? await assets(bundle.videos, 'video') : [],
    omittedVideos: keepVideos ? [] : [...bundle.videos.keys()],
  }
  files['session.json'] = [strToU8(JSON.stringify(manifest)), { level: 6 }]
  return zipBlob(files, { level: 0 })
}

function fail(message: string): never {
  throw new ArchiveError(message)
}

export async function unpackSession(file: Blob): Promise<SessionBundle> {
  let files: Unzipped
  try {
    files = await unzipAsync(await blobBytes(file))
  } catch {
    fail('This file is not a Mondrian session archive.')
  }
  const raw = files['session.json']
  if (!raw) fail('This file is not a Mondrian session archive.')
  let manifest: ArchiveManifest
  try {
    manifest = JSON.parse(strFromU8(raw))
  } catch {
    fail('The archive manifest is damaged.')
  }
  if (manifest.format !== ARCHIVE_FORMAT) fail('This file is not a Mondrian session archive.')
  if (typeof manifest.version !== 'number' || manifest.version > ARCHIVE_VERSION) {
    fail('This archive was made by a newer version of Mondrian.')
  }
  if (manifest.byteOrder !== 'little') fail('Unsupported archive byte order.')
  if (!manifest.session || !Array.isArray(manifest.snapshots) || !Array.isArray(manifest.chunks)) {
    fail('The archive manifest is incomplete.')
  }

  const chunks = new Map<number, ChunkRecord>()
  for (const { seq, n, file: name } of manifest.chunks) {
    const bytes = files[name]
    if (!Number.isInteger(seq) || !Number.isInteger(n) || !bytes) fail(`Missing chunk ${seq}.`)
    if (bytes.byteLength !== n * CHUNK_STRIDE * 8) fail(`Chunk ${seq} is damaged.`)
    const data = new Float64Array(bytes.slice().buffer)
    chunks.set(seq, { sessionId: manifest.session.id, seq, n, data })
  }
  for (const { meta, manifest: m } of manifest.snapshots) {
    if (!meta || typeof meta.savedAt !== 'number' || !isValidManifest(m, meta.pointCount)) {
      fail('A saved version in the archive is damaged.')
    }
    for (const path of m.paths) {
      path.chunks.forEach((seq, i) => {
        if (chunks.get(seq)?.n !== chunkLength(path.count, i)) fail(`Chunk ${seq} is missing.`)
      })
    }
  }
  const readAssets = (list: ArchiveAsset[] = []) => {
    const out = new Map<string, Blob>()
    for (const { key, type, file: name } of list) {
      const bytes = files[name]
      if (!bytes) fail('An image or video in the archive is missing.')
      out.set(key, new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
    }
    return out
  }
  const floorPlans = readAssets(manifest.floorPlans)
  for (const { meta } of manifest.snapshots) {
    if (meta.floorPlanKey && !floorPlans.has(meta.floorPlanKey)) meta.floorPlanKey = null
  }
  return {
    session: manifest.session,
    snapshots: manifest.snapshots,
    chunks: [...chunks.values()],
    floorPlans,
    videos: readAssets(manifest.videos),
  }
}

export function archiveFileName(session: SessionRecord, displayName: string): string {
  const safe = displayName.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'session'
  const date = new Date(session.updatedAt).toISOString().slice(0, 10)
  return `${safe}-${date}.mondrian.zip`
}
