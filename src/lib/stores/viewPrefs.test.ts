import { describe, expect, it } from 'vitest'
import { PLAYBACK_RATES, sanitizeViewPrefs, stepPlaybackRate } from './viewPrefs'

describe('stepPlaybackRate', () => {
  it('moves one step through the list', () => {
    expect(stepPlaybackRate(1, -1)).toBe(0.75)
    expect(stepPlaybackRate(0.5, 1)).toBe(0.75)
  })

  it('clamps at the slowest and fastest rates', () => {
    expect(stepPlaybackRate(PLAYBACK_RATES[0], -1)).toBe(PLAYBACK_RATES[0])
    expect(stepPlaybackRate(PLAYBACK_RATES.at(-1)!, 1)).toBe(PLAYBACK_RATES.at(-1))
  })

  it('skips rates the video source does not support', () => {
    const allowed = (r: number) => [0.5, 1, 2].includes(r)
    expect(stepPlaybackRate(1, -1, allowed)).toBe(0.5)
    expect(stepPlaybackRate(1, 1, allowed)).toBe(2)
    expect(stepPlaybackRate(0.75, 1, allowed)).toBe(1)
    expect(stepPlaybackRate(0.75, -1, allowed)).toBe(0.5)
  })
})

describe('sanitizeViewPrefs', () => {
  it('keeps valid values and replaces invalid ones with defaults', () => {
    expect(sanitizeViewPrefs({ playbackRate: 0.5 }).playbackRate).toBe(0.5)
    expect(sanitizeViewPrefs({ playbackRate: 7 }).playbackRate).toBe(1)
    expect(sanitizeViewPrefs('junk').playbackRate).toBe(1)
    expect(sanitizeViewPrefs({ recordingMode: 'hold' }).recordingMode).toBe('hold')
    expect(sanitizeViewPrefs({ recordingMode: 'drag' }).recordingMode).toBe('toggle')
    expect(sanitizeViewPrefs({ trailSeconds: 0 }).trailSeconds).toBe(0)
    expect(sanitizeViewPrefs({ trailSeconds: 4 }).trailSeconds).toBe(3)
  })
})
