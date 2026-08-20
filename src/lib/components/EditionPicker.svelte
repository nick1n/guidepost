<script lang="ts">
  import type { Edition } from "#lib/types.ts";

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

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-1" role="group" aria-label="Beta editions owned">
    {#each editions as edition (edition.v)}
      {@const active = value.includes(edition.v)}
      <button
        type="button"
        aria-pressed={active}
        onclick={(event) => selectEdition(event, edition.v)}
        class={[
          "min-w-16 cursor-pointer rounded-lg px-2 py-1 transition-colors",
          "focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
          active ? "bg-accent text-accent-foreground" : "bg-panel text-foreground hover:bg-panel hover:text-foreground",
        ]}
      >
        {edition.v}
      </button>
    {/each}
    <span class="text-muted-foreground ml-1">Edition{value.length > 1 ? "s" : ""}</span>
  </div>
</div>

{#each editions as edition (edition.v)}
  {#if value.includes(edition.v) && edition.limit}
    <label class="text-muted-foreground flex items-center gap-2">
      <span class="shrink-0">{edition.v} #</span>
      <input
        type="number"
        inputmode="numeric"
        min={1}
        max={999}
        value={copyNumbers?.[edition.v] ?? ""}
        placeholder="13"
        oninput={(event) => setCopyNumber(event, edition.v)}
        class="border-border bg-panel/60 text-foreground focus-visible:outline-accent placeholder:text-foreground/30 w-24 rounded-lg border px-2 py-1 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </label>
  {/if}
{/each}
