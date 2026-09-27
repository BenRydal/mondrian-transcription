<script lang="ts">
  import IconDownload from '~icons/material-symbols/download'
  import IconImage from '~icons/material-symbols/image'
  import Modal from './Modal.svelte'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import { drawingState } from '$lib/stores/drawingState'
  import { formatPoints } from '$lib/utils/format'
  import { exportFileName, FLOOR_PLAN_FILE } from '$lib/export/pathExport'
  import { hasRecordedData } from '$lib/stores/sessionRecovery'

  let { onSavePath }: { onSavePath: (onComplete?: () => void) => void } = $props()

  let showScaleModal = $state(false)
  let showExportPreviewModal = $state(false)
  let isExporting = $state(false)
  let minutes = $state(0)
  let seconds = $state(10)

  const scaleSeconds = $derived(minutes * 60 + seconds)
  const paths = $derived($drawingState.paths)
  const hasImage = $derived($drawingState.imageElement !== null)
  const hasExportableData = $derived(hasImage || hasRecordedData(paths))

  export function start() {
    if ($drawingConfig.isTranscriptionMode) {
      showExportPreviewModal = true
    } else {
      showScaleModal = true
    }
  }

  function confirmScale() {
    drawingConfig.update((c) => ({ ...c, speculateScale: scaleSeconds }))
    showScaleModal = false
    showExportPreviewModal = true
  }

  function confirmExport() {
    isExporting = true
    onSavePath(() => {
      isExporting = false
      showExportPreviewModal = false
    })
  }
</script>

<Modal
  id="scale_modal"
  open={showScaleModal}
  title="Set Time Scale"
  onClose={() => (showScaleModal = false)}
>
  <p class="mb-4 text-sm">
    In <strong>Speculate Mode</strong>, all paths are scaled by one factor so the session ends at
    the chosen duration. Paths keep their relative timing. Enter total time below:
  </p>

  <div class="flex gap-2 mb-2">
    <div class="flex-1">
      <label for="minutes-input" class="block text-xs font-medium mb-1">Minutes</label>
      <input
        id="minutes-input"
        type="number"
        min="0"
        class="input input-bordered w-full"
        bind:value={minutes}
      />
    </div>
    <div class="flex-1">
      <label for="seconds-input" class="block text-xs font-medium mb-1">Seconds</label>
      <input
        id="seconds-input"
        type="number"
        min="0"
        max="59"
        class="input input-bordered w-full"
        bind:value={seconds}
      />
    </div>
  </div>

  <p class="text-sm text-base-content/70 mb-4">
    Total duration: <strong>{scaleSeconds} seconds</strong>
  </p>

  {#if scaleSeconds <= 0}
    <p class="text-error text-xs mb-2">Please enter a duration greater than 0 seconds.</p>
  {/if}

  <div class="modal-action">
    <button class="btn" onclick={() => (showScaleModal = false)}>Cancel</button>
    <button class="btn btn-primary" onclick={confirmScale} disabled={scaleSeconds <= 0}>
      Save with Scaling
    </button>
  </div>
</Modal>

<Modal
  id="export_preview_modal"
  open={showExportPreviewModal}
  title="Export Preview"
  onClose={() => (showExportPreviewModal = false)}
  class="w-96 max-w-[90vw]"
>
  <p class="mb-4 text-sm text-base-content/70">The following files will be included in your ZIP:</p>

  <div class="bg-base-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
    {#if hasImage}
      <div class="flex items-center gap-2 text-sm">
        <IconImage class="w-4 h-4 text-primary" />
        <span class="font-mono">{FLOOR_PLAN_FILE}</span>
      </div>
    {/if}

    {#each paths as path, index (path.pathId)}
      {#if path.points.length > 0}
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {path.color}"
            ></span>
            <span class="font-mono">{exportFileName(path, index)}</span>
          </div>
          <span class="text-base-content/50 text-xs">
            {formatPoints(path.points.length)} pts
          </span>
        </div>
      {/if}
    {/each}

    {#if !hasExportableData}
      <p class="text-sm text-base-content/50 italic">No data to export</p>
    {/if}
  </div>

  <div class="modal-action">
    <button class="btn" onclick={() => (showExportPreviewModal = false)}>Cancel</button>
    <button
      class="btn btn-primary"
      onclick={confirmExport}
      disabled={!hasExportableData || isExporting}
    >
      {#if isExporting}
        <span class="loading loading-spinner loading-sm"></span>
        Exporting...
      {:else}
        <IconDownload class="w-4 h-4" />
        Download ZIP
      {/if}
    </button>
  </div>
</Modal>
