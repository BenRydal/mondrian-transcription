import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { sampleHold } from './drawing'
import { addPointsToCurrentPath, drawingState } from '../../stores/drawingState'
import { drawingConfig } from '../../stores/drawingConfig'
import { mediaClock, speculateClock } from '../../timing/sessionClocks'
import { resamplePath } from '../../timing/sampling'

type FakeVideo = { currentTime: number; paused: boolean; playbackRate: number }

const points = () => get(drawingState).paths[0].points

function startRecording(isTranscriptionMode: boolean, time = 2) {
  drawingConfig.update((c) => ({ ...c, isTranscriptionMode }))
  drawingState.update((s) => ({
    ...s,
    shouldTrackMouse: true,
    currentPathId: 1,
    paths: [{ pathId: 1, color: '#FF0000', points: [] }],
  }))
  addPointsToCurrentPath([{ x: 40, y: 60, time, pathId: 1 }])
}

/** Run the draw loop at `fps` for `wallSeconds`, advancing a playing video like a browser would. */
function runFrames(fps: number, wallSeconds: number, perfStart: number, video?: FakeVideo) {
  const frames = Math.round(wallSeconds * fps)
  let perf = perfStart
  for (let i = 1; i <= frames; i++) {
    perf = perfStart + (i * 1000) / fps
    if (video && !video.paused) video.currentTime += video.playbackRate / fps
    sampleHold(video as unknown as HTMLVideoElement, perf)
  }
  return perf
}

function stillSpeculate(fps: number) {
  startRecording(false)
  speculateClock.pause(0)
  speculateClock.seek(2, 0)
  speculateClock.start(1000)
  runFrames(fps, 5, 1000)
  speculateClock.pause(6000)
  return points()
}

function stillVideo(fps: number, playbackRate: number, wallSeconds: number) {
  startRecording(true)
  mediaClock.reset()
  const video: FakeVideo = { currentTime: 2, paused: false, playbackRate }
  runFrames(fps, wallSeconds, 1000, video)
  return points()
}

describe('hold points for a still pointer', () => {
  beforeEach(() => mediaClock.reset())

  it('adds one point per 100 ms of speculate clock time at the last position', () => {
    const held = stillSpeculate(60)
    expect(held).toHaveLength(51)
    expect(held.every((p) => p.x === 40 && p.y === 60)).toBe(true)
    held.slice(1).forEach((p, i) => expect(p.time).toBeCloseTo(2 + (i + 1) * 0.1, 9))
  })

  it('stamps the same times at 30 and 120 fps', () => {
    const at30 = stillSpeculate(30).map((p) => p.time)
    const at120 = stillSpeculate(120).map((p) => p.time)
    expect(at30).toEqual(at120)
  })

  it('follows media time, so half speed gives five points per wall second', () => {
    expect(stillVideo(30, 0.5, 1)).toHaveLength(1 + 5)
    const half30 = stillVideo(30, 0.5, 10).map((p) => p.time)
    const half120 = stillVideo(120, 0.5, 10).map((p) => p.time)
    expect(half30).toHaveLength(51)
    expect(half30).toEqual(half120.map((t) => expect.closeTo(t, 9)))
    expect(stillVideo(60, 1, 5)).toHaveLength(51)
  })

  it('adds nothing while the video is paused', () => {
    startRecording(true)
    const video: FakeVideo = { currentTime: 2, paused: true, playbackRate: 1 }
    runFrames(60, 3, 1000, video)
    expect(points()).toHaveLength(1)
  })

  it('adds nothing when not recording or with the speculate clock stopped', () => {
    startRecording(false)
    speculateClock.pause(0)
    runFrames(60, 3, 1000)
    expect(points()).toHaveLength(1)

    speculateClock.start(5000)
    drawingState.update((s) => ({ ...s, shouldTrackMouse: false }))
    runFrames(60, 3, 5000)
    speculateClock.pause(8000)
    expect(points()).toHaveLength(1)
  })

  it('interleaves with moves in time order and keeps export on the grid', () => {
    startRecording(false, 0)
    speculateClock.pause(0)
    speculateClock.seek(0, 0)
    speculateClock.start(0)
    let perf = runFrames(60, 1, 0)
    for (let i = 1; i <= 30; i++) {
      perf += 1000 / 60
      const time = speculateClock.timeAt(perf)
      addPointsToCurrentPath([{ x: 40 + i, y: 60, time, pathId: 1 }])
      sampleHold(null, perf)
    }
    runFrames(60, 1, perf)
    speculateClock.pause(perf + 1000)

    const times = points().map((p) => p.time)
    times.slice(1).forEach((t, i) => expect(t - times[i]).toBeGreaterThanOrEqual(0.01 - 1e-9))
    const out = resamplePath(points(), { rate: 10 })
    expect(out.every((p, i) => Math.abs(p.time - i / 10) < 1e-9)).toBe(true)
    expect(out.slice(0, 10).every((p) => p.x === 40)).toBe(true)
    expect(out.at(-1)!.x).toBe(70)
  })
})
