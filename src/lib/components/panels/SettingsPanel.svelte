<script lang="ts">
  import IconRotateLeft from '~icons/material-symbols/rotate-left'
  import IconRotateRight from '~icons/material-symbols/rotate-right'
  import { drawingConfig, rotateFloorPlan } from '$lib/stores/drawingConfig'
  import { drawingState } from '$lib/stores/drawingState'
  import PanelSection from './PanelSection.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import {
    TRAIL_LENGTHS,
    viewPrefs,
    type NewPathStart,
    type RecordingMode,
  } from '$lib/stores/viewPrefs'

  const recordingModes: { value: RecordingMode; label: string }[] = [
    { value: 'toggle', label: 'Click to toggle' },
    { value: 'hold', label: 'Hold to draw' },
  ]

  const newPathStarts: { value: NewPathStart; label: string }[] = [
    { value: 'zero', label: '0:00' },
    { value: 'current', label: 'Current time' },
  ]

  const strokeWeights = [1, 2, 3, 4, 5, 8, 10]
  const exportSampleRates = [1, 2, 5, 10, 20, 30, 60]

  const isTranscriptionMode = $derived($drawingConfig.isTranscriptionMode)
  const hasImage = $derived($drawingState.imageElement !== null)
  const isRecording = $derived($drawingState.shouldTrackMouse)

  const jumpRange = $derived(
    isTranscriptionMode
      ? { min: 5, max: 60, step: 5, value: $drawingConfig.jumpSeconds }
      : { min: 0.5, max: 10, step: 0.5, value: $drawingConfig.speculateJumpSeconds }
  )

  function setExportSampleRate(e: Event) {
    const exportSampleRate = parseInt((e.currentTarget as HTMLSelectElement).value)
    drawingConfig.update((c) => ({ ...c, exportSampleRate }))
  }

  function setStrokeWeight(e: Event) {
    const strokeWeight = parseInt((e.currentTarget as HTMLSelectElement).value)
    drawingConfig.update((c) => ({ ...c, strokeWeight }))
  }

  function setTrailSeconds(e: Event) {
    const trailSeconds = parseInt((e.currentTarget as HTMLSelectElement).value)
    viewPrefs.update((p) => ({ ...p, trailSeconds }))
  }

  function toggleContinuousMode() {
    drawingConfig.update((c) => ({ ...c, isContinuousMode: !c.isContinuousMode }))
  }

  function setJumpValue(e: Event) {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value)
    drawingConfig.update((c) => ({
      ...c,
      ...(c.isTranscriptionMode ? { jumpSeconds: value } : { speculateJumpSeconds: value }),
    }))
  }
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Recording">
    <SegmentedControl
      options={recordingModes}
      value={$viewPrefs.recordingMode}
      onSelect={(recordingMode) => viewPrefs.update((p) => ({ ...p, recordingMode }))}
      disabled={isRecording}
      label="Recording"
      class="w-full"
      itemClass="flex-1"
    />
    <p class="text-xs text-base-content/60">
      {#if isRecording}
        Stop recording to change this.
      {:else if $viewPrefs.recordingMode === 'hold'}
        Records only while you hold the mouse, pen or finger down.
      {:else}
        Click once to start recording and again to pause.
      {/if}
    </p>

    {#if !isTranscriptionMode}
      <div class="flex flex-col gap-1">
        <span id="new-path-start" class="text-sm">New path starts at</span>
        <SegmentedControl
          options={newPathStarts}
          value={$viewPrefs.newPathStart}
          onSelect={(newPathStart) => viewPrefs.update((p) => ({ ...p, newPathStart }))}
          labelledby="new-path-start"
          class="w-full"
          itemClass="flex-1"
        />
        <p class="text-xs text-base-content/60">
          {#if $viewPrefs.newPathStart === 'current'}
            A new path picks up the session clock where it is, for someone who arrives later.
          {:else}
            Every new path starts its own timeline at 0:00.
          {/if}
        </p>
      </div>
    {/if}
  </PanelSection>

  <PanelSection title="Sampling">
    <div class="flex flex-col gap-1">
      <label for="export-sample-rate" class="text-sm">Export Sample Rate</label>
      <select
        id="export-sample-rate"
        class="select select-bordered select-sm w-full"
        value={$drawingConfig.exportSampleRate}
        onchange={setExportSampleRate}
      >
        {#each exportSampleRates as rate (rate)}
          <option value={rate}>{rate} points/s</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <label for="jump-value" class="text-sm">Fast Forward / Rewind</label>
        <span class="text-sm text-base-content/60">{jumpRange.value}s</span>
      </div>
      <input
        id="jump-value"
        type="range"
        min={jumpRange.min}
        max={jumpRange.max}
        step={jumpRange.step}
        value={jumpRange.value}
        oninput={setJumpValue}
        class="range range-sm w-full"
      />
      <div class="flex justify-between text-xs text-base-content/40">
        <span>{jumpRange.min}s</span>
        <span>{jumpRange.max}s</span>
      </div>
    </div>
  </PanelSection>

  <PanelSection title="Rendering">
    <div class="flex flex-col gap-1">
      <label for="stroke-weight" class="text-sm">Stroke Weight</label>
      <select
        id="stroke-weight"
        class="select select-bordered select-sm w-full"
        value={$drawingConfig.strokeWeight}
        onchange={setStrokeWeight}
      >
        {#each strokeWeights as weight (weight)}
          <option value={weight}>{weight}px</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label for="trail-length" class="text-sm">Trails for Other Paths</label>
      <select
        id="trail-length"
        class="select select-bordered select-sm w-full"
        value={$viewPrefs.trailSeconds}
        onchange={setTrailSeconds}
      >
        {#each TRAIL_LENGTHS as seconds (seconds)}
          <option value={seconds}>{seconds === 0 ? 'Off' : `Last ${seconds}s`}</option>
        {/each}
      </select>
      <p class="text-xs text-base-content/60">
        Highlights where other paths just moved, while recording or playing.
      </p>
    </div>

    <label class="flex items-center justify-between gap-2 cursor-pointer">
      <span class="text-sm">Continuous Mode</span>
      <input
        type="checkbox"
        class="toggle toggle-sm toggle-primary"
        checked={$drawingConfig.isContinuousMode}
        onchange={toggleContinuousMode}
      />
    </label>
  </PanelSection>

  {#if hasImage}
    <PanelSection title="Floor Plan">
      <div class="flex items-center gap-2">
        <button
          class="btn btn-sm btn-outline flex-1"
          onclick={() => rotateFloorPlan('ccw')}
          title={isRecording ? 'Stop recording to rotate' : 'Rotate counterclockwise'}
          disabled={isRecording}
        >
          <IconRotateLeft class="w-4 h-4" />
          Rotate left
        </button>
        <button
          class="btn btn-sm btn-outline flex-1"
          onclick={() => rotateFloorPlan('cw')}
          title={isRecording ? 'Stop recording to rotate' : 'Rotate clockwise'}
          disabled={isRecording}
        >
          <IconRotateRight class="w-4 h-4" />
          Rotate right
        </button>
      </div>
      {#if isRecording}
        <p class="text-xs text-base-content/60">Stop recording to rotate.</p>
      {/if}
    </PanelSection>
  {/if}
</div>
