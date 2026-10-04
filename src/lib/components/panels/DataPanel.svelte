<script lang="ts">
  import IconUpload from '~icons/material-symbols/upload'
  import IconImage from '~icons/material-symbols/image'
  import IconVideo from '~icons/material-symbols/videocam'
  import IconFolderZip from '~icons/material-symbols/folder-zip-outline'
  import IconInfo from '~icons/material-symbols/info-outline'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import type { AutosaveStatus } from '$lib/storage/autosave'
  import type { VideoMeta } from '$lib/storage/sessionDb'
  import { formatBytes } from '$lib/utils/format'
  import { formatDuration } from '$lib/utils/time'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import PanelSection from './PanelSection.svelte'
  import { VIDEO_EXAMPLES, type VideoExample } from '$lib/examples/videoExamples'

  let {
    onImageUpload,
    onVideoUpload,
    onZipUpload,
    onLooseUpload,
    onSelectExample,
    onSelectVideoExample,
    autosave,
    reattachVideo = null,
  }: {
    onImageUpload: (event: Event) => void
    onVideoUpload: (event: Event) => void
    onZipUpload: (file: File) => void
    onLooseUpload: (csvs: File[], floorPlan: File | null) => void
    onSelectExample: (id: string) => void
    onSelectVideoExample: (example: VideoExample) => void
    autosave: AutosaveStatus
    reattachVideo?: VideoMeta | null
  } = $props()

  const examples = [
    { id: 'basketball', label: 'Basketball Court' },
    { id: 'grid', label: 'Blank Grid' },
    { id: 'cafe', label: 'Cafe' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'museum', label: 'Museum Gallery' },
  ]

  // The two reasons to bring files in: setting up something to trace, or reopening work
  // that already exists. Kept local rather than in viewPrefs — this component stays
  // mounted while the panel is closed, so the choice already survives closing and
  // reopening, and only resets after visiting another panel.
  type DataTab = 'new' | 'existing'
  const tabs: { value: DataTab; label: string }[] = [
    { value: 'new', label: 'New recording' },
    { value: 'existing', label: 'Open existing' },
  ]
  let tab = $state<DataTab>('new')

  // A session restored without its video force-opens this panel to ask for it, and the
  // Video button it names lives on the first tab. Switching away again is still allowed.
  $effect(() => {
    if (reattachVideo) tab = 'new'
  })

  let isDraggingFile = $state(false)

  // Browsers report ZIP and CSV types inconsistently, and sometimes as an empty string,
  // so the extension is the reliable half of those two. Image types are reported
  // reliably, so isImage stays on the MIME type rather than chasing a list of formats.
  const isZip = (file: File) =>
    file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')
  const isCsv = (file: File) => file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
  const isImage = (file: File) => file.type.startsWith('image/')

  function routeFile(file: File, event: Event) {
    if (file.type.startsWith('video/')) {
      onVideoUpload(event)
    } else if (isImage(file)) {
      onImageUpload(event)
    } else {
      window.alert('Please upload a video, an image, CSV files, or a Mondrian ZIP export')
      return false
    }
    return true
  }

  /**
   * One selection can mix kinds. A ZIP is self-contained so it wins outright; otherwise
   * any CSVs make this a data import, with a single image taken as the floor plan.
   */
  function routeFiles(files: File[], event: Event) {
    const zip = files.find(isZip)
    if (zip) {
      if (files.length > 1) {
        window.alert(`Importing ${zip.name}. The other selected files were ignored.`)
      }
      onZipUpload(zip)
      return true
    }

    const csvs = files.filter(isCsv)
    if (csvs.length === 0) return routeFile(files[0], event)

    const images = files.filter(isImage)
    if (images.length > 1) {
      window.alert('Choose at most one floor plan image to go with your CSV files')
      return false
    }
    onLooseUpload(csvs, images[0] ?? null)
    return true
  }

  function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const files = [...(input.files ?? [])]
    if (files.length === 0) return
    routeFiles(files, event)
    // Cleared even when routing failed: otherwise re-picking the same files fires no
    // change event, and the second attempt looks like a dead button.
    input.value = ''
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = false
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length > 0) routeFiles(files, asFileInputEvent(files[0]))
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

<div class="flex flex-col gap-4 px-3 py-4">
  <SegmentedControl
    options={tabs}
    value={tab}
    onSelect={(next) => (tab = next)}
    label="What to bring in"
    class="w-full"
    itemClass="flex-1"
  />

  <!-- One target for both tabs: routeFiles dispatches on the file, not on the tab, so a
       ZIP dropped while setting up still works rather than being refused. -->
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
    <p class="text-xs text-base-content/50">
      Floor plan{$drawingConfig.isTranscriptionMode ? ', video' : ''}, path CSVs, or an exported ZIP
    </p>
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

  {#if tab === 'new'}
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
    <!-- Examples belong on this tab: loading one is the same job as uploading a floor plan,
         but they get their own heading and rule so the two routes read as separate. -->
    <div class="border-t border-base-300 pt-3">
      <PanelSection
        title={$drawingConfig.isTranscriptionMode ? 'Example videos' : 'Example floor plans'}
      >
        {#if !$drawingConfig.isTranscriptionMode}
          <ul class="menu w-full p-0">
            {#each examples as example (example.id)}
              <li>
                <button onclick={() => onSelectExample(example.id)}>{example.label}</button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-xs text-base-content/50">Trace from an example floor plan and video.</p>
          <ul class="menu w-full p-0" data-testid="video-examples">
            {#each VIDEO_EXAMPLES as example (example.id)}
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
          </ul>
        {/if}
      </PanelSection>
    </div>
  {:else}
    <label class="btn btn-sm btn-outline">
      <IconFolderZip class="w-4 h-4" />
      Import paths & floor plan
      <input
        type="file"
        class="hidden"
        multiple
        accept=".zip,application/zip,.csv,text/csv,image/*"
        onchange={handleFileUpload}
      />
    </label>
    <p class="text-xs text-base-content/50">
      A previous export: a ZIP, or path CSVs with an optional floor plan image. Replaces the floor
      plan and paths in this session.
    </p>
  {/if}
</div>
