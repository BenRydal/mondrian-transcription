<script lang="ts">
  import { handleForwardTranscription, handleRewindTranscription } from '../../stores/drawingState'
  import { PLAYBACK_RATES, formatRate, viewPrefs } from '../../stores/viewPrefs'
  import { formatClock } from '$lib/utils/time'
  import type { VideoSource } from '$lib/video/source'
  import IconRewind from '~icons/material-symbols/fast-rewind'
  import IconForward from '~icons/material-symbols/fast-forward'

  let { videoElement }: { videoElement: VideoSource } = $props()

  let progress = $state(0)
  let duration = $state(0)
  let currentTime = $state(0)
  let supportedRates = $state<readonly number[]>(PLAYBACK_RATES)
  let isDraggingProgress = false
  let progressBarElement: HTMLDivElement

  function updateDuration() {
    if (!isNaN(videoElement.duration)) duration = videoElement.duration
  }

  function updateProgress() {
    if (isDraggingProgress) return
    if (!isNaN(videoElement.duration) && videoElement.duration > 0) {
      progress = (videoElement.currentTime / videoElement.duration) * 100
      currentTime = videoElement.currentTime
    } else {
      progress = 0
      currentTime = 0
    }
  }

  function handleProgressBarClick(e: MouseEvent | TouchEvent) {
    if (!progressBarElement) return

    const rect = progressBarElement.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const pos = (clientX - rect.left) / rect.width
    videoElement.currentTime = pos * videoElement.duration
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      videoElement.currentTime = Math.max(0, videoElement.currentTime - 5)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 5)
    }
  }

  function handleProgressBarDrag(e: MouseEvent | TouchEvent) {
    if (isDraggingProgress && progressBarElement) {
      handleProgressBarClick(e)
    }
  }

  function setRate(e: Event) {
    const playbackRate = parseFloat((e.currentTarget as HTMLSelectElement).value)
    viewPrefs.update((p) => ({ ...p, playbackRate }))
  }

  $effect(() => {
    const video = videoElement
    const events = ['timeupdate', 'seeked', 'loadedmetadata', 'durationchange'] as const
    const onChange = () => {
      updateDuration()
      updateProgress()
    }
    // timeupdate fires only a few times a second, too slow for a tenths display.
    let raf = 0
    const tick = () => {
      onChange()
      raf = video.paused ? 0 : requestAnimationFrame(tick)
    }
    const onPlay = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onRates = () => {
      supportedRates = PLAYBACK_RATES.filter((r) => video.supportsRate(r))
    }
    for (const name of events) video.addEventListener(name, onChange)
    video.addEventListener('play', onPlay)
    video.addEventListener('ratechange', onRates)
    onChange()
    onRates()
    if (!video.paused) onPlay()
    return () => {
      for (const name of events) video.removeEventListener(name, onChange)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('ratechange', onRates)
      cancelAnimationFrame(raf)
    }
  })

  $effect(() => {
    videoElement.playbackRate = $viewPrefs.playbackRate
  })
</script>

<div class="video-controls p-2 rounded-b-lg" data-ui-element>
  <div class="w-full flex items-center gap-2">
    <!-- Rewind button -->
    <button
      class="btn btn-ghost btn-sm btn-circle"
      onclick={() => handleRewindTranscription(videoElement)}
      aria-label="Rewind 5 seconds"
      title="Rewind 5s (R)"
    >
      <IconRewind class="h-5 w-5" />
    </button>

    <div
      bind:this={progressBarElement}
      class="progress progress-secondary flex-1 cursor-pointer relative touch-none"
      onmousedown={() => (isDraggingProgress = true)}
      onmousemove={handleProgressBarDrag}
      onmouseup={() => (isDraggingProgress = false)}
      onmouseleave={() => (isDraggingProgress = false)}
      onclick={handleProgressBarClick}
      ontouchstart={(e) => {
        isDraggingProgress = true
        handleProgressBarClick(e) // Seek immediately on tap
      }}
      ontouchmove={handleProgressBarDrag}
      ontouchend={() => (isDraggingProgress = false)}
      ontouchcancel={() => (isDraggingProgress = false)}
      onkeydown={handleKeyPress}
      role="slider"
      aria-label="Video progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={progress}
      tabindex="0"
    >
      <div
        class="progress-bar-fill bg-secondary h-full transition-all duration-100"
        style="width: {progress}%"
      ></div>
    </div>

    <!-- Forward button -->
    <button
      class="btn btn-ghost btn-sm btn-circle"
      onclick={() => handleForwardTranscription(videoElement)}
      aria-label="Forward 5 seconds"
      title="Forward 5s (F)"
    >
      <IconForward class="h-5 w-5" />
    </button>
  </div>

  <div class="flex justify-between items-center mt-1 text-sm">
    <span class="tabular-nums">{formatClock(currentTime)}</span>
    <select
      class="select select-ghost select-xs w-auto"
      aria-label="Playback speed"
      title="Playback speed ([ slower, ] faster)"
      value={$viewPrefs.playbackRate}
      onchange={setRate}
    >
      {#each PLAYBACK_RATES as rate (rate)}
        <option
          value={rate}
          disabled={!supportedRates.includes(rate)}
          title={supportedRates.includes(rate) ? undefined : 'Not available for this video'}
          >{formatRate(rate)}</option
        >
      {/each}
    </select>
    <span class="tabular-nums">{formatClock(duration)}</span>
  </div>
</div>

<style>
  .video-controls {
    position: absolute;
    bottom: var(--video-controls-bottom, 0);
    left: 0;
    z-index: 10;
    width: var(--split-width);
  }

  .progress:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .progress-bar-fill {
    border-radius: inherit;
  }
</style>
