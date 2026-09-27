<script lang="ts">
  import IconHelp from '~icons/material-symbols/help-outline'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import PanelSection from './PanelSection.svelte'

  let { onOpenWelcome }: { onOpenWelcome: () => void } = $props()

  const shortcuts = $derived([
    ...($drawingConfig.isTranscriptionMode
      ? [
          { key: 'F', action: `Forward ${$drawingConfig.jumpSeconds}s` },
          { key: 'R', action: `Rewind ${$drawingConfig.jumpSeconds}s` },
        ]
      : [
          { key: 'F', action: `Forward ${$drawingConfig.speculateJumpSeconds}s` },
          { key: 'R', action: `Rewind ${$drawingConfig.speculateJumpSeconds}s` },
        ]),
    { key: 'Ctrl/⌘ S', action: 'Save checkpoint' },
  ])
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Getting Started">
    <p class="text-sm text-base-content/70">
      Click the floor plan to start tracing, click again to pause.
    </p>
    <button class="btn btn-sm btn-outline" onclick={onOpenWelcome}>
      <IconHelp class="w-4 h-4" />
      Welcome Guide
    </button>
  </PanelSection>

  <PanelSection title="Keyboard Shortcuts">
    <dl class="flex flex-col gap-2 text-sm">
      {#each shortcuts as shortcut (shortcut.key)}
        <div class="flex items-center gap-2">
          <dt><kbd class="kbd kbd-sm">{shortcut.key}</kbd></dt>
          <dd>{shortcut.action}</dd>
        </div>
      {/each}
    </dl>
  </PanelSection>
</div>
