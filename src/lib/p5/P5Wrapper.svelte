<script lang="ts">
  import { P5Canvas, type SketchFn } from 'svelte-p5'
  import type p5 from 'p5'
  import { onMount } from 'svelte'
  import { on } from 'svelte/events'
  import { fade } from 'svelte/transition'
  import {
    drawingConfig,
    getSplitPositionForMode,
    hasLeftColumn,
    SPACE_TIME_SPLIT_RANGE,
    SPLIT_POSITION_RANGE,
    videoHeightPercent,
  } from '../stores/drawingConfig'
  import {
    drawingState,
    createNewPath,
    findCurrentPath,
    PATH_COLORS,
    handleForward,
    handleRewind,
    STOPPED_TRACKING,
  } from '../stores/drawingState'
  import {
    setupDrawing,
    drawPaths,
    endCurrentTake,
    observeVideo,
    sampleHold,
    speculateNow,
  } from './features/drawing'
  import { PathLayer } from './features/pathLayer'
  import { createRedrawRequester, setLooping } from './loop'
  import {
    dataUrlBytes,
    EXPORT_ZIP_NAME,
    FLOOR_PLAN_FILE,
    pathCsvFiles,
  } from '$lib/export/pathExport'
  import { downloadBlob } from '$lib/utils/download'
  import { zipBlob } from '$lib/utils/zip'
  import { bindPlaybackState, setupVideo } from './features/video'
  import { LocalVideoSource, type VideoEvent, type VideoSource } from '$lib/video/source'
  import { YouTubeVideoSource } from '$lib/video/youtube'
  import VideoControls from '../components/video/VideoControls.svelte'
  import SpeculateControls from '../components/SpeculateControls.svelte'
  import { getFittedImageDisplayRect } from '$lib/utils/drawingUtils'
  import IconInfo from '~icons/material-symbols/info-outline'
  import IconVideoOff from '~icons/material-symbols/videocam-off-outline'
  import IconUpload from '~icons/material-symbols/upload'
  import { isShortcutEvent } from '$lib/utils/keyboard'
  import { hasRecordedData } from '$lib/stores/sessionRecovery'
  import { clamp } from '$lib/utils/math'
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

  const videoHtmlElement = $derived(
    videoElement ? (videoElement as { elt: HTMLVideoElement }).elt : null
  )
  const showSplit = $derived(hasLeftColumn($drawingConfig))
  const videoHeight = $derived(videoHeightPercent($drawingConfig))
  const showSpaceTime = $derived($drawingConfig.showSpaceTime)
  const hasRecordedPaths = $derived(hasRecordedData($drawingState.paths))

  function spaceTimeNow() {
    return $drawingConfig.isTranscriptionMode
      ? $drawingState.videoTime
      : speculateClock.timeAt(performance.now())
  }

  const showSpeculateControls = $derived(
    !$drawingConfig.isTranscriptionMode && $drawingState.imageElement !== null
  )

  let frameEstimator = new FrameRateEstimator()
  $effect(() => {
    if (!videoHtmlElement) return
    frameEstimator = new FrameRateEstimator()
    return watchVideoFrames(videoHtmlElement, frameEstimator)
  })

  const requestRedraw = createRedrawRequester(() => p5Instance)

  function syncLoop() {
    const p = p5Instance
    if (!p) return
    const { isDrawing, isVideoPlaying, shouldTrackMouse } = $drawingState
    const playing = source !== null && !source.paused
    setLooping(p, isDrawing || isVideoPlaying || shouldTrackMouse || playing)
    requestRedraw()
  }

  $effect(() => {
    void [$drawingState, $drawingConfig, $viewPrefs]
    syncLoop()
  })

  $effect(() => {
    const video = source
    if (!video) return
    const events: VideoEvent[] = ['play', 'pause', 'ended', 'seeked', 'loadeddata', 'ratechange']
    for (const e of events) video.addEventListener(e, syncLoop)
    return () => {
      for (const e of events) video.removeEventListener(e, syncLoop)
    }
  })

  function stepVideo(video: VideoSource, direction: 1 | -1, bySecond: boolean) {
    if (!video.paused || !(video.duration > 0)) return
    const fd = frameEstimator.frameDuration
    const fixed = bySecond ? 1 : video.fixedFrameStep
    video.currentTime = fixed
      ? clamp(video.currentTime + direction * fixed, 0, video.duration)
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

    if ('touches' in e && !e.touches.length) return

    const rect = containerDiv.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] : e
    if (dragAxis === 'x') {
      const position = ((point.clientX - rect.left) / rect.width) * 100
      const { min, max } = SPLIT_POSITION_RANGE
      drawingConfig.update((config) => ({ ...config, splitPosition: clamp(position, min, max) }))
    } else {
      const position = ((point.clientY - rect.top) / rect.height) * 100
      const { min, max } = SPACE_TIME_SPLIT_RANGE
      drawingConfig.update((config) => ({ ...config, spaceTimeSplit: clamp(position, min, max) }))
    }
  }

  let stopSplitterListeners = () => {}

  function startSplitterDrag(axis: 'x' | 'y') {
    return (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      stopSplitterListeners()
      dragAxis = axis
      const offs = [
        on(containerDiv, 'mousemove', handleSplitterDrag),
        on(containerDiv, 'mouseup', handleSplitterEnd),
        on(containerDiv, 'mouseleave', handleSplitterEnd),
        on(containerDiv, 'touchmove', handleSplitterDrag, { passive: false }),
        on(containerDiv, 'touchend', handleSplitterEnd),
        on(containerDiv, 'touchcancel', handleSplitterEnd),
      ]
      stopSplitterListeners = () => offs.forEach((off) => off())
    }
  }

  function handleSplitterEnd() {
    stopSplitterListeners()
    stopSplitterListeners = () => {}
    dragAxis = null
    syncLoop()
  }

  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isShortcutEvent(e)) return
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        handleForward(source)
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        handleRewind(source)
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
    const pathLayer = new PathLayer(requestRedraw)

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
      syncLoop()
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
      drawPaths(p5, pathLayer)
    }
  }

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

  // Returns the element p5 created so callers can read metadata off the video that is
  // actually being drawn, rather than keeping a second one alive just to report duration.
  export function setVideo(src: string, restoreTime?: number): HTMLVideoElement {
    const { setVideo: setupP5Video } = setupVideo(p5Instance!)
    const p5Video = setupP5Video(src, restoreTime)
    const elt = (p5Video as { elt: HTMLVideoElement }).elt
    elt.loop = false
    elt.autoplay = false
    attachSource(new LocalVideoSource(elt), p5Video, restoreTime)
    return elt
  }

  export function getVideoError() {
    return videoError
  }

  export function setYouTube(videoId: string, aspect = 16 / 9, restoreTime?: number) {
    youtubeAspect = aspect
    const next = new YouTubeVideoSource({ videoId, host: youtubeHost, startTime: restoreTime })
    attachSource(next, null, restoreTime)
    syncLoop()
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
      syncLoop()
    })
  }

  export function startNewPath(): boolean {
    // Don't allow adding a new path if current path is empty
    const currentPath = findCurrentPath($drawingState)
    if (currentPath && currentPath.points.length === 0) {
      return false
    }

    const currentPathCount = $drawingState.paths.length
    const newColor = PATH_COLORS[currentPathCount % PATH_COLORS.length]
    endCurrentTake(source)

    if ($drawingConfig.isTranscriptionMode && source) {
      source.currentTime = 0
      source.pause()
    }
    const speculateStart =
      !$drawingConfig.isTranscriptionMode && $viewPrefs.newPathStart === 'current'
        ? speculateNow()
        : 0
    createNewPath(newColor, speculateStart)

    drawingState.update((state) => ({ ...state, ...STOPPED_TRACKING }))
    return true
  }

  export function exportAll(onComplete?: () => void) {
    const imageElement = $drawingState?.imageElement
    const files: Record<string, Uint8Array> = {}

    // Add image to ZIP
    if (imageElement && p5Instance) {
      const canvas = p5Instance.createGraphics($drawingState.imageWidth, $drawingState.imageHeight)
      canvas.pixelDensity(1) // Prevent DPI scaling on retina displays
      canvas.image(imageElement, 0, 0)
      const dataUrl = (canvas as unknown as { canvas: HTMLCanvasElement }).canvas.toDataURL(
        'image/png'
      )
      files[FLOOR_PLAN_FILE] = dataUrlBytes(dataUrl)
      try {
        canvas.remove()
      } catch {
        // p5.Graphics cleanup can throw in some builds; safe to ignore
      }
    }

    // Add each path as CSV
    Object.assign(
      files,
      pathCsvFiles($drawingState.paths, {
        isTranscriptionMode: $drawingConfig.isTranscriptionMode,
        sampleRate: $drawingConfig.exportSampleRate,
        speculateScale: $drawingConfig.speculateScale,
      })
    )

    // Generate ZIP asynchronously (uses Web Workers, won't block UI)
    zipBlob(files)
      .then((blob) => downloadBlob(blob, EXPORT_ZIP_NAME))
      .catch((err) => window.console.error('Error creating ZIP:', err))
      .finally(() => onComplete?.())
  }

  export function clearDrawing() {
    if (source) {
      source.currentTime = 0
      source.pause()
    }

    drawingState.update((state) => ({ ...state, ...STOPPED_TRACKING, paths: [], currentPathId: 0 }))
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
  role="application"
  aria-label="Drawing Canvas"
>
  <P5Canvas {sketch} bind:instance={p5Instance} style="display: block;" />

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
      <SpaceTimeView getNow={spaceTimeNow} class="inset-0" />
    </div>
  {/if}

  {#if showSplit}
    <button
      class="absolute top-0 bottom-0 w-8 bg-transparent cursor-col-resize hover:bg-base-content/5 touch-none"
      style="left: calc({$drawingConfig.splitPosition}% - 16px)"
      data-ui-element
      onmousedown={startSplitterDrag('x')}
      {@attach (node) => on(node, 'touchstart', startSplitterDrag('x'), { passive: false })}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') startSplitterDrag('x')(e)
      }}
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
            const { min, max, step } = SPACE_TIME_SPLIT_RANGE
            const delta = e.key === 'ArrowUp' ? -step : step
            drawingConfig.update((c) => ({
              ...c,
              spaceTimeSplit: clamp(c.spaceTimeSplit + delta, min, max),
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
    <SpeculateControls left={showSplit ? ($drawingConfig.splitPosition + 100) / 2 : 50} />
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
