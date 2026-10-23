<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";

  // A single-choice native select, with standard attributes and optional value binding.
  let { value = $bindable(), children, ...attributes }: Omit<HTMLSelectAttributes, "multiple" | "size"> = $props();
</script>

<div>
  <select {...attributes} bind:value>
    {@render children?.()}
  </select>
  <span class="chevron i-material-symbols:keyboard-arrow-down" aria-hidden="true"></span>
</div>

<style>
  div {
    display: grid;
    align-items: center;
  }
  select {
    appearance: none;
    grid-area: 1 / 1;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    padding-inline-end: 2.75rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--card);
    color: var(--foreground);
    cursor: pointer;
  }
  .chevron {
    --size-icon: 1.5rem;
    grid-area: 1 / 1;
    justify-self: end;
    margin-inline-end: 0.75rem;
    color: var(--muted-foreground);
    pointer-events: none;
  }
</style>
