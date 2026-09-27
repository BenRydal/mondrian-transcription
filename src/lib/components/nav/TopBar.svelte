<script lang="ts">
  import IconAdd from '~icons/material-symbols/add'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte'

  let {
    fileLabel,
    onNewPath,
    onModeSwitch,
  }: {
    fileLabel: string
    onNewPath: () => void
    onModeSwitch: () => void
  } = $props()

  const modes = [
    { label: 'Transcription', isTranscriptionMode: true },
    { label: 'Speculate', isTranscriptionMode: false },
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
    <div class="join" role="group" aria-label="Mode">
      {#each modes as mode (mode.label)}
        {@const active = mode.isTranscriptionMode === $drawingConfig.isTranscriptionMode}
        <button
          class="btn btn-sm join-item"
          class:btn-active={active}
          aria-pressed={active}
          onclick={() => requestMode(mode.isTranscriptionMode)}
        >
          {mode.label}
        </button>
      {/each}
    </div>

    <button class="btn btn-sm btn-neutral" onclick={onNewPath} aria-label="New Path">
      <IconAdd class="w-4 h-4" />
      <span class="hidden sm:inline">New Path</span>
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
