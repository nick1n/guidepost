<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { isReady, type Sheet } from "./data";
  import { statusIcons } from "#lib/constants.ts";
  let { sheet, showResources = false }: { sheet: Sheet; showResources?: boolean } = $props();
</script>

<span class={["life-state", sheet.dead && "dead", isReady(sheet) && "ready"]}>
  {#if sheet.dead || isReady(sheet)}
    <span class={["state-icon", sheet.dead ? statusIcons.dead : statusIcons.ready]} aria-hidden="true"></span>
  {/if}
  <span class="state-label">
    {sheet.dead ? "Dead" : isReady(sheet) ? "Ready" : "Not Ready"}
  </span>
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
  {#if sheet.acted}<span class={["status-icon", statusIcons.acted]}></span>{/if}
  {#if sheet.threat}<span class={["status-icon", statusIcons.threat]}></span>{/if}
  {#if sheet.statuses.includes("Monster Controller")}<span class={["status-icon", statusIcons.controller]}></span>{/if}
  {#if sheet.statuses.includes("Blind Spot")}<span class={["status-icon", statusIcons.blindSpot]}></span>{/if}
  {#if sheet.statuses.includes("Deaf")}<span class={["status-icon", statusIcons.deaf]}></span>{/if}
  {#if sheet.statuses.includes("Blind")}<span class={["status-icon", statusIcons.blind]}></span>{/if}
  {#if sheet.statuses.includes("Knocked Down")}<span class={["status-icon", statusIcons.knockedDown]}></span>{/if}
  {#if sheet.statuses.includes("Retired")}<span class={["status-icon", statusIcons.retired]}></span>{/if}
  {#if sheet.priority}<span class={["priority", statusIcons.priority]}></span>{/if}
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
    &.ready .state-icon {
      color: var(--accent-green);
    }
  }
  .state-label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .state-icon {
    display: inline-block;
    inline-size: 0.875rem;
    block-size: 0.875rem;
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    min-block-size: 0.875rem;
    gap: 1px;
  }
  .status-icon,
  .priority {
    display: inline-block;
    inline-size: 0.875rem;
    block-size: 0.875rem;
    color: var(--foreground);
  }
  .priority {
    color: var(--accent);
  }
</style>
