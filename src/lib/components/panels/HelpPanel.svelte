<script lang="ts">
  import IconHelp from '~icons/material-symbols/help-outline'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import PanelSection from './PanelSection.svelte'
  import { viewPrefs } from '$lib/stores/viewPrefs'

  let {
    onOpenWelcome,
    videoKind = null,
  }: { onOpenWelcome: () => void; videoKind?: 'local' | 'youtube' | null } = $props()

  const jump = $derived(
    $drawingConfig.isTranscriptionMode
      ? $drawingConfig.jumpSeconds
      : $drawingConfig.speculateJumpSeconds
  )
  const videoShortcuts = $derived([
    videoKind === 'youtube'
      ? { key: '← / →', action: 'Step 1/30 s (paused; YouTube has no frame access)' }
      : { key: '← / →', action: 'Step one frame (paused)' },
    { key: 'Shift ← / →', action: 'Step one second (paused)' },
    { key: '[', action: 'Slower playback' },
    { key: ']', action: 'Faster playback' },
  ])
  const shortcuts = $derived([
    { key: 'F', action: `Forward ${jump}s` },
    { key: 'R', action: `Rewind ${jump}s` },
    { key: 'S', action: 'Pause or resume 3D spin' },
    ...($drawingConfig.isTranscriptionMode ? videoShortcuts : []),
    { key: 'Ctrl/⌘ S', action: 'Save checkpoint (listed under History), even while typing' },
  ])
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Getting Started">
    <p class="text-sm text-base-content/70">
      {#if $viewPrefs.recordingMode === 'hold'}
        Hold the mouse, pen or finger down on the floor plan to trace; let go to pause.
      {:else}
        Click the floor plan to start tracing, click again to pause.
      {/if}
      Change this under Settings, Recording.
    </p>
    <button class="btn btn-sm btn-outline" onclick={onOpenWelcome}>
      <IconHelp class="w-4 h-4" />
      Welcome Guide
    </button>
  </PanelSection>

  <PanelSection title="3D Space-Time View">
    <p class="text-sm text-base-content/70">
      Turn on <span class="font-medium">3D</span> in the top bar to see your paths rise through time
      above the floor plan. Keep drawing on the flat floor plan; the 3D view follows along. A pulsing
      dot marks where each path is while you record.
    </p>
  </PanelSection>

  <PanelSection title="Keyboard Shortcuts">
    <dl class="flex flex-col gap-2 text-sm">
      {#each shortcuts as shortcut (shortcut.key)}
        <div class="flex items-center gap-2">
          <dt class="shrink-0"><kbd class="kbd kbd-sm whitespace-nowrap">{shortcut.key}</kbd></dt>
          <dd>{shortcut.action}</dd>
        </div>
      {/each}
    </dl>
  </PanelSection>
</div>
