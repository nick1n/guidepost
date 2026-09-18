<script lang="ts">
  let {
    slots = $bindable(),
    selected = $bindable(null),
    dragged = $bindable(null),
    start = 0,
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

<div class={["grid", count === 3 ? "short" : "armed"]}>
  {#if count === 9}
    <div class="unarmed" aria-label="Fist & Tooth, permanent default weapon">
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
      style:grid-column={count === 9 ? (index % 3) + 2 : undefined}
      style:grid-row={count === 9 ? Math.floor(index / 3) + 1 : undefined}
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
        <strong>{item}</strong><small>{item === "Cloth" ? "1 waist armor" : item === "Fist & Tooth" ? "2 | 8 | 0" : "2 | 7 | 1"}</small>
      {/if}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    position: relative;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2px;
    &.armed {
      grid-template-columns: 1rem 1fr 1fr 1fr;
      margin-inline-start: -1rem;
    }
  }
  .unarmed {
    display: grid;
    position: relative;
    grid-row: 3;
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
    justify-content: center;
    aspect-ratio: 1;
    min-inline-size: 0;
    min-block-size: 2.75rem;
    padding: 0.25rem;
    gap: 0.25rem;
    border: 0;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 8%, transparent);
    line-height: 1.15;
    &.selected {
      outline: 2px solid var(--accent);
    }
    &[draggable="true"] {
      background: color-mix(var(--identity) 35%, var(--panel));
      cursor: grab;
    }
  }
  strong {
    font-size: var(--text-xs);
  }
  small {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
</style>
