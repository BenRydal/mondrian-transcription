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
  it('uses the path name, else its position', () => {
    expect(exportFileName({ name: 'Teacher' }, 0)).toBe('Teacher.csv')
    expect(exportFileName({ name: '' }, 2)).toBe('path-3.csv')
  })
})

describe('pathCsvFiles', () => {
  it('writes one resampled CSV per recorded path', () => {
    const files = pathCsvFiles([path(1, [0, 0.2]), path(2, []), path(3, [0, 0.1], 'B')], {
      isTranscriptionMode: true,
      sampleRate: 10,
      speculateScale: 99,
    })
    expect(Object.keys(files)).toEqual(['path-1.csv', 'B.csv'])
    expect(new TextDecoder().decode(files['B.csv'])).toBe('x,y,time\n0.00,0.00,0\n1.00,2.00,0.1')
  })

  it('scales Speculate paths so the session ends at the chosen duration', () => {
    const files = pathCsvFiles([path(1, [0, 1])], {
      isTranscriptionMode: false,
      sampleRate: 1,
      speculateScale: 2,
    })
    expect(new TextDecoder().decode(files['path-1.csv'])).toBe(
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
    expect(csvRows(files, 'path-1.csv')).toEqual([
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
