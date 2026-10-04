import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { pathCsvFiles } from '../export/pathExport'
import { zipBlob } from '../utils/zip'
import {
  ImportError,
  MAX_CSV_CHARS,
  MAX_IMPORT_BYTES,
  parsePathCsv,
  readDataExport,
  readLooseFiles,
  readMondrianZip,
} from './pathImport'

const csv = (...rows: string[]) => ['x,y,time', ...rows].join('\n')

const files = (entries: Record<string, string>) =>
  Object.fromEntries(Object.entries(entries).map(([name, text]) => [name, strToU8(text)]))

const times = (text: string) => parsePathCsv(text).map((p) => p.time)

describe('parsePathCsv', () => {
  it('reads the header our own export writes', () => {
    expect(parsePathCsv(csv('1.00,2.00,0', '3.00,4.00,0.1'))).toEqual([
      { x: 1, y: 2, time: 0 },
      { x: 3, y: 4, time: 0.1 },
    ])
  })

  it('reads a file with no header row', () => {
    expect(parsePathCsv('1,2,0\n3,4,0.1')).toEqual([
      { x: 1, y: 2, time: 0 },
      { x: 3, y: 4, time: 0.1 },
    ])
  })

  it('maps header columns by name, in any order and any case', () => {
    expect(parsePathCsv('Time,Y,X\n0,2,1')).toEqual([{ x: 1, y: 2, time: 0 }])
  })

  it('ignores a BOM, CRLF line endings and blank lines', () => {
    expect(parsePathCsv('﻿x,y,time\r\n1,2,0\r\n\r\n3,4,0.1\r\n')).toEqual([
      { x: 1, y: 2, time: 0 },
      { x: 3, y: 4, time: 0.1 },
    ])
  })

  it('keeps extra columns out of the way', () => {
    expect(parsePathCsv('x,y,time,speaker\n1,2,0,Teacher')).toEqual([{ x: 1, y: 2, time: 0 }])
  })

  // One bad row in the middle of a long recording should not cost the whole path.
  it('skips rows that are not three finite numbers', () => {
    expect(times(csv('1,2,0', 'a,b,c', '3,4,0.1', '5,,0.2', '6,7,', '8,9,0.3'))).toEqual([
      0, 0.1, 0.3,
    ])
  })

  // A negative time has no meaning on either clock and would sort ahead of the start.
  it('skips rows with a negative time', () => {
    expect(times(csv('1,2,-1', '3,4,0', '5,6,0.1'))).toEqual([0, 0.1])
  })

  it('sorts out-of-order rows by time', () => {
    expect(times(csv('1,2,0.2', '3,4,0', '5,6,0.1'))).toEqual([0, 0.1, 0.2])
  })

  // The drawing store drops any point less than 0.01s after the previous one, so the
  // importer thins here rather than handing it points it would silently discard.
  it('thins points closer together than the minimum interval', () => {
    expect(times(csv('1,2,0', '3,4,0.004', '5,6,0.008', '7,8,0.012', '9,10,0.5'))).toEqual([
      0, 0.012, 0.5,
    ])
  })

  it('rejects a file with no usable rows', () => {
    expect(() => parsePathCsv(csv('a,b,c'))).toThrow(ImportError)
  })

  it('rejects an empty file', () => {
    expect(() => parsePathCsv('')).toThrow(ImportError)
  })

  it('rejects a header that is not x, y and time', () => {
    expect(() => parsePathCsv('lat,lon,stamp\n1,2,3')).toThrow(ImportError)
  })
})

describe('import budgets', () => {
  // Rejected on length before splitting: one enormous line would otherwise allocate a
  // cell per comma before any row-level limit could apply.
  it('rejects a CSV past the character budget', () => {
    expect(() => parsePathCsv('1,2,0\n'.padEnd(MAX_CSV_CHARS + 1, 'x'))).toThrow(ImportError)
  })

  // File.size is read without touching the file, so many large CSVs are refused before
  // any of them is parsed.
  it('rejects a loose selection past the byte budget', async () => {
    const big = new File(['x'], 'Teacher.csv', { type: 'text/csv' })
    Object.defineProperty(big, 'size', { value: MAX_IMPORT_BYTES + 1 })
    await expect(readLooseFiles([big], null)).rejects.toBeInstanceOf(ImportError)
  })

  // A crafted ZIP entry name has no length limit of its own, and the name reaches both the
  // UI and storage.
  it('caps an absurd path name at the length the rename field allows', async () => {
    const name = `${'A'.repeat(500)}.csv`
    const data = await readLooseFiles(
      [new File([strToU8(csv('1,2,0')) as Uint8Array<ArrayBuffer>], name, { type: 'text/csv' })],
      null
    )
    expect(data.paths[0].name).toHaveLength(80)
  })
})

describe('readDataExport', () => {
  it('names each path after its file and keeps the floor plan bytes', () => {
    const data = readDataExport(
      files({
        'floor-plan.png': 'png-bytes',
        'Teacher.csv': csv('1,2,0', '3,4,0.1'),
        'Student.csv': csv('5,6,0'),
      })
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher', 'Student'])
    expect(data.pointCount).toBe(3)
    expect(new TextDecoder().decode(data.floorPlan!.bytes)).toBe('png-bytes')
  })

  // The floor plan is optional: the paths still load onto whatever plan is already open,
  // and the app's existing "upload your floor plan" banner covers the empty case.
  it('imports paths when the ZIP has no floor plan', () => {
    const data = readDataExport(files({ 'Teacher.csv': csv('1,2,0') }))
    expect(data.floorPlan).toBeNull()
    expect(data.paths).toHaveLength(1)
  })

  it('reads CSVs nested inside a folder', () => {
    const data = readDataExport(
      files({ 'export/floor-plan.png': 'png', 'export/Teacher.csv': csv('1,2,0') })
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(data.floorPlan).not.toBeNull()
  })

  // Re-zipping an export on macOS adds __MACOSX/._Teacher.csv next to every entry.
  // Reading those as CSVs would report half the files as unreadable.
  it('ignores macOS AppleDouble entries', () => {
    const data = readDataExport(
      files({
        'floor-plan.png': 'png',
        'Teacher.csv': csv('1,2,0'),
        '__MACOSX/._Teacher.csv': '\x00\x05\x16\x07binary',
        '__MACOSX/._floor-plan.png': '\x00\x05\x16\x07binary',
      })
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(data.skipped).toEqual([])
  })

  it('skips unreadable CSVs and reports them', () => {
    const data = readDataExport(
      files({ 'Teacher.csv': csv('1,2,0'), 'Broken.csv': 'lat,lon\n1,2' })
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(data.skipped).toEqual(['Broken.csv'])
  })

  it('rejects a ZIP with no CSVs at all', () => {
    expect(() => readDataExport(files({ 'floor-plan.png': 'png' }))).toThrow(ImportError)
  })

  it('rejects a ZIP where every CSV is unreadable', () => {
    expect(() => readDataExport(files({ 'Broken.csv': 'lat,lon\n1,2' }))).toThrow(ImportError)
  })
})

describe('readLooseFiles', () => {
  const file = (name: string, text: string, type = 'text/csv') =>
    new File([strToU8(text) as Uint8Array<ArrayBuffer>], name, { type })

  it('reads CSVs picked from disk, with the image as the floor plan', async () => {
    const plan = file('room.jpg', 'jpeg-bytes', 'image/jpeg')
    const data = await readLooseFiles([file('Teacher.csv', csv('1,2,0', '3,4,0.1'))], plan)

    expect(data.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(data.pointCount).toBe(2)
    expect(data.floorPlan).toEqual({ bytes: expect.anything(), type: 'image/jpeg' })
    expect(new TextDecoder().decode(data.floorPlan!.bytes)).toBe('jpeg-bytes')
  })

  // A file picker's order is not guaranteed and drag-and-drop order varies by platform,
  // so sorting is what stops path order, and therefore colour, from drifting.
  it('sorts by file name so path order is stable', async () => {
    const data = await readLooseFiles(
      [
        file('Teacher.csv', csv('1,2,0')),
        file('Aide.csv', csv('3,4,0')),
        file('Student.csv', csv('5,6,0')),
      ],
      null
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Aide', 'Student', 'Teacher'])
  })

  it('imports with no floor plan at all', async () => {
    const data = await readLooseFiles([file('Teacher.csv', csv('1,2,0'))], null)
    expect(data.floorPlan).toBeNull()
  })

  // Some browsers hand over an empty type for a dragged file.
  it('falls back to PNG when the image has no type', async () => {
    const data = await readLooseFiles([file('Teacher.csv', csv('1,2,0'))], file('p.png', 'x', ''))
    expect(data.floorPlan!.type).toBe('image/png')
  })

  it('keeps both files when two CSVs share a name', async () => {
    const data = await readLooseFiles(
      [file('Teacher.csv', csv('1,2,0')), file('Teacher.csv', csv('3,4,0'))],
      null
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher', 'Teacher'])
  })

  it('skips unreadable CSVs and reports them', async () => {
    const data = await readLooseFiles(
      [file('Teacher.csv', csv('1,2,0')), file('Broken.csv', 'lat,lon\n1,2')],
      null
    )
    expect(data.paths.map((p) => p.name)).toEqual(['Teacher'])
    expect(data.skipped).toEqual(['Broken.csv'])
  })

  it('rejects a selection with no readable CSVs', async () => {
    await expect(readLooseFiles([file('Broken.csv', 'lat,lon\n1,2')], null)).rejects.toBeInstanceOf(
      ImportError
    )
  })

  it('rejects an empty selection', async () => {
    await expect(readLooseFiles([], null)).rejects.toBeInstanceOf(ImportError)
  })
})

describe('readMondrianZip', () => {
  const blob = (entries: Record<string, string>) =>
    new Blob([zipSync(files(entries)) as Uint8Array<ArrayBuffer>])

  // The bytes come back so the archive importer does not have to read the file again.
  it('routes a session archive without reading it as data', async () => {
    const result = await readMondrianZip(blob({ 'session.json': '{}' }))
    expect(result.kind).toBe('session')
    expect(result.kind === 'session' && result.bytes.byteLength).toBeGreaterThan(0)
  })

  it('reads a data export', async () => {
    const result = await readMondrianZip(blob({ 'Teacher.csv': csv('1,2,0') }))
    expect(result.kind).toBe('data')
  })

  it('rejects a file that is not a ZIP', async () => {
    await expect(readMondrianZip(new Blob(['not a zip']))).rejects.toBeInstanceOf(ImportError)
  })
})

// The trip is lossy on purpose: export resamples onto the sample-rate grid and rounds
// x/y to 2 decimals, so this pins the resampled values rather than the originals.
describe('round trip', () => {
  const path = (pathId: number, times: number[], name?: string) => ({
    pathId,
    color: '#f00',
    name,
    points: times.map((time, i) => ({ x: i, y: i * 2, time, pathId })),
  })

  it('imports what a transcription-mode export wrote', async () => {
    const exported = pathCsvFiles([path(1, [0, 0.1, 0.2], 'Teacher'), path(2, [0, 0.1], 'Aide')], {
      isTranscriptionMode: true,
      sampleRate: 10,
      speculateScale: 99,
    })
    const result = await readMondrianZip(
      await zipBlob({ ...exported, 'floor-plan.png': strToU8('png') })
    )
    if (result.kind !== 'data') throw new Error('expected a data export')

    // Path order survives, which keeps each path in its original slot and colour.
    expect(result.data.paths.map((p) => p.name)).toEqual(['Teacher', 'Aide'])
    expect(result.data.paths.map((p) => p.points.map((pt) => [pt.x, pt.y, pt.time]))).toEqual([
      [
        [0, 0, 0],
        [1, 2, 0.1],
        [2, 4, 0.2],
      ],
      [
        [0, 0, 0],
        [1, 2, 0.1],
      ],
    ])
  })

  // Speculate exports are stretched to the chosen duration, and the importer reads those
  // stretched times verbatim, which is what keeps the imported paths self-consistent.
  it('keeps the stretched times of a Speculate-mode export', async () => {
    const exported = pathCsvFiles([path(1, [0, 1])], {
      isTranscriptionMode: false,
      sampleRate: 1,
      speculateScale: 2,
    })
    const result = await readMondrianZip(await zipBlob(exported))
    if (result.kind !== 'data') throw new Error('expected a data export')

    expect(result.data.paths[0].points.map((p) => p.time)).toEqual([0, 1, 2])
  })
})
