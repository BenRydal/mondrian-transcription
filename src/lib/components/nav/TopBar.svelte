<script lang="ts">
  import IconAdd from '~icons/material-symbols/add'
  import Icon3D from '~icons/material-symbols/view-in-ar-outline'
  import IconDownload from '~icons/material-symbols/download'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'

  let {
    fileLabel,
    onNewPath,
    onExport,
    onModeSwitch,
    hasPaths,
    hasVideo,
  }: {
    fileLabel: string
    onNewPath: () => void
    onExport: () => void
    onModeSwitch: (isTranscriptionMode: boolean) => void
    hasPaths: boolean
    hasVideo: boolean
  } = $props()

  const modes = [
    { label: 'Transcription', value: true },
    { label: 'Speculate', value: false },
  ]

  let pendingMode = $state<boolean | null>(null)

  // Only paths are checkpointed, and only when some have been recorded: an empty session
  // saves no snapshot, so a dropped video has to be loaded again by hand.
  const switchMessage = $derived(
    hasPaths
      ? hasVideo
        ? 'Switching modes will erase all recorded paths and remove the current video. A checkpoint is saved first, so you can restore the paths from History.'
        : 'Switching modes will erase all recorded paths. A checkpoint is saved first, so you can restore them from History.'
      : 'Switching modes will remove the current video. You will need to load it again.'
  )

  function requestMode(isTranscriptionMode: boolean) {
    if (isTranscriptionMode === $drawingConfig.isTranscriptionMode) return
    // Only worth confirming when the switch would actually discard something.
    if (hasPaths || hasVideo) pendingMode = isTranscriptionMode
    else switchMode(isTranscriptionMode)
  }

  function switchMode(isTranscriptionMode: boolean) {
    onModeSwitch(isTranscriptionMode)
    drawingConfig.update((c) => ({ ...c, isTranscriptionMode }))
    pendingMode = null
  }

  function confirmSwitch() {
    switchMode(pendingMode === true)
  }
</script>

<header class="navbar min-h-16 gap-2 bg-base-100 px-2 md:px-4" data-ui-element>
  <div class="flex flex-1 min-w-0 items-center gap-4">
    <a class="btn btn-ghost px-2 text-lg md:text-xl" href="https://interactiongeography.org"
      >Mondrian</a
    >
    {#if fileLabel}
      <span class="hidden sm:inline truncate text-sm text-base-content/70" title={fileLabel}
        >{fileLabel}</span
      >
    {/if}
  </div>

  <div class="flex flex-none items-center gap-2">
    <SegmentedControl
      options={modes}
      value={$drawingConfig.isTranscriptionMode}
      onSelect={requestMode}
      label="Mode"
    />

    <button
      class="btn btn-sm"
      class:btn-primary={$drawingConfig.showSpaceTime}
      class:btn-soft={$drawingConfig.showSpaceTime}
      aria-pressed={$drawingConfig.showSpaceTime}
      aria-label="3D view"
      title="{$drawingConfig.showSpaceTime ? 'Hide' : 'Show'} the 3D space-time view"
      onclick={() => drawingConfig.update((c) => ({ ...c, showSpaceTime: !c.showSpaceTime }))}
    >
      <Icon3D class="w-4 h-4" />
      <span class="hidden sm:inline">3D</span>
    </button>

    <button class="btn btn-sm btn-neutral" onclick={onNewPath} aria-label="New Path">
      <IconAdd class="w-4 h-4" />
      <span class="hidden sm:inline">New Path</span>
    </button>

    <button class="btn btn-sm btn-primary" onclick={onExport} aria-label="Export">
      <IconDownload class="w-4 h-4" />
      <span class="hidden sm:inline">Export</span>
    </button>
  </div>
</header>

<ConfirmDialog
  open={pendingMode !== null}
  title="Switch Mode?"
  message={switchMessage}
  confirmLabel="Switch"
  onConfirm={confirmSwitch}
  onCancel={() => (pendingMode = null)}
/>
