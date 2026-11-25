<script module lang="ts">
  export type ScaleStudy = "spine" | "slots" | "wide-slots" | "square-ticks" | "square-dots" | "square-bands" | "lucide" | "game-icons";
  const scaleTops = { tiny: 18, small: 14, medium: 10, large: 6, xl: 2 } as const;
  const pawnSizes = { tiny: 42, small: 57, medium: 72, large: 87, xl: 100 } as const;
  const slots = Object.values(scaleTops);
</script>

<script lang="ts">
  import type { ModelScale } from "#lib/kdm/ui/ModelScaleIcon.svelte";

  type Props = {
    scales: readonly ModelScale[];
    variant: ScaleStudy;
  };

  let { scales, variant }: Props = $props();
  let levels = $derived([...new Set(scales.map((scale) => scaleTops[scale]))].sort((a, b) => b - a));
  let highest = $derived(levels.at(-1) ?? 22);
  let pawns = $derived([...new Set(scales)].sort((a, b) => pawnSizes[b] - pawnSizes[a]));
</script>

{#if variant === "lucide" || variant === "game-icons"}
  <span class="pawn-stack" aria-hidden="true">
    {#each pawns as scale, index (scale)}
      <span
        class={["pawn", variant === "lucide" ? "i-lucide:chess-pawn" : "i-game-icons:pawn"]}
        style:--pawn-size={`${pawnSizes[scale]}%`}
        style:--pawn-end={`${Math.min(index * 42, 100 - pawnSizes[scale])}%`}
      ></span>
    {/each}
  </span>
{:else}
  <!-- Test-page studies based on Lucide's ruler-dimension-line (ISC). -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {#if variant === "spine"}
      <g class="guide">
        <rect x="4" y="2" width="8" height="20" rx="2" />
        <path d="M9 6h3m-3 4h3m-3 4h3m-3 4h3" />
        <path d={`M18 ${highest}V22m-2 0h4`} />
      </g>
      {#each levels as top (top)}
        <path d={`M16 ${top}h4`} />
      {/each}
    {:else if variant === "slots" || variant === "wide-slots"}
      {@const geometry =
        variant === "wide-slots"
          ? { base: "M2 2v20h20", start: 6, active: 16, inactive: 5 }
          : { base: "M7 2v20h10", start: 10, active: 7, inactive: 2 }}
      <path class="guide" d={geometry.base} />
      {#each slots as top (top)}
        {@const active = levels.includes(top)}
        <path class={active ? undefined : "guide"} d={`M${geometry.start} ${top}h${active ? geometry.active : geometry.inactive}`} />
      {/each}
    {:else}
      {#each slots as top (top)}
        {@const active = levels.includes(top)}
        {@const y = 5 + ((top - 2) * 7) / 8}
        {#if variant === "square-bands" && active}
          <rect x="3" y={y - 1.5} width="18" height="3" fill="currentColor" stroke="none" />
        {:else if variant === "square-dots" && active}
          <circle cx="16" cy={y} r="1.25" fill="currentColor" stroke="none" />
        {:else}
          <path class={active ? undefined : "guide"} d={`M8 ${y}h${active ? 8 : 3}`} />
        {/if}
      {/each}
      <rect class="guide" x="2" y="2" width="20" height="20" rx="2" />
    {/if}
  </svg>
{/if}

<style>
  svg,
  .pawn-stack {
    display: inline-block;
    inline-size: var(--size-icon, 1em);
    block-size: var(--size-icon, 1em);
    color: var(--scale-mark, var(--blue-2));
    vertical-align: middle;
  }

  .guide {
    stroke: var(--scale-guide, var(--grey-5));
  }

  .pawn-stack {
    position: relative;
  }

  .pawn {
    --size-icon: var(--pawn-size);

    position: absolute;
    inset-block-end: 0;
    inset-inline-end: var(--pawn-end);
  }

  .pawn:first-child:not(:only-child) {
    color: var(--scale-guide, var(--blue-4));
  }
</style>
