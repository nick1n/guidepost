<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { availableActions, lifeState, type Sheet } from "../../showdown/sheet";
  import { statusFlags } from "#lib/constants.ts";
  import StatusIcon from "./StatusIcon.svelte";
  let { sheet, showResources = false }: { sheet: Sheet; showResources?: boolean } = $props();
  let life = $derived(lifeState(sheet));
</script>

<span class={["life-state", life.tone]}>
  {#if life.icon}<StatusIcon icon={life.icon} active context="life" />{/if}
  <span class="state-label">{life.label}</span>
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
  {#if availableActions(sheet)}<StatusIcon icon="dodge" active context="quick" />{/if}
  {#each statusFlags as status (status)}
    {#if sheet.statuses.includes(status)}
      <StatusIcon icon={status} active context="quick" />
    {/if}
  {/each}
  {#if sheet.priority}<StatusIcon icon="priority" active context="quick" />{/if}
</span>

<style>
  .life-state {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    min-inline-size: 0;
    gap: 0.125rem;
    &.unavailable {
      color: var(--accent-red);
    }
  }
  .state-label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
    min-block-size: 1rem;
    gap: 1px;
  }
</style>
