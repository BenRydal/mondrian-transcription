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
  import {
    setupDrawing,
    drawPaths,
    endCurrentTake,
    observeVideo,
    sampleHold,
    speculateNow,
  } from './features/drawing'
  import { formatClock } from '$lib/utils/time'
  import { resamplePath, sessionScale } from '$lib/timing/sampling'
  import { bindPlaybackState, setupVideo } from './features/video'
  import { LocalVideoSource, type VideoSource } from '$lib/video/source'
  import { YouTubeVideoSource } from '$lib/video/youtube'
  import VideoControls from '../components/video/VideoControls.svelte'
  import { getFittedImageDisplayRect } from '$lib/utils/drawingUtils'
  import IconInfo from '~icons/material-symbols/info-outline'
  import IconVideoOff from '~icons/material-symbols/videocam-off-outline'
  import IconUpload from '~icons/material-symbols/upload'
  import { isShortcutEvent } from '$lib/utils/keyboard'
  import { clamp } from '$lib/spacetime/geometry'
  import { speculateClock } from '$lib/timing/sessionClocks'
  import SpaceTimeView from '../components/spacetime/SpaceTimeView.svelte'
  import { stepPlaybackRate, viewPrefs } from '$lib/stores/viewPrefs'
  import {
    FrameRateEstimator,
    currentFrameStart,
    frameStepTarget,
    watchVideoFrames,
  } from '$lib/timing/frameStep'

  let { onVideoUpload }: { onVideoUpload?: (event: Event) => void } = $props()

  let containerDiv: HTMLDivElement
  let youtubeHost: HTMLDivElement
  let width = 800
  let height = 400
  let dragAxis: 'x' | 'y' | null = null
  let videoElement = $state.raw<p5.Element | null>(null)
  let source = $state.raw<VideoSource | null>(null)
  let videoError = $state<string | null>(null)
  let youtubeAspect = $state(16 / 9)
  let unbindSource = () => {}
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

  const showSpeculateControls = $derived(
    !$drawingConfig.isTranscriptionMode && $drawingState.imageElement !== null
  )
  const isDrawing = $derived($drawingState.isDrawing)
  const currentPoints = $derived(
    $drawingState.paths.find((p) => p.pathId === $drawingState.currentPathId)?.points ?? []
  )
  const pathStart = $derived(currentPoints[0]?.time)
  const pathEnd = $derived(currentPoints.at(-1)?.time)
  let speculateTime = $state(0)

  $effect(() => {
    // Rewind, forward and path switches move the clock without drawing.
    void [pathStart, pathEnd, $drawingState.currentPathId]
    if (showSpeculateControls) speculateTime = speculateNow()
  })

  $effect(() => {
    if (!showSpeculateControls || !isDrawing) return
    let raf = requestAnimationFrame(function tick() {
      speculateTime = speculateNow()
      raf = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(raf)
      speculateTime = speculateNow()
    }
  })

  let frameEstimator = new FrameRateEstimator()
  $effect(() => {
    if (!videoHtmlElement) return
    frameEstimator = new FrameRateEstimator()
    return watchVideoFrames(videoHtmlElement, frameEstimator)
  })

  /** Paused only: one frame, or one second with Shift. */
  function stepVideo(video: VideoSource, direction: 1 | -1, bySecond: boolean) {
    if (!video.paused || !(video.duration > 0)) return
    const fd = frameEstimator.frameDuration
    const fixed = bySecond ? 1 : video.fixedFrameStep
    video.currentTime = fixed
      ? Math.min(Math.max(video.currentTime + direction * fixed, 0), video.duration)
      : frameStepTarget(
          currentFrameStart(video.currentTime, fd, frameEstimator.displayedTime),
          fd,
          direction,
          video.duration
        )
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
        if ($drawingConfig.isTranscriptionMode && source) {
          handleForwardTranscription(source)
        } else {
          handleForwardSpeculateMode()
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if ($drawingConfig.isTranscriptionMode && source) {
          handleRewindTranscription(source)
        } else {
          handleRewindSpeculateMode()
        }
      } else if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !e.defaultPrevented &&
        $drawingConfig.isTranscriptionMode &&
        source
      ) {
        e.preventDefault()
        stepVideo(source, e.key === 'ArrowRight' ? 1 : -1, e.shiftKey)
      } else if ((e.key === '[' || e.key === ']') && $drawingConfig.isTranscriptionMode) {
        e.preventDefault()
        const direction = e.key === ']' ? 1 : -1
        viewPrefs.update((p) => ({
          ...p,
          playbackRate: stepPlaybackRate(
            p.playbackRate,
            direction,
            (r) => source?.supportsRate(r) ?? true
          ),
        }))
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
    const { handlePressVideo, handlePressSpeculate, handleHoldStart, handleHoldEnd, handleMove } =
      setupDrawing(p5, () => canvasElt)
    let holdPointerId: number | null = null

    const canRecord = () =>
      $drawingConfig.isTranscriptionMode
        ? !dragAxis && source !== null
        : $drawingState.imageElement !== null

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || !canRecord()) return
      if ($viewPrefs.recordingMode === 'hold') {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        if (handleHoldStart(event, source)) {
          holdPointerId = event.pointerId
          // Capture keeps pointerup coming to the canvas if the pointer leaves it mid-stroke.
          canvasElt?.setPointerCapture(event.pointerId)
        }
      } else if (!$drawingConfig.isTranscriptionMode) {
        handlePressSpeculate(event)
      } else if (source) {
        handlePressVideo(event, source)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.isPrimary) handleMove(event, source)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === holdPointerId) {
        holdPointerId = null
        handleHoldEnd(event, source)
      } else {
        handlePointerMove(event)
      }
    }

    p5.setup = () => {
      const canvas = p5.createCanvas(width, height)
      canvas.parent(containerDiv)
      canvasElt = (canvas as unknown as { elt: HTMLCanvasElement }).elt
      canvasElt.addEventListener('pointerdown', handlePointerDown)
      canvasElt.addEventListener('pointermove', handlePointerMove)
      canvasElt.addEventListener('pointerup', handlePointerUp)
      canvasElt.addEventListener('pointercancel', handlePointerUp)
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
      if ($drawingConfig.isTranscriptionMode && source) {
        const { updateVideoTime, drawVideo, checkVideoEnd } = setupVideo(p5)
        lastVideoTime = updateVideoTime(source, lastVideoTime)
        observeVideo(source, performance.now())
        checkVideoEnd(source)
        if (videoElement) drawVideo(p5, videoElement)
      }
      sampleHold(source)

      drawRotatedImage()
      drawPaths(p5)
    }

    p5.loop()
  }

  /** Swap in a new video source; a restore keeps the paths and resumes at `restoreTime`. */
  function attachSource(next: VideoSource, p5Video: p5.Element | null, restoreTime?: number) {
    const isRecovery = restoreTime !== undefined
    lastVideoTime = 0
    drawingState.update((state) => ({
      ...state,
      videoTime: isRecovery ? restoreTime : 0,
    }))
    clearVideo()
    videoElement = p5Video
    source = next
    videoError = null
    const unbind = bindPlaybackState(next)
    const onError = () => (videoError = next instanceof YouTubeVideoSource ? next.error : null)
    next.addEventListener('error', onError)
    unbindSource = () => {
      unbind()
      next.removeEventListener('error', onError)
    }

    if (p5Instance) {
      p5Instance.redraw()
      if (!isRecovery) clearDrawing()
    }
    if (!isRecovery && $drawingState.imageElement) startNewPath()
  }

  export function setVideo(video: HTMLVideoElement, restoreTime?: number) {
    video.loop = false
    const { setVideo: setupP5Video } = setupVideo(p5Instance!)
    const p5Video = setupP5Video(video, restoreTime)
    const elt = (p5Video as { elt: HTMLVideoElement }).elt
    elt.loop = false
    attachSource(new LocalVideoSource(elt), p5Video, restoreTime)
  }

  export function getVideoError() {
    return videoError
  }

  export function setYouTube(videoId: string, aspect = 16 / 9, restoreTime?: number) {
    youtubeAspect = aspect
    const next = new YouTubeVideoSource({ videoId, host: youtubeHost, startTime: restoreTime })
    attachSource(next, null, restoreTime)
    p5Instance?.loop()
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
          if (source) startNewPath()
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
    endCurrentTake(source)

    if ($drawingConfig.isTranscriptionMode && source) {
      source.currentTime = 0
      source.pause()
    }
    createNewPath(newColor)

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
    if (source) {
      source.currentTime = 0
      source.pause()
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
    unbindSource()
    unbindSource = () => {}
    try {
      source?.destroy()
      ;(videoElement as { remove: () => void } | null)?.remove()
    } catch (e) {
      window.console.warn('Error cleaning up video:', e)
    }
    youtubeHost?.replaceChildren()
    source = null
    videoElement = null
    videoError = null
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

  <!-- An iframe can't be drawn into the canvas, so YouTube sits over the video slot instead. -->
  <div
    class="absolute left-0 top-0 pointer-events-none"
    class:hidden={source?.kind !== 'youtube' || !$drawingConfig.isTranscriptionMode}
    style:width="{$drawingConfig.splitPosition}%"
    style:height="{videoHeight}%"
    style:container-type="size"
  >
    <div
      bind:this={youtubeHost}
      class="youtube-frame"
      style:--aspect={youtubeAspect}
      data-testid="youtube-slot"
    ></div>
    {#if videoError}
      <div
        class="absolute inset-0 flex items-center justify-center p-4 bg-base-200 pointer-events-auto"
        data-ui-element
        role="alert"
      >
        <div class="flex flex-col items-center gap-3 max-w-sm text-center">
          <IconVideoOff class="h-8 w-8 text-base-content/40" />
          <p class="text-sm font-medium">{videoError}</p>
          <p class="text-sm text-base-content/70">
            Upload the video file instead to keep tracing on the same timeline.
          </p>
          <label class="btn btn-sm btn-primary">
            <IconUpload class="h-4 w-4" />
            Upload video file
            <input type="file" class="hidden" accept="video/*" onchange={onVideoUpload} />
          </label>
        </div>
      </div>
    {/if}
  </div>

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
        {/if}
        <p>or try an example from the <span class="font-medium">Data</span> panel</p>
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
        getDuration={() => source?.duration ?? 0}
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

  {#if source}
    <VideoControls videoElement={source} />
  {:else if showSpeculateControls}
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
      <div class="flex flex-col justify-center pl-1 pr-2 leading-tight tabular-nums">
        <span class="text-sm font-medium" aria-label="Session time"
          >{formatClock(speculateTime)}</span
        >
        <span class="text-xs text-base-content/60">
          {#if pathStart !== undefined && pathEnd !== undefined}
            Path {formatClock(pathStart)}–{formatClock(pathEnd)}
          {:else}
            Path not started
          {/if}
        </span>
      </div>
    </div>
  {/if}

  <!-- Assets needed for recovered session -->
  {#if hasRecordedPaths}
    {@const alertMessage =
      $drawingConfig.isTranscriptionMode && !$drawingState.imageElement
        ? 'Upload your floor plan and video to continue recording'
        : $drawingConfig.isTranscriptionMode && !source
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

<style>
  .youtube-frame {
    position: absolute;
    inset: 0;
    margin: auto;
    width: min(100cqw, 100cqh * var(--aspect));
    height: min(100cqh, 100cqw / var(--aspect));
  }

  .youtube-frame :global(iframe) {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>
