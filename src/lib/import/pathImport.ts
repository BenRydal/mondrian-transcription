import { strFromU8, type Unzipped } from 'fflate'
import { FLOOR_PLAN_FILE } from '$lib/export/pathExport'
import { thinByTime, type TimedPoint } from '$lib/timing/sampling'
import { unzipAsync } from '$lib/utils/zip'

/** Thrown with a message meant to be shown to the user as-is. */
export class ImportError extends Error {}

export interface ImportedPath {
  name: string
  points: TimedPoint[]
}

export interface DataExport {
  paths: ImportedPath[]
  floorPlan: { bytes: Uint8Array; type: string } | null
  pointCount: number
  /** CSVs that could not be read, by file name, so the caller can say so. */
  skipped: string[]
}

/**
 * The bytes ride along on the session arm so the archive importer need not read the file
 * a second time — an archive may be hundreds of megabytes.
 */
export type ZipContents =
  | { kind: 'session'; bytes: Uint8Array }
  | { kind: 'data'; data: DataExport }

const SESSION_MANIFEST = 'session.json'
const CSV_SUFFIX = '.csv'
const COLUMNS = ['x', 'y', 'time'] as const

/**
 * Import budgets. Nothing here is a security boundary — the files are the user's own —
 * but without them a malformed or hostile file locks the tab instead of failing.
 */
// 10 Hz over an hour is ~36k points per path, so this is far past any real recording.
export const MAX_POINTS = 1_000_000
// At ~20 characters a row, this is comfortably more than MAX_POINTS worth of CSV.
export const MAX_CSV_CHARS = 32 * 1024 ** 2
// An import is CSVs plus one floor plan; a session archive is capped separately.
export const MAX_IMPORT_BYTES = 64 * 1024 ** 2
// Matches the maxlength on the rename fields; a ZIP entry name has no limit of its own.
const MAX_NAME_CHARS = 80

type ColumnIndex = [number, number, number]

const HEADERLESS_COLUMNS: ColumnIndex = [0, 1, 2]

function fail(message: string): never {
  throw new ImportError(message)
}

// Our own export writes a flat ZIP, but ZIPs made by hand or re-zipped by a file
// manager often nest everything inside a folder, so match on the base name.
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// Re-zipping an export with macOS Archive Utility adds __MACOSX/._Teacher.csv next to
// every entry. Those are binary AppleDouble metadata, so reading them as CSVs would
// report half the files as unreadable.
const isAppleDouble = (path: string) =>
  path.startsWith('__MACOSX/') || basename(path).startsWith('._')

const isCsv = (path: string) =>
  !isAppleDouble(path) && basename(path).toLowerCase().endsWith(CSV_SUFFIX)

function toNumber(cell: string | undefined): number {
  const text = cell?.trim()
  // Number('') is 0, which would turn a blank cell into a real coordinate.
  return text ? Number(text) : NaN
}

function headerColumns(cells: string[]): ColumnIndex | null {
  const found = COLUMNS.map((column) =>
    cells.findIndex((cell) => cell.trim().toLowerCase() === column)
  )
  return found.every((index) => index >= 0) ? (found as ColumnIndex) : null
}

const isHeaderless = (cells: string[]) =>
  HEADERLESS_COLUMNS.every((index) => Number.isFinite(toNumber(cells[index])))

function toPoint(cells: string[], [xi, yi, ti]: ColumnIndex): TimedPoint | null {
  const x = toNumber(cells[xi])
  const y = toNumber(cells[yi])
  const time = toNumber(cells[ti])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(time)) return null
  // A negative time has no meaning on either clock and would sort ahead of the start.
  return time < 0 ? null : { x, y, time }
}

/**
 * Parse one `x,y,time` CSV. Written to accept our own export first and be forgiving
 * beyond it: the header is optional and its columns may be in any order, individual
 * malformed rows are skipped, and rows are sorted and thinned to the minimum interval
 * the drawing store assumes.
 */
export function parsePathCsv(text: string): TimedPoint[] {
  // Checked before splitting: one enormous line would otherwise allocate a cell per comma
  // before any row-level limit could apply.
  if (text.length > MAX_CSV_CHARS) fail('That file is too large to import.')

  const rows = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.split(','))
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
  if (rows.length === 0) fail('The file is empty.')

  const header = headerColumns(rows[0])
  if (!header && !isHeaderless(rows[0])) fail('The file has no x, y and time columns.')
  const columns = header ?? HEADERLESS_COLUMNS

  const points: TimedPoint[] = []
  for (const cells of header ? rows.slice(1) : rows) {
    const point = toPoint(cells, columns)
    if (point) points.push(point)
  }
  if (points.length === 0) fail('The file has no usable x, y, time rows.')

  points.sort((a, b) => a.time - b.time)
  return thinByTime(points)
}

interface NamedFile {
  name: string
  bytes: Uint8Array
}

/** Read every CSV, keeping the order given: it decides path order and so path colour. */
function readPaths(csvs: NamedFile[]) {
  if (csvs.length === 0) fail('No movement data found (no CSV files).')

  const paths: ImportedPath[] = []
  const skipped: string[] = []
  let pointCount = 0
  for (const { name, bytes } of csvs) {
    let points: TimedPoint[]
    try {
      points = parsePathCsv(strFromU8(bytes))
    } catch {
      // Only this file is lost; the caller reports it by name.
      skipped.push(basename(name))
      continue
    }
    // Every point becomes a frozen object in memory and four float64s in storage, so the
    // total is checked as we go. Deliberately outside the catch above, which would
    // otherwise turn an over-budget import into "one file could not be read".
    pointCount += points.length
    if (pointCount > MAX_POINTS) {
      fail(`That data has more than ${MAX_POINTS.toLocaleString()} points, which is too many.`)
    }
    paths.push({ name: pathName(name), points })
  }
  if (paths.length === 0) fail('None of the CSV files could be read.')

  return { paths, skipped, pointCount }
}

/** Read an already-unzipped data export. Separate so the ZIP is only decoded once. */
export function readDataExport(files: Unzipped): DataExport {
  // ZIP order, not sorted: our own export writes the CSVs in path order, so keeping it
  // means a path comes back in its original position and keeps its colour.
  const csvs = Object.entries(files)
    .filter(([name]) => isCsv(name))
    .map(([name, bytes]) => ({ name, bytes }))
  const floorPlan = Object.keys(files).find((name) => basename(name) === FLOOR_PLAN_FILE)
  return {
    ...readPaths(csvs),
    floorPlan: floorPlan ? { bytes: files[floorPlan], type: 'image/png' } : null,
  }
}

const fileBytes = async (file: File) => new Uint8Array(await file.arrayBuffer())

/**
 * Read CSVs chosen straight from disk, with an optional floor plan image. Nothing can
 * check that the image is the one the CSVs were recorded against; the caller warns when
 * the points land outside it, and importing again with the right image replaces both.
 */
export async function readLooseFiles(csvs: File[], floorPlan: File | null): Promise<DataExport> {
  // File.size needs no read, so the budget is settled before anything is loaded. Without
  // it, many large CSVs would all be parsed before the point cap above could notice.
  const selected = floorPlan ? [...csvs, floorPlan] : csvs
  if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES) {
    fail('Those files are too large to import.')
  }
  // Sorted, unlike a ZIP: a file picker's order is not guaranteed and drag-and-drop order
  // varies by platform, so sorting is what keeps path order and colours stable.
  const sorted = [...csvs].sort((a, b) => a.name.localeCompare(b.name))
  const named = await Promise.all(
    sorted.map(async (file) => ({ name: file.name, bytes: await fileBytes(file) }))
  )
  return {
    ...readPaths(named),
    floorPlan: floorPlan
      ? { bytes: await fileBytes(floorPlan), type: floorPlan.type || 'image/png' }
      : null,
  }
}

// IGS uses the file name as the person's name, and so does our export, so the name
// round-trips by stripping the extension and nothing else, bar an outright silly length.
function pathName(file: string): string {
  const name = basename(file)
  return (name.slice(0, -CSV_SUFFIX.length) || name).slice(0, MAX_NAME_CHARS)
}

/**
 * Decode either kind of Mondrian ZIP so the caller can route it. A session archive is
 * recognised from its manifest alone, leaving the rest of it — which may hold hundreds of
 * megabytes of video — compressed for the archive importer to inflate.
 */
export async function readMondrianZip(file: Blob): Promise<ZipContents> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  // The filter visits every entry before any of them is inflated, so the declared sizes
  // are free to total up here. A crafted ZIP can understate them, so this only stops an
  // obvious decompression bomb; MAX_POINTS is the backstop that does not rely on headers.
  let uncompressed = 0
  let manifest: Unzipped
  try {
    manifest = await unzipAsync(bytes, (entry) => {
      uncompressed += entry.originalSize
      return basename(entry.name) === SESSION_MANIFEST
    })
  } catch {
    fail('That file is not a ZIP archive.')
  }
  // An archive is handed on whole, video and all, so only a data export is capped here.
  if (Object.keys(manifest).length > 0) return { kind: 'session', bytes }
  if (uncompressed > MAX_IMPORT_BYTES) fail('That ZIP is too large to import.')

  let files: Unzipped
  try {
    files = await unzipAsync(bytes)
  } catch {
    fail('That ZIP could not be read.')
  }
  return { kind: 'data', data: readDataExport(files) }
}
