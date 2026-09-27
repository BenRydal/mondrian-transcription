<script lang="ts">
  import IconUpload from '~icons/material-symbols/upload'
  import IconImage from '~icons/material-symbols/image'
  import IconVideo from '~icons/material-symbols/videocam'
  import IconInfo from '~icons/material-symbols/info-outline'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import type { AutosaveStatus } from '$lib/storage/autosave'
  import type { VideoMeta } from '$lib/storage/sessionDb'
  import { formatBytes } from '$lib/utils/format'
  import { formatDuration } from '$lib/utils/time'
  import PanelSection from './PanelSection.svelte'
  import { groupVideoExamples, type VideoExample } from '$lib/examples/videoExamples'

  let {
    onImageUpload,
    onVideoUpload,
    onSelectExample,
    onSelectVideoExample,
    autosave,
    reattachVideo = null,
  }: {
    onImageUpload: (event: Event) => void
    onVideoUpload: (event: Event) => void
    onSelectExample: (id: string) => void
    onSelectVideoExample: (example: VideoExample) => void
    autosave: AutosaveStatus
    reattachVideo?: VideoMeta | null
  } = $props()

  const examples = [
    { id: 'classroom', label: 'Classroom Space' },
    { id: 'museum', label: 'Museum Gallery' },
    { id: 'basketball', label: 'Basketball Court' },
  ]

  const videoExampleGroups = groupVideoExamples()

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

    routeFile(file, asFileInputEvent(file))
  }

  function asFileInputEvent(file: File): Event {
    const input = document.createElement('input')
    input.type = 'file'
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    return { target: input } as unknown as Event
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
  {:else}
    <PanelSection title="Example Videos">
      <p class="text-xs text-base-content/50">
        A floor plan and YouTube video to trace from scratch. Opens as a new session.
      </p>
      <ul class="menu w-full p-0" data-testid="video-examples">
        {#each videoExampleGroups as { group, items } (group)}
          <li class="menu-title px-2 pt-2 pb-1 text-xs">{group}</li>
          {#each items as example (example.id)}
            <li>
              <button
                class="flex justify-between gap-2"
                onclick={() => onSelectVideoExample(example)}
              >
                <span>{example.title}</span>
                <span class="text-xs text-base-content/50 tabular-nums shrink-0"
                  >{example.duration}</span
                >
              </button>
            </li>
          {/each}
        {/each}
      </ul>
    </PanelSection>
  {/if}
</div>
