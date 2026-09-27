<script lang="ts">
  let {
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
    class: className = 'w-80',
  }: {
    open: boolean
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
    onCancel: () => void
    class?: string
  } = $props()
</script>

<dialog class="modal" class:modal-open={open} data-ui-element>
  <div class="modal-box {className}">
    <h2 class="text-lg font-semibold mb-4">{title}</h2>
    <p class="mb-6 text-sm">{message}</p>
    <div class="modal-action">
      <button class="btn" onclick={onCancel}>Cancel</button>
      <button class="btn btn-error" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onCancel}>close</button>
  </form>
</dialog>
