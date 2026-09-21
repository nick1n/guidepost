<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";

  let {
    slots = $bindable(),
    selected = $bindable(null),
    dragged = $bindable(null),
    start = 1,
    count = 9,
    slotLabel = "Slot",
  }: {
    slots: (string | null)[];
    selected?: number | null;
    dragged?: number | null;
    start?: number;
    count?: number;
    slotLabel?: string;
  } = $props();
  let columns = $derived(count === 4 ? 2 : 3);
  function move(target: number, source = selected) {
    if (source === null) {
      if (slots[target]) selected = target;
      return;
    }
    [slots[source], slots[target]] = [slots[target], slots[source]];
    selected = null;
  }
  function drop(event: DragEvent, target: number) {
    event.preventDefault();
    if (dragged === null) return;
    move(target, dragged);
    dragged = null;
  }
  function drag(event: DragEvent, index: number) {
    dragged = index;
    event.dataTransfer?.setData("text/plain", String(index));
  }
  function ondragend() {
    dragged = null;
  }
</script>

<div class={["grid", count === 3 ? "short" : "armed"]} style:--columns={columns}>
  {#if count !== 3}
    <div class="unarmed" style:grid-row={columns} aria-label="Fist & Tooth, permanent default weapon">
      <strong class="weapon-name">Fist &amp; Tooth</strong>
    </div>
  {/if}
  <p class="help">
    <span class="help-icon i-material-symbols:drag-pan" aria-hidden="true"></span>
    <span>{selected === null ? "Drag or tap to move gear" : "Tap a destination"}</span>
  </p>
  {#each slots.slice(start, start + count) as item, index (start + index)}
    <button
      class={["slot", selected === start + index && "selected"]}
      style:grid-column={count !== 3 ? (index % columns) + 2 : undefined}
      style:grid-row={count !== 3 ? Math.floor(index / columns) + 1 : undefined}
      draggable={!!item}
      onclick={() => move(start + index)}
      ondragstart={(event) => drag(event, start + index)}
      {ondragend}
      ondragover={(event) => event.preventDefault()}
      ondrop={(event) => drop(event, start + index)}
      aria-label={`${slotLabel} ${index + 1}: ${item ?? "empty"}${selected === start + index ? ", selected" : ""}`}
      aria-pressed={selected === start + index}
    >
      {#if item}
        {#if item === "Cloth"}
          <span class="armor-markers" aria-hidden="true">
            <KdIcon i="armor-1" />
            <KdIcon i="location-waist" />
          </span>
          <span class="gear-art i-game-icons:cape" aria-hidden="true"></span>
        {/if}
        {#if item === "Founding Stone"}
          <span class="gear-art i-game-icons:rock" aria-hidden="true"></span>
          <strong class="gear-stats" aria-hidden="true">
            <span class="gear-stat">2</span>
            <span class="gear-stat divided">7</span>
            <span class="gear-stat divided">1</span>
          </strong>
        {/if}
        <strong class="gear-name">{item}</strong>
        {#if item !== "Founding Stone"}
          <small class="gear-values">{item === "Cloth" ? "1 waist armor" : item === "Fist & Tooth" ? "2 | 8 | 0" : ""}</small>
        {:else}
          <small class="gear-action"><KdIcon i="activation" /> Activate</small>
        {/if}
      {/if}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    position: relative;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: 2px;
    &.armed {
      grid-template-columns: 1rem repeat(var(--columns), minmax(0, 1fr));
      margin-inline-start: -1rem;
    }
  }
  .unarmed {
    display: grid;
    position: relative;
    grid-column: 1;
    place-items: center;
    align-self: center;
    block-size: 100%;
    padding-block: 0.5rem;
    border-radius: 0 0.375rem 0.375rem 0;
    background: var(--identity);
    color: var(--identity-ink);
  }
  :global(.folio) .unarmed {
    padding-block: 0;
  }
  :global(.folio) .unarmed::before {
    display: none;
  }
  .weapon-name {
    position: relative;
    rotate: 180deg;
    font-size: 0.625rem;
    line-height: 1;
    white-space: nowrap;
    writing-mode: vertical-rl;
  }
  :global(.folio) .weapon-name {
    rotate: 0deg;
    font-weight: var(--font-normal);
    font-size: 0.875rem;
  }
  :global(.signal) .unarmed::before {
    display: none;
  }
  .help {
    display: grid;
    position: absolute;
    grid-auto-flow: column;
    place-items: center;
    justify-content: center;
    inset: 0;
    padding-inline: 0.75rem;
    gap: 0.5rem;
    rotate: -4deg;
    color: color-mix(var(--identity) 60%, var(--muted-foreground));
    font-weight: var(--font-bold);
    font-size: round(clamp(0.75rem, 4.2vw, 1rem), 1px);
    line-height: 1.15;
    text-align: center;
    white-space: nowrap;
    opacity: 0.25;
    pointer-events: none;
  }
  .help-icon {
    align-self: center;
    inline-size: 1.625rem;
    block-size: 1.625rem;
  }
  .short .help {
    padding-inline: 0.5rem;
    gap: 0.375rem;
    rotate: 0deg;
    font-size: round(clamp(0.625rem, 3.4vw, 0.875rem), 1px);
  }
  .short .help-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  :global(.folio) .help {
    display: flex;
    gap: 0.625rem;
    rotate: 0;
    color: var(--foreground);
    font-weight: var(--font-normal);
    font-size: round(clamp(0.75rem, 3.8vw, 1rem), 1px);
    opacity: 0.22;
  }
  :global(.folio) .help-icon {
    display: none;
  }
  :global(.signal) .help {
    align-self: center;
    block-size: fit-content;
    inset: 1rem;
    padding: 0.5rem 0.875rem;
    rotate: 3deg;
    border-radius: 1.25rem 0.25rem 1.25rem 0.25rem;
    background: var(--identity);
    color: var(--identity-ink);
    font-size: round(clamp(0.75rem, 3.5vw, 0.875rem), 1px);
    opacity: 0.2;
  }
  :global(.signal) .help-icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
  :global(.signal) .short .help {
    inset: 0.5rem;
    rotate: 0deg;
  }
  .armed .help {
    inset-inline-start: 1.375rem;
    gap: 0.25rem;
    font-size: round(clamp(0.625rem, 3vw, 0.875rem), 1px);
  }
  .slot {
    display: flex;
    z-index: 1;
    position: relative;
    flex-direction: column;
    align-items: center;
    align-self: center;
    justify-content: space-between;
    aspect-ratio: 1;
    min-inline-size: 0;
    min-block-size: var(--size-control);
    padding: 0.5rem;
    gap: 0.25rem;
    border: 0;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 8%, transparent);
    color: var(--background);
    font-size: var(--text-xs);
    line-height: 1.15;
    &.selected {
      outline: 2px solid var(--accent);
    }
    &[draggable="true"] {
      background: var(--color-gear);
      cursor: grab;
    }
  }
  .armor-markers {
    display: flex;
    z-index: 1;
    position: absolute;
    flex-direction: column;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.25rem;
    color: #000;
    font-size: 1.5rem;
    pointer-events: none;
  }
  .gear-art {
    z-index: 0;
    position: absolute;
    inline-size: 50%;
    block-size: 50%;
    inset: 50%;
    translate: -50% -50%;
    color: var(--muted-foreground);
    opacity: 0.65;
    pointer-events: none;
  }
  .gear-stats {
    display: grid;
    z-index: 2;
    position: absolute;
    inset-block-start: 0.25rem;
    inset-inline-start: 0.25rem;
    padding: 0.25rem;
    border-radius: 99px;
    background: color-mix(var(--foreground) 85%, transparent);
    color: #000;
    font-size: 1rem;
    line-height: 1;
    text-align: center;
  }
  .gear-stat {
    display: block;
  }
  .gear-stat.divided {
    border-block-start: 1px solid color-mix(var(--background) 65%, transparent);
  }
  .gear-action {
    display: flex;
    gap: 0.125rem;
    color: #000;
    font-weight: var(--font-bold);
    font-size: 1rem;

    :global(span) {
      translate: 0 0.1em;
    }
  }
  .gear-name,
  .gear-values,
  .gear-action {
    z-index: 1;
    position: relative;
  }
</style>
