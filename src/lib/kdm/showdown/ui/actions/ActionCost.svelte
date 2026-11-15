<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { describeCost, type Cost } from "#lib/kdm/showdown/sheet.ts";

  let { cost }: { cost: readonly Cost[] } = $props();
  let label = $derived(cost.length ? `Costs ${describeCost(cost)}` : undefined);
</script>

<span class={["cost", !cost.length && "free"]} role={label ? "img" : undefined} aria-label={label}>
  {#if cost.length}
    {#each cost as item, index (`${item}-${index}`)}
      <KdIcon i={item} />
    {/each}
  {:else}
    Free
  {/if}
</span>

<style>
  .cost {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-action-cost, var(--identity));
    font-size: 1.125rem;
    white-space: nowrap;

    &.free {
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
    }
  }
</style>
