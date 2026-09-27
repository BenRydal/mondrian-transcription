export class SessionClock {
  private base = 0
  private anchor: number | null = null
  private rate = 1

  get running(): boolean {
    return this.anchor !== null
  }

  timeAt(perfMs: number): number {
    if (this.anchor === null) return this.base
    return this.base + (Math.max(0, perfMs - this.anchor) / 1000) * this.rate
  }

  start(perfMs: number) {
    if (this.anchor === null) this.anchor = perfMs
  }

  pause(perfMs: number) {
    if (this.anchor === null) return
    this.base = this.timeAt(perfMs)
    this.anchor = null
  }

  seek(time: number, perfMs: number) {
    this.base = Math.max(0, time)
    if (this.anchor !== null) this.anchor = perfMs
  }

  setRate(rate: number, perfMs: number) {
    if (this.anchor !== null) {
      this.base = this.timeAt(perfMs)
      this.anchor = perfMs
    }
    this.rate = rate
  }
}

const MAX_EXTRAPOLATION = 0.25

export class MediaClock {
  private anchorMedia = 0
  private anchorPerf = 0
  private playing = false
  private rate = 1
  private last = -Infinity

  constructor(private maxExtrapolation = MAX_EXTRAPOLATION) {}

  observe(mediaTime: number, perfMs: number, playing: boolean, rate: number) {
    if (mediaTime !== this.anchorMedia || playing !== this.playing || rate !== this.rate) {
      this.anchorMedia = mediaTime
      this.anchorPerf = perfMs
    }
    this.playing = playing
    this.rate = rate
  }

  timeAt(perfMs: number): number {
    let t = this.anchorMedia
    if (this.playing) {
      const elapsed = (Math.max(0, perfMs - this.anchorPerf) / 1000) * this.rate
      t += Math.min(elapsed, this.maxExtrapolation * this.rate)
    }
    this.last = Math.max(t, this.last)
    return this.last
  }

  reset() {
    this.last = -Infinity
  }
}
