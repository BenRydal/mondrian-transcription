import { MediaClock } from '$lib/timing/clock'
import { clamp } from '$lib/utils/math'
import type { VideoEvent, VideoSource } from './source'

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

const YOUTUBE_FRAME_STEP = 1 / 30
const API_URL = 'https://www.youtube.com/iframe_api'
const API_TIMEOUT_MS = 15_000
const MAX_EXTRAPOLATION_BETWEEN_POLLS = 1
const SEEK_TOLERANCE = 0.25
const SEEK_HOLD_MS = 1500

export interface YTPlayerLike {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  destroy(): void
}

export interface YTPlayerEvents {
  onReady(): void
  onStateChange(state: number): void
  onPlaybackRateChange(rate: number): void
  onError(code: number): void
}

type PlayerFactory = (
  host: HTMLElement,
  videoId: string,
  events: YTPlayerEvents
) => Promise<YTPlayerLike>

class YouTubeUnavailableError extends Error {}

type YTNamespace = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayerLike
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }

let apiPromise: Promise<YTNamespace> | null = null

function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as YTWindow
  if (w.YT?.Player) return Promise.resolve(w.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const fail = () => {
      apiPromise = null
      reject(
        new YouTubeUnavailableError(
          'YouTube could not be reached. You may be offline, or YouTube is blocked on this network.'
        )
      )
    }
    const timer = setTimeout(fail, API_TIMEOUT_MS)
    const previous = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      previous?.()
      clearTimeout(timer)
      if (w.YT?.Player) resolve(w.YT)
      else fail()
    }
    const script = document.createElement('script')
    script.src = API_URL
    script.async = true
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      fail()
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

const createIframePlayer: PlayerFactory = async (host, videoId, events) => {
  const YT = await loadYouTubeApi()
  const target = document.createElement('div')
  host.replaceChildren(target)
  return new YT.Player(target, {
    videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      rel: 0,
      fs: 0,
      iv_load_policy: 3,
      origin: window.location.origin,
    },
    events: {
      onReady: () => events.onReady(),
      onStateChange: (e: { data: number }) => events.onStateChange(e.data),
      onPlaybackRateChange: (e: { data: number }) => events.onPlaybackRateChange(e.data),
      onError: (e: { data: number }) => events.onError(e.data),
    },
  })
}

function youtubeErrorMessage(code: number): string {
  switch (code) {
    case 101:
    case 150:
    case 152:
      return "YouTube won't play this video here: embedding is off, or YouTube wants you to sign in first."
    case 153:
      return 'YouTube refused to play this video because the page sent no referrer.'
    case 100:
      return 'This video is no longer available on YouTube.'
    case 2:
      return 'This YouTube video link is not valid.'
    default:
      return 'YouTube could not play this video.'
  }
}

interface YouTubeSourceOptions {
  videoId: string
  host: HTMLElement
  startTime?: number
  createPlayer?: PlayerFactory
  now?: () => number
}

export class YouTubeVideoSource implements VideoSource {
  readonly kind = 'youtube'
  readonly fixedFrameStep = YOUTUBE_FRAME_STEP
  readonly videoId: string
  error: string | null = null

  private host: HTMLElement

  private player: YTPlayerLike | null = null
  private ready = false
  private destroyed = false
  private state: number = YT_STATE.UNSTARTED
  private isPaused = true
  private rate = 1
  private rates: number[] | null = null
  private knownDuration = NaN
  private startTime: number
  private seekTarget: number | null = null
  private seekAt = 0
  private clock = new MediaClock(MAX_EXTRAPOLATION_BETWEEN_POLLS)
  private events = new EventTarget()
  private now: () => number
  private settleReady!: (error?: Error) => void
  private whenReady = new Promise<void>((resolve, reject) => {
    this.settleReady = (error) => (error ? reject(error) : resolve())
  })

  constructor(opts: YouTubeSourceOptions) {
    this.videoId = opts.videoId
    this.host = opts.host
    this.whenReady.catch(() => {})
    this.startTime = Math.max(0, opts.startTime ?? 0)
    this.now = opts.now ?? (() => performance.now())
    const create = opts.createPlayer ?? createIframePlayer
    create(opts.host, opts.videoId, {
      onReady: () => this.handleReady(),
      onStateChange: (s) => this.handleState(s),
      onPlaybackRateChange: (r) => {
        this.rate = r
        this.emit('ratechange')
      },
      onError: (code) => {
        console.warn('YouTube player error', code)
        this.fail(youtubeErrorMessage(code))
      },
    }).then(
      (player) => {
        if (this.destroyed) player.destroy()
        else this.player = player
      },
      (e) => this.fail(e instanceof Error ? e.message : String(e))
    )
  }

  get isReady() {
    return this.ready
  }

  get duration() {
    return this.knownDuration
  }

  get paused() {
    return this.isPaused
  }

  get playbackRate() {
    return this.rate
  }
  set playbackRate(rate: number) {
    const target = this.nearestRate(rate)
    if (target === this.rate) return
    this.rate = target
    this.call((p) => p.setPlaybackRate(target))
    this.emit('ratechange')
  }

  get currentTime(): number {
    if (!this.player || !this.ready) return this.seekTarget ?? this.startTime
    const now = this.now()
    let reported = this.call((p) => p.getCurrentTime()) ?? 0
    if (this.seekTarget !== null) {
      const landed = Math.abs(reported - this.seekTarget) < SEEK_TOLERANCE
      if (landed || now - this.seekAt > SEEK_HOLD_MS) this.seekTarget = null
      else reported = this.seekTarget
    }
    this.refreshDuration()
    const advancing = !this.isPaused && this.state === YT_STATE.PLAYING
    if (!advancing) this.clock.reset()
    this.clock.observe(reported, now, advancing, this.rate)
    const t = this.clock.timeAt(now)
    return this.knownDuration > 0 ? Math.min(t, this.knownDuration) : t
  }
  set currentTime(time: number) {
    const max = this.knownDuration > 0 ? this.knownDuration : Infinity
    const target = clamp(time, 0, max)
    this.seekTarget = target
    this.seekAt = this.now()
    this.clock.reset()
    if (this.ready) this.call((p) => p.seekTo(target, true))
    else this.startTime = target
    this.emit('seeked')
    this.emit('timeupdate')
  }

  play(): Promise<void> {
    if (this.error) return Promise.reject(new Error(this.error))
    if (this.isPaused) {
      this.isPaused = false
      this.clock.reset()
      this.emit('play')
    }
    return this.whenReady.then(() => {
      if (!this.isPaused) this.call((p) => p.playVideo())
    })
  }

  pause() {
    this.call((p) => p.pauseVideo())
    if (!this.isPaused) this.markPaused()
  }

  supportsRate(rate: number) {
    return this.rates === null || this.rates.includes(rate)
  }

  addEventListener(type: VideoEvent, listener: () => void, options?: AddEventListenerOptions) {
    this.events.addEventListener(type, listener, options)
  }
  removeEventListener(type: VideoEvent, listener: () => void) {
    this.events.removeEventListener(type, listener)
  }

  destroy() {
    this.destroyed = true
    this.call((p) => p.destroy())
    this.player = null
    this.host.replaceChildren()
  }

  private handleReady() {
    if (this.destroyed) return
    this.ready = true
    const rates = this.call((p) => p.getAvailablePlaybackRates())
    this.rates = rates && rates.length > 0 ? rates : null
    const wanted = this.nearestRate(this.rate)
    this.rate = wanted
    if (wanted !== 1) this.call((p) => p.setPlaybackRate(wanted))
    if (this.startTime > 0) this.currentTime = this.startTime
    this.refreshDuration()
    this.settleReady()
    this.emit('loadedmetadata')
    this.emit('loadeddata')
    this.emit('ratechange')
    this.emit('timeupdate')
  }

  private handleState(state: number) {
    this.state = state
    this.refreshDuration()
    const startedWithoutAsking = state === YT_STATE.PLAYING && this.isPaused
    if (startedWithoutAsking) this.call((p) => p.pauseVideo())
    if ((state === YT_STATE.PAUSED || state === YT_STATE.ENDED) && !this.isPaused) {
      this.markPaused()
    }
    if (state === YT_STATE.ENDED) this.emit('ended')
    this.emit('timeupdate')
  }

  private markPaused() {
    this.isPaused = true
    this.clock.reset()
    this.emit('pause')
  }

  private refreshDuration() {
    const d = this.call((p) => p.getDuration())
    if (d && d > 0 && d !== this.knownDuration) {
      this.knownDuration = d
      this.emit('durationchange')
    }
  }

  private nearestRate(rate: number) {
    if (!this.rates || this.rates.includes(rate)) return rate
    return this.rates.reduce((a, b) => (Math.abs(b - rate) < Math.abs(a - rate) ? b : a))
  }

  private fail(message: string) {
    if (this.destroyed || this.error) return
    this.error = message
    this.isPaused = true
    this.settleReady(new Error(message))
    this.emit('error')
  }

  private call<T>(fn: (p: YTPlayerLike) => T): T | undefined {
    if (!this.player) return undefined
    try {
      return fn(this.player)
    } catch (e) {
      console.warn('YouTube player call failed:', e)
      return undefined
    }
  }

  private emit(type: VideoEvent) {
    queueMicrotask(() => {
      if (!this.destroyed) this.events.dispatchEvent(new Event(type))
    })
  }
}
