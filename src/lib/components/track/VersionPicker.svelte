<script lang="ts">
  import type { Edition } from "#lib/types/index.ts";

  type Props = {
    versions: Edition[];
    value?: string[];
    onselect: (v: string) => void;
  };

  let { versions, value = [], onselect }: Props = $props();

  function selectVersion(event: MouseEvent, version: string) {
    event.stopPropagation();
    onselect(version);
  }
</script>

<div role="group" aria-label="Versions owned">
  <span>Version</span>
  {#each versions as version (version.v)}
    {@const active = value.includes(version.v)}
    <button type="button" aria-pressed={active} onclick={(event) => selectVersion(event, version.v)}>
      {version.v}
    </button>
  {/each}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  span {
    margin-inline-end: 0.25rem;
    color: var(--muted-foreground);
  }

  button {
    min-inline-size: 2.75rem;
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    background: var(--panel);
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }
</style>
