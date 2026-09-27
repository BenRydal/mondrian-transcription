<script lang="ts">
  import IconRotateLeft from '~icons/material-symbols/rotate-left'
  import IconRotateRight from '~icons/material-symbols/rotate-right'
  import { drawingConfig, rotateFloorPlan } from '$lib/stores/drawingConfig'
  import { drawingState } from '$lib/stores/drawingState'
  import PanelSection from './PanelSection.svelte'

  const strokeWeights = [1, 2, 3, 4, 5, 8, 10]
  const pollingRates = [
    { labelVideo: '4ms', labelSpeculate: '4 steps', value: 4 },
    { labelVideo: '8ms', labelSpeculate: '8 steps', value: 8 },
    { labelVideo: '16ms', labelSpeculate: '16 steps', value: 16 },
    { labelVideo: '32ms', labelSpeculate: '32 steps', value: 32 },
    { labelVideo: '64ms', labelSpeculate: '64 steps', value: 64 },
    { labelVideo: '100ms', labelSpeculate: '100 steps', value: 100 },
  ]

  const isTranscriptionMode = $derived($drawingConfig.isTranscriptionMode)
  const hasImage = $derived($drawingState.imageElement !== null)
  const isRecording = $derived($drawingState.shouldTrackMouse)

  function setPollingRate(e: Event) {
    const pollingRate = parseInt((e.currentTarget as HTMLSelectElement).value)
    drawingConfig.update((c) => ({ ...c, pollingRate }))
  }

  function setStrokeWeight(e: Event) {
    const strokeWeight = parseInt((e.currentTarget as HTMLSelectElement).value)
    drawingConfig.update((c) => ({ ...c, strokeWeight }))
  }

  function toggleAdaptiveSampling() {
    drawingConfig.update((c) => ({ ...c, useAdaptiveSampling: !c.useAdaptiveSampling }))
  }

  function toggleContinuousMode() {
    drawingConfig.update((c) => ({ ...c, isContinuousMode: !c.isContinuousMode }))
  }

  function setJumpValue(e: Event) {
    const value = parseInt((e.currentTarget as HTMLInputElement).value)
    drawingConfig.update((c) => ({
      ...c,
      ...(c.isTranscriptionMode ? { jumpSeconds: value } : { jumpSteps: value }),
    }))
  }
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Sampling">
    <div class="flex flex-col gap-1">
      <label for="polling-rate" class="text-sm">Point Capture Interval</label>
      <select
        id="polling-rate"
        class="select select-bordered select-sm w-full"
        value={$drawingConfig.pollingRate}
        onchange={setPollingRate}
      >
        {#each pollingRates as rate (rate.value)}
          <option value={rate.value}>
            {isTranscriptionMode ? rate.labelVideo : rate.labelSpeculate}
          </option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="flex items-center justify-between gap-2 cursor-pointer">
        <span class="text-sm">Adaptive Sampling</span>
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          checked={$drawingConfig.useAdaptiveSampling}
          onchange={toggleAdaptiveSampling}
        />
      </label>
      <p class="text-xs text-base-content/60">
        When ON: samples frequently during movement, less when stationary. When OFF: fixed interval
        sampling.
      </p>
    </div>

    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <label for="jump-value" class="text-sm">Fast Forward / Rewind</label>
        <span class="text-sm text-base-content/60">
          {isTranscriptionMode
            ? `${$drawingConfig.jumpSeconds}s`
            : `${$drawingConfig.jumpSteps} steps`}
        </span>
      </div>
      <input
        id="jump-value"
        type="range"
        min="5"
        max={isTranscriptionMode ? 60 : 50}
        step="5"
        value={isTranscriptionMode ? $drawingConfig.jumpSeconds : $drawingConfig.jumpSteps}
        oninput={setJumpValue}
        class="range range-sm w-full"
      />
      <div class="flex justify-between text-xs text-base-content/40">
        <span>5{isTranscriptionMode ? 's' : ''}</span>
        <span>{isTranscriptionMode ? '60s' : '50'}</span>
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
