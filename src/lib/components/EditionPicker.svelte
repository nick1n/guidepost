<script lang="ts">
  import type { Edition } from "#lib/kdm-data.ts";

  type Props = {
    editions: Edition[];
    value: string[];
    copyNumbers?: Record<string, number>;
    onselect: (id: string) => void;
    onSetCopyNumber: (id: string, n?: number) => void;
  };

  let { editions, value, copyNumbers, onselect, onSetCopyNumber }: Props = $props();

  const selected = $derived(editions.filter((edition) => value.includes(edition.v)));
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-1" role="group" aria-label="Beta editions owned">
    {#each editions as edition (edition.v)}
      {@const active = value.includes(edition.v)}
      <button
        type="button"
        aria-pressed={active}
        onclick={(event) => {
          event.stopPropagation();
          onselect(edition.v);
        }}
        class={[
          "min-w-16 rounded-lg px-2 py-1 transition-colors cursor-pointer",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          active ? "bg-accent text-accent-foreground" : "bg-panel text-foreground hover:bg-panel hover:text-foreground",
        ]}
      >
        {edition.v}
      </button>
    {/each}
    <span class="ml-1 text-muted-foreground">Edition{value.length > 1 ? "s" : ""}</span>
  </div>
</div>

{#each selected as edition (edition.v)}
  {#if edition.limit}
    <label class="flex items-center gap-2 text-muted-foreground">
      <span class="shrink-0">{edition.v} #</span>
      <input
        type="number"
        inputmode="numeric"
        min={1}
        max={999}
        value={copyNumbers?.[edition.v] ?? ""}
        placeholder="13"
        oninput={(event) => {
          const raw = event.currentTarget.value;
          onSetCopyNumber(edition.v, raw === "" ? undefined : Math.min(999, Math.max(1, Number.parseInt(raw, 10) || 1)));
        }}
        class="w-24 rounded-lg border border-border bg-panel/60 px-2 py-1 tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent placeholder:text-foreground/30"
      />
    </label>
  {/if}
{/each}
