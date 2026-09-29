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
  }: {
    fileLabel: string
    onNewPath: () => void
    onExport: () => void
    onModeSwitch: () => void
  } = $props()

  const modes = [
    { label: 'Transcription', value: true },
    { label: 'Speculate', value: false },
  ]

  let pendingMode = $state<boolean | null>(null)

  function requestMode(isTranscriptionMode: boolean) {
    if (isTranscriptionMode !== $drawingConfig.isTranscriptionMode) {
      pendingMode = isTranscriptionMode
    }
  }

  function confirmSwitch() {
    const isTranscriptionMode = pendingMode === true
    onModeSwitch()
    drawingConfig.update((c) => ({ ...c, isTranscriptionMode }))
    pendingMode = null
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
  message="Switching modes will erase all recorded data. Do you want to continue?"
  confirmLabel="Switch"
  onConfirm={confirmSwitch}
  onCancel={() => (pendingMode = null)}
/>
