import { describe, expect, it } from 'vitest'
import {
  FALLBACK_FRAME_DURATION,
  FrameRateEstimator,
  currentFrameStart,
  frameStepTarget,
} from './frameStep'

describe('FrameRateEstimator', () => {
  it('falls back to 1/30 s before any frames are seen', () => {
    expect(new FrameRateEstimator().frameDuration).toBe(FALLBACK_FRAME_DURATION)
  })

  it('finds the frame duration even when frames are dropped', () => {
    const est = new FrameRateEstimator()
    const fd = 1 / 25
    let presented = 0
    for (let frame = 0; frame < 50; frame += frame % 3 === 0 ? 2 : 1) {
      est.sample(frame * fd, presented++)
    }
    expect(est.frameDuration).toBeCloseTo(fd, 9)
  })

  it('ignores seeks backwards', () => {
    const est = new FrameRateEstimator()
    est.sample(5, 10)
    est.sample(1, 11)
    expect(est.frameDuration).toBe(FALLBACK_FRAME_DURATION)
  })
})

describe('currentFrameStart', () => {
  const fd = 1 / 30
  it('uses the displayed frame time when it matches currentTime', () => {
    expect(currentFrameStart(1.01, fd, 1.0)).toBe(1.0)
  })

  it('snaps to the frame grid when the displayed time is stale', () => {
    expect(currentFrameStart(10 * fd + fd / 2, fd, 2 * fd)).toBeCloseTo(10 * fd)
    expect(currentFrameStart(0.1, fd, null)).toBeCloseTo(0.1)
  })
})

describe('frameStepTarget', () => {
  const fd = 1 / 30
  it('aims at the middle of the neighbouring frame', () => {
    expect(frameStepTarget(1, fd, 1, 20)).toBeCloseTo(1 + 1.5 * fd)
    expect(frameStepTarget(1, fd, -1, 20)).toBeCloseTo(1 - 0.5 * fd)
  })

  it('stays within the video', () => {
    expect(frameStepTarget(0, fd, -1, 20)).toBeCloseTo(fd / 2)
    expect(frameStepTarget(20, fd, 1, 20)).toBe(20)
  })
})
