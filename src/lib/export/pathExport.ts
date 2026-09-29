import type { PathData } from '$lib/stores/drawingState'
import { resamplePath, sessionScale } from '$lib/timing/sampling'

const COORD_DECIMALS = 2

export const EXPORT_ZIP_NAME = 'transcription-export.zip'
export const FLOOR_PLAN_FILE = 'floor-plan.png'

interface ExportOptions {
  isTranscriptionMode: boolean
  sampleRate: number
  speculateScale: number
}

// The index prefix makes every name unique by construction, so two paths sharing a
// name can no longer overwrite each other in the ZIP. It also keeps this function pure,
// which is what lets the export preview show the same names the ZIP will contain.
export function exportFileName(path: Pick<PathData, 'name'>, index: number): string {
  const name = path.name?.replace(/[/\\:*?"<>|]/g, '_') || 'path'
  return `${String(index + 1).padStart(2, '0')}-${name}.csv`
}

export function pathCsvFiles(paths: readonly PathData[], options: ExportOptions) {
  const scale = options.isTranscriptionMode
    ? 1
    : sessionScale(
        paths.map((path) => path.points),
        options.speculateScale
      )
  const encoder = new TextEncoder()
  const files: Record<string, Uint8Array> = {}
  paths.forEach((path, index) => {
    if (path.points.length === 0) return
    const rows = resamplePath(path.points, { rate: options.sampleRate, scale })
    const csv = rows
      .map((p) => `${p.x.toFixed(COORD_DECIMALS)},${p.y.toFixed(COORD_DECIMALS)},${p.time}`)
      .join('\n')
    files[exportFileName(path, index)] = encoder.encode(`x,y,time\n${csv}`)
  })
  return files
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
}
