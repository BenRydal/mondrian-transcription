import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, formatHms } from './time'

describe('formatClock', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatClock(0)).toBe('0:00.0')
    expect(formatClock(3.14)).toBe('0:03.1')
    expect(formatClock(125.25)).toBe('2:05.2')
    expect(formatClock(0.3)).toBe('0:00.3')
  })

  it('truncates rather than rounding up into the next minute', () => {
    expect(formatClock(59.96)).toBe('0:59.9')
    expect(formatClock(60)).toBe('1:00.0')
  })

  it('shows zero for missing or negative times', () => {
    expect(formatClock(NaN)).toBe('0:00.0')
    expect(formatClock(-2)).toBe('0:00.0')
  })
})

describe('formatHms', () => {
  it('floors to whole seconds and adds hours only when needed', () => {
    expect(formatHms(0)).toBe('0:00')
    expect(formatHms(75.9)).toBe('1:15')
    expect(formatHms(3725)).toBe('1:02:05')
  })
})

describe('formatDuration', () => {
  it('rounds to whole seconds and keeps counting minutes past an hour', () => {
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(4500)).toBe('75:00')
  })
})
