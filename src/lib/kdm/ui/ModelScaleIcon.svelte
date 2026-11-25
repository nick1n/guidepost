<script module lang="ts">
  const tops = { tiny: 18, small: 14, medium: 10, large: 6, xl: 2 } as const;
  export type ModelScale = keyof typeof tops;
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    scale: ModelScale;
    label?: string;
    class?: ClassValue;
  };

  let { scale, label, class: className }: Props = $props();
  let top = $derived(tops[scale]);
</script>

<!-- Adapted from Lucide's ruler-dimension-line (ISC): rotated ruler, adjustable measurement. -->
<svg
  class={className}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  focusable="false"
>
  {#if label}<title>{label}</title>{/if}
  <rect x="4" y="2" width="8" height="20" rx="2" />
  <path d="M9 6h3m-3 4h3m-3 4h3m-3 4h3" />
  <!-- Four notch heights, then the ruler's top edge for XL. -->
  <path d={`M16 ${top}h4m-2 0V22m-2 0h4`} />
</svg>

<style>
  svg {
    display: inline-block;
    inline-size: var(--size-icon, 1em);
    block-size: var(--size-icon, 1em);
    color: var(--color-model-scale, currentColor);
    vertical-align: middle;
  }
</style>
