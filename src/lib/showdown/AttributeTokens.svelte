<script lang="ts">
  import { tokenNet, type TokenCount } from "./data";

  let { owner, names, labels, counts = $bindable() }: { owner: string; names: string[]; labels: string[]; counts: TokenCount[] } = $props();

  const id = $props.id();
  let editing = $state<number | null>(null);
  let selected = $derived(editing === null ? null : counts[editing]);
  let triggers: HTMLButtonElement[] = [];

  function close() {
    const index = editing;
    editing = null;
    if (index !== null) triggers[index]?.focus();
  }
  function setCount(kind: keyof TokenCount, value: number | undefined) {
    if (selected) selected[kind] = Math.max(0, Math.trunc(value || 0));
  }
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
</script>

<div class={["token-grid", names.length > 6 && "monster-tokens"]}>
  {#each names as name, index (name)}
    <div class="token">
      <span class="label">{labels[index]}</span>
      <button
        class={["net", editing === index && "selected"]}
        aria-label={`${owner} ${name} tokens: ${tokenNet(counts[index])} net, ${counts[index].positive} positive, ${counts[index].negative} negative. Edit counts`}
        aria-expanded={editing === index}
        aria-controls={editing === index ? `${id}-editor` : undefined}
        onclick={() => (editing = editing === index ? null : index)}
        {@attach (element) => {
          triggers[index] = element;
        }}
      >
        {tokenNet(counts[index])}
      </button>
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
  <div class="editor" id={`${id}-editor`} {onkeydown}>
    <div class="editor-heading">
      <strong>{names[editing]}</strong><span>{selected.positive + selected.negative} Tokens</span>
      <button class="close" onclick={close} aria-label={`Close ${names[editing]} token editor`}>
        <span class="close-icon i-material-symbols:close" aria-hidden="true"></span>
      </button>
    </div>
    <div class="counts">
      <label>
        Positive (+1)
        <input
          type="number"
          min="0"
          step="1"
          aria-label={`${owner} ${names[editing]} positive tokens`}
          bind:value={() => selected?.positive, (value) => setCount("positive", value)}
        />
      </label>
      <label>
        Negative (-1)
        <input
          type="number"
          min="0"
          step="1"
          aria-label={`${owner} ${names[editing]} negative tokens`}
          bind:value={() => selected?.negative, (value) => setCount("negative", value)}
        />
      </label>
    </div>
  </div>
{/if}

<style>
  .token-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.125rem;
    &.monster-tokens {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      row-gap: 0.5rem;
    }
  }
  .token {
    display: grid;
    justify-items: center;
    gap: 0.125rem;
  }
  .label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .net {
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 1px solid color-mix(var(--identity) 65%, var(--panel));
    border-radius: 50%;
    background: color-mix(var(--identity) 20%, var(--panel));
    font-size: 1rem;
    &.selected {
      background: var(--identity);
      color: var(--identity-ink);
    }
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
    inline-size: 2.75rem;
    block-size: 2.75rem;
  }
  .close-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .counts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    font-size: var(--text-xs);
  }
  input {
    appearance: textfield;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--background);
    text-align: center;
    &::-webkit-inner-spin-button {
      appearance: none;
    }
  }
  :global(.signal) .net {
    grid-row: 3;
    border-radius: 50% 50% 0.375rem 0.375rem;
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
