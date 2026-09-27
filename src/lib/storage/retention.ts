export interface RetentionEntry {
  id: number
  savedAt: number
  pinned: boolean
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Age limit (exclusive) and bucket width for each tier, youngest first. */
export const RETENTION_TIERS: ReadonlyArray<{ maxAge: number; bucket: number }> = [
  { maxAge: MINUTE, bucket: 0 },
  { maxAge: 15 * MINUTE, bucket: MINUTE },
  { maxAge: 2 * HOUR, bucket: 10 * MINUTE },
  { maxAge: 7 * DAY, bucket: HOUR },
  { maxAge: Infinity, bucket: DAY },
]

function bucketWidth(age: number): number {
  return RETENTION_TIERS.find((t) => age < t.maxAge)!.bucket
}

const isNewer = (a: RetentionEntry, b: RetentionEntry) =>
  a.savedAt !== b.savedAt ? a.savedAt > b.savedAt : a.id > b.id

/**
 * Ids to keep: every pinned entry, the newest entry by id, everything under a minute old
 * (including future timestamps from clock skew), and the newest entry per tier bucket.
 */
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
    // Buckets are anchored to the epoch, so they nest and thinning is stable over time.
    const key = `${width}:${Math.floor(entry.savedAt / width)}`
    const current = buckets.get(key)
    if (!current || isNewer(entry, current)) buckets.set(key, entry)
  }
  for (const entry of buckets.values()) keep.add(entry.id)
  if (Number.isFinite(newestId)) keep.add(newestId)
  return keep
}
