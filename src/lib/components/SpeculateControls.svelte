<script lang="ts">
  import IconRewind from '~icons/material-symbols/fast-rewind'
  import IconForward from '~icons/material-symbols/fast-forward'
  import {
    drawingState,
    findCurrentPath,
    handleForwardSpeculateMode,
    handleRewindSpeculateMode,
  } from '$lib/stores/drawingState'
  import { speculateNow } from '$lib/p5/features/drawing'
  import { formatClock } from '$lib/utils/time'

  let { left }: { left: number } = $props()

  const isDrawing = $derived($drawingState.isDrawing)
  const currentPoints = $derived(findCurrentPath($drawingState)?.points ?? [])
  const pathStart = $derived(currentPoints[0]?.time)
  const pathEnd = $derived(currentPoints.at(-1)?.time)
  let speculateTime = $state(0)

  $effect(() => {
    void [pathStart, pathEnd, $drawingState.currentPathId]
    speculateTime = speculateNow()
  })

  $effect(() => {
    if (!isDrawing) return
    let raf = requestAnimationFrame(function tick() {
      speculateTime = speculateNow()
      raf = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(raf)
      speculateTime = speculateNow()
    }
  })
</script>

<div
  class="absolute bottom-4 -translate-x-1/2 flex gap-2 bg-base-200/80 backdrop-blur-sm rounded-lg p-2 shadow-lg"
  style:left="{left}%"
  data-ui-element
>
  <button
    class="btn btn-ghost btn-sm btn-circle"
    onclick={handleRewindSpeculateMode}
    aria-label="Rewind"
    title="Rewind (R)"
  >
    <IconRewind class="h-5 w-5" />
  </button>
  <button
    class="btn btn-ghost btn-sm btn-circle"
    onclick={handleForwardSpeculateMode}
    aria-label="Forward"
    title="Forward (F)"
  >
    <IconForward class="h-5 w-5" />
  </button>
  <div class="flex flex-col justify-center pl-1 pr-2 leading-tight tabular-nums">
    <span class="text-sm font-medium" aria-label="Session time">{formatClock(speculateTime)}</span>
    <span class="text-xs text-base-content/60">
      {#if pathStart !== undefined && pathEnd !== undefined}
        Path {formatClock(pathStart)}–{formatClock(pathEnd)}
      {:else}
        Path not started
      {/if}
    </span>
  </div>
</div>
