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

// IGS uses the file name as the person's name, so names stay plain and only
// collisions get a suffix; the preview calls this too so it matches the ZIP.
export function exportFileNames(paths: readonly Pick<PathData, 'name' | 'points'>[]): string[] {
  const taken = new Set<string>()
  return paths.map((path, index) => {
    if (path.points.length === 0) return ''
    const base = path.name?.trim().replace(/[/\\:*?"<>|]/g, '_') || `path-${index + 1}`
    let name = base
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}-${n}`
    taken.add(name.toLowerCase())
    return `${name}.csv`
  })
}

export function pathCsvFiles(paths: readonly PathData[], options: ExportOptions) {
  const scale = options.isTranscriptionMode
    ? 1
    : sessionScale(
        paths.map((path) => path.points),
        options.speculateScale
      )
  const encoder = new TextEncoder()
  const names = exportFileNames(paths)
  const files: Record<string, Uint8Array> = {}
  paths.forEach((path, index) => {
    if (path.points.length === 0) return
    const rows = resamplePath(path.points, { rate: options.sampleRate, scale })
    const csv = rows
      .map((p) => `${p.x.toFixed(COORD_DECIMALS)},${p.y.toFixed(COORD_DECIMALS)},${p.time}`)
      .join('\n')
    files[names[index]] = encoder.encode(`x,y,time\n${csv}`)
  })
  return files
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
}
