import { describe, expect, it } from 'vitest'
import { dataUrlBytes, exportFileName, pathCsvFiles } from './pathExport'

const path = (pathId: number, times: number[], name?: string) => ({
  pathId,
  color: '#f00',
  name,
  points: times.map((time, i) => ({ x: i, y: i * 2, time, pathId })),
})

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
    expect(new TextDecoder().decode(files['B.csv'])).toBe('x,y,time\n0,0,0\n1,2,0.1')
  })

  it('scales Speculate paths so the session ends at the chosen duration', () => {
    const files = pathCsvFiles([path(1, [0, 1])], {
      isTranscriptionMode: false,
      sampleRate: 1,
      speculateScale: 2,
    })
    expect(new TextDecoder().decode(files['path-1.csv'])).toBe('x,y,time\n0,0,0\n0.5,1,1\n1,2,2')
  })
})

describe('dataUrlBytes', () => {
  it('decodes the base64 payload', () => {
    expect([...dataUrlBytes('data:image/png;base64,AAEC/w==')]).toEqual([0, 1, 2, 255])
  })
})
