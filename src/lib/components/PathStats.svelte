<script lang="ts">
  import { drawingState, renamePathById, deletePathById } from '$lib/stores/drawingState'
  import { drawingConfig } from '$lib/stores/drawingConfig'

  let expanded = true
  let editingPathId: number | null = null
  let editValue = ''
  let pendingDeletePathId: number | null = null

  // Dragging state
  let isDragging = false
  let position: { x: number; y: number } | null = null // null = use default position
  let dragStart = { x: 0, y: 0 }

  function formatTime(seconds: number): string {
    const totalSecs = Math.floor(seconds)
    const hrs = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatPoints(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  function getPathDuration(points: { time: number }[]): string {
    if (points.length === 0) return '--'
    return formatTime(points[points.length - 1].time - points[0].time)
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

  function startDrag(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input')) return
    isDragging = true
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', stopDrag)
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging) return
    position = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }
  }

  function stopDrag() {
    isDragging = false
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
  }

  function confirmDelete() {
    if (pendingDeletePathId !== null) {
      deletePathById(pendingDeletePathId)
      pendingDeletePathId = null
    }
  }

  function cancelDelete() {
    pendingDeletePathId = null
  }

  $: paths = $drawingState.paths
  $: currentPathId = $drawingState.currentPathId
  $: isRecording = $drawingState.shouldTrackMouse
  $: isTranscriptionMode = $drawingConfig.isTranscriptionMode
</script>

{#if paths.length > 0}
  <div
    class="fixed bg-base-100/90 backdrop-blur-sm rounded-lg shadow-lg text-sm w-48 z-50"
    style={position ? `left: ${position.x}px; top: ${position.y}px;` : 'left: 16px; bottom: 16px;'}
    role="region"
    aria-label="Path statistics"
    data-ui-element
  >
    <div
      class="flex items-center justify-between p-3 cursor-move select-none"
      on:mousedown={startDrag}
      role="heading"
      aria-level="2"
    >
      <span class="font-medium text-base-content/70">Recorded Paths</span>
      <button
        class="text-base-content/50 text-xs hover:text-base-content cursor-pointer px-1"
        on:click={() => (expanded = !expanded)}
      >
        {expanded ? '▼' : '▶'}
      </button>
    </div>

    {#if expanded}
      <div class="px-3 pb-3 space-y-1.5">
        {#each paths as path, index (path.pathId)}
          {@const isActive = path.pathId === currentPathId}
          {@const isActiveRecording = isActive && isRecording}
          {@const displayName = path.name || `Path ${index + 1}`}
          <div
            class="flex items-center gap-2 py-1 px-2 rounded transition-colors"
            class:bg-base-200={isActive}
          >
            <span
              class="w-3 h-3 rounded-full flex-shrink-0"
              class:animate-pulse={isActiveRecording}
              style="background-color: {path.color}"
            ></span>

            {#if editingPathId === path.pathId}
              <input
                type="text"
                class="flex-1 bg-base-100 border border-base-300 rounded px-1 text-base-content/80 text-sm w-16"
                bind:value={editValue}
                on:blur={saveEdit}
                on:keydown={handleKeydown}
                autofocus
              />
            {:else}
              <button
                class="flex-1 text-left text-base-content/80 hover:text-primary cursor-pointer truncate"
                on:click={() => startEditing(path.pathId, displayName)}
                title="Click to rename"
              >
                {displayName}
              </button>
            {/if}

            <span class="text-base-content/60 tabular-nums text-xs">
              {formatPoints(path.points.length)}
            </span>

            {#if isTranscriptionMode}
              <span class="text-base-content/50 tabular-nums text-xs w-10 text-right">
                {getPathDuration(path.points)}
              </span>
            {/if}

            {#if isActiveRecording}
              <span class="text-error text-xs">●</span>
            {/if}

            <button
              class="text-base-content/30 hover:text-error text-xs cursor-pointer px-1"
              on:click={() => (pendingDeletePathId = path.pathId)}
              title="Delete path"
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Delete Path Confirmation Modal -->
<dialog class="modal" class:modal-open={pendingDeletePathId !== null} data-ui-element>
  <div class="modal-box w-72">
    <h2 class="text-lg font-semibold mb-4">Delete Path?</h2>
    <p class="mb-6 text-sm">
      This will delete the selected path and all its recorded points.
    </p>
    <div class="modal-action">
      <button class="btn btn-sm" on:click={cancelDelete}>Cancel</button>
      <button class="btn btn-sm btn-error" on:click={confirmDelete}>Delete</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={cancelDelete}>close</button>
  </form>
</dialog>
