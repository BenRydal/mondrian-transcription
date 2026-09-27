<script lang="ts">
  import P5Wrapper from '../lib/p5/P5Wrapper.svelte'
  import TopBar from '$lib/components/nav/TopBar.svelte'
  import WelcomeModal from '$lib/components/WelcomeModal.svelte'
  import RecoveryModal from '$lib/components/RecoveryModal.svelte'
  import DataPanel from '$lib/components/panels/DataPanel.svelte'
  import PathsPanel from '$lib/components/panels/PathsPanel.svelte'
  import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte'
  import HelpPanel from '$lib/components/panels/HelpPanel.svelte'
  import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte'
  import ExportDialog from '$lib/components/dialogs/ExportDialog.svelte'
  import { CanvasFrame, ActivityBar, SidePanel, type ActivityBarItem } from 'svelte-p5-components'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { drawingState, deletePathById } from '$lib/stores/drawingState'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import { invalidateSpeculateClock } from '$lib/timing/sessionClocks'
  import { hasRecordedData, formatBytes } from '$lib/stores/sessionRecovery'
  import { createAutosave, type AutosaveState } from '$lib/storage/autosave'
  import type {
    AssetInput,
    RestoredSession,
    SnapshotInput,
    SnapshotMeta,
    VideoMeta,
  } from '$lib/storage/sessionDb'
  import IconWarning from '~icons/material-symbols/warning-outline'
  import IconData from '~icons/material-symbols/folder-open-outline'
  import IconPaths from '~icons/material-symbols/route'
  import IconSettings from '~icons/material-symbols/settings-outline'
  import IconHelp from '~icons/material-symbols/help-outline'

  type PanelId = 'data' | 'paths' | 'settings' | 'help'
  const PANEL_LABELS: Record<PanelId, string> = {
    data: 'Data',
    paths: 'Paths',
    settings: 'Settings',
    help: 'Help',
  }
  let activePanel = $state<PanelId | null>(null)
  // Keeps the panel body rendered while it slides closed.
  let lastPanel = $state<PanelId>('data')
  let panelWidth = $state(300)
  let pendingDeletePathId = $state<number | null>(null)
  let showClearAllModal = $state(false)
  let exportDialog: ExportDialog
  let floorPlanName = $state<string | null>(null)
  let videoName = $state<string | null>(null)
  const fileLabel = $derived([floorPlanName, videoName].filter(Boolean).join(' · '))

  const railItems: ActivityBarItem[] = $derived([
    { id: 'data', label: PANEL_LABELS.data, icon: dataIcon },
    {
      id: 'paths',
      label: PANEL_LABELS.paths,
      icon: pathsIcon,
      badge: $drawingState.paths.length,
    },
    { id: 'settings', label: PANEL_LABELS.settings, icon: settingsIcon },
    { id: 'help', label: PANEL_LABELS.help, icon: helpIcon },
  ])

  function handleRailSelect(id: string) {
    const panel = id as PanelId
    activePanel = activePanel === panel ? null : panel
    if (activePanel) lastPanel = activePanel
  }

  function confirmDeletePath() {
    if (pendingDeletePathId !== null) deletePathById(pendingDeletePathId)
    pendingDeletePathId = null
  }

  let p5Component: P5Wrapper
  let showRecoveryModal = $state(false)
  let recoveredSession = $state.raw<RestoredSession | null>(null)
  let showEmptyPathWarning = $state(false)
  let notice = $state<string | null>(null)
  let floorPlanAsset: AssetInput | null = null
  let videoAsset: (AssetInput & { meta: VideoMeta }) | null = null
  let reattachVideo = $state<VideoMeta | null>(null)
  let savedVersions = $state<SnapshotMeta[]>([])
  let pendingRestoreId = $state<number | null>(null)

  const newAssetKey = () =>
    window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

  function getSnapshot(): SnapshotInput | null {
    const state = get(drawingState)
    if (!hasRecordedData(state.paths)) return null
    const config = get(drawingConfig)
    return {
      paths: state.paths,
      videoTime: state.videoTime,
      imageWidth: state.imageWidth,
      imageHeight: state.imageHeight,
      config: {
        isTranscriptionMode: config.isTranscriptionMode,
        exportSampleRate: config.exportSampleRate,
        strokeWeight: config.strokeWeight,
        speculateScale: config.speculateScale,
        isContinuousMode: config.isContinuousMode,
        floorPlanRotation: config.floorPlanRotation,
      },
      floorPlan: state.imageElement ? floorPlanAsset : null,
      video: config.isTranscriptionMode ? videoAsset : null,
    }
  }

  const autosave = createAutosave({ getSnapshot })
  const autosaveStatus = autosave.status

  async function refreshSavedVersions() {
    savedVersions = await autosave.listSnapshots()
  }

  const NOTICES: Partial<Record<AutosaveState, string>> = {
    'other-tab': 'Mondrian is open in another tab, so autosave is paused here.',
    unavailable: 'Autosave is unavailable in this window. Use Export to keep your work.',
  }
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  function showNotice(message: string) {
    notice = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = null), 6000)
  }

  $effect(() => {
    if ($drawingState.isDrawing) {
      showEmptyPathWarning = false
    }
  })

  onMount(() => {
    autosave.init().then((session) => {
      // An empty latest snapshot (e.g. after a clear) is not offered here;
      // older non-empty ones remain reachable from Saved Versions.
      if (session && hasRecordedData(session.paths)) {
        recoveredSession = session
        showRecoveryModal = true
      } else {
        openWelcomeModal()
      }
      refreshSavedVersions()
    })

    const shownNotices: AutosaveState[] = []
    const unsubscribeStatus = autosave.status.subscribe(({ state }) => {
      const message = NOTICES[state]
      if (message && !shownNotices.includes(state)) {
        shownNotices.push(state)
        showNotice(message)
      }
      if (state === 'saved') refreshSavedVersions()
    })

    let wasRecording = false
    let lastPaths = get(drawingState).paths
    const unsubscribe = drawingState.subscribe((state) => {
      const isRecording = state.isDrawing
      const pathsChanged = state.paths !== lastPaths
      lastPaths = state.paths
      if (showRecoveryModal || !hasRecordedData(state.paths)) {
        wasRecording = isRecording
        return
      }
      if (wasRecording && !isRecording) autosave.flush()
      else if (pathsChanged) autosave.schedule()
      wasRecording = isRecording
    })
    const unsubscribeConfig = drawingConfig.subscribe(() => {
      if (!showRecoveryModal) autosave.schedule()
    })

    const flushNow = () => {
      if (!showRecoveryModal) autosave.flush()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushNow)

    // Warn before leaving with unsaved data
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasRecordedData(get(drawingState).paths)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', flushNow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      unsubscribe()
      unsubscribeConfig()
      unsubscribeStatus()
      clearTimeout(noticeTimer)
      autosave.destroy()
    }
  })

  function applyRestoredSession(session: RestoredSession) {
    const { meta, paths, floorPlan, video } = session

    if (!meta.config.isTranscriptionMode || !meta.video) {
      p5Component.clearVideo()
      videoName = null
      videoAsset = null
      reattachVideo = null
    }

    drawingConfig.update((config) => ({
      ...config,
      isTranscriptionMode: meta.config.isTranscriptionMode,
      exportSampleRate: meta.config.exportSampleRate ?? config.exportSampleRate,
      strokeWeight: meta.config.strokeWeight,
      speculateScale: meta.config.speculateScale,
      isContinuousMode: meta.config.isContinuousMode,
      floorPlanRotation: meta.config.floorPlanRotation ?? 0,
    }))

    invalidateSpeculateClock()
    drawingState.update((state) => ({
      ...state,
      paths,
      currentPathId: Math.max(...paths.map((p) => p.pathId), 0),
      videoTime: meta.videoTime,
      imageWidth: meta.imageWidth,
      imageHeight: meta.imageHeight,
    }))

    if (floorPlan && meta.floorPlanKey) {
      const name = meta.floorPlanName ?? 'Restored floor plan'
      floorPlanAsset = { key: meta.floorPlanKey, blob: floorPlan, name }
      const image = new window.Image()
      image.onload = () => {
        p5Component.setImage(image, true)
        floorPlanName = name
      }
      image.onerror = () => console.warn('Failed to restore floor plan image from saved session')
      image.src = window.URL.createObjectURL(floorPlan)
    }

    if (meta.config.isTranscriptionMode && meta.video) {
      if (video && meta.videoKey) {
        videoAsset = { key: meta.videoKey, blob: video, name: meta.video.name, meta: meta.video }
        attachVideo(video, meta.video.name, meta.videoTime)
      } else {
        reattachVideo = meta.video
        activePanel = lastPanel = 'data'
      }
    }
  }

  function handleRestoreSession() {
    if (!recoveredSession || !p5Component) return
    applyRestoredSession(recoveredSession)
    showRecoveryModal = false
    recoveredSession = null
  }

  function handleDiscardSession() {
    showRecoveryModal = false
    recoveredSession = null
  }

  /** Saves the live session first, so restoring an older version is itself undoable. */
  async function confirmRestoreVersion() {
    const id = pendingRestoreId
    pendingRestoreId = null
    if (id === null || !p5Component) return
    // Read the target before flushing, so a full ring can't evict it out from under us.
    const session = await autosave.loadSnapshot(id)
    await autosave.flush()
    if (session) applyRestoredSession(session)
    refreshSavedVersions()
  }

  function attachVideo(source: Blob, name: string, restoreTime?: number) {
    const video = window.document.createElement('video')
    video.src = window.URL.createObjectURL(source)
    video.autoplay = false
    video.loop = false
    p5Component.setVideo(video, restoreTime)
    videoName = name
    return video
  }

  function checkReattachMatch(file: File, video: HTMLVideoElement) {
    const expected = reattachVideo
    if (!expected) return
    reattachVideo = null
    const warn = () =>
      showNotice(
        `This video differs from the original (${expected.name}, ${formatBytes(expected.size)}). Recorded times may not line up.`
      )
    if (file.name !== expected.name || file.size !== expected.size) return warn()
    video.addEventListener(
      'loadedmetadata',
      () => {
        if (expected.duration && Math.abs(video.duration - expected.duration) > 0.5) warn()
      },
      { once: true }
    )
  }

  function handleVideoUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      // Re-attaching a missing video after a restore resumes at its saved time.
      const restoreTime = reattachVideo ? get(drawingState).videoTime : undefined
      const meta: VideoMeta = { name: file.name, size: file.size, type: file.type }
      videoAsset = { key: newAssetKey(), blob: file, name: file.name, meta }
      const video = attachVideo(file, file.name, restoreTime)
      video.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(video.duration)) meta.duration = video.duration
          autosave.schedule()
        },
        { once: true }
      )
      checkReattachMatch(file, video)
    }
  }

  function handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const image = new window.Image()
      image.src = window.URL.createObjectURL(file)
      image.onload = () => {
        floorPlanAsset = { key: newAssetKey(), blob: file, name: file.name }
        p5Component.setImage(image)
        floorPlanName = file.name
      }
    }
  }

  function handleSavePath(onComplete?: () => void) {
    p5Component.exportAll(() => {
      onComplete?.()
    })
  }

  function handleClear() {
    p5Component.clearDrawing()
    p5Component.startNewPath()
  }

  function handleModeSwitch() {
    p5Component.clearDrawing()
    p5Component.clearVideo()
    videoName = null
    videoAsset = null
    reattachVideo = null
    p5Component.startNewPath()
  }

  function handleNewPath() {
    const created = p5Component.startNewPath()
    showEmptyPathWarning = !created
  }

  function openWelcomeModal() {
    const modal = window.document.getElementById('welcome_modal')
    if (modal instanceof HTMLDialogElement) modal.showModal()
  }

  function closeWelcomeModal() {
    const modal = window.document.getElementById('welcome_modal')
    if (modal instanceof HTMLDialogElement) modal.close()
  }

  function handleTryExample() {
    if ($drawingConfig.isTranscriptionMode) {
      handleModeSwitch()
      drawingConfig.update((c) => ({ ...c, isTranscriptionMode: false }))
    }
    loadExampleData('classroom')
    closeWelcomeModal()
  }

  function loadExampleData(imageID: string) {
    const filePath = `/examples/${imageID}.png`
    const image = new window.Image()
    image.src = filePath
    image.onload = () => {
      p5Component.setImage(image)
      floorPlanName = `${imageID}.png`
      const key = newAssetKey()
      floorPlanAsset = null
      fetch(filePath)
        .then((r) => r.blob())
        .then((blob) => {
          floorPlanAsset = { key, blob, name: `${imageID}.png` }
          autosave.schedule()
        })
        .catch((e) => console.warn('Could not keep example floor plan for autosave:', e))
    }
    image.onerror = (error) => {
      window.console.error(`Error loading example image from ${filePath}:`, error)
    }
  }
</script>

{#if showRecoveryModal && recoveredSession}
  <RecoveryModal
    session={recoveredSession}
    onRestore={handleRestoreSession}
    onDiscard={handleDiscardSession}
  />
{/if}

{#snippet dataIcon()}<IconData />{/snippet}
{#snippet pathsIcon()}<IconPaths />{/snippet}
{#snippet settingsIcon()}<IconSettings />{/snippet}
{#snippet helpIcon()}<IconHelp />{/snippet}

<div class="app-frame">
  <CanvasFrame>
    {#snippet top()}
      <TopBar {fileLabel} onNewPath={handleNewPath} onModeSwitch={handleModeSwitch} />
    {/snippet}

    {#snippet leftRail()}
      <nav class="left-rail" aria-label="Sidebar" data-ui-element>
        <ActivityBar
          activeId={activePanel ?? undefined}
          onSelect={handleRailSelect}
          items={railItems}
        />
        <div
          id="side-panel"
          role="tabpanel"
          aria-label="{PANEL_LABELS[lastPanel]} panel"
          class="side-panel-shell"
          class:side-panel-shell--open={activePanel !== null}
          style:width="{activePanel ? panelWidth : 0}px"
          inert={activePanel === null}
        >
          <SidePanel
            open={true}
            title={PANEL_LABELS[lastPanel]}
            bind:width={panelWidth}
            onClose={() => (activePanel = null)}
          >
            {#if lastPanel === 'data'}
              <DataPanel
                onImageUpload={handleImageUpload}
                onVideoUpload={handleVideoUpload}
                onSelectExample={loadExampleData}
                onExport={() => exportDialog.start()}
                onClearAll={() => (showClearAllModal = true)}
                autosave={$autosaveStatus}
                {reattachVideo}
                {savedVersions}
                onRestoreVersion={(id) => (pendingRestoreId = id)}
              />
            {:else if lastPanel === 'paths'}
              <PathsPanel onDelete={(id) => (pendingDeletePathId = id)} />
            {:else if lastPanel === 'settings'}
              <SettingsPanel />
            {:else if lastPanel === 'help'}
              <HelpPanel onOpenWelcome={openWelcomeModal} />
            {/if}
          </SidePanel>
        </div>
      </nav>
    {/snippet}

    {#snippet canvas()}
      <P5Wrapper bind:this={p5Component} />
    {/snippet}
  </CanvasFrame>
</div>

<ConfirmDialog
  open={pendingDeletePathId !== null}
  title="Delete Path?"
  message="This will delete the selected path and all its recorded points."
  confirmLabel="Delete"
  onConfirm={confirmDeletePath}
  onCancel={() => (pendingDeletePathId = null)}
  class="w-72"
/>

<ConfirmDialog
  open={showClearAllModal}
  title="Clear All Paths?"
  message="This will delete all recorded paths. You can restore an earlier version from Saved Versions afterward."
  confirmLabel="Clear All"
  onConfirm={() => {
    handleClear()
    showClearAllModal = false
  }}
  onCancel={() => (showClearAllModal = false)}
/>

<ConfirmDialog
  open={pendingRestoreId !== null}
  title="Restore This Version?"
  message="Your current work will be saved first, then replaced with this saved version."
  confirmLabel="Restore"
  onConfirm={confirmRestoreVersion}
  onCancel={() => (pendingRestoreId = null)}
/>

<ExportDialog bind:this={exportDialog} onSavePath={handleSavePath} />

<WelcomeModal onClose={closeWelcomeModal} onTryExample={handleTryExample} />

{#if notice}
  <div class="fixed top-20 left-4 right-4 flex justify-center pointer-events-none z-50">
    <div class="alert alert-info shadow-lg max-w-md pointer-events-auto" role="status">
      <IconWarning class="h-5 w-5" />
      <span class="text-sm">{notice}</span>
    </div>
  </div>
{/if}

{#if showEmptyPathWarning}
  <div class="fixed top-20 left-4 right-4 flex justify-center pointer-events-none z-50">
    <div class="alert alert-warning shadow-lg max-w-md pointer-events-auto">
      <IconWarning class="h-5 w-5" />
      <span class="text-sm"
        >Please record some data on the current path before adding a new one.</span
      >
    </div>
  </div>
{/if}

<style>
  /* CanvasFrame needs a bounded parent; dvh keeps it clear of mobile URL bars. */
  .app-frame {
    height: 100vh;
    height: 100dvh;
  }

  .left-rail {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    border-right: 1px solid var(--color-base-300);
    --activity-bar-bg: var(--color-base-100);
    --activity-bar-border: var(--color-base-300);
    --activity-bar-fg: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    --activity-bar-fg-hover: var(--color-base-content);
    --activity-bar-bg-hover: var(--color-base-200);
    --activity-bar-fg-active: var(--color-base-content);
    --activity-bar-bg-active: color-mix(in srgb, var(--color-primary) 15%, transparent);
    --activity-bar-accent: var(--color-primary);
    --activity-bar-focus: var(--color-primary);
    --side-panel-bg: var(--color-base-100);
    --side-panel-border: var(--color-base-300);
    --side-panel-title-fg: color-mix(in srgb, var(--color-base-content) 70%, transparent);
    --side-panel-close-fg: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }

  .side-panel-shell {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    transition: width 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Below lg the panel overlays the canvas instead of squeezing it. */
  @media (max-width: 1023px) {
    .side-panel-shell {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 100%;
      z-index: 40;
    }
    .side-panel-shell--open {
      box-shadow: 4px 0 12px rgb(0 0 0 / 0.12);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .side-panel-shell {
      transition: none;
    }
  }
</style>
