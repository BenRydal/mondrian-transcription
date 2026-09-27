import { describe, expect, it } from 'vitest'
import { MediaClock, SessionClock } from './clock'

describe('SessionClock', () => {
  it('stays at 0 until started', () => {
    const clock = new SessionClock()
    expect(clock.running).toBe(false)
    expect(clock.timeAt(1234)).toBe(0)
  })

  it('advances with performance time while running and freezes when paused', () => {
    const clock = new SessionClock()
    clock.start(1000)
    expect(clock.timeAt(1500)).toBeCloseTo(0.5)
    clock.pause(2000)
    expect(clock.running).toBe(false)
    expect(clock.timeAt(9000)).toBeCloseTo(1)
    clock.start(10000)
    expect(clock.timeAt(10250)).toBeCloseTo(1.25)
  })

  it('never reports time before the start of a take', () => {
    const clock = new SessionClock()
    clock.seek(2, 0)
    clock.start(1000)
    expect(clock.timeAt(990)).toBe(2)
  })

  it('seeks while paused and while running', () => {
    const clock = new SessionClock()
    clock.seek(5, 0)
    expect(clock.timeAt(100)).toBe(5)
    clock.start(1000)
    clock.seek(1, 1500)
    expect(clock.timeAt(2000)).toBeCloseTo(1.5)
    clock.seek(-3, 2000)
    expect(clock.timeAt(2000)).toBe(0)
  })

  it('applies playback rate from the moment it changes', () => {
    const clock = new SessionClock()
    clock.start(0)
    clock.setRate(2, 1000)
    expect(clock.timeAt(1500)).toBeCloseTo(2)
  })
})

describe('MediaClock', () => {
  it('gives distinct increasing times to events between video frames', () => {
    const clock = new MediaClock()
    clock.observe(10, 1000, true, 1)
    const times = [1000, 1004, 1008, 1012, 1016].map((ms) => clock.timeAt(ms))
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
    expect(times[0]).toBeCloseTo(10)
    expect(times[4]).toBeCloseTo(10.016)
  })

  it('never goes backwards within a take when media time lags the extrapolation', () => {
    const clock = new MediaClock()
    clock.observe(10, 1000, true, 1)
    const a = clock.timeAt(1030)
    clock.observe(10.02, 1031, true, 1)
    const b = clock.timeAt(1031)
    expect(b).toBeGreaterThanOrEqual(a)
    const c = clock.timeAt(1060)
    expect(c).toBeGreaterThan(b)
  })

  it('stays monotonic across many jittery observations', () => {
    const clock = new MediaClock()
    let last = -Infinity
    for (let frame = 0; frame < 200; frame++) {
      const perf = frame * 16.7
      const media = Math.floor((perf / 1000) * 30) / 30
      clock.observe(media, perf, true, 1)
      for (let e = 0; e < 4; e++) {
        const t = clock.timeAt(perf + e * 4 + (frame % 3))
        expect(t).toBeGreaterThanOrEqual(last)
        last = t
      }
    }
  })

  it('holds media time while paused and scales with playback rate', () => {
    const clock = new MediaClock()
    clock.observe(4, 0, false, 1)
    expect(clock.timeAt(500)).toBe(4)
    clock.observe(4, 600, true, 2)
    expect(clock.timeAt(700)).toBeCloseTo(4.2)
  })

  it('never reports a time before the observed media time', () => {
    const clock = new MediaClock()
    clock.observe(0, 1000, true, 1)
    expect(clock.timeAt(995)).toBe(0)
  })

  it('caps extrapolation when the video stalls', () => {
    const clock = new MediaClock()
    clock.observe(1, 0, true, 1)
    expect(clock.timeAt(5000)).toBeCloseTo(1.25)
  })

  it('allows earlier times after reset, for a new take after a seek', () => {
    const clock = new MediaClock()
    clock.observe(20, 0, true, 1)
    clock.timeAt(10)
    clock.reset()
    clock.observe(5, 100, true, 1)
    expect(clock.timeAt(100)).toBeCloseTo(5)
  })
})
