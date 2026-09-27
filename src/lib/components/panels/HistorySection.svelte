<script lang="ts">
  import IconRestore from '~icons/material-symbols/history'
  import IconPin from '~icons/material-symbols/keep-outline'
  import IconEdit from '~icons/material-symbols/edit-outline'
  import IconDelete from '~icons/material-symbols/delete-outline'
  import IconSave from '~icons/material-symbols/bookmark-add-outline'
  import type { SnapshotMeta } from '$lib/storage/sessionDb'
  import { diffPaths, pathLabel } from '$lib/storage/history'
  import { formatSavedAt } from '$lib/stores/sessionRecovery'
  import PanelSection from './PanelSection.svelte'

  const PAGE_SIZE = 20

  let {
    entries,
    livePathIds,
    canWrite,
    onCheckpoint,
    onRestore,
    onRestorePath,
    onRename,
    onDelete,
  }: {
    entries: SnapshotMeta[]
    livePathIds: ReadonlySet<number>
    canWrite: boolean
    onCheckpoint: (name: string) => void
    onRestore: (id: number) => void
    onRestorePath: (id: number, pathId: number, mode: 'replace' | 'copy') => void
    onRename: (id: number, label: string) => void
    onDelete: (id: number) => void
  } = $props()

  let checkpointName = $state('')
  let shown = $state(PAGE_SIZE)
  let expandedId = $state<number | null>(null)
  let editingId = $state<number | null>(null)
  let editValue = $state('')

  const visible = $derived(entries.slice(0, shown))

  function save(e: SubmitEvent) {
    e.preventDefault()
    onCheckpoint(checkpointName)
    checkpointName = ''
  }

  function commitRename() {
    if (editingId !== null) onRename(editingId, editValue)
    editingId = null
  }

  function handleRenameKey(e: KeyboardEvent) {
    e.stopPropagation()
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') editingId = null
  }
</script>

<PanelSection title="History">
  <form class="flex gap-2" onsubmit={save}>
    <input
      type="text"
      class="input input-sm flex-1 min-w-0"
      placeholder="Checkpoint name (optional)"
      aria-label="Checkpoint name (optional)"
      maxlength="80"
      bind:value={checkpointName}
      onkeydown={(e) => e.stopPropagation()}
      disabled={!canWrite}
    />
    <button class="btn btn-sm btn-primary" type="submit" disabled={!canWrite}>
      <IconSave class="w-4 h-4" />
      Save
    </button>
  </form>
  <p class="text-xs text-base-content/50">
    Checkpoints are kept until you delete them. Autosaves thin out over time.
  </p>

  {#if entries.length > 0}
    <ul class="flex flex-col gap-2" data-testid="saved-versions">
      {#each visible as entry, i (entry.id)}
        {@const changes = diffPaths(entry.paths, entries[i + 1]?.paths)}
        {@const pinned = entry.kind === 'pinned'}
        <li
          class="flex flex-col gap-1 rounded-lg p-2 text-sm {pinned
            ? 'bg-primary/10'
            : 'bg-base-200'}"
          data-kind={entry.kind}
        >
          <div class="flex items-center gap-2">
            {#if pinned}
              <IconPin class="w-4 h-4 shrink-0 text-primary" aria-label="Checkpoint" />
            {/if}
            {#if editingId === entry.id}
              <input
                type="text"
                class="input input-xs flex-1 min-w-0"
                aria-label="Rename checkpoint"
                maxlength="80"
                bind:value={editValue}
                onblur={commitRename}
                onkeydown={handleRenameKey}
                {@attach (node) => node.focus()}
              />
            {:else}
              <div class="flex flex-col flex-1 min-w-0">
                <span class="truncate font-medium">
                  {entry.label ?? (pinned ? 'Checkpoint' : formatSavedAt(entry.savedAt))}
                </span>
                <span class="text-xs text-base-content/60 truncate">
                  {#if entry.label || pinned}{formatSavedAt(entry.savedAt)} ·{/if}
                  {entry.pathCount}
                  {entry.pathCount === 1 ? 'path' : 'paths'} ·
                  {entry.pointCount.toLocaleString()} pts
                </span>
              </div>
              <button
                class="btn btn-xs btn-outline shrink-0"
                disabled={!canWrite}
                onclick={() => onRestore(entry.id!)}
              >
                <IconRestore class="w-3.5 h-3.5" />
                Restore
              </button>
            {/if}
          </div>

          {#if changes.length > 0}
            <p class="text-xs text-base-content/60 truncate" data-testid="version-changes">
              Changed: {changes
                .map((c) =>
                  c.change === 'added'
                    ? `+${c.label}`
                    : c.change === 'removed'
                      ? `−${c.label}`
                      : c.label
                )
                .join(' · ')}
            </p>
          {/if}

          <div class="flex items-center gap-1">
            <button
              class="btn btn-ghost btn-xs"
              aria-expanded={expandedId === entry.id}
              onclick={() => (expandedId = expandedId === entry.id ? null : entry.id!)}
            >
              {expandedId === entry.id ? 'Hide paths' : 'Paths'}
            </button>
            {#if pinned}
              <span class="flex-1"></span>
              <button
                class="btn btn-ghost btn-xs btn-square"
                aria-label="Rename checkpoint"
                disabled={!canWrite}
                onclick={() => {
                  editingId = entry.id!
                  editValue = entry.label ?? ''
                }}
              >
                <IconEdit class="w-4 h-4" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square hover:text-error"
                aria-label="Delete checkpoint"
                disabled={!canWrite}
                onclick={() => onDelete(entry.id!)}
              >
                <IconDelete class="w-4 h-4" />
              </button>
            {/if}
          </div>

          {#if expandedId === entry.id}
            <ul class="flex flex-col gap-1" data-testid="version-paths">
              {#each entry.paths.filter((p) => p.count > 0) as path (path.pathId)}
                <li class="flex items-center gap-2 text-xs">
                  <span class="w-3 h-3 shrink-0 rounded-full" style="background-color: {path.color}"
                  ></span>
                  <span class="flex-1 min-w-0 truncate">
                    {pathLabel(entry.paths, path.pathId)} · {path.count.toLocaleString()} pts
                  </span>
                  <button
                    class="btn btn-xs btn-outline"
                    disabled={!canWrite}
                    title={livePathIds.has(path.pathId)
                      ? 'Replace the current version of this path'
                      : 'Add this path back'}
                    onclick={() => onRestorePath(entry.id!, path.pathId, 'replace')}
                  >
                    {livePathIds.has(path.pathId) ? 'Replace' : 'Add back'}
                  </button>
                  {#if livePathIds.has(path.pathId)}
                    <button
                      class="btn btn-xs btn-ghost"
                      disabled={!canWrite}
                      title="Add as a new path, keeping the current one"
                      onclick={() => onRestorePath(entry.id!, path.pathId, 'copy')}
                    >
                      Copy
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
    {#if entries.length > shown}
      <button class="btn btn-xs btn-ghost self-start" onclick={() => (shown += PAGE_SIZE)}>
        Show {Math.min(PAGE_SIZE, entries.length - shown)} more of {entries.length - shown}
      </button>
    {/if}
  {/if}
</PanelSection>
