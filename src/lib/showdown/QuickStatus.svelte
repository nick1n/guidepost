<script lang="ts">
  import { isReady, type Sheet } from "./data";
  let { sheet }: { sheet: Sheet } = $props();
</script>

<span class={["life-state", sheet.dead && "dead"]}>
  {sheet.dead ? "Dead" : isReady(sheet) ? "Ready" : sheet.statuses.includes("Retired") ? "Retired" : "Alive"}
  {#if sheet.statuses.includes("Blind Spot")}<span class="blind i-material-symbols:visibility" aria-hidden="true"></span>{/if}
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
    gap: 0.25rem;
    font-size: var(--text-xs);
    line-height: 0.875rem;
    &.dead {
      color: var(--accent-red);
    }
  }
  .blind {
    inline-size: 0.875rem;
    block-size: 0.875rem;
    color: var(--accent-green);
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
