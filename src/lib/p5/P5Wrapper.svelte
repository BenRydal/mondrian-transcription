<script lang="ts">
  import { P5Canvas, type SketchFn } from 'svelte-p5'
  import type p5 from 'p5'
  import { onMount } from 'svelte'
  import { on } from 'svelte/events'
  import { fade } from 'svelte/transition'
  import { zip } from 'fflate'
  import { drawingConfig, getSplitPositionForMode } from '../stores/drawingConfig'
  import {
    drawingState,
    createNewPath,
    handleForwardTranscription,
    handleRewindTranscription,
    handleForwardSpeculateMode,
    handleRewindSpeculateMode,
  } from '../stores/drawingState'
  import IconRewind from '~icons/material-symbols/fast-rewind'
  import IconForward from '~icons/material-symbols/fast-forward'
  import { setupDrawing, drawPaths, endCurrentTake, observeVideo } from './features/drawing'
  import { resamplePath, sessionScale } from '$lib/timing/sampling'
  import { setupVideo } from './features/video'
  import VideoControls from '../components/video/VideoControls.svelte'
  import { getFittedImageDisplayRect } from '$lib/utils/drawingUtils'
  import IconInfo from '~icons/material-symbols/info-outline'
  import { isShortcutEvent } from '$lib/utils/keyboard'
  import { clamp } from '$lib/spacetime/geometry'
  import { speculateClock } from '$lib/timing/sessionClocks'
  import SpaceTimeView from '../components/spacetime/SpaceTimeView.svelte'

  let containerDiv: HTMLDivElement
  let width = 800
  let height = 400
  let dragAxis: 'x' | 'y' | null = null
  let videoElement = $state.raw<p5.Element | null>(null)
  let p5Instance = $state.raw<p5 | null>(null)
  let lastVideoTime = 0
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

  const videoHtmlElement = $derived(
    videoElement ? (videoElement as { elt: HTMLVideoElement }).elt : null
  )
  const showSplit = $derived($drawingConfig.isTranscriptionMode || $drawingConfig.showSpaceTime)
  const videoHeight = $derived(
    $drawingConfig.isTranscriptionMode && $drawingConfig.showSpaceTime
      ? $drawingConfig.spaceTimeSplit
      : 100
  )
  const showSpaceTime = $derived($drawingConfig.showSpaceTime)
  const hasRecordedPaths = $derived($drawingState.paths.some((p) => p.points.length > 0))

  function spaceTimeNow() {
    return $drawingConfig.isTranscriptionMode
      ? $drawingState.videoTime
      : speculateClock.timeAt(performance.now())
  }

  function handleSplitterDrag(e: MouseEvent | TouchEvent) {
    if (!dragAxis) return
    e.preventDefault()
    e.stopPropagation()

    // Guard against empty touches array (e.g., touchend)
    if ('touches' in e && !e.touches.length) return

    const rect = containerDiv.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] : e
    if (dragAxis === 'x') {
      const position = ((point.clientX - rect.left) / rect.width) * 100
      drawingConfig.update((config) => ({ ...config, splitPosition: clamp(position, 30, 70) }))
    } else {
      const position = ((point.clientY - rect.top) / rect.height) * 100
      drawingConfig.update((config) => ({ ...config, spaceTimeSplit: clamp(position, 20, 80) }))
    }
  }

  function handleSplitterEnd() {
    dragAxis = null
    if (p5Instance) {
      p5Instance.loop()
    }
  }

  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isShortcutEvent(e)) return
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if ($drawingConfig.isTranscriptionMode && videoHtmlElement) {
          handleForwardTranscription(videoHtmlElement)
        } else {
          handleForwardSpeculateMode()
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if ($drawingConfig.isTranscriptionMode && videoHtmlElement) {
          handleRewindTranscription(videoHtmlElement)
        } else {
          handleRewindSpeculateMode()
        }
      }
    }

    const updateDimensions = () => {
      height = containerDiv.clientHeight
      width = containerDiv.clientWidth
      if (p5Instance) {
        p5Instance.resizeCanvas(width, height)
      }
    }

    // The side panel resizes the canvas area without a window resize.
    const resizeObserver = new ResizeObserver(updateDimensions)
    window.addEventListener('keydown', handleKeydown)
    resizeObserver.observe(containerDiv)
    updateDimensions()

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      resizeObserver.disconnect()
    }
  })

  const sketch: SketchFn = (p5) => {
    let canvasElt: HTMLCanvasElement | null = null
    const { handlePressVideo, handlePressSpeculate, handleMove } = setupDrawing(p5, () => canvasElt)

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return
      if (!$drawingConfig.isTranscriptionMode) {
        if (!$drawingState.imageElement) return
        handlePressSpeculate(event)
      } else if (!dragAxis && videoHtmlElement) {
        handlePressVideo(event, videoHtmlElement)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.isPrimary) handleMove(event, videoHtmlElement)
    }

    p5.setup = () => {
      const canvas = p5.createCanvas(width, height)
      canvas.parent(containerDiv)
      canvasElt = (canvas as unknown as { elt: HTMLCanvasElement }).elt
      canvasElt.addEventListener('pointerdown', handlePointerDown)
      canvasElt.addEventListener('pointermove', handlePointerMove)
      canvasElt.addEventListener('pointerup', handlePointerMove)
      p5.strokeCap(p5.ROUND)
      p5.strokeJoin(p5.ROUND)

      p5.noLoop()
    }

    // Helper to draw rotated floor plan image
    const drawRotatedImage = () => {
      const img = $drawingState.imageElement
      const imgW = $drawingState.imageWidth
      const imgH = $drawingState.imageHeight
      if (!img || !imgW || !imgH) return

      const rotation = $drawingConfig.floorPlanRotation
      const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH, rotation)

      if (rotation === 0) {
        p5.image(img, r.x, r.y, r.w, r.h)
      } else {
        p5.push()
        p5.translate(r.x + r.w / 2, r.y + r.h / 2)
        p5.rotate((rotation * Math.PI) / 180)
        // For 90°/270°, display rect dimensions are swapped relative to original image
        // so we draw with swapped dimensions and offsets
        if (rotation === 90 || rotation === 270) {
          p5.image(img, -r.h / 2, -r.w / 2, r.h, r.w)
        } else {
          p5.image(img, -r.w / 2, -r.h / 2, r.w, r.h)
        }
        p5.pop()
      }
    }

    p5.draw = () => {
      p5.background(255)

      // Draw video in transcription mode
      if ($drawingConfig.isTranscriptionMode && videoElement) {
        const { updateVideoTime, drawVideo, checkVideoEnd } = setupVideo(p5)
        lastVideoTime = updateVideoTime(videoElement, lastVideoTime)
        if (videoHtmlElement) observeVideo(videoHtmlElement, performance.now())
        checkVideoEnd(videoElement)
        drawVideo(p5, videoElement)
      }

      drawRotatedImage()
      drawPaths(p5)
    }

    p5.loop()
  }

  export function setVideo(video: HTMLVideoElement, restoreTime?: number) {
    const isRecovery = restoreTime !== undefined

    lastVideoTime = 0

    drawingState.update((state) => ({
      ...state,
      videoTime: isRecovery ? restoreTime : 0,
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

    const { setVideo: setupP5Video } = setupVideo(p5Instance!)
    videoElement = setupP5Video(video, restoreTime)

    if (videoElement) {
      ;(videoElement as { elt: HTMLVideoElement }).elt.loop = false

      if (p5Instance) {
        p5Instance.redraw()
        // Only clear drawing if not recovering
        if (!isRecovery) {
          clearDrawing()
        }
      }
    }

    // Only start new path if not recovering
    if (!isRecovery && $drawingState.imageElement) startNewPath()
  }

  export function setImage(image: HTMLImageElement, isRecovery = false) {
    // Auto-detect recovery: paths exist but no image loaded yet
    const isImplicitRecovery = !isRecovery && hasRecordedPaths && !$drawingState.imageElement

    p5Instance!.loadImage(image.src, (p5Img: p5.Image) => {
      if (!isRecovery && !isImplicitRecovery) {
        // Reset rotation for new floor plans (not recovery)
        drawingConfig.update((c) => ({ ...c, floorPlanRotation: 0 }))

        if (!$drawingConfig.isTranscriptionMode) {
          if (p5Instance) {
            p5Instance.redraw()
            clearDrawing()
          }
          startNewPath()
        } else {
          if (videoElement) startNewPath()
        }
      }
      drawingState.update((state) => ({
        ...state,
        imageWidth: image.width,
        imageHeight: image.height,
        imageElement: p5Img,
      }))
      if (p5Instance) {
        p5Instance.loop()
      }
    })
  }

  export function startNewPath(): boolean {
    // Don't allow adding a new path if current path is empty
    const currentPath = $drawingState.paths.find((p) => p.pathId === $drawingState.currentPathId)
    if (currentPath && currentPath.points.length === 0) {
      return false
    }

    const currentPathCount = $drawingState.paths.length
    const newColor = colors[currentPathCount % colors.length]
    endCurrentTake(videoHtmlElement)

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
    return true
  }

  export function exportAll(onComplete?: () => void) {
    const paths = $drawingState.paths
    const imageElement = $drawingState?.imageElement
    const isTranscriptionMode = $drawingConfig.isTranscriptionMode
    const sampleRate = $drawingConfig.exportSampleRate
    const scale = isTranscriptionMode
      ? 1
      : sessionScale(
          paths.map((path) => path.points),
          $drawingConfig.speculateScale
        )

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
      try {
        canvas.remove()
      } catch {
        // p5.Graphics cleanup can throw in some builds; safe to ignore
      }
    }

    // Add each path as CSV
    paths.forEach((path, index) => {
      if (path.points.length === 0) return

      const rows = resamplePath(path.points, { rate: sampleRate, scale })
      const csv = rows.map((p) => `${p.x},${p.y},${p.time}`).join('\n')

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

  $effect(() => {
    if (containerDiv && $drawingConfig) {
      containerDiv.style.setProperty('--split-width', `${$drawingConfig.splitPosition}%`)
      containerDiv.style.setProperty('--video-controls-bottom', `${100 - videoHeight}%`)
    }
  })
</script>

<div
  bind:this={containerDiv}
  class="relative w-full h-full touch-none"
  onmousemove={handleSplitterDrag}
  onmouseup={handleSplitterEnd}
  onmouseleave={handleSplitterEnd}
  {@attach (node) => on(node, 'touchmove', handleSplitterDrag, { passive: false })}
  ontouchend={handleSplitterEnd}
  ontouchcancel={handleSplitterEnd}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
    }
  }}
  role="application"
  aria-label="Drawing Canvas"
>
  <!-- The sketch reparents its canvas into containerDiv, so the host div must not take up height. -->
  <P5Canvas {sketch} bind:instance={p5Instance} style="display: block;" />

  <!-- Empty State -->
  {#if !$drawingState.imageElement}
    <div
      class="absolute inset-y-0 right-0 flex items-center justify-center pointer-events-none"
      style:left={showSpaceTime ? `${$drawingConfig.splitPosition}%` : '0'}
      data-ui-element
    >
      <div class="text-center text-base-content/40 text-2xl space-y-2 px-4">
        {#if $drawingConfig.isTranscriptionMode}
          <p>Upload a floor plan and video to get started</p>
        {:else}
          <p>Upload a floor plan to get started</p>
          <p>or try an example from the <span class="font-medium">Data</span> panel</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if showSpaceTime}
    <div
      class="absolute left-0 bottom-0"
      class:border-t={videoHeight < 100}
      class:border-base-300={videoHeight < 100}
      style:top="{videoHeight < 100 ? videoHeight : 0}%"
      style:width="{$drawingConfig.splitPosition}%"
    >
      <SpaceTimeView
        getNow={spaceTimeNow}
        getDuration={() => videoHtmlElement?.duration ?? 0}
        class="inset-0"
      />
    </div>
  {/if}

  {#if showSplit}
    {@const startSplitterDrag = (axis: 'x' | 'y') => (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      dragAxis = axis
    }}
    <button
      class="absolute top-0 bottom-0 w-8 bg-transparent cursor-col-resize hover:bg-base-content/5 touch-none"
      style="left: calc({$drawingConfig.splitPosition}% - 16px)"
      data-ui-element
      onmousedown={startSplitterDrag('x')}
      {@attach (node) => on(node, 'touchstart', startSplitterDrag('x'), { passive: false })}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') startSplitterDrag('x')(e)
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

    {#if videoHeight < 100}
      <button
        class="absolute left-0 h-8 bg-transparent cursor-row-resize hover:bg-base-content/5 touch-none"
        style="top: calc({videoHeight}% - 16px); width: {$drawingConfig.splitPosition}%"
        data-ui-element
        onmousedown={startSplitterDrag('y')}
        {@attach (node) => on(node, 'touchstart', startSplitterDrag('y'), { passive: false })}
        onkeydown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const step = e.key === 'ArrowUp' ? -2 : 2
            drawingConfig.update((c) => ({
              ...c,
              spaceTimeSplit: clamp(c.spaceTimeSplit + step, 20, 80),
            }))
          }
        }}
        aria-label="Resize video and 3D view"
        transition:fade={{ duration: 200 }}
      >
        <div
          class="absolute left-0 right-0 h-1 bg-base-300 hover:bg-primary transition-colors"
          style="top: 50%"
        ></div>
      </button>
    {/if}
  {/if}

  {#if videoHtmlElement}
    <VideoControls videoElement={videoHtmlElement} />
  {:else if !$drawingConfig.isTranscriptionMode && $drawingState.imageElement}
    <!-- Speculate mode controls (forward/rewind buttons) -->
    <div
      class="absolute bottom-4 -translate-x-1/2 flex gap-2 bg-base-200/80 backdrop-blur-sm rounded-lg p-2 shadow-lg"
      style:left="{showSplit ? ($drawingConfig.splitPosition + 100) / 2 : 50}%"
      data-ui-element
    >
      <button
        class="btn btn-ghost btn-sm btn-circle"
        onclick={handleRewindSpeculateMode}
        aria-label="Rewind"
        title="Rewind (R)"
      >
        <IconRewind class="h-5 w-5" />
      </button>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        onclick={handleForwardSpeculateMode}
        aria-label="Forward"
        title="Forward (F)"
      >
        <IconForward class="h-5 w-5" />
      </button>
    </div>
  {/if}

  <!-- Assets needed for recovered session -->
  {#if hasRecordedPaths}
    {@const alertMessage =
      $drawingConfig.isTranscriptionMode && !$drawingState.imageElement
        ? 'Upload your floor plan and video to continue recording'
        : $drawingConfig.isTranscriptionMode && !videoHtmlElement
          ? 'Upload your video to continue recording'
          : !$drawingConfig.isTranscriptionMode && !$drawingState.imageElement
            ? 'Upload your floor plan to continue recording'
            : null}
    {#if alertMessage}
      <div
        class="absolute top-4 left-4 right-4 flex justify-center pointer-events-none"
        data-ui-element
      >
        <div class="alert alert-info shadow-lg max-w-md pointer-events-auto">
          <IconInfo class="h-5 w-5" />
          <span class="text-sm">{alertMessage}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>
