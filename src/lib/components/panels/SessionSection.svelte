<script lang="ts">
  import IconAdd from '~icons/material-symbols/add'
  import IconEdit from '~icons/material-symbols/edit-outline'
  import IconDelete from '~icons/material-symbols/delete-outline'
  import IconDownload from '~icons/material-symbols/download'
  import IconUpload from '~icons/material-symbols/upload'
  import type { SessionRecord } from '$lib/storage/sessionDb'
  import { sessionName } from '$lib/storage/history'
  import { getSessionAge } from '$lib/stores/sessionRecovery'
  import { formatBytes } from '$lib/utils/format'
  import PanelSection from './PanelSection.svelte'

  let {
    sessions,
    currentId,
    currentName,
    canWrite,
    onSwitch,
    onNew,
    onRename,
    onDelete,
    onExport,
    onImport,
  }: {
    sessions: SessionRecord[]
    currentId: string | null
    currentName: string
    canWrite: boolean
    onSwitch: (id: string) => void
    onNew: () => void
    onRename: (id: string, name: string) => void
    onDelete: (session: SessionRecord) => void
    onExport: () => void
    onImport: (file: File) => void
  } = $props()

  let editingId = $state<string | null>(null)
  let editValue = $state('')
  let showList = $state(false)

  const others = $derived(sessions.filter((s) => s.id !== currentId))
  const current = $derived(sessions.find((s) => s.id === currentId) ?? null)

  function startEditing(id: string, name: string) {
    editingId = id
    editValue = name
  }

  function commitEdit() {
    if (editingId !== null && editValue.trim()) onRename(editingId, editValue)
    editingId = null
  }

  function handleEditKey(e: KeyboardEvent) {
    e.stopPropagation()
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') editingId = null
  }

  function handleImport(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) onImport(file)
    input.value = ''
  }
</script>

{#snippet nameEditor(name: string)}
  <input
    type="text"
    class="input input-xs flex-1 min-w-0"
    aria-label="Rename {name}"
    bind:value={editValue}
    onblur={commitEdit}
    onkeydown={handleEditKey}
    {@attach (node) => node.focus()}
  />
{/snippet}

<PanelSection title="Session">
  <div class="flex flex-col gap-1" data-testid="current-session">
    <div class="flex items-center gap-2">
      {#if editingId !== null && editingId === currentId}
        {@render nameEditor(currentName)}
      {:else}
        <span class="flex-1 min-w-0 truncate text-sm font-medium">{currentName}</span>
        {#if currentId}
          <button
            class="btn btn-ghost btn-xs btn-square"
            aria-label="Rename session"
            title="Rename session"
            onclick={() => startEditing(currentId, current?.name ?? currentName)}
          >
            <IconEdit class="w-4 h-4" />
          </button>
        {/if}
      {/if}
    </div>
    {#if current}
      <span class="text-xs text-base-content/60">
        {current.snapshotCount}
        {current.snapshotCount === 1 ? 'version' : 'versions'} · ≈{formatBytes(current.bytes)}
      </span>
    {/if}
  </div>

  <div class="flex flex-wrap gap-2">
    <button class="btn btn-xs btn-outline" onclick={onNew}>
      <IconAdd class="w-3.5 h-3.5" />
      New session
    </button>
    {#if others.length > 0}
      <button
        class="btn btn-xs btn-ghost"
        aria-expanded={showList}
        aria-controls="session-list"
        onclick={() => (showList = !showList)}
      >
        {showList ? 'Hide' : 'Other sessions'} ({others.length})
      </button>
    {/if}
  </div>

  {#if showList && others.length > 0}
    <ul id="session-list" class="flex flex-col gap-1" data-testid="session-list">
      {#each others as session (session.id)}
        <li class="flex items-center gap-2 rounded-lg bg-base-200 p-2 text-sm">
          {#if editingId === session.id}
            {@render nameEditor(sessionName(session))}
          {:else}
            <div class="flex flex-col flex-1 min-w-0">
              <span class="truncate font-medium">{sessionName(session)}</span>
              <span class="text-xs text-base-content/60">
                {getSessionAge(session.updatedAt)} · ≈{formatBytes(session.bytes)}
              </span>
            </div>
            <button class="btn btn-xs btn-outline" onclick={() => onSwitch(session.id)}>
              Open
            </button>
            <button
              class="btn btn-ghost btn-xs btn-square"
              aria-label="Rename {sessionName(session)}"
              onclick={() => startEditing(session.id, sessionName(session))}
            >
              <IconEdit class="w-4 h-4" />
            </button>
            <button
              class="btn btn-ghost btn-xs btn-square hover:text-error"
              aria-label="Delete {sessionName(session)}"
              onclick={() => onDelete(session)}
            >
              <IconDelete class="w-4 h-4" />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex flex-wrap gap-2">
    <button class="btn btn-xs btn-ghost" onclick={onExport} disabled={!current}>
      <IconDownload class="w-3.5 h-3.5" />
      Export history
    </button>
    <label class="btn btn-xs btn-ghost" class:btn-disabled={!canWrite}>
      <IconUpload class="w-3.5 h-3.5" />
      Import history
      <input
        type="file"
        class="hidden"
        accept=".zip,application/zip"
        disabled={!canWrite}
        onchange={handleImport}
      />
    </label>
    {#if current}
      <button
        class="btn btn-xs btn-ghost hover:text-error"
        onclick={() => current && onDelete(current)}
      >
        <IconDelete class="w-3.5 h-3.5" />
        Delete session
      </button>
    {/if}
  </div>
</PanelSection>
