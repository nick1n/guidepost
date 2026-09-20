<script lang="ts">
  import Section from "./Section.svelte";

  let {
    title,
    restricted = false,
    deck = [],
    entries = $bindable([]),
  }: {
    title: string;
    restricted?: boolean;
    deck?: string[];
    entries?: { id: number; text: string }[];
  } = $props();
  let open = $state(false);
  const id = $props.id();
  let editing = $state<number | null>(null);
  let drawMessage = $state("");
  function draw() {
    open = true;
    const remaining = deck.filter((text) => !entries.some((entry) => entry.text === text));
    if (!remaining.length) {
      drawMessage = "All sample cards are already added.";
      return;
    }
    const text = remaining[Math.floor(Math.random() * remaining.length)];
    entries.push({ id: nextId++, text });
    drawMessage = `Drew ${text} from the sample deck.`;
  }
  function edit(id: number, text: string) {
    editing = id;
    draft = text;
    adding = true;
  }

  let adding = $state(false);
  let draft = $state("");
  let nextId = 0;

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (editing === null) entries.push({ id: nextId++, text });
    else entries = entries.map((entry) => (entry.id === editing ? { ...entry, text } : entry));
    editing = null;
    draft = "";
    adding = false;
  }

  function remove(id: number) {
    entries = entries.filter((entry) => entry.id !== id);
  }

  function cancel() {
    adding = false;
    editing = null;
    draft = "";
  }
</script>

<Section
  {title}
  bind:open
  onaction={deck.length ? draw : undefined}
  actionLabel="Draw"
  actionName={`Draw random card from ${title}`}
  restricted={restricted ? "Cannot use" : ""}
  meta={entries.length ? `${entries.length} ${entries.length === 1 ? "Entry" : "Entries"}` : "None"}
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
          <button class="entry" aria-label={`Edit ${entry.text}`} onclick={() => edit(entry.id, entry.text)}>{entry.text}</button>
          <button class="remove" aria-label={`Remove ${entry.text} from ${title}`} onclick={() => remove(entry.id)}>
            <span class="remove-icon i-material-symbols:close" aria-hidden="true"></span>
          </button>
        </li>
      {/each}
    </ul>
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
      <div class="form-actions">
        <button class="save" type="submit" disabled={!draft.trim()}>{editing === null ? "Add Entry" : "Save Entry"}</button>
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
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--text-sm);
  }
  .entry {
    flex: 1;
    min-inline-size: 0;
    text-align: start;
    overflow-wrap: anywhere;
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
  }
  .remove-icon {
    inline-size: 1rem;
    block-size: 1rem;
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
  input {
    min-inline-size: 0;
    min-block-size: var(--size-control);
    padding-inline: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--background);
    color: var(--foreground);
    font-size: 1rem;
    user-select: text;
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
</style>
