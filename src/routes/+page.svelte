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
  import HistorySection from '$lib/components/panels/HistorySection.svelte'
  import SessionSection from '$lib/components/panels/SessionSection.svelte'
  import { drawingState, deletePathById, type PathData } from '$lib/stores/drawingState'
  import { drawingConfig } from '$lib/stores/drawingConfig'
  import { invalidateSpeculateClock } from '$lib/timing/sessionClocks'
  import { hasRecordedData, formatBytes } from '$lib/stores/sessionRecovery'
  import { createAutosave, SessionBusyError, type AutosaveState } from '$lib/storage/autosave'
  import type {
    AssetInput,
    RestoredSession,
    SessionRecord,
    SnapshotInput,
    SnapshotMeta,
    VideoMeta,
  } from '$lib/storage/sessionDb'
  import { pathLabel, sessionName } from '$lib/storage/history'
  import {
    ArchiveError,
    MAX_ARCHIVE_VIDEO_BYTES,
    archiveFileName,
    packSession,
    unpackSession,
  } from '$lib/storage/sessionArchive'
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
    const id = pendingDeletePathId
    pendingDeletePathId = null
    if (id === null) return
    const paths = get(drawingState).paths
    const index = paths.findIndex((p) => p.pathId === id)
    void pin(`Before deleting ${paths[index]?.name || `Path ${index + 1}`}`)
    deletePathById(id)
  }

  let p5Component: P5Wrapper
  let showRecoveryModal = $state(false)
  let recoveredSession = $state.raw<RestoredSession | null>(null)
  let showEmptyPathWarning = $state(false)
  let notice = $state<string | null>(null)
  let floorPlanAsset: AssetInput | null = null
  let videoAsset: (AssetInput & { meta: VideoMeta }) | null = null
  let reattachVideo = $state<VideoMeta | null>(null)
  let history = $state.raw<SnapshotMeta[]>([])
  let sessions = $state.raw<SessionRecord[]>([])
  let storageLabel = $state<string | null>(null)
  let pendingRestoreId = $state<number | null>(null)
  let pendingDeleteSession = $state<SessionRecord | null>(null)

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

  const autosave = createAutosave({ getSnapshot, onNotice: showNotice })
  const autosaveStatus = autosave.status
  const canWrite = $derived(!['other-tab', 'unavailable'].includes($autosaveStatus.state))
  const currentSession = $derived(sessions.find((s) => s.id === $autosaveStatus.sessionId) ?? null)
  const currentSessionName = $derived(
    currentSession ? sessionName(currentSession) : (floorPlanName ?? 'Untitled session')
  )
  const livePathIds = $derived(
    new Set($drawingState.paths.filter((p) => p.points.length > 0).map((p) => p.pathId))
  )

  // History is only read while the Data panel is open; saves while drawing just mark it stale.
  let historyStale = true
  let historyLoading: Promise<void> | null = null
  let historyAgain = false
  function refreshHistory() {
    if (activePanel !== 'data') {
      historyStale = true
      return
    }
    historyStale = false
    if (historyLoading) {
      historyAgain = true
      return
    }
    historyLoading = (async () => {
      do {
        historyAgain = false
        const [h, s, estimate] = await Promise.all([
          autosave.listSnapshots(),
          autosave.listSessions(),
          autosave.storageEstimate(),
        ])
        history = h
        sessions = s
        storageLabel = estimate
          ? `Storage: ${formatBytes(estimate.usage)} used of ${formatBytes(estimate.quota)}`
          : null
      } while (historyAgain)
      historyLoading = null
    })()
  }
  $effect(() => {
    if (activePanel === 'data' && historyStale) refreshHistory()
  })

  /** Pin the live state; the snapshot is captured synchronously, before any await. */
  async function pin(label: string | null) {
    const result = await autosave.checkpoint(label)
    if (result) refreshHistory()
    return result
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
      refreshHistory()
    })

    const shownNotices: AutosaveState[] = []
    const unsubscribeStatus = autosave.status.subscribe(({ state }) => {
      const message = NOTICES[state]
      if (message && !shownNotices.includes(state)) {
        shownNotices.push(state)
        showNotice(message)
      }
      if (state === 'saved') refreshHistory()
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
    window.addEventListener('keydown', handleCheckpointShortcut)

    return () => {
      window.removeEventListener('keydown', handleCheckpointShortcut)
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

  function handleCheckpointShortcut(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 's') return
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return
    e.preventDefault()
    if (!hasRecordedData(get(drawingState).paths)) return showNotice('Nothing to save yet.')
    void pin(null).then((result) => result && showNotice('Checkpoint saved.'))
  }

  /** Empty canvas, no floor plan or video: the state of a brand-new session. */
  function resetWorkspace() {
    p5Component.clearDrawing()
    p5Component.clearVideo()
    videoName = null
    videoAsset = null
    reattachVideo = null
    floorPlanAsset = null
    floorPlanName = null
    drawingState.update((state) => ({
      ...state,
      imageElement: null,
      imageWidth: 0,
      imageHeight: 0,
      videoTime: 0,
    }))
  }

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
    } else {
      floorPlanAsset = null
      floorPlanName = null
      drawingState.update((state) => ({ ...state, imageElement: null }))
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

  /** Start Fresh keeps the recovered session intact and begins a new one. */
  async function handleDiscardSession() {
    showRecoveryModal = false
    recoveredSession = null
    await autosave.newSession()
    refreshHistory()
  }

  /** Pins the live session first, so restoring an older version is itself undoable. */
  async function confirmRestoreVersion() {
    const id = pendingRestoreId
    pendingRestoreId = null
    if (id === null || !p5Component) return
    const session = await autosave.loadSnapshot(id)
    if (!session) return showNotice('That saved version is damaged and cannot be restored.')
    await pin('Before restore')
    applyRestoredSession(session)
    refreshHistory()
  }

  /** Replace one path (or add it back / as a copy) without touching the others. */
  async function restorePath(snapshotId: number, pathId: number, mode: 'replace' | 'copy') {
    const path = await autosave.loadPath(snapshotId, pathId)
    if (!path) return showNotice('That saved version is damaged and cannot be restored.')
    const entry = history.find((m) => m.id === snapshotId)
    const label = entry ? pathLabel(entry.paths, pathId) : 'path'
    await pin(`Before restoring ${label}`)
    invalidateSpeculateClock()
    drawingState.update((state) => {
      const paths = [...state.paths]
      const index = paths.findIndex((p) => p.pathId === pathId)
      if (mode === 'copy') {
        const id = Math.max(state.currentPathId, ...paths.map((p) => p.pathId)) + 1
        const points = path.points.map((p) => ({ ...p, pathId: id }))
        paths.push({ ...path, pathId: id, points, name: `${label} (restored)` } as PathData)
      } else if (index >= 0) {
        paths[index] = path
      } else {
        const after = paths.findIndex((p) => p.pathId > pathId)
        paths.splice(after < 0 ? paths.length : after, 0, path)
      }
      return { ...state, paths, shouldTrackMouse: false, isDrawing: false, isVideoPlaying: false }
    })
    refreshHistory()
  }

  async function handleSwitchSession(id: string) {
    const session = await autosave.switchSession(id)
    resetWorkspace()
    if (session) applyRestoredSession(session)
    refreshHistory()
  }

  async function handleNewSession() {
    await autosave.newSession()
    resetWorkspace()
    refreshHistory()
    showNotice('Started a new session. Your other sessions are in the Data panel.')
  }

  async function confirmDeleteSession() {
    const session = pendingDeleteSession
    pendingDeleteSession = null
    if (!session) return
    const isCurrent = session.id === autosave.sessionId
    try {
      await autosave.deleteSession(session.id)
      if (isCurrent) resetWorkspace()
    } catch (e) {
      showNotice(e instanceof SessionBusyError ? e.message : 'Could not delete the session.')
    }
    refreshHistory()
  }

  function download(blob: Blob, name: string) {
    const url = window.URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }

  async function handleExportHistory() {
    const id = autosave.sessionId
    const bundle = id ? await autosave.exportSession(id) : null
    if (!bundle) return showNotice('Nothing has been saved in this session yet.')
    const videoBytes = [...bundle.videos.values()].reduce((sum, b) => sum + b.size, 0)
    download(
      await packSession(bundle),
      archiveFileName(bundle.session, sessionName(bundle.session))
    )
    if (videoBytes > MAX_ARCHIVE_VIDEO_BYTES) {
      showNotice('The video is too large to include; re-attach it after importing.')
    }
  }

  async function handleImportHistory(file: File) {
    try {
      const bundle = await unpackSession(file)
      await pin('Before import')
      const session = await autosave.importSession(bundle)
      resetWorkspace()
      if (session) applyRestoredSession(session)
      refreshHistory()
      showNotice(`Imported "${sessionName(bundle.session)}" as a new session.`)
    } catch (e) {
      showNotice(e instanceof ArchiveError ? e.message : 'Could not import that file.')
    }
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
      if (!reattachVideo) void pin('Before new video')
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
        void pin('Before new floor plan')
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
    void pin('Before mode switch')
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
      void pin('Before loading example')
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
                {storageLabel}
              >
                {#snippet sessionSection()}
                  <SessionSection
                    {sessions}
                    currentId={$autosaveStatus.sessionId}
                    currentName={currentSessionName}
                    {canWrite}
                    onSwitch={handleSwitchSession}
                    onNew={handleNewSession}
                    onRename={(id, name) => autosave.renameSession(id, name).then(refreshHistory)}
                    onDelete={(s) => (pendingDeleteSession = s)}
                    onExport={handleExportHistory}
                    onImport={handleImportHistory}
                  />
                {/snippet}
                {#snippet historySection()}
                  <HistorySection
                    entries={history}
                    {livePathIds}
                    {canWrite}
                    onCheckpoint={(name) =>
                      pin(name).then((r) => !r && showNotice('Nothing to save yet.'))}
                    onRestore={(id) => (pendingRestoreId = id)}
                    onRestorePath={restorePath}
                    onRename={(id, label) =>
                      autosave.renameSnapshot(id, label).then(refreshHistory)}
                    onDelete={(id) => autosave.deleteSnapshot(id).then(refreshHistory)}
                  />
                {/snippet}
              </DataPanel>
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
  message="This will delete all recorded paths. A checkpoint is saved first, so you can restore them from History."
  confirmLabel="Clear All"
  onConfirm={() => {
    void pin('Before Clear All')
    handleClear()
    showClearAllModal = false
  }}
  onCancel={() => (showClearAllModal = false)}
/>

<ConfirmDialog
  open={pendingRestoreId !== null}
  title="Restore This Version?"
  message="Your current work is saved as a checkpoint first, then replaced with this saved version."
  confirmLabel="Restore"
  onConfirm={confirmRestoreVersion}
  onCancel={() => (pendingRestoreId = null)}
/>

<ConfirmDialog
  open={pendingDeleteSession !== null}
  title="Delete Session?"
  message={pendingDeleteSession
    ? `"${sessionName(pendingDeleteSession)}" and all ${pendingDeleteSession.snapshotCount} of its saved versions and checkpoints will be permanently deleted. No checkpoint is kept. Use Export history first if you might need it.`
    : ''}
  confirmLabel="Delete Session"
  onConfirm={confirmDeleteSession}
  onCancel={() => (pendingDeleteSession = null)}
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
