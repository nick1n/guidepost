<script module lang="ts">
  const swipeFeedbackDuration = 900;
  function tagWeight(count: number, maximum: number) {
    const proportion = Math.log(Math.max(3, count) / 3) / Math.log(Math.max(4, maximum) / 3);
    return Math.expm1(2 * proportion) / Math.expm1(2);
  }
</script>

<script lang="ts">
  import { afterNavigate, beforeNavigate, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onDestroy, untrack } from "svelte";
  import { innerHeight, scrollY } from "svelte/reactivity/window";
  import CollectionCard from "#lib/components/track/CollectionCard.svelte";
  import { swipe, type SwipeDirection } from "#lib/swipe.ts";
  import { reviewTagLabel } from "#lib/catalog-view.ts";
  import { CollectionBrowsing, browseCategories as categories } from "#lib/collection-browsing.svelte.ts";
  import { CollectionCards } from "#lib/collection-cards.svelte.ts";
  import { formatPriceTotals } from "#lib/kdm-data.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";
  import { getCollection } from "#lib/state/collection.svelte.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const collection = getCollection();
  // Route entry installs the catalog before building this page's index and commands.
  collection.setCatalog(untrack(() => data.catalog));
  const catalog = collection.catalog;
  const entries = catalog.entries;
  const browsing = new CollectionBrowsing(catalog, (item, edition) => collection.getEdition(item, edition), {
    current: () => page.shallow?.url ?? page.url,
    replace: (url) => replaceState(url, page.state),
  });
  let dragDistance = $state(0);
  let swipeReady = $state(false);
  let categoriesVisible = $state(true);
  let categoryBar: HTMLElement | undefined;
  let swipeFeedback = $state(false);
  let swipeFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const showSwipeTabs = $derived((dragDistance !== 0 || swipeFeedback) && !categoriesVisible);
  let searchInput: HTMLInputElement | undefined;

  function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return;
    const target = event.target;
    const modified = event.ctrlKey || event.metaKey;
    if (
      event.key === "Backspace" &&
      !modified &&
      !event.shiftKey &&
      target === searchInput &&
      !browsing.query &&
      browsing.selectedTags.length
    ) {
      event.preventDefault();
      browsing.removeLastTag();
      return;
    }
    if (event.key === "Enter" && !modified && !event.shiftKey && target === searchInput) {
      if (!browsing.acceptTagQuery()) return;
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && !modified && !event.shiftKey && target === searchInput) {
      event.preventDefault();
      searchInput?.blur();
      return;
    }
    const searchShortcut = event.key.toLowerCase() === "k" && modified && !event.shiftKey;
    if (!searchShortcut) {
      if (event.key !== "/" || modified) return;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select") || target.isContentEditable)) return;
    }
    event.preventDefault();
    searchInput?.focus();
  }

  beforeNavigate(() => browsing.cancelPendingUrl());
  afterNavigate(({ to }) => {
    if (to) browsing.restore(to.url);
  });
  const showBackToTop = $derived((innerHeight.current ?? 0) > 0 && (scrollY.current ?? 0) >= (innerHeight.current ?? 0));

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  let tagsOpen = $state(false);
  let allTagsOpen = $state(false);
  const writable = $derived(collection.canWrite);
  const cards = new CollectionCards(entries);
  onDestroy(() => {
    browsing.cancelPendingUrl();
    clearTimeout(swipeFeedbackTimer);
    cards.dispose();
  });
  function markLatestOwned() {
    if (!writable) return;
    collectionActions.run(collection.setEditionsOwned(browsing.latestUnowned, true));
  }
  function refreshCollection() {
    if (!collection.hasStore) {
      window.location.reload();
      return;
    }
    collectionActions.run(collection.refresh(), { success: false });
  }
  function swipeCategory(direction: SwipeDirection) {
    const index = categories.findIndex((option) => option.id === browsing.category);
    const offset = direction === "left" ? 1 : -1;
    const next = categories[(index + offset + categories.length) % categories.length];
    browsing.changeCategory(next.id);
    if (!categoriesVisible) {
      clearTimeout(swipeFeedbackTimer);
      swipeFeedback = true;
      swipeFeedbackTimer = setTimeout(() => (swipeFeedback = false), swipeFeedbackDuration);
    }
  }
  function dragCatalog(distance: number, ready = false) {
    if (distance !== 0 && dragDistance === 0) {
      clearTimeout(swipeFeedbackTimer);
      swipeFeedback = false;
      // Measure at gesture start so feedback does not wait for the observer's next frame.
      if (categoryBar) {
        const bounds = categoryBar.getBoundingClientRect();
        categoriesVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
      }
    }
    dragDistance = distance;
    swipeReady = ready;
  }
  function observeCategories(element: HTMLElement) {
    categoryBar = element;
    const observer = new IntersectionObserver(([entry]) => {
      categoriesVisible = entry.isIntersecting;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      categoryBar = undefined;
    };
  }
</script>

<svelte:head><title>Collection | Guidepost</title></svelte:head>

<svelte:window {onkeydown} />

<main {@attach swipe({ onSwipe: swipeCategory, onDrag: dragCatalog, scope: "page" })} class="scrollbar-stable">
  <a class="back" href={resolve("/")}>
    <span class="back-icon i-material-symbols:arrow-back" aria-hidden="true"></span>Guidepost
  </a>
  <header>
    <h1>Collection</h1>
    <p class="subtitle">Kingdom Death: Monster collection tracker</p>
  </header>

  {#if collection.loadStatus === "pending"}
    <p class="collection-status" role="status">Loading your saved collection...</p>
  {:else if collection.loadError || collection.saveError}
    <div class="collection-status error">
      <p role="alert">{(collection.loadError ?? collection.saveError)?.message}</p>
      <button type="button" onclick={refreshCollection}>
        {collection.loadError ? (collection.hasStore ? "Retry loading" : "Reload page") : "Refresh collection"}
      </button>
    </div>
  {:else if collection.needsRefresh}
    <div class="collection-status">
      <p role="status">Your collection changed in another tab. Refresh your collection before editing again.</p>
      <button onclick={refreshCollection}>Refresh collection</button>
    </div>
  {/if}

  <section class="stats" aria-label="Collection totals">
    <button class="stat-owned" type="button" aria-pressed={browsing.status === "owned"} onclick={() => browsing.toggleStatus("owned")}>
      <span class="stat-label">
        Owned<span class="stat-icon control-icon i-material-symbols:inventory-2-outline-sharp" aria-hidden="true"></span>
      </span>
      <strong>{collection.ownedCount}</strong>
    </button>
    <div class="stat-value">
      <strong>{formatPriceTotals(collection.totals)}</strong>
    </div>
    <button
      class="stat-wishlist"
      type="button"
      aria-pressed={browsing.status === "wishlist"}
      onclick={() => browsing.toggleStatus("wishlist")}
    >
      <span class="stat-label"
        ><span class="stat-icon control-icon i-material-symbols:favorite-outline" aria-hidden="true"></span>Wishlist</span
      >
      <strong>{collection.wishlistCount}</strong>
    </button>
  </section>

  <nav class="categories" aria-label="Catalog categories" {@attach observeCategories}>
    {@render categoryButtons()}
  </nav>
  <nav class={["swipe-tabs", showSwipeTabs && "is-visible"]} aria-label="Catalog categories while swiping" inert={!showSwipeTabs}>
    {@render categoryButtons()}
  </nav>

  <div class="catalog-filters">
    <div class={["search-controls", browsing.selectedTags.length > 0 && browsing.selectedTags.length <= 2 && "is-inline"]}>
      <div class="search-heading">
        <label class="search" for="catalog-search">Search catalog</label>
        {#if browsing.hasSearch}
          <button class="search-command" type="button" onclick={markLatestOwned} disabled={!writable || !browsing.latestUnowned.length}>
            Mark latest editions owned
          </button>
        {/if}
        <button
          class="search-command"
          type="button"
          onclick={browsing.clearSearch}
          disabled={!browsing.query && !browsing.selectedTags.length && browsing.status === "all"}
        >
          Clear search
        </button>
        <p class="results">{browsing.filtered.length} items</p>
      </div>
      <div class="search-row">
        <div class="search-field">
          <input
            id="catalog-search"
            type="search"
            bind:this={searchInput}
            bind:value={() => browsing.query, browsing.setQuery}
            aria-keyshortcuts="/ Control+k Meta+k"
            aria-describedby="search-shortcut"
            placeholder="Name, alias, or tag"
          />
          <span id="search-shortcut" class={["shortcut", browsing.query && "is-hidden"]}>
            <span class="visually-hidden">Press </span><kbd>/</kbd><span class="visually-hidden"> to focus search</span>
          </span>
        </div>
        {#if browsing.selectedTags.length}
          <section class="tag-filters" aria-label="Selected tags">
            {#each browsing.selectedTags as tag (tag)}
              <button
                class="active-tag"
                type="button"
                aria-label="Remove {reviewTagLabel(tag)} filter"
                onclick={() => browsing.toggleTag(tag)}
              >
                {reviewTagLabel(tag)}<span class="remove-icon i-material-symbols:close" aria-hidden="true"></span>
              </button>
            {/each}
          </section>
        {/if}
        <div class="search-actions">
          <button
            class="tag-heading"
            type="button"
            aria-expanded={tagsOpen}
            aria-controls="tag-browser"
            onclick={() => (tagsOpen = !tagsOpen)}
          >
            <span class="tag-icon control-icon i-material-symbols:label-outline" aria-hidden="true"></span>
            <strong class="tag-title">Tags</strong>
            <span class="tag-chevron control-icon i-material-symbols:expand-more" aria-hidden="true"></span>
          </button>
          <button
            class="collapse-all"
            type="button"
            aria-label={cards.allCollapsed ? "Expand all" : "Collapse all"}
            disabled={!entries.length}
            onclick={() => cards.toggleAll()}
          >
            <span
              class={[
                "collapse-icon",
                "control-icon",
                cards.allCollapsed ? "i-material-symbols:unfold-more-double" : "i-material-symbols:unfold-less-double",
              ]}
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>
    <div class="tag-body" id="tag-browser" hidden={!tagsOpen}>
      {#if tagsOpen}
        {#if browsing.cloudTags.length}
          <fieldset class="tag-cloud">
            <legend class="visually-hidden">Filter by tags</legend>
            {#each browsing.cloudTags as option (option.tag)}
              {@render tagButton(option.tag, tagWeight(option.count, browsing.tags[0]?.count ?? 0))}
            {/each}
          </fieldset>
        {/if}
        {#if browsing.category === "content" && browsing.allTags.length}
          <details class="more-tags" bind:open={allTagsOpen}>
            <summary class="more-heading"
              >All tags<span class="more-chevron control-icon i-material-symbols:expand-more" aria-hidden="true"></span></summary
            >
            {#if allTagsOpen}
              <fieldset class="tag-list">
                <legend class="visually-hidden">All tags</legend>
                {#each browsing.allTags as option (option.tag)}
                  {@render tagButton(option.tag)}
                {/each}
              </fieldset>
            {/if}
          </details>
        {/if}
        {#if !browsing.tags.length}<p>No tags are listed for this category.</p>{/if}
      {/if}
    </div>
  </div>

  <div class="catalog-viewport">
    <div class={["catalog-content", dragDistance !== 0 && "is-dragging"]} style:--drag-distance={`${dragDistance}px`}>
      {#each browsing.panels as option (option.id)}
        {@const items = option.items}
        <!-- Keep visited cards mounted so category changes preserve their controls and deferred bodies. -->
        <div data-category={option.id} hidden={option.id !== browsing.category}>
          {#if !items.length}
            <p class="empty">No items match. Try another search, tag, category, or ownership filter.</p>
          {:else}
            <div class="cards">
              {#each items as item, index (item.id)}
                {@const presentation = cards.state(item.id, index)}
                <CollectionCard
                  {item}
                  ready={presentation.ready}
                  collapsed={presentation.collapsed}
                  selectedTags={browsing.selectedTags}
                  observe={cards.observe(item.id)}
                  onToggle={() => cards.toggle(item.id)}
                  onHold={() => cards.toggleAll(item.id)}
                  onTagClick={browsing.toggleTag}
                />
              {/each}
            </div>
            {#if option.id === browsing.category && items.length < browsing.filtered.length}
              <div class="catalog-more">
                <p>
                  {browsing.category === "content" ? "Gameplay items first. " : ""}Showing {items.length} of {browsing.filtered.length} items.
                </p>
                <button class="show-more" type="button" onclick={browsing.showMoreItems}>Show {browsing.nextCount} more</button>
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </div>
  <footer>Your collection is saved on this device and remains available offline.</footer>
  <div
    class={["swipe-previous", dragDistance > 0 && "is-visible"]}
    data-ready={swipeReady}
    style:--swipe-pull={`${Math.max(0, dragDistance)}px`}
    aria-hidden="true"
  >
    <span class="swipe-icon i-material-symbols:chevron-left"></span>
  </div>
  <div
    class={["swipe-next", dragDistance < 0 && "is-visible"]}
    data-ready={swipeReady}
    style:--swipe-pull={`${Math.max(0, -dragDistance)}px`}
    aria-hidden="true"
  >
    <span class="swipe-icon i-material-symbols:chevron-right"></span>
  </div>
</main>

{#if showBackToTop}
  <button class="back-to-top" type="button" aria-label="Back to top" onclick={backToTop}>
    <span class="control-icon i-material-symbols:expand-less" aria-hidden="true"></span>
  </button>
{/if}

{#snippet categoryButtons()}
  {#each categories as option (option.id)}
    <button
      class="category-tab"
      type="button"
      aria-pressed={browsing.category === option.id}
      onclick={() => browsing.changeCategory(option.id)}>{option.label}</button
    >
  {/each}
  <span class="tab-highlight" aria-hidden="true"></span>
{/snippet}

{#snippet tagButton(tag: string, weight = 0)}
  {@const selected = browsing.selectedTags.includes(tag)}
  <button
    class="cloud-tag"
    type="button"
    aria-pressed={selected}
    disabled={!selected && !browsing.tagCounts.get(tag)}
    style:--tag-weight={weight}
    onclick={() => browsing.toggleTag(tag)}>{reviewTagLabel(tag)}</button
  >
{/snippet}

<style>
  .collection-status {
    margin-block: 0.75rem;
    padding: 0.75rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--muted-foreground);

    &.error {
      display: grid;
      gap: 0.5rem;
      color: var(--accent-red);
    }
  }
  .collection-status button {
    justify-self: start;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-control);
    background: var(--card);
    color: var(--foreground);
  }
  main {
    --distance-swipe-limit: 2.25rem;
    --size-catalog: 72rem;
    --size-swipe-icon: clamp(3rem, 8vw, 7rem);
    --distance-swipe-cue-limit: calc(var(--size-swipe-icon) * 0.5);

    max-inline-size: var(--size-catalog);
    margin-inline: auto;
    padding: 0 0.25rem 2rem;
    overflow-anchor: none;
  }
  .catalog-viewport {
    /* Clip the shifted catalog without creating a scrolling container. */
    overflow-x: clip;
  }
  .catalog-content {
    translate: clamp(calc(-1 * var(--distance-swipe-limit)), calc(var(--drag-distance) * 0.3), var(--distance-swipe-limit)) 0;
    transition: translate var(--duration-fast) var(--ease-standard);

    &.is-dragging {
      cursor: grabbing;
      transition: none;
    }
  }
  .swipe-previous,
  .swipe-next {
    display: grid;
    visibility: hidden;
    z-index: 2;
    position: fixed;
    inset-block-start: 50%;
    /* Shadow the icon's silhouette, since a text shadow does not apply to its mask. */
    filter: drop-shadow(0 0.125rem 0.25rem color-mix(in oklch, var(--contrast) 80%, transparent))
      drop-shadow(0 0 0.5rem color-mix(in oklch, var(--foreground) 20%, transparent));
    opacity: 0;
    /* Decorative gesture feedback must not intercept the swipe or nearby controls. */
    pointer-events: none;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard),
      visibility 0s var(--duration-fast);

    &.is-visible {
      visibility: visible;
      /* Follow the pointer immediately while retaining the opacity fade. */
      transition-duration: var(--duration-fast), 0s, 0s;
      opacity: 1;
      transition-delay: 0s;
    }
    &[data-ready="true"] {
      filter: drop-shadow(0 0.125rem 0.25rem color-mix(in oklch, var(--contrast) 80%, transparent))
        drop-shadow(0 0 0.75rem color-mix(in oklch, var(--accent) 65%, transparent));
    }
  }
  .swipe-previous {
    inset-inline-start: 0;
    translate: -25% -50%;

    &.is-visible {
      translate: clamp(
          calc(var(--size-swipe-icon) * -0.25),
          calc(var(--size-swipe-icon) * -0.25 + var(--swipe-pull) * 0.5),
          var(--distance-swipe-cue-limit)
        ) -50%;
    }
  }
  .swipe-next {
    inset-inline-end: 0;
    translate: 25% -50%;

    &.is-visible {
      translate: clamp(
          calc(var(--distance-swipe-cue-limit) * -1),
          calc(var(--size-swipe-icon) * 0.25 - var(--swipe-pull) * 0.5),
          calc(var(--size-swipe-icon) * 0.25)
        ) -50%;
    }
  }
  .swipe-icon {
    --size-icon: var(--size-swipe-icon);
    color: var(--muted-foreground);
    transition:
      color var(--duration-fast) var(--ease-standard),
      scale var(--duration-fast) var(--ease-standard);
  }
  [data-ready="true"] .swipe-icon {
    color: var(--accent);
    scale: 1.12;
  }
  header {
    margin-block-end: 0.75rem;
    text-align: center;
  }
  h1 {
    font-weight: var(--font-bold);
    font-size: 5rem;
    line-height: var(--line-height-none);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }
  .back {
    display: inline-flex;
    align-items: center;
    padding: 1rem;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .back-icon,
  .remove-icon {
    --size-icon: 1rem;
  }
  .back-to-top,
  .tag-heading,
  .show-more,
  .collapse-all {
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .back-to-top {
    display: grid;
    z-index: 2;
    position: fixed;
    place-items: center;
    inline-size: 3rem;
    block-size: 3rem;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline-start: max(1rem, env(safe-area-inset-left));
    box-shadow: 0 0.25rem 0.5rem color-mix(in oklch, var(--contrast) 25%, transparent);
  }
  .back-to-top,
  .show-more {
    color: var(--foreground);
  }
  .subtitle,
  footer,
  .results {
    color: var(--muted-foreground);
  }
  .categories,
  .swipe-tabs {
    display: flex;
    margin-block-start: 0.5rem;
    padding: 0.25rem;
    overflow-x: auto;
    gap: 0.25rem;
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .swipe-tabs {
    visibility: hidden;
    z-index: 2;
    /* Keep the gesture's category controls visible without moving the page layout. */
    position: fixed;
    max-inline-size: calc(var(--size-catalog) - 0.5rem);
    margin-inline: auto;
    margin-block-start: 0;
    inset-block-start: 0;
    inset-inline: 0.25rem;
    padding-block-start: max(0.25rem, env(safe-area-inset-top));
    translate: 0 calc(-100% - 0.5rem);
    box-shadow: 0 0.25rem 0.5rem color-mix(in oklch, var(--contrast) 25%, transparent);
    transition:
      translate var(--duration-fast) var(--ease-standard),
      visibility 0s var(--duration-fast);

    &.is-visible {
      visibility: visible;
      translate: 0 0;
      transition-delay: 0s;
    }
  }
  .category-tab {
    flex: 1 0 auto;
    min-block-size: 2.75rem;
    padding: 0.4rem 0.25rem;
    border-radius: calc(var(--radius-control) - 0.25rem);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    white-space: nowrap;

    &[aria-pressed="true"] {
      background: var(--card);
      color: var(--foreground);
    }
  }
  .tab-highlight {
    display: none;
  }
  @supports (anchor-name: --active-category) and (anchor-scope: --active-category) {
    .categories {
      position: relative;
      isolation: isolate;
    }
    .categories,
    .swipe-tabs {
      anchor-scope: --active-category;
    }
    .category-tab {
      z-index: 1;
      position: relative;

      &[aria-pressed="true"] {
        anchor-name: --active-category;
        background: transparent;
      }
    }
    .tab-highlight {
      display: block;
      position: absolute;
      position-anchor: --active-category;
      inset-block-end: anchor(--active-category bottom);
      inset-block-start: anchor(--active-category top);
      inset-inline-end: anchor(--active-category right);
      inset-inline-start: anchor(--active-category left);
      border-radius: calc(var(--radius-control) - 0.25rem);
      background: var(--card);
      transition:
        inset-block-start var(--duration-fast) var(--ease-standard),
        inset-block-end var(--duration-fast) var(--ease-standard),
        inset-inline-start var(--duration-fast) var(--ease-standard),
        inset-inline-end var(--duration-fast) var(--ease-standard);
    }
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .stats > :is(div, button) {
    display: grid;
    align-content: center;
    padding: 0.75rem;
    gap: 0.25rem;
    border-radius: var(--radius-card);
    background: var(--panel);
  }
  .stats button {
    text-align: start;
    &[aria-pressed="true"] {
      background: color-mix(in oklch, var(--stat-accent) 12%, var(--panel));
    }
  }
  .stat-owned {
    --stat-accent: var(--accent-blue);
  }
  .stat-wishlist {
    --stat-accent: var(--accent-red);
    justify-items: end;
  }
  .stat-value {
    grid-row: 2;
    grid-column: 1 / -1;
    justify-items: center;
  }
  .stat-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .stat-icon {
    color: var(--stat-accent);
  }
  .stats button strong {
    color: var(--stat-accent);
  }
  .stats strong {
    font-size: clamp(var(--text-xl), 3vw, 2rem);
    line-height: var(--line-height-snug);
    font-variant-numeric: tabular-nums;
  }
  .catalog-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    margin-block: 0.5rem;
    gap: 0.5rem;
  }
  .search {
    margin-inline-end: auto;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .shortcut {
    grid-area: 1 / 1;
    align-self: center;
    justify-self: end;
    margin-inline-end: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    /* Let clicks on the hint focus the input underneath it. */
    pointer-events: none;

    &.is-hidden {
      visibility: hidden;
    }
  }
  kbd {
    padding: 0.125rem 0.25rem;
    border: 1px solid var(--color-divider);
    border-radius: 0.25rem;
    background: var(--panel);
  }
  .search-controls {
    display: grid;
    gap: 0.25rem;
  }
  .search-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }
  .search-field {
    display: grid;
    min-inline-size: 0;
  }
  input[type="search"] {
    grid-area: 1 / 1;
    min-inline-size: 0;
    inline-size: 100%;
    padding: 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);

    &:placeholder-shown {
      padding-inline-end: 2.5rem;
    }
  }
  .tag-filters {
    grid-row: 2;
    grid-column: 1 / -1;
  }
  .tag-heading,
  .more-heading {
    display: flex;
    align-items: center;
    min-block-size: 2.75rem;
    font-size: var(--text-md);
  }
  .search-actions {
    display: flex;
    grid-row: 1;
    grid-column: 2;
    gap: 0.5rem;
  }
  .tag-heading {
    padding: 0.5rem;
    gap: 0.4rem;
  }
  .more-heading {
    justify-content: space-between;
    padding-inline: 0.25rem;
    gap: 0.75rem;
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }
  .tag-icon,
  .tag-chevron,
  .more-chevron {
    flex-shrink: 0;
    color: var(--muted-foreground);
  }
  .tag-title {
    flex: 1;
  }
  .tag-chevron,
  .more-chevron {
    transition: rotate var(--duration-fast) var(--ease-standard);
  }
  .tag-heading[aria-expanded="true"] .tag-chevron,
  .more-tags[open] .more-chevron {
    rotate: 180deg;
  }
  .tag-body {
    display: grid;
    padding: 0.75rem;
    gap: 0.75rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);

    &[hidden] {
      display: none;
    }
  }
  .tag-body p {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .tag-cloud,
  .tag-list,
  .tag-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.125rem;
  }
  .tag-cloud,
  .tag-list {
    min-inline-size: 0;
    padding: 0.4rem;
  }
  .tag-cloud {
    justify-content: center;
    padding-block: 1rem;
  }
  .tag-list {
    max-block-size: 20rem;
    overflow-y: auto;
  }
  .cloud-tag {
    max-inline-size: 100%;
    min-block-size: 2rem;
    padding: 0 0.5em;
    transform-origin: bottom;
    border-radius: 99px;
    background: color-mix(in oklch, var(--card) 75%, transparent);
    box-shadow: 0 0.2rem 0.6rem color-mix(in oklch, var(--contrast) 18%, transparent);
    font: var(--font-semibold) calc(var(--text-md) + var(--tag-weight) * var(--text-lg) * 1.75) / var(--line-height-snug)
      var(--font-display);
    overflow-wrap: anywhere;
    transition:
      scale var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: color-mix(in oklch, var(--accent) 14%, var(--panel));
      color: var(--accent);
    }
  }
  .active-tag {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.4rem 0.65rem;
    gap: 0.4rem;
    border: var(--border-width) solid color-mix(in oklch, var(--accent) 40%, transparent);
    border-radius: var(--radius-control);
    background: color-mix(in oklch, var(--accent) 10%, var(--panel));
    color: var(--accent);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  :is(.tag-heading, .more-heading, .cloud-tag, .active-tag):focus-visible {
    outline: var(--border-width) solid var(--accent);
    outline-offset: 3px;
  }
  .remove-icon {
    flex-shrink: 0;
    color: var(--accent);
  }
  .results {
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .search-command {
    min-block-size: 1.5rem;
    padding-inline: 0.25rem;
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .cards {
    display: grid;
    align-items: start;
    gap: 0.5rem;
  }
  .catalog-more {
    display: grid;
    justify-items: center;
    margin-block-start: 1rem;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-align: center;
  }
  .show-more {
    padding: 0.75rem 1rem;
    font-size: var(--text-md);
  }
  .collapse-all {
    display: grid;
    place-items: center;
    min-inline-size: 2.75rem;
    padding: 0.5rem;
  }
  .collapse-icon {
    color: var(--muted-foreground);
  }
  .empty {
    padding: 2rem 1rem;
    color: var(--muted-foreground);
    text-align: center;
  }
  footer {
    margin-block-start: 1rem;
    font-size: var(--text-sm);
    text-align: center;
  }
  button:disabled {
    cursor: default;
    opacity: 0.4;
  }
  button,
  a,
  summary,
  input {
    transition: var(--transition-colors);
  }
  @media (hover: hover) {
    button:not(:disabled, .cloud-tag, .search-command):hover,
    summary:hover {
      background: color-mix(in oklch, var(--accent) 14%, var(--panel));
      color: var(--accent);
    }
    .search-command:not(:disabled):hover {
      color: var(--accent);
    }
    .active-tag:not(:disabled):hover,
    input[type="search"]:hover {
      border-color: var(--accent);
    }
    .tag-heading:hover :is(.tag-icon, .tag-chevron),
    summary:hover :is(.tag-icon, .tag-chevron, .more-chevron) {
      color: var(--accent);
    }
    .back:hover {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .cloud-tag:not(:disabled):hover {
      z-index: 1;
      scale: 1.25;
      background: color-mix(in oklch, var(--accent) 14%, var(--panel));
      box-shadow: 0 0.5rem 1rem color-mix(in oklch, var(--contrast) 25%, transparent);
      color: var(--accent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .swipe-previous.is-visible,
    .swipe-next.is-visible {
      translate: 0 -50%;
    }
    .catalog-content {
      translate: none;
    }
  }
  @media (min-width: 40rem) {
    .is-inline .search-row {
      grid-template-columns: minmax(0, 1fr) auto auto;
    }
    .is-inline .tag-filters {
      grid-row: 1;
      grid-column: 2;
    }
    .is-inline .search-actions {
      grid-column: 3;
    }
    .stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .stat-value {
      grid-row: auto;
      grid-column: auto;
    }
  }
  @media (min-width: 60rem) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
