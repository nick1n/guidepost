<script lang="ts">
  import type { ListEntry } from "./data";
  import Section from "./Section.svelte";

  let {
    title,
    restricted = false,
    swipeDelete = false,
    deck = [],
    entries = $bindable([]),
  }: {
    title: string;
    restricted?: boolean;
    swipeDelete?: boolean;
    deck?: Omit<ListEntry, "id">[];
    entries?: ListEntry[];
  } = $props();
  let open = $state(false);
  const id = $props.id();
  let editing = $state<number | null>(null);
  let revealed = $state<number | null>(null);
  let dragging = $state<number | null>(null);
  let swipeLearned = $state(false);
  let dragOffset = $state(0);
  let drawMessage = $state("");
  const drawActions: Record<string, { name: string; iconText: string }> = {
    "Fighting Arts": { name: "Draw fighting art card", iconText: "FA" },
    Disorders: { name: "Draw disorder card", iconText: "D" },
    Abilities: { name: "Draw character card", iconText: "C" },
  };
  let drawAction = $derived(drawActions[title]);
  let gesture: {
    id: number;
    pointerId: number;
    startX: number;
    startY: number;
    base: number;
    horizontal: boolean;
    target: HTMLButtonElement;
  } | null = null;
  let suppressClick: number | null = null;

  function draw() {
    open = true;
    revealed = null;
    const remaining = deck.filter((card) => !entries.some((entry) => entry.text === card.text));
    if (!remaining.length) {
      drawMessage = "All sample cards are already added.";
      return;
    }
    const card = remaining[Math.floor(Math.random() * remaining.length)];
    const entry = { id: nextId++, ...card };
    entries.push(entry);
    drawMessage = `Drew ${card.text} from the sample deck.`;
  }
  function edit(entry: ListEntry) {
    revealed = null;
    editing = entry.id;
    draft = entry.text;
    description = entry.description;
    adding = true;
  }

  let adding = $state(false);
  let draft = $state("");
  let description = $state("");
  let nextId = 0;

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    const detail = description.trim();
    if (!text || !detail) return;
    if (editing === null) {
      const entry = { id: nextId++, text, description: detail };
      entries.push(entry);
    } else entries = entries.map((entry) => (entry.id === editing ? { ...entry, text, description: detail } : entry));
    editing = null;
    draft = "";
    description = "";
    adding = false;
  }

  function remove(id: number) {
    entries = entries.filter((entry) => entry.id !== id);
    if (revealed === id) revealed = null;
  }

  function cancel() {
    adding = false;
    editing = null;
    revealed = null;
    draft = "";
    description = "";
  }

  function startSwipe(event: PointerEvent, entryId: number) {
    if (!swipeDelete || !event.isPrimary || event.button !== 0) return;
    const base = revealed === entryId ? -72 : 0;
    if (revealed !== entryId) revealed = null;
    gesture = {
      id: entryId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base,
      horizontal: false,
      target: event.currentTarget as HTMLButtonElement,
    };
    dragging = entryId;
    dragOffset = base;
  }

  function onpointermove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const x = event.clientX - gesture.startX;
    const y = event.clientY - gesture.startY;
    if (!gesture.horizontal) {
      if (Math.hypot(x, y) < 6) return;
      if (Math.abs(y) > Math.abs(x)) {
        dragging = null;
        gesture = null;
        return;
      }
      gesture.horizontal = true;
      gesture.target.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    dragOffset = Math.max(-72, Math.min(0, gesture.base + x));
  }

  function onpointerup(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;
    if (current.horizontal) {
      if (current.base === 0 && dragOffset < 0) swipeLearned = true;
      revealed = dragOffset <= -36 ? current.id : null;
      suppressClick = current.id;
      setTimeout(() => {
        if (suppressClick === current.id) suppressClick = null;
      });
      event.preventDefault();
    }
    if (current.target.hasPointerCapture(event.pointerId)) current.target.releasePointerCapture(event.pointerId);
    dragging = null;
    dragOffset = 0;
    gesture = null;
  }

  function onpointercancel(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    dragging = null;
    dragOffset = 0;
    gesture = null;
  }

  function openEntry(event: MouseEvent, entry: ListEntry) {
    if (suppressClick === entry.id) {
      event.preventDefault();
      suppressClick = null;
      return;
    }
    edit(entry);
  }
</script>

<Section
  {title}
  bind:open
  onaction={deck.length ? draw : undefined}
  actionLabel="Draw"
  actionName={drawAction?.name ?? `Draw ${title.toLowerCase()} card`}
  actionIcon="deck"
  actionIconText={drawAction?.iconText}
  restricted={restricted ? "Cannot use" : ""}
  meta={entries.length ? entries.map((entry) => entry.text) : "None"}
  onadd={() => {
    cancel();
    adding = true;
  }}
>
  {#if restricted}<p class="restriction">Cannot use {title.toLowerCase()}.</p>{/if}
  {#if deck.length}
    <p role="status">{drawMessage}</p>
  {/if}
  {#if entries.length}
    <ul>
      {#each entries as entry (entry.id)}
        <li>
          <button
            class={["entry", swipeDelete && revealed === entry.id && "swiped", swipeDelete && dragging === entry.id && "dragging"]}
            style:--drag-offset={swipeDelete && dragging === entry.id ? `${dragOffset}px` : undefined}
            aria-label={`Edit ${entry.text}`}
            onpointerdown={(event) => startSwipe(event, entry.id)}
            {onpointermove}
            {onpointerup}
            {onpointercancel}
            onclick={(event) => openEntry(event, entry)}
          >
            <strong class="name">{entry.text}</strong>
            <span class="description">{entry.description}</span>
          </button>
          <button
            class="remove"
            aria-label={`Remove ${entry.text} from ${title}`}
            onfocus={() => {
              if (swipeDelete) revealed = entry.id;
            }}
            onclick={() => remove(entry.id)}
          >
            <span class="remove-icon i-material-symbols:close" aria-hidden="true"></span>
            <span class="remove-label" aria-hidden="true">Delete</span>
          </button>
        </li>
      {/each}
    </ul>
    {#if swipeDelete && !swipeLearned}<p class="swipe-hint">Swipe left to delete</p>{/if}
  {/if}
  {#if adding}
    <form {onsubmit}>
      <label for={`${id}-entry`}>
        {editing === null ? "New Entry" : "Edit Entry"}
        <input
          id={`${id}-entry`}
          aria-label={`New ${title} entry`}
          bind:value={draft}
          required
          maxlength="160"
          autocomplete="off"
          {@attach (element) => element.focus()}
        />
      </label>
      <label for={`${id}-description`}>
        Description
        <textarea id={`${id}-description`} bind:value={description} required maxlength="320" rows="3"></textarea>
      </label>
      <div class="form-actions">
        <button class="save" type="submit" disabled={!draft.trim() || !description.trim()}
          >{editing === null ? "Add Entry" : "Save Entry"}</button
        >
        <button type="button" onclick={cancel}>Cancel</button>
      </div>
    </form>
  {:else if !entries.length}
    <p>No entries yet.</p>
  {/if}
</Section>

<style>
  .restriction {
    padding-block: 0.375rem;
    color: var(--accent-red);
  }
  :global(.signal) .restriction {
    display: none;
  }
  ul {
    display: grid;
    gap: 0.125rem;
    list-style: none;
  }
  li {
    display: flex;
    align-items: stretch;
  }
  .entry {
    display: grid;
    flex: 1;
    align-content: center;
    min-inline-size: 0;
    padding: 0.5rem 0.625rem;
    gap: 0.125rem;
    background: color-mix(var(--identity) 10%, var(--panel));
    text-align: start;
    overflow-wrap: anywhere;

    &:hover {
      background: color-mix(var(--identity) 18%, var(--panel));
    }
  }
  .name {
    color: color-mix(var(--identity) 55%, var(--foreground));
  }
  .description {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    line-height: 1.4;
  }
  button {
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
    padding-inline: 0.5rem;
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
  }
  .remove {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    color: var(--muted-foreground);

    &:hover {
      background: color-mix(var(--accent-red) 12%, transparent);
      color: var(--accent-red);
    }
  }
  .remove-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .remove-label {
    display: none;
  }
  form {
    display: grid;
    gap: 0.375rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  input,
  textarea {
    min-inline-size: 0;
    min-block-size: var(--size-control);
    padding: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--background);
    color: var(--foreground);
    font-size: 1rem;
    user-select: text;
  }
  textarea {
    resize: vertical;
  }
  .form-actions {
    display: flex;
    gap: 0.25rem;
  }
  .save {
    background: var(--card);
    &:disabled {
      color: var(--muted-foreground);
    }
  }
  p {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  :global(.folio) ul {
    margin-inline: -0.25rem;
    gap: 0;
    border-block-start: 3px double color-mix(var(--identity) 35%, transparent);
  }
  :global(.folio) li {
    border-block-end: 1px solid color-mix(var(--identity) 25%, transparent);
  }
  :global(.folio) .entry {
    padding: 0.625rem 0.375rem;
    gap: 0.25rem;
    border-radius: 0;
    background: transparent;

    &:is(:hover, :focus-visible) {
      background: color-mix(var(--identity) 9%, var(--panel));
    }
  }
  :global(.folio) .name {
    color: var(--foreground);
    font-weight: var(--font-normal);
    font-size: 1rem;
    font-family: var(--font-editorial);
  }
  :global(.folio) .description {
    font-size: var(--text-sm);
    font-family: var(--font-editorial);
  }
  :global(.folio) .remove {
    align-self: start;
    margin-block-start: 0.25rem;
    border-radius: 0;
  }

  :global(.obsidian) {
    li {
      position: relative;
      overflow: clip;
      gap: 0;
      background: var(--accent-red);
    }
    .entry {
      z-index: 1;
      inline-size: 100%;
      translate: 0;
      touch-action: pan-y;
      transition: translate var(--duration-fast);

      &.swiped {
        translate: -4.5rem 0;
      }

      &.dragging {
        translate: var(--drag-offset) 0;
        transition: none;
      }
    }
    .remove {
      position: absolute;
      inline-size: 4.5rem;
      inset-block: 0;
      inset-inline-end: 0;
      border-radius: 0;
      background: var(--accent-red);
      color: var(--foreground);
    }
    .remove-icon {
      display: none;
    }
    .remove-label {
      display: block;
      font-weight: var(--font-bold);
    }
    button {
      border-radius: 0;
    }
  }
  .swipe-hint {
    margin-block-start: 0.375rem;
    padding-inline: 0.625rem;
    font-size: var(--text-xs);
    text-align: end;
  }

  :global(.signal) .entry {
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: color-mix(var(--identity) 16%, var(--background));

    &:hover {
      background: color-mix(var(--identity) 26%, var(--background));
    }
  }
  :global(.signal) .name {
    color: var(--foreground);
  }
  :global(.signal) .remove {
    border-radius: 0.25rem 1rem 0.25rem 1rem;
    background: color-mix(var(--identity) 12%, var(--background));
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.obsidian) .entry {
      transition: none;
    }
  }
</style>
