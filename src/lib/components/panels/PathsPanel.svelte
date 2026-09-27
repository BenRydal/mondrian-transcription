<script lang="ts">
  import {
    drawingState,
    renamePathById,
    togglePathVisibility,
    updatePathColor,
  } from '$lib/stores/drawingState'
  import IconVisibility from '~icons/material-symbols/visibility'
  import IconVisibilityOff from '~icons/material-symbols/visibility-off'
  import IconClose from '~icons/material-symbols/close'
  import IconDeleteAll from '~icons/material-symbols/delete-sweep-outline'
  import { formatPoints } from '$lib/utils/format'
  import { formatHms } from '$lib/utils/time'

  let { onDelete, onClearAll }: { onDelete: (pathId: number) => void; onClearAll: () => void } =
    $props()

  let editingPathId = $state<number | null>(null)
  let editValue = $state('')

  const paths = $derived($drawingState.paths)
  const currentPathId = $derived($drawingState.currentPathId)
  const isRecording = $derived($drawingState.shouldTrackMouse)

  function getPathDuration(points: { time: number }[]): string {
    if (points.length === 0) return '--'
    return formatHms(points[points.length - 1].time - points[0].time)
  }

  function getPathSpan(points: { time: number }[]): string | undefined {
    if (points.length === 0) return undefined
    return `${formatHms(points[0].time)}–${formatHms(points[points.length - 1].time)}`
  }

  function startEditing(pathId: number, currentName: string) {
    editingPathId = pathId
    editValue = currentName
  }

  function saveEdit() {
    if (editingPathId !== null) {
      renamePathById(editingPathId, editValue)
      editingPathId = null
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') editingPathId = null
  }
</script>

<div class="flex flex-col gap-2 px-3 py-4">
  {#if paths.length === 0}
    <p class="text-sm text-base-content/70">No paths recorded yet.</p>
  {:else}
    <ul class="flex flex-col gap-1" aria-label="Recorded paths">
      {#each paths as path, index (path.pathId)}
        {@const isActive = path.pathId === currentPathId}
        {@const isActiveRecording = isActive && isRecording}
        {@const displayName = path.name || `Path ${index + 1}`}
        <li
          class="flex items-center gap-2 py-1 px-2 rounded transition-colors"
          class:bg-base-200={isActive}
        >
          <label
            class="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1"
            class:animate-pulse={isActiveRecording}
            style="background-color: {path.color}"
            title="Change color"
          >
            <input
              type="color"
              class="sr-only"
              aria-label="Color for {displayName}"
              value={path.color}
              oninput={(e) => updatePathColor(path.pathId, e.currentTarget.value)}
            />
          </label>

          {#if editingPathId === path.pathId}
            <input
              type="text"
              class="flex-1 min-w-0 bg-base-100 border border-base-300 rounded px-2 py-0.5 text-sm text-base-content/80"
              aria-label="Rename {displayName}"
              bind:value={editValue}
              onblur={saveEdit}
              onkeydown={handleKeydown}
              {@attach (node) => node.focus()}
            />
          {:else}
            <button
              class="flex-1 min-w-0 text-left text-sm text-base-content/80 hover:text-primary cursor-pointer truncate"
              onclick={() => startEditing(path.pathId, displayName)}
              title="Click to rename"
            >
              {displayName}
            </button>
          {/if}

          <span class="text-sm tabular-nums text-base-content/60">
            {formatPoints(path.points.length)}
          </span>

          <span
            class="w-12 text-right text-sm tabular-nums text-base-content/50"
            title={getPathSpan(path.points)}
          >
            {getPathDuration(path.points)}
          </span>

          {#if isActiveRecording}
            <span class="text-sm text-error" aria-label="Recording">●</span>
          {/if}

          <button
            class="text-base-content/40 hover:text-base-content cursor-pointer"
            onclick={() => togglePathVisibility(path.pathId)}
            title={path.visible === false ? 'Show path' : 'Hide path'}
            aria-label={path.visible === false ? `Show ${displayName}` : `Hide ${displayName}`}
          >
            {#if path.visible === false}
              <IconVisibilityOff class="w-4 h-4" />
            {:else}
              <IconVisibility class="w-4 h-4" />
            {/if}
          </button>

          <button
            class="text-base-content/40 hover:text-error cursor-pointer"
            onclick={() => onDelete(path.pathId)}
            title="Delete path"
            aria-label="Delete {displayName}"
          >
            <IconClose class="w-4 h-4" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button class="btn btn-sm btn-outline btn-error self-start mt-4" onclick={onClearAll}>
    <IconDeleteAll class="w-4 h-4" />
    Clear All Paths
  </button>
</div>
