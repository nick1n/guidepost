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
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
    color: var(--foreground);
    transition: filter var(--duration-fast) var(--ease-standard);
    touch-action: manipulation;

    &:active {
      filter: brightness(var(--feedback-brightness, 1.12));
    }
  }
  @media (hover: hover) {
    button:hover {
      filter: brightness(var(--feedback-brightness, 1.12));
    }
  }
</style>
