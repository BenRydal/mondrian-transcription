<script lang="ts">
  import P5, { type Sketch } from 'p5-svelte'
  import type p5 from 'p5'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { zip } from 'fflate'
  import { drawingConfig, getSplitPositionForMode } from '../stores/drawingConfig'
  import {
    drawingState,
    createNewPath,
    handleTimeJump,
    handleRewindSpeculateMode,
  } from '../stores/drawingState'
  import { setupDrawing, drawPaths, timeSampler, indexSampler } from './features/drawing'
  import { setupVideo } from './features/video'
  import VideoControls from '../components/video/VideoControls.svelte'
  import { getFittedImageDisplayRect } from '$lib/utils/drawingUtils'

  let containerDiv: HTMLDivElement
  let width = 800
  let height = 400
  let isDraggingSplitter = false
  let videoElement: p5.Element | null = null
  let p5Instance: p5
  let lastVideoTime = 0
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

  $: videoHtmlElement = videoElement ? (videoElement as { elt: HTMLVideoElement }).elt : null

  function handleSplitterDrag(e: MouseEvent) {
    if (isDraggingSplitter) {
      e.preventDefault()
      e.stopPropagation()

      const rect = containerDiv.getBoundingClientRect()
      const position = ((e.clientX - rect.left) / rect.width) * 100
      const minVideoWidth = 30
      const minImageWidth = 30
      const constrainedPosition = Math.min(Math.max(position, minVideoWidth), 100 - minImageWidth)

      drawingConfig.update((config) => ({
        ...config,
        splitPosition: constrainedPosition,
      }))
    }
  }

  function handleSplitterEnd() {
    isDraggingSplitter = false
    if (p5Instance) {
      p5Instance.loop()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if ($drawingConfig.isTranscriptionMode && videoHtmlElement) {
          handleTimeJump(true, videoHtmlElement)
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if ($drawingConfig.isTranscriptionMode && videoHtmlElement) {
          handleTimeJump(false, videoHtmlElement)
        } else {
          handleRewindSpeculateMode(false)
        }
      }
    })

    const updateDimensions = () => {
      height = window.innerHeight - 64
      width = containerDiv.clientWidth
      if (p5Instance) {
        p5Instance.resizeCanvas(width, height)
      }
    }

    window.addEventListener('resize', updateDimensions)
    updateDimensions()
    return () => window.removeEventListener('resize', updateDimensions)
  })

  const sketch: Sketch = (p5: p5) => {
    p5Instance = p5
    const { handleMousePressedVideo, handleMousePressedSpeculateMode, addCurrentPoint } =
      setupDrawing(p5)

    p5.setup = () => {
      const canvas = p5.createCanvas(width, height)
      canvas.parent(containerDiv)
      p5.strokeCap(p5.ROUND)
      p5.strokeJoin(p5.ROUND)

      if (p5Instance) {
        p5Instance.noLoop()
      }
    }

    p5.draw = () => {
      p5.background(255)
      if ($drawingConfig.isTranscriptionMode) {
        if (videoElement) {
          const { updateVideoTime, drawVideo, checkVideoEnd } = setupVideo(p5)
          lastVideoTime = updateVideoTime(videoElement, lastVideoTime)
          checkVideoEnd(videoElement)
          drawVideo(p5, videoElement)
        }

        const img = $drawingState.imageElement
        const imgW = $drawingState.imageWidth
        const imgH = $drawingState.imageHeight

        if (img && imgW && imgH) {
          const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH)
          p5.image(img, r.x, r.y, r.w, r.h)
        }

        addCurrentPoint()
        drawPaths(p5)
      } else {
        const img = $drawingState.imageElement
        const imgW = $drawingState.imageWidth
        const imgH = $drawingState.imageHeight

        if (img && imgW && imgH) {
          const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH)
          p5.image(img, r.x, r.y, r.w, r.h)
        }

        addCurrentPoint()
        drawPaths(p5)
      }
    }

    p5.mousePressed = (event: MouseEvent) => {
      // Ignore clicks on UI elements (modals, buttons, etc.)
      const target = event?.target as HTMLElement
      if (target?.closest('[data-ui-element]')) return

      if (!$drawingConfig.isTranscriptionMode) {
        handleMousePressedSpeculateMode()
      } else {
        if (!isDraggingSplitter) {
          handleMousePressedVideo(videoHtmlElement)
        }
      }
    }
    if (p5Instance) {
      p5Instance.loop()
    }
  }

  export function setVideo(video: HTMLVideoElement) {
    lastVideoTime = 0

    drawingState.update((state) => ({
      ...state,
      videoTime: 0,
    }))

    if (videoElement) {
      try {
        const videoElt = (videoElement as { elt: HTMLVideoElement }).elt
        if (videoElt) {
          videoElt.pause()
          videoElt.currentTime = 0
        }
        ;(videoElement as { remove: () => void }).remove()
      } catch (e) {
        window.console.warn('Error cleaning up previous video:', e)
      }
    }

    video.loop = false

    const { setVideo: setupP5Video } = setupVideo(p5Instance)
    videoElement = setupP5Video(video)

    if (videoElement) {
      ;(videoElement as { elt: HTMLVideoElement }).elt.loop = false

      if (p5Instance) {
        p5Instance.redraw()
        clearDrawing()
      }
    }

    if ($drawingState.imageElement) startNewPath()
  }

  export function setImage(image: HTMLImageElement) {
    p5Instance.loadImage(image.src, (p5Img: p5.Image) => {
      if (!$drawingConfig.isTranscriptionMode) {
        if (p5Instance) {
          p5Instance.redraw()
          clearDrawing()
        }
        startNewPath()
      } else {
        if (videoElement) startNewPath()
      }
      drawingState.update((state) => ({
        ...state,
        imageWidth: image.width,
        imageHeight: image.height,
        imageElement: p5Img,
      }))
    })
  }

  export function startNewPath() {
    const currentPathCount = $drawingState.paths.length
    const newColor = colors[currentPathCount % colors.length]
    timeSampler.reset()
    indexSampler.reset()

    if (!$drawingConfig.isTranscriptionMode) {
      createNewPath(newColor)
    } else {
      if (videoElement) {
        const htmlVideo = (videoElement as { elt: HTMLVideoElement }).elt
        if (htmlVideo) {
          htmlVideo.currentTime = 0
          htmlVideo.pause()
        }
      }
      createNewPath(newColor)
    }

    drawingState.update((state) => ({
      ...state,
      shouldTrackMouse: false,
      isDrawing: false,
      isVideoPlaying: false, // always false if no video
    }))
  }

  export function exportAll(onComplete?: () => void) {
    const paths = $drawingState.paths
    const imageElement = $drawingState?.imageElement
    const isTranscriptionMode = $drawingConfig.isTranscriptionMode
    const scaleValue = $drawingConfig.speculateScale

    const files: Record<string, Uint8Array> = {}

    // Add image to ZIP
    if (imageElement && p5Instance) {
      const canvas = p5Instance.createGraphics($drawingState.imageWidth, $drawingState.imageHeight)
      canvas.pixelDensity(1) // Prevent DPI scaling on retina displays
      canvas.image(imageElement, 0, 0)
      const dataUrl = (canvas as unknown as { canvas: HTMLCanvasElement }).canvas.toDataURL(
        'image/png'
      )
      const base64Data = dataUrl.split(',')[1]
      const binaryString = window.atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      files['floor-plan.png'] = bytes
      canvas.remove()
    }

    // Add each path as CSV
    paths.forEach((path, index) => {
      if (path.points.length === 0) return

      const maxTime = path.points[path.points.length - 1].time
      const csv = path.points
        .map((p) => {
          const time = isTranscriptionMode ? p.time : (p.time / maxTime) * scaleValue
          return `${p.x},${p.y},${time}`
        })
        .join('\n')

      const filename = path.name ? `${path.name}.csv` : `path-${index + 1}.csv`
      files[filename] = new TextEncoder().encode(`x,y,time\n${csv}`)
    })

    // Generate ZIP asynchronously (uses Web Workers, won't block UI)
    zip(files, (err, data) => {
      if (err) {
        window.console.error('Error creating ZIP:', err)
        onComplete?.()
        return
      }

      const blob = new Blob([data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = 'transcription-export.zip'
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      onComplete?.()
    })
  }

  export function clearDrawing() {
    if (videoElement) {
      const htmlVideo = (videoElement as { elt: HTMLVideoElement }).elt
      if (htmlVideo) {
        htmlVideo.currentTime = 0
        htmlVideo.pause()
      }
    }

    drawingState.update((state) => ({
      ...state,
      paths: [],
      currentPathId: 0,
      shouldTrackMouse: false,
      isDrawing: false,
      isVideoPlaying: false,
    }))
  }

  export function clearVideo() {
    if (videoElement) {
      try {
        const videoElt = (videoElement as { elt: HTMLVideoElement }).elt
        if (videoElt) {
          videoElt.pause()
          videoElt.currentTime = 0
        }
        ;(videoElement as { remove: () => void }).remove()
      } catch (e) {
        window.console.warn('Error cleaning up video:', e)
      }
      videoElement = null
    }
  }

  export function clearCurrentPath() {
    if (videoElement) {
      const htmlVideo = (videoElement as { elt: HTMLVideoElement }).elt
      if (htmlVideo) {
        htmlVideo.currentTime = 0
        htmlVideo.pause()
      }
    }

    drawingState.update((state) => {
      const { paths } = state
      if (paths.length === 0) return state
      const newPaths = paths.slice(0, -1) // Remove last path

      return {
        ...state,
        paths: newPaths,
        currentPathId: newPaths.length,
        shouldTrackMouse: false,
        isDrawing: false,
        isVideoPlaying: false,
      }
    })
  }

  $: if (containerDiv && $drawingConfig) {
    containerDiv.style.setProperty('--split-width', `${$drawingConfig.splitPosition}%`)
  }
</script>

<div
  bind:this={containerDiv}
  class="relative w-full h-[calc(100vh-64px)]"
  on:mousemove={handleSplitterDrag}
  on:mouseup={handleSplitterEnd}
  on:mouseleave={handleSplitterEnd}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
    }
  }}
  role="application"
  aria-label="Drawing Canvas"
>
  <P5 {sketch} />

  <!-- Empty State -->
  {#if !$drawingState.imageElement}
    <div
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
      data-ui-element
    >
      <div class="text-center text-base-content/40 text-2xl space-y-2">
        {#if $drawingConfig.isTranscriptionMode}
          <p>Upload a floor plan and video to get started</p>
        {:else}
          <p>Upload a floor plan to get started</p>
          <p>or try an example from the <span class="font-medium">Example Data</span> menu</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if $drawingConfig.isTranscriptionMode}
    <button
      class="absolute top-0 bottom-0 w-8 bg-transparent cursor-col-resize hover:bg-base-content/5"
      style="left: calc({$drawingConfig.splitPosition}% - 16px)"
      data-ui-element
      on:mousedown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        isDraggingSplitter = true
      }}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          isDraggingSplitter = true
        }
      }}
      role="separator"
      aria-label="Resize panels"
      transition:fade={{ duration: 200 }}
    >
      <div
        class="absolute top-0 bottom-0 w-1 bg-base-300 hover:bg-primary transition-colors"
        style="left: 50%"
      ></div>
    </button>
  {/if}

  {#if videoHtmlElement}
    <VideoControls videoElement={videoHtmlElement} />
  {/if}

</div>
