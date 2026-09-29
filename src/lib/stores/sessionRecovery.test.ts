import { describe, expect, it } from 'vitest'
import { getSessionAge, hasRecordedData } from './sessionRecovery'

const DAY_MS = 24 * 60 * 60 * 1000

describe('getSessionAge', () => {
  it('has no cutoff: multi-day sessions are still reported, not bucketed', () => {
    const now = Date.now()
    expect(getSessionAge(now - 25 * 60 * 60 * 1000)).toBe('1 day ago')
    expect(getSessionAge(now - 3 * DAY_MS)).toBe('3 days ago')
    expect(getSessionAge(now - 10 * DAY_MS)).toBe('10 days ago')
  })
})

describe('hasRecordedData', () => {
  it('is true only when at least one path has recorded points', () => {
    expect(hasRecordedData([])).toBe(false)
    expect(hasRecordedData([{ pathId: 1, color: '#fff', points: [] }])).toBe(false)
    expect(
      hasRecordedData([{ pathId: 1, color: '#fff', points: [{ x: 0, y: 0, time: 0, pathId: 1 }] }])
    ).toBe(true)
  })
})
