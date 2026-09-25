/// <reference types="vite/client" />
// Cross-origin handoff: IGS opened with ?import=mondrian posts "ready" to its opener,
// and Mondrian answers with the files, addressed to IGS's origin only.
export const IGS_URL: string =
  import.meta.env.VITE_IGS_URL ?? 'https://www.interactiongeography.org'
export const HANDOFF_VERSION = 1

export type HandoffMessage =
  | { type: 'igs:ready'; version: number }
  | { type: 'igs:received'; version: number }
  | { type: 'mondrian:files'; version: number; files: File[] }

export type HandoffResult = 'sent' | 'blocked' | 'timeout'

/** Must run inside the click handler, or the browser blocks the new tab. */
export function openIgs(): Window | null {
  const url = new URL(IGS_URL)
  url.searchParams.set('import', 'mondrian')
  return window.open(url, '_blank')
}

/** Sends the files once the IGS tab says it is ready; 'sent' only when IGS confirms it took them. */
export function sendWhenReady(
  igs: Window | null,
  files: Promise<File[]>,
  timeoutMs = 20000
): Promise<HandoffResult> {
  if (!igs) return Promise.resolve('blocked')
  const igsOrigin = new URL(IGS_URL).origin

  return new Promise((resolve) => {
    const finish = (result: HandoffResult) => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(result)
    }

    let posted = false
    const onMessage = async (event: MessageEvent) => {
      const data = event.data as HandoffMessage | undefined
      if (event.source !== igs || event.origin !== igsOrigin) return
      if (data?.type === 'igs:received') return finish('sent')
      if (data?.type !== 'igs:ready' || posted) return
      posted = true
      const message: HandoffMessage = {
        type: 'mondrian:files',
        version: HANDOFF_VERSION,
        files: await files,
      }
      igs.postMessage(message, igsOrigin)
    }

    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    window.addEventListener('message', onMessage)
  })
}

/** The export's bytes as Files IGS's importer understands, plus the video when one is loaded. */
export function toFiles(exported: Record<string, Uint8Array>, video: File | null): File[] {
  const files = Object.entries(exported).map(
    ([name, bytes]) =>
      new File([new Uint8Array(bytes)], name, {
        type: name.endsWith('.png') ? 'image/png' : 'text/csv',
      })
  )
  return video ? [...files, video] : files
}
