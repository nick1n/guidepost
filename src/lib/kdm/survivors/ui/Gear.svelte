<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { canDropGear, dropGear, getGearDrag, trinketSpace } from "./gear-drag";

  let {
    slots = $bindable(),
    selected = $bindable(null),
    dragged = $bindable(null),
    start = 1,
    count = 9,
    gridCount = 9,
    slotLabel = "Slot",
  }: {
    slots: (string | null)[];
    selected?: number | null;
    dragged?: number | null;
    start?: number;
    count?: number;
    gridCount?: number;
    slotLabel?: string;
  } = $props();
  type GearAction = "transfer" | "storage" | "archive";
  const gearDrag = getGearDrag();
  let trinkets = $derived(start === 10);
  let columns = $derived(!trinkets && count === 4 ? 2 : 3);
  let hovering = $state<GearAction | null>(null);
  let hoveredSlot = $state<number | null>(null);
  let activeSlot = $derived(dragged ?? selected);
  let activeItem = $derived(activeSlot !== null && activeSlot >= start && activeSlot < start + count ? slots[activeSlot] : null);
  let destination = $derived(trinkets ? "Gear grid" : "Trinkets");
  let destinationSlot = $derived(
    trinkets ? slots.findIndex((item, index) => item === null && index >= 1 && index <= gridCount) : trinketSpace(slots),
  );
  let actions = $derived([
    { kind: "transfer" as const, label: `${destination}${destinationSlot === -1 ? " full" : ""}`, icon: "i-material-symbols:swap-horiz" },
    { kind: "storage" as const, label: "Storage", icon: "i-material-symbols:inventory-2-outline" },
    { kind: "archive" as const, label: "Archive", icon: "i-material-symbols:delete-outline" },
  ]);

  function act(action: GearAction) {
    if (activeSlot === null || !activeItem) return;
    if (action === "transfer") {
      if (destinationSlot === -1) return;
      if (!dropGear({ slots, slot: activeSlot, item: activeItem }, slots, destinationSlot)) return;
    } else {
      // TODO: For "storage", move this gear into settlement storage instead of clearing the slot.
      slots[activeSlot] = null;
    }
    selected = null;
    dragged = null;
    gearDrag.current = null;
    gearDrag.selection = null;
    hovering = null;
    hoveredSlot = null;
  }
  function dragover(event: DragEvent, action: GearAction) {
    if (dragged === null || !activeItem || (action === "transfer" && destinationSlot === -1)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    hovering = action;
  }
  function ondragleave() {
    hovering = null;
  }
  function actionDrop(event: DragEvent, action: GearAction) {
    event.preventDefault();
    if (dragged !== null) act(action);
  }
  function move(target: number, source = selected) {
    if (source === null) {
      const selection = gearDrag.selection;
      if (selection?.isSelected() && selection.slots !== slots && slots[target] === null) {
        if (dropGear(selection, slots, target)) {
          selection.clear();
          gearDrag.selection = null;
        }
        return;
      }
      const item = slots[target];
      if (item) {
        selection?.clear();
        selected = target;
        gearDrag.selection = {
          slots,
          slot: target,
          item,
          isSelected: () => selected === target,
          clear: () => (selected = null),
        };
      }
      return;
    }
    [slots[source], slots[target]] = [slots[target], slots[source]];
    selected = null;
    gearDrag.selection = null;
  }
  function drop(event: DragEvent, target: number) {
    if (!dropGear(gearDrag.current, slots, target)) return;
    event.preventDefault();
    event.stopPropagation();
    selected = null;
    dragged = null;
    gearDrag.current = null;
    hoveredSlot = null;
  }
  function slotDragover(event: DragEvent, target: number) {
    const accepted =
      canDropGear(gearDrag.current, slots, target) || (trinkets && canDropGear(gearDrag.current, slots, trinketSpace(slots)));
    if (!accepted) {
      hoveredSlot = null;
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      return;
    }
    event.preventDefault();
    hoveredSlot = target;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }
  function leaveSlot(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    hoveredSlot = null;
  }
  function ondragover(event: DragEvent) {
    if (!trinkets || !canDropGear(gearDrag.current, slots, trinketSpace(slots))) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }
  function ondrop(event: DragEvent) {
    if (trinkets) drop(event, trinketSpace(slots));
  }
  function drag(event: DragEvent, index: number) {
    const item = slots[index];
    if (!item) return;
    gearDrag.selection?.clear();
    gearDrag.selection = null;
    selected = null;
    dragged = index;
    gearDrag.current = { slots, slot: index, item };
    event.dataTransfer?.setData("text/plain", String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  function ondragend() {
    dragged = null;
    gearDrag.current = null;
    hovering = null;
    hoveredSlot = null;
  }
</script>

<svelte:window {ondragend} />

<div
  class={["grid", !trinkets && "armed"]}
  style:--columns={columns}
  role="group"
  aria-label={trinkets ? "Trinket slots" : "Gear slots"}
  {ondragover}
  {ondrop}
>
  {#if !trinkets}
    <div class="unarmed" style:grid-row={columns} aria-label="Fist & Tooth, permanent default weapon">
      <strong class="weapon-name">Fist &amp; Tooth</strong>
    </div>
  {/if}
  {#each slots.slice(start, start + count) as item, index (start + index)}
    <button
      class={["slot", selected === start + index && "selected"]}
      data-drop-target={hoveredSlot === start + index ? true : undefined}
      style:grid-column={!trinkets ? (index % columns) + 2 : undefined}
      style:grid-row={!trinkets ? Math.floor(index / columns) + 1 : undefined}
      draggable={!!item}
      onclick={() => move(start + index)}
      ondragstart={(event) => drag(event, start + index)}
      ondragover={(event) => slotDragover(event, start + index)}
      ondragleave={leaveSlot}
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

<div class="gear-actions">
  {#if activeItem}
    {#each actions as action (action.kind)}
      <button
        class={["target", hovering === action.kind && dragged !== null && "active"]}
        data-action={action.kind}
        type="button"
        disabled={action.kind === "transfer" && destinationSlot === -1}
        onclick={() => act(action.kind)}
        ondragover={(event) => dragover(event, action.kind)}
        {ondragleave}
        ondrop={(event) => actionDrop(event, action.kind)}
        aria-label={action.kind === "archive" ? `Archive ${activeItem}` : `Move ${activeItem} to ${action.label.toLowerCase()}`}
      >
        <span class={["target-icon", action.icon]} aria-hidden="true"></span>
        <span class="target-label">{action.label}</span>
      </button>
    {/each}
  {:else}
    <p class="help">Drag or tap to move gear</p>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: var(--gear-gap);
    &.armed {
      grid-template-columns: 1rem repeat(var(--columns), minmax(0, 1fr));
      margin-inline-start: calc(-1rem - var(--gear-gap));
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
  .gear-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-block-size: 3.5rem;
    margin-block-start: var(--gear-gap);
    gap: var(--gear-gap);
  }
  .help {
    grid-column: 1 / -1;
    align-self: center;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-align: center;
  }
  .target {
    --color-target: var(--accent);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    gap: 0.125rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--color-divider);
    color: var(--muted-foreground);
    font-size: var(--text-sm);

    &[data-action="archive"] {
      --color-target: var(--accent-red);
    }
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    &.active {
      border-color: var(--color-target);
      background: color-mix(var(--color-target) 20%, var(--panel));
      color: var(--foreground);
    }
  }
  /* Keep drag enter/leave events on the target rather than its label and icon. */
  .target-label,
  .target-icon {
    --size-icon: 1.25rem;
    pointer-events: none;
  }
  .slot {
    display: flex;
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
      outline: var(--border-width) solid var(--accent);
    }
    &[data-drop-target] {
      box-shadow: inset 0 0 0 var(--border-width) var(--accent);
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
  @media (hover: hover) {
    .target:enabled:hover:not(.active) {
      border-color: color-mix(var(--color-target) 40%, var(--color-divider));
      background: color-mix(var(--color-target) 8%, var(--panel));
      color: var(--foreground);
    }
    .slot:hover:not([data-drop-target]) {
      box-shadow: inset 0 0 0 var(--border-width) color-mix(var(--identity) 45%, var(--foreground));
    }
    .slot[draggable="false"]:hover {
      background: color-mix(var(--identity) 14%, transparent);
    }
  }
</style>
