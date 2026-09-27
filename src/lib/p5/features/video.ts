import type p5 from 'p5'
import { drawingState, appendFinalPoint } from '../../stores/drawingState'
import { get } from 'svelte/store'
import { drawingConfig, getVideoHeightPercent } from '../../stores/drawingConfig'

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

    p5Vid.elt.onplay = () => drawingState.update((state) => ({ ...state, isVideoPlaying: true }))

    p5Vid.elt.onpause = () => {
      appendFinalPoint(videoElt.currentTime)
      drawingState.update((state) => ({
        ...state,
        isVideoPlaying: false,
        shouldTrackMouse: false,
        isDrawing: false,
      }))
    }

    p5Vid.elt.onended = () => {
      appendFinalPoint(videoElt.currentTime)
      drawingState.update((state) => ({
        ...state,
        isVideoPlaying: false,
        shouldTrackMouse: false,
        isDrawing: false,
      }))
    }

    return p5Vid
  }

  const updateVideoTime = (videoElement: p5.Element, lastVideoTime: number) => {
    if (videoElement) {
      const currentTime = (videoElement as any).elt.currentTime
      if (currentTime !== lastVideoTime) {
        drawingState.update((state) => ({ ...state, videoTime: currentTime }))
        return currentTime
      }
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

  const checkVideoEnd = (videoElement: p5.Element) => {
    if (videoElement && (videoElement as any).elt) {
      const video = (videoElement as any).elt
      if (video.currentTime >= video.duration - 0.1) {
        appendFinalPoint(video.currentTime)
        video.pause()
        video.currentTime = video.duration

        drawingState.update((state) => ({
          ...state,
          isVideoPlaying: false,
          shouldTrackMouse: false,
          isDrawing: false,
        }))
      }
    }
  }

  return {
    setVideo,
    updateVideoTime,
    drawVideo,
    checkVideoEnd,
  }
}
