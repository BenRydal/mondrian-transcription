import { describe, expect, it } from 'vitest'
import { pulseClock, pulseScale } from './pulse'

describe('pulseScale', () => {
  it('rests at the same size the marker has when not animating', () => {
    expect(pulseScale(null)).toBe(0.75)
    expect(pulseScale(0)).toBe(0.75)
  })

  it('swings between half and full size over time', () => {
    const samples = Array.from({ length: 200 }, (_, i) => pulseScale(i * 20))
    expect(Math.min(...samples)).toBeCloseTo(0.5, 2)
    expect(Math.max(...samples)).toBeCloseTo(1, 2)
  })

  it('peaks a quarter period after the start, whatever the frame rate', () => {
    expect(pulseScale(Math.PI / 2 / 0.003)).toBeCloseTo(1, 6)
  })
})

describe('pulseClock', () => {
  it('stays still when idle or when reduced motion is preferred', () => {
    expect(pulseClock(false, false)).toBeNull()
    expect(pulseClock(true, true)).toBeNull()
    expect(pulseClock(true, false)).toEqual(expect.any(Number))
  })
})
