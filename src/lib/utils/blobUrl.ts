/**
 * Owns one object URL at a time.
 *
 * The browser keeps a blob alive until its URL is revoked, whether or not anything still
 * references it. Creating through `set` releases the previous URL, so replacing a video or
 * floor plan cannot accumulate — the pairing is enforced here rather than at each caller.
 */
export function blobUrlSlot() {
  let url: string | null = null
  return {
    set(blob: Blob): string {
      if (url) URL.revokeObjectURL(url)
      url = URL.createObjectURL(blob)
      return url
    },
    clear() {
      if (url) URL.revokeObjectURL(url)
      url = null
    },
  }
}
