<script lang="ts">
  import Modal from './Modal.svelte'

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

<Modal {open} {title} onClose={onCancel} class={className}>
  <p class="mb-6 text-sm">{message}</p>
  <div class="modal-action">
    <button class="btn" onclick={onCancel}>Cancel</button>
    <button class="btn btn-error" onclick={onConfirm}>{confirmLabel}</button>
  </div>
</Modal>
