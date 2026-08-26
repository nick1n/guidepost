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

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <div class="relative flex-1">
      <span
        class="i-material-symbols:search text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      ></span>
      <input
        bind:this={searchInput}
        type="search"
        value={filters.value.query}
        oninput={(e) => set("query", e.currentTarget.value)}
        placeholder="Search"
        aria-label="Search items"
        class="border-card bg-card placeholder:text-muted-foreground focus:border-accent h-10 w-full rounded-bl-2xl border-2 pr-2 pl-8 focus:outline-none"
      />
      {#if !filters.value.query}
        <kbd
          aria-hidden="true"
          class="border-muted-foreground text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-2 py-1 text-xs leading-none"
        >
          /
        </kbd>
      {/if}
    </div>
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      class={[
        "flex h-10 cursor-pointer items-center gap-2 rounded-br-2xl px-3 transition-colors",
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
    <div class="border-border bg-card flex flex-col gap-3 rounded-2xl border p-3">
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

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Tags</span>
          {#if filters.value.tags.length > 0}
            <button type="button" onclick={() => set("tags", [])} class="text-accent inline-flex items-center gap-1">
              <span class="i-material-symbols:close size-3" aria-hidden="true"></span> Clear
            </button>
          {/if}
        </div>
        <div class="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {#each tagOptions as tag (tag)}
            {@const active = filters.value.tags.includes(tag)}
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

      <div class="border-border/60 flex items-center justify-between border-t pt-2">
        <span class="text-muted-foreground tabular-nums">{resultCount} shown</span>
        <button type="button" onclick={() => filters.reset(true)} class="text-accent">Reset filters</button>
      </div>
    </div>
  {/if}
</div>
