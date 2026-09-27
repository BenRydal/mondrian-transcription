<script lang="ts">
  import type { Snippet } from 'svelte'

  let { title, children }: { title: string; children: Snippet } = $props()
</script>

<section class="flex flex-col gap-2">
  <h3 class="text-xs font-semibold uppercase tracking-wide text-base-content/60">{title}</h3>
  {@render children()}
</section>
