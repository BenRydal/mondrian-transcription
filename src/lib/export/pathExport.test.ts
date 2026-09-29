import { describe, expect, it } from 'vitest'
import { dataUrlBytes, exportFileName, pathCsvFiles } from './pathExport'

const path = (pathId: number, times: number[], name?: string) => ({
  pathId,
  color: '#f00',
  name,
  points: times.map((time, i) => ({ x: i, y: i * 2, time, pathId })),
})

const csvRows = (files: Record<string, Uint8Array>, name: string) =>
  new TextDecoder().decode(files[name]).split('\n').slice(1)

describe('exportFileName', () => {
  it('prefixes the path index, falling back to a generic name', () => {
    expect(exportFileName({ name: 'Teacher' }, 0)).toBe('01-Teacher.csv')
    expect(exportFileName({ name: '' }, 2)).toBe('03-path.csv')
  })

  it('strips characters that would nest or break the ZIP entry', () => {
    expect(exportFileName({ name: 'a/b\\c' }, 0)).toBe('01-a_b_c.csv')
    expect(exportFileName({ name: 'why?<this>' }, 0)).toBe('01-why__this_.csv')
  })

  // Guards against the strip above being rewritten as an allowlist, which would mangle
  // every name that is not Latin.
  it('keeps non-ASCII names intact', () => {
    expect(exportFileName({ name: '张老师' }, 4)).toBe('05-张老师.csv')
  })
})

describe('pathCsvFiles', () => {
  it('keeps both files when two paths share a name', () => {
    const files = pathCsvFiles([path(1, [0, 0.1], 'Teacher'), path(2, [0, 0.1], 'Teacher')], {
      isTranscriptionMode: true,
      sampleRate: 10,
      speculateScale: 99,
    })
    expect(Object.keys(files)).toEqual(['01-Teacher.csv', '02-Teacher.csv'])
  })

  it('writes one resampled CSV per recorded path', () => {
    const files = pathCsvFiles([path(1, [0, 0.2]), path(2, []), path(3, [0, 0.1], 'B')], {
      isTranscriptionMode: true,
      sampleRate: 10,
      speculateScale: 99,
    })
    expect(Object.keys(files)).toEqual(['01-path.csv', '03-B.csv'])
    expect(new TextDecoder().decode(files['03-B.csv'])).toBe('x,y,time\n0.00,0.00,0\n1.00,2.00,0.1')
  })

  it('scales Speculate paths so the session ends at the chosen duration', () => {
    const files = pathCsvFiles([path(1, [0, 1])], {
      isTranscriptionMode: false,
      sampleRate: 1,
      speculateScale: 2,
    })
    expect(new TextDecoder().decode(files['01-path.csv'])).toBe(
      'x,y,time\n0.00,0.00,0\n0.50,1.00,1\n1.00,2.00,2'
    )
  })

  // x/y are rounded because they carry float noise; time is left alone because the
  // resample grid already produces it exactly, even at the fastest rate.
  it('rounds the coordinates but leaves the time grid untouched', () => {
    const points = [
      { x: 1209.5999999999999, y: 2116.7999999999997, time: 0 },
      { x: 1263.350044997516, y: 2116.738286763841, time: 1 / 60 },
    ].map((p) => ({ ...p, pathId: 1 }))
    const files = pathCsvFiles([{ pathId: 1, color: '#f00', points }], {
      isTranscriptionMode: true,
      sampleRate: 60,
      speculateScale: 99,
    })
    expect(csvRows(files, '01-path.csv')).toEqual([
      '1209.60,2116.80,0',
      '1263.35,2116.74,0.016666666666666666',
    ])
  })
})

describe('dataUrlBytes', () => {
  it('decodes the base64 payload', () => {
    expect([...dataUrlBytes('data:image/png;base64,AAEC/w==')]).toEqual([0, 1, 2, 255])
  })
})
