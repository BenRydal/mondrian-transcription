<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    title,
    onClose,
    id,
    class: className = 'w-80',
    children,
  }: {
    open: boolean
    title: string
    onClose: () => void
    id?: string
    class?: string
    children: Snippet
  } = $props()
</script>

<dialog {id} class="modal" class:modal-open={open} data-ui-element>
  <div class="modal-box {className}">
    <h2 class="text-lg font-semibold mb-4">{title}</h2>
    {@render children()}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onClose}>close</button>
  </form>
</dialog>
