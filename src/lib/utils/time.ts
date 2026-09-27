const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const tenths = Math.floor(seconds * 10 + 1e-6)
  const rest = tenths % 600
  return `${Math.floor(tenths / 600)}:${pad2(Math.floor(rest / 10))}.${rest % 10}`
}

export function formatHms(seconds: number): string {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const ss = pad2(total % 60)
  return h > 0 ? `${h}:${pad2(m)}:${ss}` : `${m}:${ss}`
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}
