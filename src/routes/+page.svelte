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
  import {
    getRecoverableSession,
    clearSavedSession,
    saveSession,
    hasRecordedData,
    debounce,
    type SavedSession,
  } from '$lib/stores/sessionRecovery'
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
  let recoveredSession = $state<SavedSession | null>(null)
  let showEmptyPathWarning = $state(false)

  $effect(() => {
    if ($drawingState.isDrawing) {
      showEmptyPathWarning = false
    }
  })

  // Save function (used by all save triggers)
  function saveNow() {
    if (p5Component) {
      const floorPlanDataUrl = p5Component.getFloorPlanDataUrl()
      saveSession(floorPlanDataUrl)
    }
  }

  // Debounced save for general state changes (renames, config, etc.)
  const debouncedSave = debounce(saveNow, 2000)

  onMount(() => {
    // Check for recoverable session
    const session = getRecoverableSession()
    if (session) {
      recoveredSession = session
      showRecoveryModal = true
    } else {
      openWelcomeModal()
    }

    // Track previous recording state to detect when recording stops
    let wasRecording = false
    let periodicSaveInterval: ReturnType<typeof setInterval> | null = null

    // Set up auto-save subscription
    const unsubscribe = drawingState.subscribe((state) => {
      const hasData = hasRecordedData(state.paths)
      const isRecording = state.isDrawing

      // Save immediately when recording stops
      if (wasRecording && !isRecording && hasData) {
        saveNow()
      }

      // Start/stop periodic save during recording
      if (isRecording && !periodicSaveInterval) {
        // Save every 60 seconds while recording
        periodicSaveInterval = setInterval(() => {
          if (hasRecordedData(get(drawingState).paths)) {
            saveNow()
          }
        }, 60000)
      } else if (!isRecording && periodicSaveInterval) {
        clearInterval(periodicSaveInterval)
        periodicSaveInterval = null
      }

      wasRecording = isRecording

      // Debounced save for other state changes (when not recording)
      if (!showRecoveryModal && hasData && !isRecording) {
        debouncedSave()
      }
    })

    // Save when page loses visibility (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hasRecordedData(get(drawingState).paths)) {
          saveNow()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

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
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (periodicSaveInterval) clearInterval(periodicSaveInterval)
      unsubscribe()
    }
  })

  function handleRestoreSession() {
    if (!recoveredSession || !p5Component) return

    // Restore config first
    drawingConfig.update((config) => ({
      ...config,
      isTranscriptionMode: recoveredSession!.config.isTranscriptionMode,
      pollingRate: recoveredSession!.config.pollingRate,
      heartbeatInterval: recoveredSession!.config.heartbeatInterval ?? 500,
      useAdaptiveSampling: recoveredSession!.config.useAdaptiveSampling ?? true,
      strokeWeight: recoveredSession!.config.strokeWeight,
      speculateScale: recoveredSession!.config.speculateScale,
      isContinuousMode: recoveredSession!.config.isContinuousMode,
      floorPlanRotation: recoveredSession!.config.floorPlanRotation ?? 0,
    }))

    // Restore paths and state
    drawingState.update((state) => ({
      ...state,
      paths: recoveredSession!.paths,
      currentPathId: Math.max(...recoveredSession!.paths.map((p) => p.pathId), 0),
      videoTime: recoveredSession!.videoTime,
      imageWidth: recoveredSession!.imageWidth,
      imageHeight: recoveredSession!.imageHeight,
    }))

    // Restore floor plan image if saved
    if (recoveredSession.floorPlanDataUrl) {
      const image = new window.Image()
      image.onload = () => {
        p5Component.setImage(image, true)
        floorPlanName = 'Restored floor plan'
      }
      image.onerror = () => {
        console.warn('Failed to restore floor plan image from saved session')
      }
      image.src = recoveredSession.floorPlanDataUrl
    }

    showRecoveryModal = false
    recoveredSession = null
  }

  function handleDiscardSession() {
    clearSavedSession()
    showRecoveryModal = false
    recoveredSession = null
  }

  function handleVideoUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const video = window.document.createElement('video')
      video.src = window.URL.createObjectURL(file)
      video.autoplay = false
      video.loop = false
      p5Component.setVideo(video)
      videoName = file.name
    }
  }

  function handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const image = new window.Image()
      image.src = window.URL.createObjectURL(file)
      image.onload = () => {
        p5Component.setImage(image)
        floorPlanName = file.name
      }
    }
  }

  function handleSavePath(onComplete?: () => void) {
    p5Component.exportAll(() => {
      // Clear saved session after successful export
      clearSavedSession()
      onComplete?.()
    })
  }

  function handleClear() {
    p5Component.clearDrawing()
    p5Component.startNewPath()
    clearSavedSession()
  }

  function handleModeSwitch() {
    p5Component.clearDrawing()
    p5Component.clearVideo()
    videoName = null
    p5Component.startNewPath()
    clearSavedSession()
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
  message="This will delete all recorded paths. This action cannot be undone."
  confirmLabel="Clear All"
  onConfirm={() => {
    handleClear()
    showClearAllModal = false
  }}
  onCancel={() => (showClearAllModal = false)}
/>

<ExportDialog bind:this={exportDialog} onSavePath={handleSavePath} />

<WelcomeModal onClose={closeWelcomeModal} onTryExample={handleTryExample} />

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
