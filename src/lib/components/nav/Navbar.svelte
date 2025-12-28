<script lang="ts">
  import IconHelp from '~icons/material-symbols/help-outline'
  import IconSettings from '~icons/material-symbols/settings'
  import IconUpload from '~icons/material-symbols/upload'
  import IconDownload from '~icons/material-symbols/download'
  import IconDelete from '~icons/material-symbols/delete-outline'
  import IconDeleteAll from '~icons/material-symbols/delete-sweep-outline'
  import IconPlayArrow from '~icons/material-symbols/play-arrow'
  import IconFastForward from '~icons/material-symbols/fast-forward'
  import IconRewind from '~icons/material-symbols/fast-rewind'
  import IconImage from '~icons/material-symbols/image'
  import IconVideo from '~icons/material-symbols/videocam'
  import IconStylusNote from '~icons/material-symbols/stylus-note'
  import IconPrivacyTip from '~icons/material-symbols/privacy-tip'
  import IconClick from '~icons/material-symbols/touch-app'
  import IconMenu from '~icons/material-symbols/menu'
  import IconClose from '~icons/material-symbols/close'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import { drawingState } from '$lib/stores/drawingState'

  export let onImageUpload: (event: Event) => void
  export let onVideoUpload: (event: Event) => void
  export let onSavePath: (onComplete?: () => void) => void
  export let onClear: () => void
  export let onNewPath: () => void
  export let onSelectExample: (data: string) => void
  export let onModeSwitch: () => void

  let showModal = false
  let showClearAllModal = false
  let isExporting = false
  let showMobileMenu = false
  // Use strings for safe comparison with option values
  let pendingValue = get(drawingConfig).isTranscriptionMode ? 'true' : 'false'
  let originalValue = pendingValue

  // Sync when store changes externally (e.g., session recovery)
  $: if (!showModal) {
    const storeValue = $drawingConfig.isTranscriptionMode ? 'true' : 'false'
    pendingValue = storeValue
    originalValue = storeValue
  }

  // Define modes as strings
  const modes = [
    { label: 'Transcription Mode', value: 'true' },
    { label: 'Speculate Mode', value: 'false' },
  ]

  let showScaleModal = false
  let showExportPreviewModal = false
  let showUploadModal = false
  let isDraggingFile = false
  let minutes = 0
  let seconds = 10 // default

  $: scaleSeconds = minutes * 60 + seconds
  $: paths = $drawingState.paths
  $: hasImage = $drawingState.imageElement !== null
  $: hasExportableData = hasImage || paths.some(p => p.points.length > 0)

  onMount(() => {
    openHelpModal()
  })

  const strokeWeights = [1, 2, 3, 4, 5, 8, 10]
  const pollingRates = [
    { labelVideo: '4ms', labelSpeculate: '4 steps', value: 4 },
    { labelVideo: '8ms', labelSpeculate: '8 steps', value: 8 },
    { labelVideo: '16ms', labelSpeculate: '16 steps', value: 16 },
    { labelVideo: '32ms', labelSpeculate: '32 steps', value: 32 },
    { labelVideo: '64ms', labelSpeculate: '64 steps', value: 64 },
    { labelVideo: '100ms', labelSpeculate: '100 steps', value: 100 },
  ]

  const examples = [
    { id: 'classroom', label: 'Classroom Space' },
    { id: 'museum', label: 'Museum Gallery' },
    { id: 'basketball', label: 'Basketball Court' },
  ]

  function handleExport() {
    if ($drawingConfig.isTranscriptionMode) {
      showExportPreviewModal = true
    } else {
      showScaleModal = true // ask for scaling first
    }
  }

  function confirmScale() {
    drawingConfig.update((c) => ({
      ...c,
      speculateScale: scaleSeconds,
    }))
    showScaleModal = false
    showExportPreviewModal = true
  }

  function cancelScale() {
    showScaleModal = false
  }

  function confirmExport() {
    isExporting = true
    onSavePath(() => {
      isExporting = false
      showExportPreviewModal = false
    })
  }

  function cancelExport() {
    showExportPreviewModal = false
  }

  function formatPoints(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  function handleModeChange(e) {
    pendingValue = e.currentTarget.value
    showModal = true
  }

  function confirmSwitch() {
    // Clear existing data
    onModeSwitch()

    // Update store
    drawingConfig.update((c) => ({
      ...c,
      isTranscriptionMode: pendingValue === 'true',
    }))

    originalValue = pendingValue
    showModal = false
  }

  function cancelSwitch() {
    // Revert select UI back to original
    pendingValue = originalValue
    showModal = false
  }

  function confirmClearAll() {
    onClear()
    showClearAllModal = false
  }

  function cancelClearAll() {
    showClearAllModal = false
  }

  function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    if (file.type.startsWith('video/')) {
      onVideoUpload(event)
    } else if (file.type.startsWith('image/')) {
      onImageUpload(event)
    } else {
      window.alert('Please upload a video or image file')
      return
    }

    showUploadModal = false
    ;(event.target as HTMLInputElement).value = ''
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = true
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = false

    const file = e.dataTransfer?.files[0]
    if (!file) return

    // Create a synthetic event for the existing handlers
    const input = document.createElement('input')
    input.type = 'file'
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    const syntheticEvent = { target: input } as unknown as Event

    if (file.type.startsWith('video/')) {
      onVideoUpload(syntheticEvent)
    } else if (file.type.startsWith('image/')) {
      onImageUpload(syntheticEvent)
    } else {
      window.alert('Please upload a video or image file')
      return
    }
    showUploadModal = false
  }

  function preventDrawing(e: MouseEvent) {
    e.stopPropagation()
  }

  function openHelpModal() {
    const modal = window.document.getElementById('help_modal')
    if (modal instanceof HTMLDialogElement) {
      modal.showModal()
    }
  }

  // Config update helpers to reduce duplication
  function setPollingRate(e: Event) {
    drawingConfig.update((c) => ({
      ...c,
      pollingRate: parseInt((e.currentTarget as HTMLSelectElement).value),
    }))
  }

  function setStrokeWeight(e: Event) {
    drawingConfig.update((c) => ({
      ...c,
      strokeWeight: parseInt((e.currentTarget as HTMLSelectElement).value),
    }))
  }

  function toggleAdaptiveSampling() {
    drawingConfig.update((c) => ({
      ...c,
      useAdaptiveSampling: !c.useAdaptiveSampling,
    }))
  }

  function toggleContinuousMode() {
    drawingConfig.update((c) => ({
      ...c,
      isContinuousMode: !c.isContinuousMode,
    }))
  }

  function getPollingRateLabel(rate: typeof pollingRates[number]): string {
    return $drawingConfig.isTranscriptionMode ? rate.labelVideo : rate.labelSpeculate
  }
</script>

<div
  class="navbar bg-base-100 h-16 px-2 md:px-4"
  role="presentation"
  on:mousedown={preventDrawing}
  on:mouseup={preventDrawing}
  on:mousemove={preventDrawing}
>
  <!-- Logo - always visible -->
  <div class="flex-1">
    <a class="btn btn-ghost text-lg md:text-xl px-2" href="https://interactiongeography.org">Mondrian</a>
  </div>

  <!-- Desktop Navigation - hidden on small screens -->
  <div class="hidden lg:flex justify-end items-center gap-2">
    <!-- Clear All Button -->
    <button class="btn btn-ghost" on:click={() => (showClearAllModal = true)} title="Clear all paths">
      <IconDeleteAll class="w-5 h-5" />
      Clear All
    </button>

    <div class="divider divider-horizontal"></div>

    <!-- Export Data -->
    <button class="btn btn-ghost" on:click={handleExport}
      ><IconDownload class="w-5 h-5" />Export</button
    >

    <!-- File Upload -->
    <button class="btn btn-ghost" on:click={() => (showUploadModal = true)}>
      <IconUpload class="w-5 h-5" />
      Upload
    </button>

    <div class="divider divider-horizontal"></div>

    <!-- Mode -->
    <div>
      <label class="label cursor-pointer flex-col items-start">
        <select
          id="mode-select"
          class="select select-bordered select-sm w-full"
          bind:value={pendingValue}
          on:change={handleModeChange}
        >
          {#each modes as m (m.value)}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <!-- Sample Data for Speculate Mode -->
    {#if !$drawingConfig.isTranscriptionMode}
      <!-- Example Data Dropdown -->
      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-neutral flex items-center gap-2">
          <IconImage class="w-5 h-5" />
          <span>Example Data</span>
        </div>

        <ul
          class="dropdown-content menu bg-base-100 rounded-box z-[100] w-72 p-3 shadow-lg mt-2 border border-base-300"
          role="menu"
        >
          {#each examples as example (example.id)}
            <li class="mb-1">
              <button
                class="btn btn-sm btn-outline w-full text-left text-base-content border-base-300 hover:bg-base-200 transition"
                on:click={() => onSelectExample(example.id)}
              >
                {example.label}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- New Path -->
    <button class="btn btn-neutral gap-2" on:click={onNewPath}> New Path </button>

    <!-- Settings Dropdown -->
    <div class="dropdown dropdown-end" role="none" on:click={preventDrawing} data-ui-element>
      <button
        tabindex="0"
        class="btn btn-ghost"
        on:keydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
          }
        }}
        aria-label="Settings menu"
      >
        <IconSettings class="w-5 h-5" />
      </button>

      <ul
        class="dropdown-content menu bg-base-100 rounded-box z-[1] w-80 p-4 shadow mt-4"
        role="menu"
      >
        <!-- Sampling Section -->
        <li class="menu-title text-xs uppercase text-base-content/50 pt-0 text-center">Sampling</li>

        <!-- Point Capture Interval -->
        <li>
          <label class="label cursor-pointer flex-col items-start gap-2">
            <span class="label-text w-full">Point Capture Interval</span>
            <select
              class="select select-bordered select-sm w-full"
              value={$drawingConfig.pollingRate}
              on:change={setPollingRate}
            >
              {#each pollingRates as rate (rate.value)}
                <option value={rate.value}>{getPollingRateLabel(rate)}</option>
              {/each}
            </select>
          </label>
        </li>

        <!-- Adaptive Sampling Toggle -->
        <li>
          <label class="label cursor-pointer flex-col items-start gap-2 w-full">
            <div class="flex items-center justify-between w-full">
              <span class="label-text">Adaptive Sampling</span>
              <div class="tooltip tooltip-left" data-tip="When ON: samples frequently during movement, less when stationary. When OFF: fixed interval sampling.">
                <IconHelp class="w-4 h-4 text-base-content/50" />
              </div>
            </div>
            <button
              type="button"
              class="btn btn-sm w-full transition-colors duration-200"
              class:bg-blue-800={$drawingConfig.useAdaptiveSampling}
              class:text-white={$drawingConfig.useAdaptiveSampling}
              class:bg-gray-200={!$drawingConfig.useAdaptiveSampling}
              class:text-gray-800={!$drawingConfig.useAdaptiveSampling}
              on:click={toggleAdaptiveSampling}
            >
              {#if $drawingConfig.useAdaptiveSampling}ON{:else}OFF{/if}
            </button>
          </label>
        </li>

        <div class="divider my-1"></div>

        <!-- Rendering Section -->
        <li class="menu-title text-xs uppercase text-base-content/50 text-center">Rendering</li>

        <!-- Stroke Weight -->
        <li>
          <label class="label cursor-pointer flex-col items-start gap-2">
            <span class="label-text w-full">Stroke Weight</span>
            <select
              class="select select-bordered select-sm w-full"
              value={$drawingConfig.strokeWeight}
              on:change={setStrokeWeight}
            >
              {#each strokeWeights as weight (weight)}
                <option value={weight}>{weight}px</option>
              {/each}
            </select>
          </label>
        </li>

        <!-- Continuous Mode Toggle -->
        <li>
          <label class="label cursor-pointer flex-col items-start gap-2 w-full">
            <span class="label-text w-full">Continuous Mode</span>
            <button
              type="button"
              class="btn btn-sm w-full transition-colors duration-200"
              class:bg-blue-800={$drawingConfig.isContinuousMode}
              class:text-white={$drawingConfig.isContinuousMode}
              class:bg-gray-200={!$drawingConfig.isContinuousMode}
              class:text-gray-800={!$drawingConfig.isContinuousMode}
              on:click={toggleContinuousMode}
            >
              {#if $drawingConfig.isContinuousMode}ON{:else}OFF{/if}
            </button>
          </label>
        </li>
      </ul>
    </div>

    <!-- Help -->
    <button class="btn btn-ghost" on:click={openHelpModal}>
      <IconHelp class="w-5 h-5" />
    </button>
  </div>

  <!-- Mobile Navigation - visible on small screens -->
  <div class="flex lg:hidden items-center gap-1">
    <!-- Quick action buttons always visible on mobile -->
    <button class="btn btn-ghost btn-sm" on:click={() => (showUploadModal = true)} title="Upload">
      <IconUpload class="w-5 h-5" />
    </button>
    <button class="btn btn-ghost btn-sm" on:click={handleExport} title="Export">
      <IconDownload class="w-5 h-5" />
    </button>
    <button class="btn btn-neutral btn-sm" on:click={onNewPath} title="New Path">
      New Path
    </button>

    <!-- Hamburger Menu Button -->
    <button
      class="btn btn-ghost btn-sm"
      on:click={() => (showMobileMenu = !showMobileMenu)}
      aria-label="Toggle menu"
    >
      {#if showMobileMenu}
        <IconClose class="w-6 h-6" />
      {:else}
        <IconMenu class="w-6 h-6" />
      {/if}
    </button>
  </div>
</div>

<!-- Mobile Menu Dropdown -->
{#if showMobileMenu}
  <div
    class="lg:hidden fixed top-16 left-0 right-0 bg-base-100 border-b border-base-300 shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto"
    role="presentation"
    on:mousedown={preventDrawing}
    on:mouseup={preventDrawing}
    on:mousemove={preventDrawing}
  >
    <div class="p-4 space-y-3">
      <!-- Mode Selector -->
      <div class="form-control">
        <label class="label" for="mobile-mode-select">
          <span class="label-text font-medium">Mode</span>
        </label>
        <select
          id="mobile-mode-select"
          class="select select-bordered w-full"
          bind:value={pendingValue}
          on:change={handleModeChange}
        >
          {#each modes as m (m.value)}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
      </div>

      <!-- Example Data for Speculate Mode -->
      {#if !$drawingConfig.isTranscriptionMode}
        <div class="form-control">
          <span class="label-text font-medium mb-2">Example Data</span>
          <div class="flex flex-wrap gap-2">
            {#each examples as example (example.id)}
              <button
                class="btn btn-sm btn-outline"
                on:click={() => {
                  onSelectExample(example.id)
                  showMobileMenu = false
                }}
              >
                {example.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="divider my-2"></div>

      <!-- Settings Section -->
      <div class="text-xs uppercase text-base-content/50 font-medium">Sampling</div>

      <!-- Point Capture Interval -->
      <div class="form-control">
        <label class="label py-1" for="mobile-polling-rate">
          <span class="label-text">Point Capture Interval</span>
        </label>
        <select
          id="mobile-polling-rate"
          class="select select-bordered select-sm w-full"
          value={$drawingConfig.pollingRate}
          on:change={setPollingRate}
        >
          {#each pollingRates as rate (rate.value)}
            <option value={rate.value}>{getPollingRateLabel(rate)}</option>
          {/each}
        </select>
      </div>

      <!-- Adaptive Sampling -->
      <div class="form-control">
        <label class="label py-1 cursor-pointer justify-between">
          <span class="label-text">Adaptive Sampling</span>
          <input
            type="checkbox"
            class="toggle [--tglbg:#1e40af] checked:bg-blue-800 checked:border-blue-800"
            checked={$drawingConfig.useAdaptiveSampling}
            on:change={toggleAdaptiveSampling}
          />
        </label>
      </div>

      <div class="divider my-2"></div>

      <div class="text-xs uppercase text-base-content/50 font-medium">Rendering</div>

      <!-- Stroke Weight -->
      <div class="form-control">
        <label class="label py-1" for="mobile-stroke-weight">
          <span class="label-text">Stroke Weight</span>
        </label>
        <select
          id="mobile-stroke-weight"
          class="select select-bordered select-sm w-full"
          value={$drawingConfig.strokeWeight}
          on:change={setStrokeWeight}
        >
          {#each strokeWeights as weight (weight)}
            <option value={weight}>{weight}px</option>
          {/each}
        </select>
      </div>

      <!-- Continuous Mode -->
      <div class="form-control">
        <label class="label py-1 cursor-pointer justify-between">
          <span class="label-text">Continuous Mode</span>
          <input
            type="checkbox"
            class="toggle [--tglbg:#1e40af] checked:bg-blue-800 checked:border-blue-800"
            checked={$drawingConfig.isContinuousMode}
            on:change={toggleContinuousMode}
          />
        </label>
      </div>

      <div class="divider my-2"></div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-2">
        <button
          class="btn btn-ghost justify-start"
          on:click={() => {
            showClearAllModal = true
            showMobileMenu = false
          }}
        >
          <IconDeleteAll class="w-5 h-5" />
          Clear All Paths
        </button>
        <button
          class="btn btn-ghost justify-start"
          on:click={() => {
            openHelpModal()
            showMobileMenu = false
          }}
        >
          <IconHelp class="w-5 h-5" />
          Help
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- All Modals (shared between desktop and mobile) -->

<!-- Scale Modal using DaisyUI Modal -->
<dialog id="scale_modal" class="modal" class:modal-open={showScaleModal} data-ui-element>
  <div class="modal-box w-80">
    <h2 class="text-lg font-semibold mb-4">Set Time Scale</h2>
    <p class="mb-4 text-sm">
      In <strong>Speculate Mode</strong>, recorded data is stretched over a chosen duration.
      Enter total time below:
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
      <button class="btn" on:click={cancelScale}>Cancel</button>
      <button class="btn btn-primary" on:click={confirmScale} disabled={scaleSeconds <= 0}>
        Save with Scaling
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={cancelScale}>close</button>
  </form>
</dialog>

<!-- Mode Switch Modal using DaisyUI Modal -->
<dialog id="mode_switch_modal" class="modal" class:modal-open={showModal} data-ui-element>
  <div class="modal-box w-80">
    <h2 class="text-lg font-semibold mb-4">Switch Mode?</h2>
    <p class="mb-6 text-sm">
      Switching modes will erase all recorded data. Do you want to continue?
    </p>
    <div class="modal-action">
      <button class="btn" on:click={cancelSwitch}>Cancel</button>
      <button class="btn btn-error" on:click={confirmSwitch}>Switch</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={cancelSwitch}>close</button>
  </form>
</dialog>

<!-- Clear All Modal -->
<dialog id="clear_all_modal" class="modal" class:modal-open={showClearAllModal} data-ui-element>
  <div class="modal-box w-80">
    <h2 class="text-lg font-semibold mb-4">Clear All Paths?</h2>
    <p class="mb-6 text-sm">
      This will delete all recorded paths. This action cannot be undone.
    </p>
    <div class="modal-action">
      <button class="btn" on:click={cancelClearAll}>Cancel</button>
      <button class="btn btn-error" on:click={confirmClearAll}>Clear All</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={cancelClearAll}>close</button>
  </form>
</dialog>

<!-- Export Preview Modal -->
<dialog id="export_preview_modal" class="modal" class:modal-open={showExportPreviewModal} data-ui-element>
  <div class="modal-box w-96 max-w-[90vw]">
    <h2 class="text-lg font-semibold mb-4">Export Preview</h2>
    <p class="mb-4 text-sm text-base-content/70">
      The following files will be included in your ZIP:
    </p>

    <div class="bg-base-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
      {#if hasImage}
        <div class="flex items-center gap-2 text-sm">
          <IconImage class="w-4 h-4 text-primary" />
          <span class="font-mono">floor-plan.png</span>
        </div>
      {/if}

      {#each paths as path, index (path.pathId)}
        {#if path.points.length > 0}
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <span
                class="w-3 h-3 rounded-full flex-shrink-0"
                style="background-color: {path.color}"
              ></span>
              <span class="font-mono">{path.name || `path-${index + 1}`}.csv</span>
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
      <button class="btn" on:click={cancelExport}>Cancel</button>
      <button
        class="btn btn-primary"
        on:click={confirmExport}
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
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={cancelExport}>close</button>
  </form>
</dialog>

<!-- Upload Modal -->
<dialog class="modal" class:modal-open={showUploadModal} data-ui-element>
  <div class="modal-box w-96 max-w-[90vw]">
    <h2 class="text-lg font-semibold mb-4">Upload Files</h2>

    <!-- Drag & Drop Zone -->
    <div
      class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {isDraggingFile ? 'border-primary bg-primary/5' : 'border-base-300'}"
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      role="button"
      tabindex="0"
    >
      <IconUpload class="w-12 h-12 mx-auto mb-3 text-base-content/40" />
      <p class="text-base-content/70 mb-1">Drag & drop files here</p>
      <p class="text-sm text-base-content/50">or use the buttons below</p>
    </div>

    <!-- File Type Buttons -->
    <div class="flex gap-3 mt-4">
      <label class="btn btn-outline flex-1">
        <IconImage class="w-5 h-5" />
        Floor Plan
        <input type="file" class="hidden" accept="image/*" on:change={handleFileUpload} />
      </label>
      {#if $drawingConfig.isTranscriptionMode}
        <label class="btn btn-outline flex-1">
          <IconVideo class="w-5 h-5" />
          Video
          <input type="file" class="hidden" accept="video/*" on:change={handleFileUpload} />
        </label>
      {/if}
    </div>

    <div class="modal-action">
      <button class="btn" on:click={() => (showUploadModal = false)}>Cancel</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={() => (showUploadModal = false)}>close</button>
  </form>
</dialog>

<dialog id="help_modal" class="modal" data-ui-element>
  <div class="modal-box w-11/12 max-w-3xl">
    <h3 class="font-bold text-3xl mb-4 text-center flex items-center justify-center gap-2">
      <IconHelp /> Mondrian Transcription Software
    </h3>

    <div class="space-y-4 text-base">
      <p>
        Welcome to <strong>Mondrian Transcription</strong>! This tool allows you to
        <em>transcribe </em>
        movement data from video or <em>speculate</em> about how movement could occur over space and
        time. To get started:
      </p>
      <ul class="space-y-2">
        <li class="flex items-start gap-2">
          <IconUpload class="text-xl mt-1" />
          <span
            >Load a <strong>floor plan/image</strong> (PNG/JPG) and <strong>video</strong> (MP4)
            using the top buttons.<br /><em
              >* If using Speculate Mode you only need a floor plan/image</em
            ></span
          >
        </li>
        <li class="flex items-start gap-2">
          <IconClick class="text-xl mt-1" />
          <span
            ><strong>Click</strong> once on the floor plan to start recording movement data synchronized
            to video.</span
          >
        </li>
        <li class="flex items-start gap-2">
          <IconStylusNote class="text-xl mt-1" />
          <span>As you <strong>move your cursor</strong>, positioning data is recorded.</span>
        </li>
        <li class="flex items-start gap-2">
          <IconClick class="text-xl mt-1" />
          <span><strong>Click</strong> again on the floor plan to play/pause recording.</span>
        </li>
        <li class="flex items-start gap-2">
          <IconFastForward class="text-xl mt-1" />
          <span
            >Press <kbd class="border px-1 rounded">f</kbd> on your keyboard to fast forward video and
            recording 5 seconds.</span
          >
        </li>
        <li class="flex items-start gap-2">
          <IconRewind class="text-xl mt-1" />
          <span
            >Press <kbd class="border px-1 rounded">r</kbd> on your keyboard to rewind video and recording
            5 seconds.</span
          >
        </li>
        <li class="flex items-start gap-2">
          <IconDownload class="text-xl mt-1" />
          <span>
            <strong>Save</strong> your recorded data as a CSV file or <IconDelete
              class="inline-block text-xl"
            /> <strong>clear</strong> your data to start over.</span
          >
        </li>
      </ul>

      <p class="text-success font-medium flex items-center gap-2">
        <IconPrivacyTip class="text-xl" />
        All your data stays local on your device. Nothing is uploaded or stored externally.
      </p>

      <p class="text-center">
        <a
          href="https://youtu.be/mgbNzikyucQ"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block px-4 py-2 bg-base-300 text-base-content rounded-lg shadow hover:bg-base-200 transition"
        >
          <IconPlayArrow class="inline-block mr-2 text-lg" /> Watch Demonstration Video
        </a>
      </p>
    </div>

    <details class="mt-6 text-sm text-base-content/60">
      <summary class="cursor-pointer hover:text-base-content">Credits & Citation</summary>
      <p class="mt-2 italic">
        <a
          href="https://github.com/BenRydal/mondrian-transcription"
          class="text-primary underline"
          target="_blank">Open-source project</a
        > built with Svelte, JavaScript, and p5.js (GPL 3.0). Developed by Ben Rydal Shapiro, Edwin Zhao,
        and contributors, with support from the National Science Foundation (#1623690, #2100784). If
        using Mondrian Transcription in your work, kindly reference: Shapiro, B.R., Hall, R. and Owens,
        D. (2017). Developing & Using Interaction Geography in a Museum. International Journal of Computer-Supported
        Collaborative Learning, 12(4), 377-399.
        <a
          href="https://par.nsf.gov/servlets/purl/10074100"
          class="text-primary underline"
          target="_blank">DOI</a
        >
      </p>
    </details>

    <div class="modal-action mt-6">
      <a href="https://forms.gle/jfV6zntsvua4k3XdA" target="_blank" class="btn btn-base-100">
        Feedback
      </a>
      <form method="dialog">
        <button class="btn btn-neutral">Close</button>
      </form>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
