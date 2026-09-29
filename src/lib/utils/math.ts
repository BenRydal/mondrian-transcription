export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function expDecay(dt: number, tau: number): number {
  return Math.exp(-Math.max(0, dt) / tau)
}
