<script lang="ts" generics="T extends string">
  type Option = { value: T; label: string };

  type Props = {
    label: string;
    value: T;
    options: Option[];
    onchange: (v: T) => void;
  };

  let { label, value, options, onchange }: Props = $props();
</script>

<div class="segmented">
  <span>{label}</span>
  <div class="options">
    {#each options as option (option.value)}
      {@const active = option.value === value}
      <button type="button" aria-pressed={active} onclick={() => onchange(option.value)}>
        {option.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .segmented {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  span {
    color: var(--muted-foreground);
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  button {
    border-radius: var(--radius-control);
    padding: 0.5rem 0.75rem;
    background: color-mix(var(--panel) 70%, transparent);
    color: color-mix(var(--foreground) 70%, transparent);
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    &:not([aria-pressed="true"]):hover {
      background: var(--panel);
      color: var(--foreground);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }
</style>
