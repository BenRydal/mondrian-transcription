<script lang="ts">
  import { onMount } from 'svelte'
  import {
    countRecordedPaths,
    getSessionAge,
    getTotalPointCount,
  } from '$lib/stores/sessionRecovery'
  import { formatBytes, formatClockTime } from '$lib/utils/format'
  import type { RestoredSession } from '$lib/storage/sessionDb'
  import IconRestore from '~icons/material-symbols/history'
  import IconInfo from '~icons/material-symbols/info-outline'

  interface Props {
    session: RestoredSession
    onRestore: () => void
    onDiscard: () => void
  }

  let { session, onRestore, onDiscard }: Props = $props()

  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDiscard()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  const pathCount = $derived(countRecordedPaths(session.paths))
  const totalPoints = $derived(getTotalPointCount(session.paths))
  const sessionAge = $derived(getSessionAge(session.meta.savedAt))
  const isTranscription = $derived(session.meta.config.isTranscriptionMode)
  const hasFloorPlan = $derived(!!session.floorPlan)
  const videoMeta = $derived(session.meta.video)
  const hasVideo = $derived(!!session.video)
  const needsVideo = $derived(isTranscription && !hasVideo)
  const missing = $derived(
    [!hasFloorPlan && 'floor plan', needsVideo && 'video'].filter(Boolean).join(' and ')
  )
</script>

<div class="modal modal-open" data-ui-element>
  <div class="modal-box max-w-md">
    <h3 class="font-bold text-lg flex items-center gap-2">
      <IconRestore class="h-6 w-6 text-warning" />
      Recover Previous Session?
    </h3>

    <div class="py-4 space-y-3">
      <p class="text-base-content/70">
        Found unsaved work from <span class="font-medium">{sessionAge}</span>
        <span class="text-base-content/50">(saved {formatClockTime(session.meta.savedAt)})</span>
      </p>

      <div class="bg-base-200 rounded-lg p-3 space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-base-content/60">Mode:</span>
          <span class="font-medium">{isTranscription ? 'Transcription' : 'Speculate'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-base-content/60">Paths:</span>
          <span class="font-medium">{pathCount}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-base-content/60">Total points:</span>
          <span class="font-medium">{totalPoints.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-base-content/60">Floor plan:</span>
          <span class="font-medium">{hasFloorPlan ? 'Saved' : 'Not saved'}</span>
        </div>
        {#if isTranscription}
          <div class="flex justify-between">
            <span class="text-base-content/60">Video:</span>
            <span class="font-medium">{hasVideo ? 'Saved' : 'Not saved'}</span>
          </div>
        {/if}
      </div>

      {#if missing}
        <div class="alert alert-info text-sm py-2">
          <IconInfo class="h-5 w-5 shrink-0" />
          <span>
            You'll need to re-upload your {missing} to continue recording.
            {#if needsVideo && videoMeta}
              Use the same file: <span class="font-medium">{videoMeta.name}</span>
              ({formatBytes(videoMeta.size)}).
            {/if}
          </span>
        </div>
      {/if}
    </div>

    <div class="modal-action">
      <button class="btn btn-ghost" onclick={onDiscard}>Start Fresh</button>
      <button class="btn btn-primary" onclick={onRestore}>Restore Session</button>
    </div>
  </div>
  <button
    class="modal-backdrop bg-black/50 border-none cursor-default"
    onclick={onDiscard}
    aria-label="Close modal"
  ></button>
</div>
