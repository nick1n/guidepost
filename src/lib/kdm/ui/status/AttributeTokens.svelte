<script lang="ts">
  import { tick } from "svelte";
  import Counter from "../Counter.svelte";
  import { tokenNet, type TokenCount } from "../../showdown/sheet";

  let { owner, names, labels, counts = $bindable() }: { owner: string; names: string[]; labels: string[]; counts: TokenCount[] } = $props();

  const id = $props.id();
  let monsterTokens = $derived(names.length > 6);
  let editing = $state<number | null>(null);
  let selected = $derived(editing === null ? null : counts[editing]);

  function removeToken(index: number) {
    counts[index].negative++;
  }

  async function open(index: number) {
    editing = index;
    await tick();
    document.getElementById(`${id}-positive`)?.focus();
  }

  function close() {
    const index = editing;
    editing = null;
    if (index !== null) document.getElementById(`${id}-token-${index}`)?.focus();
  }
  function setCount(kind: keyof TokenCount, value: number | undefined) {
    if (selected) selected[kind] = Math.max(0, Math.trunc(value || 0));
  }
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
</script>

<div class={["token-grid", monsterTokens && "monster-tokens"]}>
  {#each names as name, index (name)}
    <div
      class={["token", `field-${name.toLowerCase()}`]}
      style:grid-column={monsterTokens ? `${index < 4 ? index * 2 + 1 : (index - 4) * 2 + 2} / span 2` : undefined}
      style:grid-row={monsterTokens ? (index < 4 ? 1 : 2) : undefined}
    >
      <span class="label">{labels[index]}</span>
      <Counter
        id={`${id}-token-${index}`}
        class="net"
        shape="circle"
        value={tokenNet(counts[index])}
        label={`${owner} ${name} tokens, ${counts[index].positive} positive, ${counts[index].negative} negative, net`}
        selected={editing === index}
        expanded={editing === index}
        controls={editing === index ? `${id}-editor` : undefined}
        ontap={() => removeToken(index)}
        onhold={() => open(index)}
        holdHint="Click to remove a positive token first, otherwise a negative token. Hold or press Shift+Enter to edit token counts."
      />
      <span class="balance" aria-hidden="true">
        <span class={["positive", counts[index].positive === 0 && "empty"]}>+{counts[index].positive}</span>
        <span class={["negative", counts[index].negative === 0 && "empty"]}>−{counts[index].negative}</span>
      </span>
    </div>
  {/each}
</div>
{#if selected && editing !== null}
  <!-- Escape closes this editor without changing the surrounding dashboard. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class={["editor", `field-${names[editing].toLowerCase()}`]} id={`${id}-editor`} {onkeydown}>
    <div class="editor-heading">
      <strong>{names[editing]}</strong><span>{selected.positive + selected.negative} Tokens</span>
      <button class="close" onclick={close} aria-label={`Close ${names[editing]} token editor`}>
        <span class="close-icon i-material-symbols:close" aria-hidden="true"></span>
      </button>
    </div>
    <div class="counts">
      <div class="token">
        <label class="label" for={`${id}-negative`}>Neg</label>
        <Counter
          id={`${id}-negative`}
          shape="circle"
          min={0}
          label={`${owner} ${names[editing]} negative tokens`}
          bind:value={() => selected?.negative ?? 0, (value) => setCount("negative", value)}
        />
      </div>
      <div class="token">
        <label class="label" for={`${id}-positive`}>Pos</label>
        <Counter
          id={`${id}-positive`}
          shape="circle"
          min={0}
          label={`${owner} ${names[editing]} positive tokens`}
          bind:value={() => selected?.positive ?? 0, (value) => setCount("positive", value)}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .token-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    &.monster-tokens {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }
  .token {
    display: grid;
    justify-items: center;
  }
  .label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .balance {
    display: flex;
    gap: 0.25rem;
    font-size: var(--text-xs);
    line-height: 1rem;
  }
  .positive {
    color: color-mix(var(--accent-green) 40%, var(--foreground));
  }
  .negative {
    color: color-mix(var(--accent-red) 40%, var(--foreground));
  }
  .empty {
    opacity: 0;
  }
  .editor {
    margin-block-start: 0.375rem;
    padding: 0 0.5rem 0.5rem;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 15%, var(--panel));
  }
  .editor-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-sm);
  }
  .editor-heading > span {
    margin-inline-start: auto;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .close {
    display: grid;
    place-items: center;
    inline-size: var(--size-control);
    block-size: var(--size-control);
  }
  .close-icon {
    --size-icon: 1rem;
  }
  .counts {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    justify-content: space-evenly;
    gap: 0.5rem;
  }

  :global(.signal) .token :global(.net) {
    grid-row: 3;
  }
  :global(.signal) .label {
    grid-row: 1;
  }
  :global(.signal) .balance {
    display: contents;
  }
  :global(.signal) .positive {
    grid-row: 2;
  }
  :global(.signal) .negative {
    grid-row: 4;
  }
  :global(.signal) .empty {
    opacity: 0.12;
  }
</style>
