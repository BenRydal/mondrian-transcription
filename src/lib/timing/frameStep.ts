export const FALLBACK_FRAME_DURATION = 1 / 30
const MIN_FRAME_DURATION = 1 / 240
const MAX_SAMPLES = 60

/** Estimates frame duration from requestVideoFrameCallback metadata. */
export class FrameRateEstimator {
  private last: { mediaTime: number; presentedFrames: number } | null = null
  private samples: number[] = []
  displayedTime: number | null = null

  sample(mediaTime: number, presentedFrames: number) {
    const last = this.last
    if (last) {
      const frames = presentedFrames - last.presentedFrames
      const d = (mediaTime - last.mediaTime) / frames
      // Dropped frames only lengthen a gap, so the shortest recent gap is the frame duration.
      if (frames > 0 && d >= MIN_FRAME_DURATION && d <= 1) {
        this.samples.push(d)
        if (this.samples.length > MAX_SAMPLES) this.samples.shift()
      }
    }
    this.last = { mediaTime, presentedFrames }
    this.displayedTime = mediaTime
  }

  get frameDuration(): number {
    return this.samples.length > 0 ? Math.min(...this.samples) : FALLBACK_FRAME_DURATION
  }
}

/** Start time of the frame on screen: the reported one if it matches currentTime, else the grid. */
export function currentFrameStart(
  currentTime: number,
  frameDuration: number,
  displayedTime: number | null
): number {
  if (displayedTime !== null && Math.abs(currentTime - displayedTime) < frameDuration / 2) {
    return displayedTime
  }
  return Math.floor(currentTime / frameDuration + 1e-6) * frameDuration
}

/** Seek target for `frames` frames away, aimed mid-frame so rounding can't land on a neighbour. */
export function frameStepTarget(
  frameStart: number,
  frameDuration: number,
  frames: number,
  duration: number
): number {
  const target = frameStart + (frames + 0.5) * frameDuration
  return Math.min(Math.max(target, frameDuration / 2), duration)
}

/** Feed an estimator from every presented frame; returns a stop function. */
export function watchVideoFrames(video: HTMLVideoElement, estimator: FrameRateEstimator) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return () => {}
  let handle = 0
  let stopped = false
  const onFrame: VideoFrameRequestCallback = (_now, meta) => {
    if (stopped) return
    estimator.sample(meta.mediaTime, meta.presentedFrames)
    handle = video.requestVideoFrameCallback(onFrame)
  }
  handle = video.requestVideoFrameCallback(onFrame)
  return () => {
    stopped = true
    video.cancelVideoFrameCallback(handle)
  }
}
