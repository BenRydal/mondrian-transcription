import type p5 from 'p5'
import { drawingState, appendFinalPoint } from '../../stores/drawingState'
import { get } from 'svelte/store'
import { drawingConfig, getVideoHeightPercent } from '../../stores/drawingConfig'
import type { VideoSource } from '../../video/source'

function stopRecording(time: number) {
  appendFinalPoint(time)
  drawingState.update((state) => ({
    ...state,
    isVideoPlaying: false,
    shouldTrackMouse: false,
    isDrawing: false,
  }))
}

/** Mirror a source's play, pause and end into the drawing state; returns an unbind function. */
export function bindPlaybackState(source: VideoSource) {
  const onPlay = () => drawingState.update((state) => ({ ...state, isVideoPlaying: true }))
  const onStop = () => stopRecording(source.currentTime)
  source.addEventListener('play', onPlay)
  source.addEventListener('pause', onStop)
  source.addEventListener('ended', onStop)
  return () => {
    source.removeEventListener('play', onPlay)
    source.removeEventListener('pause', onStop)
    source.removeEventListener('ended', onStop)
  }
}

export function setupVideo(p5: p5) {
  const setVideo = (video: HTMLVideoElement, restoreTime?: number) => {
    const p5Vid = p5.createVideo([video.src])
    const videoElt = p5Vid.elt as HTMLVideoElement

    // Ensure all properties are set correctly
    videoElt.loop = false
    videoElt.currentTime = 0

    // Seek once metadata is ready, so a restore doesn't race a blind timed seek.
    videoElt.addEventListener(
      'loadedmetadata',
      () => {
        const target = restoreTime ?? 0.1
        try {
          videoElt.currentTime = Math.min(target, videoElt.duration || target)
        } catch (e) {
          console.warn('Could not set initial currentTime', e)
        }
        drawingState.update((state) => ({
          ...state,
          videoTime: restoreTime ?? 0,
        }))
      },
      { once: true }
    )

    // Force load to trigger proper timeline setup
    videoElt.load()

    p5Vid.elt.addEventListener('loadeddata', () => {
      if (p5.draw) {
        p5.redraw()
      }

      let frameCount = 0
      const tempDraw = () => {
        frameCount++
        p5.redraw()
        if (frameCount < 3) {
          requestAnimationFrame(tempDraw)
        }
      }
      requestAnimationFrame(tempDraw)
    })

    p5Vid.hide()
    return p5Vid
  }

  const updateVideoTime = (source: VideoSource, lastVideoTime: number) => {
    const currentTime = source.currentTime
    if (currentTime !== lastVideoTime) {
      drawingState.update((state) => ({ ...state, videoTime: currentTime }))
      return currentTime
    }
    return lastVideoTime
  }

  const drawVideo = (p5: p5, videoElement: p5.Element) => {
    const config = get(drawingConfig)
    const splitX = (p5.width * config.splitPosition) / 100
    const slotH = (p5.height * getVideoHeightPercent()) / 100
    const aspectRatio = videoElement.elt.videoWidth / videoElement.elt.videoHeight
    if (!(aspectRatio > 0)) return
    const displayHeight = Math.min(slotH, splitX / aspectRatio)
    const displayWidth = displayHeight * aspectRatio
    const xOffset = (splitX - displayWidth) / 2
    const yOffset = (slotH - displayHeight) / 2

    p5.image(videoElement, xOffset, yOffset, displayWidth, displayHeight)
  }

  const checkVideoEnd = (source: VideoSource) => {
    // Paused at the end: acting again would update the store and redraw forever.
    if (!source.paused && source.currentTime >= source.duration - 0.1) {
      appendFinalPoint(source.currentTime)
      source.pause()
      source.currentTime = source.duration
      drawingState.update((state) => ({
        ...state,
        isVideoPlaying: false,
        shouldTrackMouse: false,
        isDrawing: false,
      }))
    }
  }

  return {
    setVideo,
    updateVideoTime,
    drawVideo,
    checkVideoEnd,
  }
}
