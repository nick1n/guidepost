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
  let drafts = $state<Record<string, string>>({});

  function oninput(event: Event, edition: string) {
    const input = event.currentTarget as HTMLInputElement;
    drafts[edition] = input.value;
  }

  function onchange(event: Event, edition: string) {
    const input = event.currentTarget as HTMLInputElement;
    const number = input.value === "" ? undefined : Math.min(999, Math.max(1, Number.parseInt(input.value, 10) || 1));
    delete drafts[edition];
    onSetCopyNumber(edition, number);
  }
</script>

<div class="editions" role="group" aria-label="Beta editions owned">
  {#each editions as edition (edition.v)}
    {@const active = value.includes(edition.v)}
    <button type="button" aria-pressed={active} onclick={() => onselect(edition.v)}>
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
        value={drafts[edition.v] ?? copyNumbers?.[edition.v] ?? ""}
        placeholder="13"
        oninput={(event) => oninput(event, edition.v)}
        onchange={(event) => onchange(event, edition.v)}
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
  }
</style>
