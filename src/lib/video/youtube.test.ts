import { describe, expect, it } from 'vitest'
import { YT_STATE, YouTubeVideoSource, type YTPlayerEvents, type YTPlayerLike } from './youtube'

class FakePlayer implements YTPlayerLike {
  time = 0
  state: number = YT_STATE.CUED
  rate = 1
  duration = 37
  rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  calls: string[] = []
  constructor(public events: YTPlayerEvents) {}
  playVideo() {
    this.calls.push('play')
    this.setState(YT_STATE.PLAYING)
  }
  pauseVideo() {
    this.calls.push('pause')
    this.setState(YT_STATE.PAUSED)
  }
  seekTo(seconds: number) {
    this.calls.push(`seek:${seconds}`)
    this.time = seconds
    if (this.state !== YT_STATE.PAUSED) this.setState(YT_STATE.PLAYING)
  }
  getCurrentTime() {
    return this.time
  }
  getDuration() {
    return this.duration
  }
  getPlayerState() {
    return this.state
  }
  setPlaybackRate(rate: number) {
    this.rate = rate
  }
  getAvailablePlaybackRates() {
    return this.rates
  }
  destroy() {
    this.calls.push('destroy')
  }
  setState(state: number) {
    this.state = state
    this.events.onStateChange(state)
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const host = { replaceChildren() {} } as unknown as HTMLElement

async function makeSource(opts: { startTime?: number; rates?: number[] } = {}) {
  let perf = 1000
  let player!: FakePlayer
  const source = new YouTubeVideoSource({
    videoId: 'abc',
    host,
    startTime: opts.startTime,
    now: () => perf,
    createPlayer: async (_host, _id, events) => {
      player = new FakePlayer(events)
      if (opts.rates) player.rates = opts.rates
      return player
    },
  })
  await flush()
  player.events.onReady()
  await flush()
  return {
    source,
    player,
    advance: (ms: number) => (perf += ms),
  }
}

describe('YouTubeVideoSource media time', () => {
  it('interpolates between coarse polls, scaled by playback rate', async () => {
    const { source, player, advance } = await makeSource()
    source.playbackRate = 0.5
    await source.play()
    player.time = 10
    expect(source.currentTime).toBeCloseTo(10)
    advance(200)
    expect(source.currentTime).toBeCloseTo(10.1)
    advance(200)
    expect(source.currentTime).toBeCloseTo(10.2)
  })

  it('stays monotonic when a poll reports a time behind the interpolation', async () => {
    const { source, player, advance } = await makeSource()
    await source.play()
    player.time = 5
    let last = source.currentTime
    for (let i = 0; i < 60; i++) {
      advance(16.7)
      if (i % 15 === 0) player.time = 5 + (i * 16.7) / 1000 - 0.1
      const t = source.currentTime
      expect(t).toBeGreaterThanOrEqual(last)
      last = t
    }
    expect(last).toBeGreaterThan(5.8)
  })

  it('snaps to a seek target, backwards too, before the player reports it', async () => {
    const { source, player, advance } = await makeSource()
    await source.play()
    player.time = 20
    expect(source.currentTime).toBeCloseTo(20)
    advance(100)
    expect(source.currentTime).toBeGreaterThan(20)
    player.time = 20.3
    source.currentTime = 4
    player.time = 20.4
    expect(source.currentTime).toBeCloseTo(4)
    player.time = 4
    advance(100)
    expect(source.currentTime).toBeCloseTo(4.1)
  })

  it('reports the exact player time while paused', async () => {
    const { source, player, advance } = await makeSource()
    await source.play()
    player.time = 8
    expect(source.currentTime).toBeCloseTo(8)
    advance(500)
    expect(source.currentTime).toBeCloseTo(8.5)
    source.pause()
    player.time = 8.42
    expect(source.currentTime).toBeCloseTo(8.42)
    advance(1000)
    expect(source.currentTime).toBeCloseTo(8.42)
  })

  it('does not run ahead while buffering', async () => {
    const { source, player, advance } = await makeSource()
    await source.play()
    player.time = 3
    player.setState(YT_STATE.BUFFERING)
    advance(800)
    expect(source.currentTime).toBeCloseTo(3)
    expect(source.paused).toBe(false)
  })
})

describe('YouTubeVideoSource interface', () => {
  it('fires play, pause, seeked and ended events like a video element', async () => {
    const { source, player } = await makeSource()
    const seen: string[] = []
    for (const type of ['play', 'pause', 'seeked', 'ended'] as const) {
      source.addEventListener(type, () => seen.push(type))
    }
    await source.play()
    source.currentTime = 3
    source.pause()
    await flush()
    await source.play()
    player.setState(YT_STATE.ENDED)
    await flush()
    expect(seen).toEqual(['play', 'seeked', 'pause', 'play', 'pause', 'ended'])
    expect(source.paused).toBe(true)
  })

  it('keeps a seek from a cued player paused, and restores the start time on ready', async () => {
    const { source, player } = await makeSource({ startTime: 12.5 })
    expect(player.calls).toContain('seek:12.5')
    expect(player.state).toBe(YT_STATE.PAUSED)
    expect(source.paused).toBe(true)
    expect(source.currentTime).toBeCloseTo(12.5)
    expect(source.duration).toBe(37)
  })

  it('only offers the playback rates the player supports', async () => {
    const { source, player } = await makeSource({ rates: [0.5, 1, 2] })
    expect(source.supportsRate(0.75)).toBe(false)
    expect(source.supportsRate(0.5)).toBe(true)
    source.playbackRate = 0.75
    expect([0.5, 1]).toContain(source.playbackRate)
    expect(player.rate).toBe(source.playbackRate)
  })

  it('steps by a fixed 1/30 s since frames cannot be observed', async () => {
    const { source } = await makeSource()
    expect(source.fixedFrameStep).toBeCloseTo(1 / 30)
  })

  it('starts a play requested while loading once the player is ready', async () => {
    let player!: FakePlayer
    const source = new YouTubeVideoSource({
      videoId: 'abc',
      host,
      createPlayer: async (_host, _id, events) => (player = new FakePlayer(events)),
    })
    const playing = source.play()
    expect(source.paused).toBe(false)
    await flush()
    expect(player.calls).not.toContain('play')
    player.events.onReady()
    await playing
    expect(player.calls).toContain('play')
    expect(player.state).toBe(YT_STATE.PLAYING)
  })

  it('refuses to play and reports an error when the video cannot be embedded', async () => {
    const { source, player } = await makeSource()
    let errors = 0
    source.addEventListener('error', () => errors++)
    player.events.onError(150)
    await flush()
    expect(errors).toBe(1)
    expect(source.error).toMatch(/won't play this video/)
    await expect(source.play()).rejects.toThrow()
  })

  it('reports a failed API load as an error', async () => {
    const source = new YouTubeVideoSource({
      videoId: 'abc',
      host,
      createPlayer: () => Promise.reject(new Error('offline')),
    })
    await flush()
    expect(source.error).toBe('offline')
  })

  it('destroys the player and empties its host', async () => {
    let cleared = 0
    const source = new YouTubeVideoSource({
      videoId: 'abc',
      host: { replaceChildren: () => cleared++ } as unknown as HTMLElement,
      createPlayer: async (_host, _id, events) => new FakePlayer(events),
    })
    await flush()
    source.destroy()
    expect(cleared).toBe(1)
  })
})
