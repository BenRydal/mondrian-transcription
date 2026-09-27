<script lang="ts">
  import IconUpload from '~icons/material-symbols/upload'
  import IconDownload from '~icons/material-symbols/download'
  import IconDeleteAll from '~icons/material-symbols/delete-sweep-outline'
  import IconImage from '~icons/material-symbols/image'
  import IconVideo from '~icons/material-symbols/videocam'
  import IconInfo from '~icons/material-symbols/info-outline'
  import IconRestore from '~icons/material-symbols/history'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import type { AutosaveStatus } from '$lib/storage/autosave'
  import type { SnapshotMeta, VideoMeta } from '$lib/storage/sessionDb'
  import { formatBytes, formatClockTime, formatDuration } from '$lib/stores/sessionRecovery'
  import PanelSection from './PanelSection.svelte'

  let {
    onImageUpload,
    onVideoUpload,
    onSelectExample,
    onExport,
    onClearAll,
    autosave,
    reattachVideo = null,
    savedVersions = [],
    onRestoreVersion,
  }: {
    onImageUpload: (event: Event) => void
    onVideoUpload: (event: Event) => void
    onSelectExample: (id: string) => void
    onExport: () => void
    onClearAll: () => void
    autosave: AutosaveStatus
    reattachVideo?: VideoMeta | null
    savedVersions?: SnapshotMeta[]
    onRestoreVersion: (id: number) => void
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

  const examples = [
    { id: 'classroom', label: 'Classroom Space' },
    { id: 'museum', label: 'Museum Gallery' },
    { id: 'basketball', label: 'Basketball Court' },
  ]

  let isDraggingFile = $state(false)

  function routeFile(file: File, event: Event) {
    if (file.type.startsWith('video/')) {
      onVideoUpload(event)
    } else if (file.type.startsWith('image/')) {
      onImageUpload(event)
    } else {
      window.alert('Please upload a video or image file')
      return false
    }
    return true
  }

  function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (routeFile(file, event)) (event.target as HTMLInputElement).value = ''
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = false
    const file = e.dataTransfer?.files[0]
    if (!file) return

    // Wrap the dropped file as an input change event for the upload handlers.
    const input = document.createElement('input')
    input.type = 'file'
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    routeFile(file, { target: input } as unknown as Event)
  }
</script>

<div class="flex flex-col gap-6 px-3 py-4">
  <PanelSection title="Upload">
    <div
      class="border-2 border-dashed rounded-lg p-4 text-center transition-colors {isDraggingFile
        ? 'border-primary bg-primary/5'
        : 'border-base-300'}"
      ondragover={(e) => {
        e.preventDefault()
        isDraggingFile = true
      }}
      ondragleave={(e) => {
        e.preventDefault()
        isDraggingFile = false
      }}
      ondrop={handleDrop}
      role="region"
      aria-label="Drop files to upload"
    >
      <IconUpload class="w-8 h-8 mx-auto mb-2 text-base-content/40" />
      <p class="text-sm text-base-content/70">Drag & drop files here</p>
      <p class="text-xs text-base-content/50">or use the buttons below</p>
    </div>
    <div class="flex gap-2">
      <label class="btn btn-sm btn-outline flex-1">
        <IconImage class="w-4 h-4" />
        Floor Plan
        <input type="file" class="hidden" accept="image/*" onchange={handleFileUpload} />
      </label>
      {#if $drawingConfig.isTranscriptionMode}
        <label class="btn btn-sm btn-outline flex-1">
          <IconVideo class="w-4 h-4" />
          Video
          <input type="file" class="hidden" accept="video/*" onchange={handleFileUpload} />
        </label>
      {/if}
    </div>
  </PanelSection>

  <PanelSection title="Autosave">
    <p class="text-sm text-base-content/70" data-testid="autosave-status">{autosaveLabel}</p>
    {#if autosave.videoStatus === 'needs-reattach' && !reattachVideo}
      <p class="text-xs text-base-content/50">
        The video is too large to keep in the browser; you'll re-attach it after a reload.
      </p>
    {/if}
    {#if reattachVideo}
      <div class="alert alert-info text-sm py-2" data-testid="reattach-prompt">
        <IconInfo class="h-5 w-5 shrink-0" />
        <span>
          Re-attach the video with the Video button:
          <span class="font-medium">{reattachVideo.name}</span>
          ({formatBytes(reattachVideo.size)}{reattachVideo.duration
            ? `, ${formatDuration(reattachVideo.duration)}`
            : ''})
        </span>
      </div>
    {/if}
  </PanelSection>

  {#if savedVersions.length > 0}
    <PanelSection title="Saved Versions">
      <ul class="flex flex-col gap-2" data-testid="saved-versions">
        {#each savedVersions as version (version.id)}
          <li class="bg-base-200 rounded-lg p-2 flex items-center justify-between gap-2 text-sm">
            <div class="flex flex-col min-w-0">
              <span class="font-medium">{formatClockTime(version.savedAt)}</span>
              <span class="text-xs text-base-content/60 truncate">
                {version.config.isTranscriptionMode ? 'Transcription' : 'Speculate'} ·
                {version.pathCount}
                {version.pathCount === 1 ? 'path' : 'paths'} ·
                {version.pointCount.toLocaleString()} pts
                {#if version.floorPlanKey}· floor plan{/if}
                {#if version.video?.status === 'saved'}· video{/if}
              </span>
            </div>
            <button
              class="btn btn-xs btn-outline shrink-0"
              onclick={() => onRestoreVersion(version.id!)}
            >
              <IconRestore class="w-3.5 h-3.5" />
              Restore
            </button>
          </li>
        {/each}
      </ul>
    </PanelSection>
  {/if}

  {#if !$drawingConfig.isTranscriptionMode}
    <PanelSection title="Example Data">
      <ul class="menu w-full p-0">
        {#each examples as example (example.id)}
          <li>
            <button onclick={() => onSelectExample(example.id)}>{example.label}</button>
          </li>
        {/each}
      </ul>
    </PanelSection>
  {/if}

  <PanelSection title="Export">
    <button class="btn btn-sm btn-primary" onclick={onExport}>
      <IconDownload class="w-4 h-4" />
      Export
    </button>
  </PanelSection>

  <PanelSection title="Clear">
    <button class="btn btn-sm btn-outline btn-error" onclick={onClearAll}>
      <IconDeleteAll class="w-4 h-4" />
      Clear All Paths
    </button>
  </PanelSection>
</div>
