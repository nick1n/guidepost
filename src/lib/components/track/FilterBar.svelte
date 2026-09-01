<script lang="ts">
  import type { Filters } from "#lib/types/index.ts";
  import { getFilterState } from "#lib/state/filters.svelte.ts";
  import Segmented from "./Segmented.svelte";

  type Props = {
    tagOptions: string[];
    showKind?: boolean;
    showGameplay?: boolean;
    resultCount: number;
  };

  let { tagOptions, showKind = true, showGameplay = true, resultCount }: Props = $props();

  const filters = getFilterState();

  let open = $state(false);
  let searchInput: HTMLInputElement;

  const activeCount = $derived(
    filters.value.tags.length +
      (filters.value.gameplay !== "any" ? 1 : 0) +
      (filters.value.kind !== "any" ? 1 : 0) +
      (filters.value.status !== "any" ? 1 : 0),
  );

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    filters.set(key, value);
  }

  function toggleTag(tag: string) {
    filters.toggleTag(tag);
  }

  function isEditableTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }

  function onkeydown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return;

    const isSlash = event.key === "/";
    const isSearchShortcut = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

    if (isSlash || isSearchShortcut) {
      event.preventDefault();
      searchInput?.focus();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="filter-bar">
  <div class="toolbar">
    <div class="search">
      <span class="search-icon i-material-symbols:search" aria-hidden="true"></span>
      <input
        bind:this={searchInput}
        type="search"
        value={filters.value.query}
        oninput={(e) => set("query", e.currentTarget.value)}
        placeholder="Search"
        aria-label="Search items"
      />
      {#if !filters.value.query}
        <kbd aria-hidden="true">/</kbd>
      {/if}
    </div>
    <button type="button" onclick={() => (open = !open)} aria-expanded={open} class="filter-toggle" data-active={open || activeCount > 0}>
      <span class="filter-icon i-material-symbols:tune" aria-hidden="true"></span>
      Filter
      {#if activeCount > 0}
        <span class="count">({activeCount})</span>
      {/if}
    </button>
  </div>

  {#if open}
    <div class="panel">
      <Segmented
        label="Sort by"
        value={filters.value.sort}
        onchange={(v) => set("sort", v)}
        options={[
          { value: "name", label: "Name" },
          { value: "price-desc", label: "Price high" },
          { value: "price-asc", label: "Price low" },
        ]}
      />
      <Segmented
        label="Status"
        value={filters.value.status}
        onchange={(v) => set("status", v)}
        options={[
          { value: "any", label: "All" },
          { value: "owned", label: "Owned" },
          { value: "unowned", label: "Missing" },
          { value: "wishlisted", label: "Wishlist" },
        ]}
      />
      {#if showGameplay}
        <Segmented
          label="Content"
          value={filters.value.gameplay}
          onchange={(v) => set("gameplay", v)}
          options={[
            { value: "any", label: "All" },
            { value: "gameplay", label: "Gameplay" },
            { value: "models", label: "Models only" },
          ]}
        />
      {/if}
      {#if showKind}
        <Segmented
          label="Release"
          value={filters.value.kind}
          onchange={(v) => set("kind", v)}
          options={[
            { value: "any", label: "All" },
            { value: "core", label: "Core" },
            { value: "expansion", label: "Expansions" },
            { value: "white-box", label: "White Boxes" },
            { value: "set", label: "Sets" },
            { value: "beta", label: "Beta" },
            { value: "promo", label: "Promo" },
          ]}
        />
      {/if}

      <div class="tags">
        <div class="tags-header">
          <span class="label">Tags</span>
          {#if filters.value.tags.length > 0}
            <button type="button" onclick={() => set("tags", [])} class="clear">
              <span class="close-icon i-material-symbols:close" aria-hidden="true"></span> Clear
            </button>
          {/if}
        </div>
        <div class="tag-list">
          {#each tagOptions as tag (tag)}
            {@const active = filters.value.tags.includes(tag)}
            <button type="button" aria-pressed={active} onclick={() => toggleTag(tag)} class="tag">
              {tag}
            </button>
          {/each}
        </div>
      </div>

      <div class="footer">
        <span class="results">{resultCount} shown</span>
        <button type="button" onclick={() => filters.reset(true)} class="reset">Reset filters</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search {
    position: relative;
    flex: 1;
  }

  .search-icon {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 0.75rem;
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
    translate: 0 -50%;
    color: var(--muted-foreground);
    pointer-events: none;
  }

  input {
    inline-size: 100%;
    block-size: 2.5rem;
    border: var(--border-size) solid var(--card);
    border-end-start-radius: var(--radius-card);
    padding-inline: 2rem 0.5rem;
    background: var(--card);

    &::placeholder {
      color: var(--muted-foreground);
    }

    &:focus {
      border-color: var(--accent);
      outline: none;
    }
  }

  kbd {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-end: 0.5rem;
    border: 1px solid var(--muted-foreground);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    translate: 0 -50%;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    line-height: var(--line-height-none);
    pointer-events: none;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    block-size: 2.5rem;
    border-end-end-radius: var(--radius-card);
    padding-inline: 0.75rem;
    background: var(--card);
    color: var(--muted-foreground);
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[data-active="true"] {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }

  .filter-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }

  .count,
  .results {
    font-variant-numeric: tabular-nums;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: 0.75rem;
    background: var(--card);
  }

  .tags {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tags-header,
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  :is(.label, .results) {
    color: var(--muted-foreground);
  }

  :is(.clear, .reset) {
    color: var(--accent);

    &:hover {
      text-decoration: underline;
      text-underline-offset: 0.25rem;
    }
  }

  .clear {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .close-icon {
    display: inline-block;
    inline-size: 0.75rem;
    block-size: 0.75rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    overflow-y: auto;
    max-block-size: 10rem;
  }

  .tag {
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    background: color-mix(var(--panel) 70%, transparent);
    color: color-mix(var(--foreground) 70%, transparent);
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    &:not([aria-pressed="true"]):hover {
      background: var(--panel);
      color: var(--foreground);
    }
  }

  .footer {
    border-block-start: 1px solid color-mix(var(--border) 60%, transparent);
    padding-block-start: 0.5rem;
  }
</style>
