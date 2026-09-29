<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { AutosaveStatus } from '$lib/storage/autosave'
  import { formatClockTime } from '$lib/utils/format'
  import PanelSection from './PanelSection.svelte'

  let {
    autosave,
    storageLabel = null,
    sessionSection,
    historySection,
  }: {
    autosave: AutosaveStatus
    storageLabel?: string | null
    sessionSection: Snippet
    historySection: Snippet
  } = $props()

  const autosaveLabel = $derived.by(() => {
    switch (autosave.state) {
      case 'unavailable':
        return 'Unavailable in this window. Use Export to keep your work.'
      case 'other-tab':
        return 'Paused: Mondrian is open in another tab.'
      case 'error':
        return 'Last save failed. Retrying on the next change.'
      case 'saving':
        return 'Saving…'
      default:
        return autosave.lastSavedAt
          ? `Last saved ${formatClockTime(autosave.lastSavedAt)}`
          : 'Not saved yet'
    }
  })
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Autosave">
    <p class="text-sm text-base-content/70" data-testid="autosave-status">{autosaveLabel}</p>
    {#if storageLabel}
      <p class="text-xs text-base-content/50" data-testid="storage-used">{storageLabel}</p>
    {/if}
  </PanelSection>

  {@render sessionSection()}

  {@render historySection()}
</div>
