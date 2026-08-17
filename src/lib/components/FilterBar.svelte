<script lang="ts">
  import { defaultFilters, type Filters } from "#lib/filters.ts";
  import Segmented from "./Segmented.svelte";

  type Props = {
    filters: Filters;
    onchange: (f: Filters) => void;
    tagOptions: string[];
    showKind?: boolean;
    showGameplay?: boolean;
    resultCount: number;
  };

  let { filters, onchange, tagOptions, showKind = true, showGameplay = true, resultCount }: Props = $props();

  let open = $state(false);
  let searchInput: HTMLInputElement;

  const activeCount = $derived(
    filters.tags.length + (filters.gameplay !== "any" ? 1 : 0) + (filters.kind !== "any" ? 1 : 0) + (filters.status !== "any" ? 1 : 0),
  );

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onchange({ ...filters, [key]: value });
  }

  function toggleTag(tag: string) {
    set("tags", filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag]);
  }

  function isEditableTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }

  function handleShortcut(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return;

    const isSlash = event.key === "/";
    const isSearchShortcut = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

    if (isSlash || isSearchShortcut) {
      event.preventDefault();
      searchInput?.focus();
    }
  }
</script>

<svelte:window onkeydown={handleShortcut} />

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <div class="relative flex-1">
      <span
        class="i-material-symbols:search pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      ></span>
      <input
        bind:this={searchInput}
        type="search"
        value={filters.query}
        oninput={(e) => set("query", e.currentTarget.value)}
        placeholder="Search"
        aria-label="Search items"
        class="h-10 w-full rounded-bl-2xl border-2 border-card bg-card pl-8 pr-2 placeholder:text-muted-foreground focus:border-accent focus:outline-none"
      />
      {#if !filters.query}
        <kbd
          aria-hidden="true"
          class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-muted-foreground px-2 py-1 text-xs leading-none text-muted-foreground"
          >/</kbd
        >
      {/if}
    </div>
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      class={[
        "flex h-10 items-center gap-2 rounded-br-2xl px-3 transition-colors",
        open || activeCount > 0 ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground",
      ]}
    >
      <span class="i-material-symbols:tune size-4" aria-hidden="true"></span>
      Filter
      {#if activeCount > 0}
        <span class="tabular-nums">({activeCount})</span>
      {/if}
    </button>
  </div>

  {#if open}
    <div class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
      <Segmented
        label="Sort by"
        value={filters.sort}
        onchange={(v) => set("sort", v)}
        options={[
          { value: "name", label: "Name" },
          { value: "price-desc", label: "Price high" },
          { value: "price-asc", label: "Price low" },
        ]}
      />
      <Segmented
        label="Status"
        value={filters.status}
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
          value={filters.gameplay}
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
          value={filters.kind}
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

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Tags</span>
          {#if filters.tags.length > 0}
            <button type="button" onclick={() => set("tags", [])} class="inline-flex items-center gap-1 text-accent">
              <span class="i-material-symbols:close size-3" aria-hidden="true"></span> Clear
            </button>
          {/if}
        </div>
        <div class="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {#each tagOptions as tag (tag)}
            {@const active = filters.tags.includes(tag)}
            <button
              type="button"
              aria-pressed={active}
              onclick={() => toggleTag(tag)}
              class={[
                "rounded-lg px-2 py-1 transition-colors",
                active ? "bg-accent text-accent-foreground" : "bg-panel/70 text-foreground/70 hover:bg-panel hover:text-foreground",
              ]}
            >
              {tag}
            </button>
          {/each}
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-border/60 pt-2">
        <span class="tabular-nums text-muted-foreground">{resultCount} shown</span>
        <button type="button" onclick={() => onchange({ ...defaultFilters, query: filters.query })} class="text-accent">
          Reset filters
        </button>
      </div>
    </div>
  {/if}
</div>
