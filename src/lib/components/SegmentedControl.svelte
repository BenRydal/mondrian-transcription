<script lang="ts" generics="T">
  let {
    options,
    value,
    onSelect,
    disabled = false,
    label,
    labelledby,
    class: className = '',
    itemClass = '',
  }: {
    options: readonly { value: T; label: string }[]
    value: T
    onSelect: (value: T) => void
    disabled?: boolean
    label?: string
    labelledby?: string
    class?: string
    itemClass?: string
  } = $props()
</script>

<div class="join {className}" role="group" aria-label={label} aria-labelledby={labelledby}>
  {#each options as option (option.label)}
    {@const active = option.value === value}
    <button
      class="btn btn-sm join-item {itemClass}"
      class:btn-active={active}
      aria-pressed={active}
      {disabled}
      onclick={() => onSelect(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
