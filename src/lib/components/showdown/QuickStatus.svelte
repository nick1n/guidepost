<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { isReady, type Sheet } from "./data";
  let { sheet, showResources = false }: { sheet: Sheet; showResources?: boolean } = $props();
</script>

<span class={["life-state", sheet.dead && "dead"]}>
  <span class="state-label"
    >{sheet.dead ? "Dead" : isReady(sheet) ? "Ready" : sheet.statuses.includes("Retired") ? "Retired" : "Acted"}</span
  >
  {#if sheet.statuses.includes("Blind Spot")}<span class="blind i-material-symbols:visibility" aria-hidden="true"></span>{/if}
  {#if showResources}
    <span class="resources" aria-hidden="true">
      {#each Array.from({ length: sheet.remaining.movement }, (_, index) => index) as index (index)}
        <KdIcon i="movement" />
      {/each}
      {#each Array.from({ length: sheet.remaining.activation }, (_, index) => index) as index (index)}
        <KdIcon i="activation" />
      {/each}
    </span>
  {/if}
</span>
<span class="flags" aria-hidden="true">
  {#if sheet.threat}<span class="status-icon i-material-symbols:my-location"></span>{/if}
  {#if sheet.acted}<span class="status-icon i-material-symbols:check"></span>{/if}
  {#if sheet.statuses.includes("Knocked Down")}<span class="status-icon i-material-symbols:airline-seat-flat"></span>{/if}
  {#if sheet.priority}<span class="priority i-material-symbols:flag"></span>{/if}
</span>

<style>
  .life-state {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    min-inline-size: 0;
    gap: 0.125rem;
    &.dead {
      color: var(--accent-red);
    }
  }
  .state-label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .blind {
    inline-size: 0.875rem;
    block-size: 0.875rem;
    color: var(--accent-green);
    flex-shrink: 0;
  }
  .resources {
    display: inline-flex;
    flex-shrink: 0;
    gap: 1px;
    color: var(--identity);
    font-size: 0.75rem;
  }
  .resources :global(.kd-icon) {
    color: inherit;
  }
  .flags {
    display: flex;
    align-items: center;
    justify-content: center;
    block-size: 0.875rem;
    gap: 1px;
  }
  .status-icon,
  .priority {
    inline-size: 0.875rem;
    block-size: 0.875rem;
    color: var(--foreground);
  }
  .priority {
    color: var(--accent);
  }
</style>
