<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let { label, children, ...attributes }: Omit<HTMLButtonAttributes, "children"> & { label: string; children: Snippet } = $props();
</script>

<button class="floating-control" type="button" aria-label={label} {...attributes}>
  {@render children()}
</button>

<style>
  button {
    display: grid;
    place-items: center;
    inline-size: var(--size-floating-control);
    block-size: var(--size-floating-control);
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: color-mix(var(--card) 67%, transparent);
    backdrop-filter: blur(1.5px);
    color: var(--foreground);
    touch-action: manipulation;

    &[data-menu-trigger] {
      position: relative;
      z-index: 6;
    }

    &:is(:focus, :active) {
      border-color: var(--grey-4);
      background: var(--card);
    }
  }
  @media (hover: hover) {
    button:hover {
      border-color: var(--grey-4);
      background: var(--card);
    }
  }
</style>
