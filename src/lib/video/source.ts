export type VideoEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'seeked'
  | 'timeupdate'
  | 'loadedmetadata'
  | 'durationchange'
  | 'ratechange'
  | 'error'

/** The playback surface the media clock, controls and recording share, whatever plays the video. */
export interface VideoSource {
  readonly kind: 'local' | 'youtube'
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  playbackRate: number
  /** Seconds per arrow-key step when frames can't be observed; null means estimate from frames. */
  readonly fixedFrameStep: number | null
  play(): Promise<void>
  pause(): void
  supportsRate(rate: number): boolean
  addEventListener(type: VideoEvent, listener: () => void, options?: AddEventListenerOptions): void
  removeEventListener(type: VideoEvent, listener: () => void): void
  destroy(): void
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
    // load() resets playbackRate to defaultPlaybackRate, so set both.
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
