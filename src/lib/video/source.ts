export type VideoEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'seeked'
  | 'timeupdate'
  | 'loadedmetadata'
  | 'loadeddata'
  | 'durationchange'
  | 'ratechange'
  | 'error'

export interface VideoSource {
  readonly kind: 'local' | 'youtube'
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  playbackRate: number
  readonly fixedFrameStep: number | null
  play(): Promise<void>
  pause(): void
  supportsRate(rate: number): boolean
  addEventListener(type: VideoEvent, listener: () => void, options?: AddEventListenerOptions): void
  removeEventListener(type: VideoEvent, listener: () => void): void
  destroy(): void
}

const END_TOLERANCE = 0.1

export function isAtVideoEnd(video: VideoSource): boolean {
  return video.currentTime >= video.duration - END_TOLERANCE
}

export class LocalVideoSource implements VideoSource {
  readonly kind = 'local'
  readonly fixedFrameStep = null

  constructor(readonly element: HTMLVideoElement) {}

  get currentTime() {
    return this.element.currentTime
  }
  set currentTime(time: number) {
    this.element.currentTime = time
  }
  get duration() {
    return this.element.duration
  }
  get paused() {
    return this.element.paused
  }
  get playbackRate() {
    return this.element.playbackRate
  }
  set playbackRate(rate: number) {
    this.element.defaultPlaybackRate = rate
    this.element.playbackRate = rate
  }

  play() {
    return this.element.play()
  }
  pause() {
    this.element.pause()
  }
  supportsRate() {
    return true
  }
  addEventListener(type: VideoEvent, listener: () => void, options?: AddEventListenerOptions) {
    this.element.addEventListener(type, listener, options)
  }
  removeEventListener(type: VideoEvent, listener: () => void) {
    this.element.removeEventListener(type, listener)
  }
  destroy() {
    this.element.pause()
    this.element.currentTime = 0
  }
}
