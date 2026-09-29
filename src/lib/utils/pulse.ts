const PULSE_RADIANS_PER_MS = 0.003

export function pulseScale(ms: number | null): number {
  return ((ms === null ? 0 : Math.sin(ms * PULSE_RADIANS_PER_MS)) + 1) * 0.25 + 0.5
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export function pulseClock(
  animate: boolean,
  reducedMotion = prefersReducedMotion()
): number | null {
  return animate && !reducedMotion ? performance.now() : null
}
