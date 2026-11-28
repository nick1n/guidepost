<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let { checked = $bindable(), ...attributes }: Omit<HTMLInputAttributes, "type"> = $props();
</script>

<input {...attributes} type="checkbox" bind:checked />

<style>
  input {
    appearance: none;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    padding: var(--border-width);
    border: var(--border-width) solid var(--foreground);
    border-radius: 0;
    background:
      linear-gradient(var(--foreground) 0 0) center / 0% 0% no-repeat content-box,
      var(--contrast);
    cursor: pointer;
    opacity: 0.5;
    transition: background-size var(--duration-fast) var(--ease-standard);

    &:is(:hover:not(:disabled), :focus-visible, :checked) {
      opacity: 1;
    }

    &:disabled {
      cursor: default;
    }

    &:checked {
      background-size:
        100% 100%,
        auto;
    }
  }

  @media (forced-colors: active) {
    input {
      appearance: auto;
      padding: 0;
      border: 0;
      background: none;
      opacity: 1;
    }
  }
</style>
