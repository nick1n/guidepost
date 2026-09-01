<script lang="ts">
  import type { Edition } from "#lib/types/index.ts";

  type Props = {
    editions: Edition[];
    value?: string[];
    copyNumbers?: Record<string, number>;
    onselect: (id: string) => void;
    onSetCopyNumber: (id: string, n?: number) => void;
  };

  let { editions, value = [], copyNumbers, onselect, onSetCopyNumber }: Props = $props();

  function selectEdition(event: MouseEvent, edition: string) {
    event.stopPropagation();
    onselect(edition);
  }

  function setCopyNumber(event: Event, edition: string) {
    const input = event.currentTarget as HTMLInputElement;
    const raw = input.value;
    onSetCopyNumber(edition, raw === "" ? undefined : Math.min(999, Math.max(1, Number.parseInt(raw, 10) || 1)));
  }
</script>

<div class="editions" role="group" aria-label="Beta editions owned">
  {#each editions as edition (edition.v)}
    {@const active = value.includes(edition.v)}
    <button type="button" aria-pressed={active} onclick={(event) => selectEdition(event, edition.v)}>
      {edition.v}
    </button>
  {/each}
  <span class="caption">Edition{value.length > 1 ? "s" : ""}</span>
</div>

{#each editions as edition (edition.v)}
  {#if value.includes(edition.v) && edition.limit}
    <label>
      <span class="edition-name">{edition.v} #</span>
      <input
        type="number"
        inputmode="numeric"
        min={1}
        max={999}
        value={copyNumbers?.[edition.v] ?? ""}
        placeholder="13"
        oninput={(event) => setCopyNumber(event, edition.v)}
      />
    </label>
  {/if}
{/each}

<style>
  .editions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  button {
    min-inline-size: 4rem;
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    background: var(--panel);
    color: var(--foreground);
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

  .caption {
    margin-inline-start: 0.25rem;
    color: var(--muted-foreground);
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);
  }

  .edition-name {
    flex-shrink: 0;
  }

  input {
    inline-size: 6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    background: color-mix(var(--panel) 60%, transparent);
    color: var(--foreground);
    font-variant-numeric: tabular-nums;

    &::placeholder {
      color: color-mix(var(--foreground) 30%, transparent);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }
</style>
