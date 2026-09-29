<script lang="ts">
  import type { Snippet } from 'svelte'
  import IconExpand from '~icons/material-symbols/expand-more'
  import { toggleSection, viewPrefs } from '$lib/stores/viewPrefs'

  let {
    title,
    collapsibleId,
    children,
  }: { title: string; collapsibleId?: string; children: Snippet } = $props()

  const open = $derived(!collapsibleId || $viewPrefs.openSections.includes(collapsibleId))
  const headingClass = 'text-xs font-semibold uppercase tracking-wide text-base-content/60'
</script>

<section class="flex flex-col gap-2">
  {#if collapsibleId}
    <h3 class={headingClass}>
      <button
        class="flex w-full items-center justify-between gap-2 cursor-pointer uppercase hover:text-base-content"
        aria-expanded={open}
        aria-controls="section-{collapsibleId}"
        onclick={() => toggleSection(collapsibleId)}
      >
        {title}
        <IconExpand class="w-4 h-4 transition-transform {open ? 'rotate-180' : ''}" />
      </button>
    </h3>
    <div id="section-{collapsibleId}" class="flex-col gap-2 {open ? 'flex' : 'hidden'}">
      {@render children()}
    </div>
  {:else}
    <h3 class={headingClass}>{title}</h3>
    {@render children()}
  {/if}
</section>
