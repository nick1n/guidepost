<script lang="ts">
  import Section from "./Section.svelte";

  let { title }: { title: string } = $props();

  let entries = $state<{ id: number; text: string }[]>([]);
  let adding = $state(false);
  let draft = $state("");
  let nextId = 0;

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    entries.push({ id: nextId++, text });
    draft = "";
    adding = false;
  }

  function remove(id: number) {
    entries = entries.filter((entry) => entry.id !== id);
  }

  function cancel() {
    adding = false;
    draft = "";
  }
</script>

<Section
  {title}
  meta={entries.length ? `${entries.length} ${entries.length === 1 ? "Entry" : "Entries"}` : "None"}
  onadd={() => (adding = true)}
>
  {#if entries.length}
    <ul>
      {#each entries as entry (entry.id)}
        <li>
          <span>{entry.text}</span>
          <button class="remove" aria-label={`Remove ${entry.text} from ${title}`} onclick={() => remove(entry.id)}>
            <span class="remove-icon i-material-symbols:close" aria-hidden="true"></span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if adding}
    <form {onsubmit}>
      <label>
        New Entry
        <input
          aria-label={`New ${title} entry`}
          bind:value={draft}
          required
          maxlength="160"
          autocomplete="off"
          {@attach (element) => element.focus()}
        />
      </label>
      <div class="form-actions">
        <button class="save" type="submit" disabled={!draft.trim()}>Add Entry</button>
        <button type="button" onclick={cancel}>Cancel</button>
      </div>
    </form>
  {:else if !entries.length}
    <p>No entries yet.</p>
  {/if}
</Section>

<style>
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
  li > span {
    overflow-wrap: anywhere;
  }
  button {
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
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
    min-block-size: 2.75rem;
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
