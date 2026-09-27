export interface RetentionEntry {
  id: number
  savedAt: number
  pinned: boolean
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const RETENTION_TIERS: ReadonlyArray<{ maxAgeBelow: number; bucketWidth: number }> = [
  { maxAgeBelow: MINUTE, bucketWidth: 0 },
  { maxAgeBelow: 15 * MINUTE, bucketWidth: MINUTE },
  { maxAgeBelow: 2 * HOUR, bucketWidth: 10 * MINUTE },
  { maxAgeBelow: 7 * DAY, bucketWidth: HOUR },
  { maxAgeBelow: Infinity, bucketWidth: DAY },
]

function bucketWidth(age: number): number {
  return RETENTION_TIERS.find((t) => age < t.maxAgeBelow)!.bucketWidth
}

const isNewer = (a: RetentionEntry, b: RetentionEntry) =>
  a.savedAt !== b.savedAt ? a.savedAt > b.savedAt : a.id > b.id

export function selectRetained(entries: readonly RetentionEntry[], now: number): Set<number> {
  const keep = new Set<number>()
  let newestId = -Infinity
  const buckets = new Map<string, RetentionEntry>()
  for (const entry of entries) {
    newestId = Math.max(newestId, entry.id)
    if (entry.pinned) {
      keep.add(entry.id)
      continue
    }
    const width = bucketWidth(Math.max(0, now - entry.savedAt))
    if (width === 0) {
      keep.add(entry.id)
      continue
    }
    const epochBucket = Math.floor(entry.savedAt / width)
    const key = `${width}:${epochBucket}`
    const current = buckets.get(key)
    if (!current || isNewer(entry, current)) buckets.set(key, entry)
  }
  for (const entry of buckets.values()) keep.add(entry.id)
  if (Number.isFinite(newestId)) keep.add(newestId)
  return keep
}
