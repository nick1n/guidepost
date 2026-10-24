<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  let { pressed, children, ...attributes }: Omit<HTMLButtonAttributes, "aria-pressed" | "type"> & { pressed: boolean } = $props();
</script>

<button type="button" aria-pressed={pressed} {...attributes}>
  {@render children?.()}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    gap: 0.5rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--card);
    font-size: var(--text-sm);
    transition: var(--transition-colors);

    &[aria-pressed="true"] {
      border-color: var(--accent);
      background: var(--blue-7);
    }

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }
  }

  @media (hover: hover) {
    button:hover:not(:disabled) {
      border-color: var(--accent);
      background: var(--blue-8);

      &[aria-pressed="true"] {
        background: var(--blue-6);
      }
    }
  }
</style>
