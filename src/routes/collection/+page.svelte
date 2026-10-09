<script module lang="ts">
  import { data } from "#lib/kdm-data.ts";
  import { reviewIndex, reviewGameplayFirst, type ReviewEdition } from "#lib/catalog-view.ts";

  const catalog = reviewIndex(data);
  const entries = catalog.entries;
  const contentEntries = reviewGameplayFirst(catalog.byCategory.get("content") ?? []);
  const catalogBatchSize = 100;
  const contentPreview = contentEntries.slice(0, catalogBatchSize);

  const eurToUsd = 1.13;
  const categories = [
    { id: "content", label: "Content" },
    { id: "accessories", label: "Accessories" },
    { id: "bundles", label: "Bundles" },
    { id: "homebrew", label: "Homebrew" },
  ] as const;
  type Category = (typeof categories)[number]["id"];
  type Entry = (typeof entries)[number];

  type OwnershipFeedback = { item: string; kind: OwnershipKind };

  const searchUrlDelay = 250;
  const swipeFeedbackDuration = 900;
  const ownershipFeedbackDuration = 5000;
  const emptySelection: Readonly<Selection> = {};

  function key(item: Entry, edition: ReviewEdition) {
    return `${item.id}:${edition.v}`;
  }
  function tagWeight(count: number, maximum: number) {
    const proportion = Math.log(Math.max(3, count) / 3) / Math.log(Math.max(4, maximum) / 3);
    return Math.expm1(2 * proportion) / Math.expm1(2);
  }
</script>

<script lang="ts">
  import { afterNavigate, beforeNavigate, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onDestroy, tick } from "svelte";
  import { innerHeight, scrollY } from "svelte/reactivity/window";
  import CollectionCard, { type Selection, type Owner, type OwnershipKind } from "#lib/components/track/CollectionCard.svelte";
  import { swipe, type SwipeDirection } from "#lib/swipe.ts";
  import { reviewEditions, reviewPrice, reviewTags, reviewTagLabel } from "#lib/catalog-view.ts";
  import { formatPrice } from "#lib/kdm-data.ts";

  let category = $state<Category>("content");
  let categoryResults = $state.raw<Partial<Record<Category, Entry[]>>>({ content: contentPreview });
  let categoryLimits = $state<Partial<Record<Category, number>>>({});
  let dragDistance = $state(0);
  let swipeReady = $state(false);
  let categoriesVisible = $state(true);
  let categoryBar: HTMLElement | undefined;
  let swipeFeedback = $state(false);
  let swipeFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const showSwipeTabs = $derived((dragDistance !== 0 || swipeFeedback) && !categoriesVisible);
  let query = $state("");
  let searchInput: HTMLInputElement | undefined;

  function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return;
    const target = event.target;
    const modified = event.ctrlKey || event.metaKey;
    if (event.key === "Backspace" && !modified && !event.shiftKey && target === searchInput && !query && selectedTags.length) {
      event.preventDefault();
      selectedTags = selectedTags.slice(0, -1);
      updateCatalogUrl();
      return;
    }
    if (event.key === "Enter" && !modified && !event.shiftKey && target === searchInput) {
      const match =
        tags.find(({ tag }) => tag.toLowerCase() === searchQuery) ??
        tags.find(({ tag }) => reviewTagLabel(tag).toLowerCase() === searchQuery);
      if (!match) return;
      event.preventDefault();
      if (!selectedTags.includes(match.tag)) selectedTags = [...selectedTags, match.tag];
      setQuery("");
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

  let searchUrlTimer: ReturnType<typeof setTimeout> | undefined;
  beforeNavigate(() => clearTimeout(searchUrlTimer));
  afterNavigate(({ to }) => {
    clearTimeout(searchUrlTimer);
    const next = categories.find((option) => option.id === to?.url.searchParams.get("cat"))?.id ?? "content";
    if (next !== category) setCategory(next);
    query = to?.url.searchParams.get("q") ?? "";
    const availableTags = catalog.tags.get(next) ?? [];
    selectedTags = [...new Set(to?.url.searchParams.getAll("tag") ?? [])].filter((tag) => availableTags.some((value) => value.tag === tag));
  });

  function updateCatalogUrl() {
    clearTimeout(searchUrlTimer);
    const url = new URL(page.url.href);
    if (category === "content") url.searchParams.delete("cat");
    else url.searchParams.set("cat", category);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    url.searchParams.delete("tag");
    for (const tag of selectedTags) url.searchParams.append("tag", tag);
    if (url.href !== page.url.href) replaceState(url, page.state);
  }

  function setQuery(value: string) {
    query = value;
    clearTimeout(searchUrlTimer);
    if (query) searchUrlTimer = setTimeout(updateCatalogUrl, searchUrlDelay);
    else updateCatalogUrl();
  }
  const showBackToTop = $derived((innerHeight.current ?? 0) > 0 && (scrollY.current ?? 0) >= (innerHeight.current ?? 0));

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  let tagsOpen = $state(false);
  let allTagsOpen = $state(false);
  let contentsOpen = $state<Record<string, boolean>>({});
  let selectedTags = $state<string[]>([]);
  let status = $state<"all" | "owned" | "wishlist">("all");
  let selections = $state<Record<string, Selection>>({});
  let inspected = $state<Record<string, string>>({});
  let collapsed = $state<Record<string, boolean>>({});
  let rendered = $state<Record<string, boolean>>({});
  let ownershipFeedback = $state<OwnershipFeedback>();
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelCardScroll: (() => void) | undefined;
  onDestroy(() => {
    clearTimeout(searchUrlTimer);
    clearTimeout(feedbackTimer);
    clearTimeout(swipeFeedbackTimer);
    cancelCardScroll?.();
  });
  // Observer bookkeeping is nonreactive; rendered owns the state used by the template.
  const nearby = new Set<string>();
  const observedCards = new Map<HTMLElement, string>();
  let cardObserver: IntersectionObserver | undefined;

  function toggleCard(item: Entry) {
    const collapse = !collapsed[item.id];
    if (!collapse) rendered[item.id] = true;
    collapsed[item.id] = collapse;
  }

  function toggleAllCards() {
    const collapse = !allCollapsed;
    for (const item of entries) {
      if (!collapse && nearby.has(item.id)) rendered[item.id] = true;
      collapsed[item.id] = collapse;
    }
    return collapse ? "All cards collapsed." : "All cards expanded.";
  }

  function holdCard(item: Entry) {
    const card = document.getElementById(`card-body-${item.id}`)?.closest("article");
    const top = card?.getBoundingClientRect().top;
    const announcement = toggleAllCards();
    if (!collapsed[item.id]) rendered[item.id] = true;
    if (card && top !== undefined) void scrollToCard(card, top);
    return announcement;
  }

  async function scrollToCard(card: HTMLElement, top: number) {
    cancelCardScroll?.();
    const controller = new AbortController();
    const scrollStyle = document.documentElement.style;
    const overflowAnchor = scrollStyle.overflowAnchor;
    // Our correction owns scrolling while the card layout settles.
    scrollStyle.overflowAnchor = "none";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    let stableChecks = 0;
    function cancel() {
      controller.abort();
      scrollStyle.overflowAnchor = overflowAnchor;
      clearTimeout(timer);
      if (cancelCardScroll === cancel) cancelCardScroll = undefined;
    }
    cancelCardScroll = cancel;
    // Deferred bodies and content-visibility can change layout again after scrolling reveals cards.
    // Keep the header anchored until those updates settle, yielding immediately to user input.
    await tick();
    if (controller.signal.aborted) return;
    for (const event of ["wheel", "touchmove", "pointerdown", "keydown"]) {
      window.addEventListener(event, cancel, { passive: true, signal: controller.signal });
    }
    function restorePosition() {
      if (!card.isConnected || !card.getClientRects().length) return cancel();
      const offset = card.getBoundingClientRect().top - top;
      if (Math.abs(offset) > 1) {
        stableChecks = 0;
        window.scrollBy({
          top: offset,
          behavior: "instant",
        });
      } else stableChecks += 1;
      if (stableChecks >= 6 || performance.now() - started >= 1000) cancel();
      else timer = setTimeout(restorePosition, 16);
    }
    // Apply the first correction before the browser can paint the changed card layout.
    restorePosition();
  }

  function observeCard(item: Entry) {
    return (element: HTMLElement) => {
      if (rendered[item.id]) return;
      // One observer defers unopened card controls until they approach the viewport.
      cardObserver ??= new IntersectionObserver(
        (changes) => {
          for (const change of changes) {
            const id = observedCards.get(change.target as HTMLElement);
            if (!id) continue;
            if (change.isIntersecting) {
              nearby.add(id);
              if (!collapsed[id]) rendered[id] = true;
            } else nearby.delete(id);
          }
        },
        { rootMargin: "600px 0px" },
      );
      observedCards.set(element, item.id);
      cardObserver.observe(element);
      return () => {
        cardObserver?.unobserve(element);
        observedCards.delete(element);
        nearby.delete(item.id);
        if (!observedCards.size) {
          cardObserver?.disconnect();
          cardObserver = undefined;
        }
      };
    };
  }

  const searchQuery = $derived(query.trim().toLowerCase());
  const categoryEntries = $derived(category === "content" ? contentEntries : (catalog.byCategory.get(category) ?? []));
  const tags = $derived(catalog.tags.get(category) ?? []);
  const cloudTags = $derived(category === "content" ? (catalog.tagViews.get(category)?.cloud ?? []) : tags);
  const allTags = $derived(catalog.tagViews.get(category)?.all ?? []);
  const hasSearch = $derived(!!searchQuery || selectedTags.length > 0);
  const catalogLimited = $derived(!hasSearch && status === "all");
  const filtered = $derived.by(() => {
    if (catalogLimited) return categoryEntries;
    return categoryEntries.filter((item) => {
      if (!selectedTags.every((tag) => item.tags.includes(tag))) return false;
      if (searchQuery && !catalog.search.get(item.id)?.includes(searchQuery)) return false;
      if (status === "owned" && !reviewEditions(item).some((edition) => selection(item, edition).owned)) return false;
      if (status === "wishlist" && !reviewEditions(item).some((edition) => selection(item, edition).wished)) return false;
      return true;
    });
  });
  const visible = $derived(catalogLimited ? filtered.slice(0, categoryLimits[category] ?? catalogBatchSize) : filtered);
  const nextCount = $derived(Math.min(catalogBatchSize, filtered.length - visible.length));

  function showMoreItems() {
    categoryLimits[category] = Math.min((categoryLimits[category] ?? catalogBatchSize) + catalogBatchSize, categoryEntries.length);
  }

  const allCollapsed = $derived(entries.length > 0 && entries.every((item) => collapsed[item.id]));
  const latestUnowned = $derived(
    filtered.flatMap((item) => {
      const edition = reviewEditions(item).at(-1);
      return edition && edition.standalone !== false && !selection(item, edition).owned ? [{ item, edition }] : [];
    }),
  );
  const tagCounts = $derived.by(() => {
    if (filtered === categoryEntries) return catalog.tagViews.get(category)?.counts ?? new Map<string, number>();
    return new Map(reviewTags(filtered).map(({ tag, count }) => [tag, count]));
  });
  const owned = $derived(
    entries.flatMap((item) =>
      reviewEditions(item)
        .filter((edition) => selection(item, edition).owned)
        .map((edition) => ({ item, edition })),
    ),
  );
  const ownedCount = $derived(owned.filter(({ edition }) => edition.standalone !== false).length);
  const wishlistCount = $derived(
    entries.reduce((total, item) => total + reviewEditions(item).filter((edition) => selection(item, edition).wished).length, 0),
  );
  const collectionValue = $derived(
    owned.reduce((total, { item, edition }) => total + (reviewPrice(item, edition) ?? 0) * (item.currency === "EUR" ? eurToUsd : 1), 0),
  );
  const coverage = $derived.by(() => {
    const grouped = new Map<string, Owner[]>();
    for (const { item, edition } of owned) {
      for (const child of catalog.inclusions(item.id, edition.v)) {
        const owners = grouped.get(child.item) ?? [];
        owners.push({ parent: item.name, parentEdition: edition.v, edition: child.edition });
        grouped.set(child.item, owners);
      }
    }
    return grouped;
  });

  function selection(item: Entry, edition: ReviewEdition) {
    return selections[key(item, edition)] ?? emptySelection;
  }
  function editableSelection(item: Entry, edition: ReviewEdition) {
    const id = key(item, edition);
    selections[id] ??= {};
    return selections[id];
  }
  function selectedEdition(item: Entry) {
    const editions = reviewEditions(item);
    return (
      editions.find((edition) => edition.v === inspected[item.id]) ??
      editions.findLast((edition) => edition.standalone !== false) ??
      editions.at(-1)
    );
  }
  function showOwnershipFeedback(item: Entry, kind: OwnershipFeedback["kind"]) {
    clearTimeout(feedbackTimer);
    ownershipFeedback = { item: item.id, kind };
    feedbackTimer = setTimeout(() => (ownershipFeedback = undefined), ownershipFeedbackDuration);
  }
  function tapOwnership(item: Entry) {
    const hasOwned = reviewEditions(item).some((edition) => selection(item, edition).owned);
    const edition = selectedEdition(item);
    if (edition && !selection(item, edition).owned) toggleOwned(item, edition);
    showOwnershipFeedback(item, hasOwned ? "hint" : "own-hint");
  }
  function holdOwnership(item: Entry) {
    const editions = reviewEditions(item);
    const owned = !editions.some((edition) => selection(item, edition).owned);
    const targets = editions.filter((edition) => (owned ? edition.standalone !== false : selection(item, edition).owned));
    for (const edition of targets) setEditionOwned(item, edition, owned);
    showOwnershipFeedback(item, owned ? "owned" : "cleared");
    return `${item.name}, all editions marked ${owned ? "owned" : "not owned"}.`;
  }
  function selectEdition(item: Entry, edition: ReviewEdition) {
    if (selectedEdition(item)?.v === edition.v) {
      toggleOwned(item, edition);
    } else {
      inspected[item.id] = edition.v;
    }
  }
  function toggleOwned(item: Entry, edition: ReviewEdition) {
    if (edition.standalone === false) return;
    if (ownershipFeedback?.item === item.id) {
      clearTimeout(feedbackTimer);
      ownershipFeedback = undefined;
    }
    setEditionOwned(item, edition, !selection(item, edition).owned);
    inspected[item.id] = edition.v;
  }
  function setEditionOwned(item: Entry, edition: ReviewEdition, owned: boolean) {
    for (const target of [{ item, edition }, ...catalog.includedEditions(item.id, edition.v)]) {
      const value = editableSelection(target.item, target.edition);
      value.owned = owned;
      if (owned) value.wished = false;
    }
  }
  function toggleWish(item: Entry, edition: ReviewEdition) {
    const value = editableSelection(item, edition);
    value.wished = !value.wished;
  }
  function markLatestOwned() {
    for (const { item, edition } of latestUnowned) {
      if (!selection(item, edition).owned) toggleOwned(item, edition);
    }
  }
  function updateCopy(item: Entry, edition: ReviewEdition, copy: string) {
    editableSelection(item, edition).copy = copy;
  }
  function setCategory(next: Category) {
    // Retain the outgoing results without rebuilding hidden cards when search is cleared.
    categoryResults = {
      ...categoryResults,
      [category]: visible,
      [next]: categoryResults[next] ?? (catalog.byCategory.get(next) ?? []).slice(0, categoryLimits[next] ?? catalogBatchSize),
    };
    category = next;
    selectedTags = [];
  }
  function changeCategory(next: Category) {
    setCategory(next);
    setQuery("");
  }
  function swipeCategory(direction: SwipeDirection) {
    const index = categories.findIndex((option) => option.id === category);
    const offset = direction === "left" ? 1 : -1;
    const next = categories[(index + offset + categories.length) % categories.length];
    changeCategory(next.id);
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
  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag];
    updateCatalogUrl();
  }
  function clearSearch() {
    selectedTags = [];
    setQuery("");
    status = "all";
  }
  function toggleStatus(next: "owned" | "wishlist") {
    status = status === next ? "all" : next;
  }
  function owners(item: Entry, edition: ReviewEdition) {
    return (coverage.get(item.id) ?? []).filter((reference) => !reference.edition || reference.edition === edition.v);
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

  <section class="stats" aria-label="Collection totals">
    <button class="stat-owned" type="button" aria-pressed={status === "owned"} onclick={() => toggleStatus("owned")}>
      <span class="stat-label">
        Owned<span class="stat-icon control-icon i-material-symbols:inventory-2-outline-sharp" aria-hidden="true"></span>
      </span>
      <strong>{ownedCount}</strong>
    </button>
    <div class="stat-value">
      <strong>{formatPrice(collectionValue)}</strong>
    </div>
    <button class="stat-wishlist" type="button" aria-pressed={status === "wishlist"} onclick={() => toggleStatus("wishlist")}>
      <span class="stat-label"
        ><span class="stat-icon control-icon i-material-symbols:favorite-outline" aria-hidden="true"></span>Wishlist</span
      >
      <strong>{wishlistCount}</strong>
    </button>
  </section>

  <nav class="categories" aria-label="Catalog categories" {@attach observeCategories}>
    {@render categoryButtons()}
  </nav>
  <nav class={["swipe-tabs", showSwipeTabs && "is-visible"]} aria-label="Catalog categories while swiping" inert={!showSwipeTabs}>
    {@render categoryButtons()}
  </nav>

  <div class="catalog-filters">
    <div class={["search-controls", selectedTags.length > 0 && selectedTags.length <= 2 && "is-inline"]}>
      <div class="search-heading">
        <label class="search" for="catalog-search">Search catalog</label>
        {#if hasSearch}
          <button class="search-command" type="button" onclick={markLatestOwned} disabled={!latestUnowned.length}>
            Mark latest editions owned
          </button>
        {/if}
        <button class="search-command" type="button" onclick={clearSearch} disabled={!query && !selectedTags.length && status === "all"}>
          Clear search
        </button>
        <p class="results">{filtered.length} items</p>
      </div>
      <div class="search-row">
        <div class="search-field">
          <input
            id="catalog-search"
            type="search"
            bind:this={searchInput}
            bind:value={() => query, setQuery}
            aria-keyshortcuts="/ Control+k Meta+k"
            aria-describedby="search-shortcut"
            placeholder="Name, alias, or tag"
          />
          <span id="search-shortcut" class={["shortcut", query && "is-hidden"]}>
            <span class="visually-hidden">Press </span><kbd>/</kbd><span class="visually-hidden"> to focus search</span>
          </span>
        </div>
        {#if selectedTags.length}
          <section class="tag-filters" aria-label="Selected tags">
            {#each selectedTags as tag (tag)}
              <button class="active-tag" type="button" aria-label="Remove {reviewTagLabel(tag)} filter" onclick={() => toggleTag(tag)}>
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
            aria-label={allCollapsed ? "Expand all" : "Collapse all"}
            disabled={!entries.length}
            onclick={toggleAllCards}
          >
            <span
              class={[
                "collapse-icon",
                "control-icon",
                allCollapsed ? "i-material-symbols:unfold-more-double" : "i-material-symbols:unfold-less-double",
              ]}
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>
    <div class="tag-body" id="tag-browser" hidden={!tagsOpen}>
      {#if tagsOpen}
        {#if cloudTags.length}
          <fieldset class="tag-cloud">
            <legend class="visually-hidden">Filter by tags</legend>
            {#each cloudTags as option (option.tag)}
              {@render tagButton(option.tag, tagWeight(option.count, tags[0]?.count ?? 0))}
            {/each}
          </fieldset>
        {/if}
        {#if category === "content" && allTags.length}
          <details class="more-tags" bind:open={allTagsOpen}>
            <summary class="more-heading"
              >All tags<span class="more-chevron control-icon i-material-symbols:expand-more" aria-hidden="true"></span></summary
            >
            {#if allTagsOpen}
              <fieldset class="tag-list">
                <legend class="visually-hidden">All tags</legend>
                {#each allTags as option (option.tag)}
                  {@render tagButton(option.tag)}
                {/each}
              </fieldset>
            {/if}
          </details>
        {/if}
        {#if !tags.length}<p>No tags are listed for this category.</p>{/if}
      {/if}
    </div>
  </div>

  <div class="catalog-viewport">
    <div class={["catalog-content", dragDistance !== 0 && "is-dragging"]} style:--drag-distance={`${dragDistance}px`}>
      {#each categories as option (option.id)}
        {#if categoryResults[option.id]}
          {@const items = option.id === category ? visible : categoryResults[option.id]!}
          <!-- Keep visited cards mounted so category changes preserve their controls and deferred bodies. -->
          <div data-category={option.id} hidden={option.id !== category}>
            {#if !items.length}
              <p class="empty">No items match. Try another search, tag, category, or ownership filter.</p>
            {:else}
              <div class="cards">
                {#each items as item, index (item.id)}
                  <CollectionCard
                    {item}
                    {catalog}
                    ready={index < 6 || !!rendered[item.id]}
                    collapsed={!!collapsed[item.id]}
                    selected={selectedEdition(item)}
                    feedback={ownershipFeedback?.item === item.id ? ownershipFeedback.kind : undefined}
                    {selectedTags}
                    bind:contentsOpen
                    getSelection={(edition) => selection(item, edition)}
                    getOwners={(edition) => owners(item, edition)}
                    observe={observeCard(item)}
                    onToggle={() => toggleCard(item)}
                    onHold={() => holdCard(item)}
                    onOwnership={() => tapOwnership(item)}
                    onHoldOwnership={() => holdOwnership(item)}
                    onEditionSelect={(edition) => selectEdition(item, edition)}
                    onOwnedChange={(edition) => toggleOwned(item, edition)}
                    onWishChange={(edition) => toggleWish(item, edition)}
                    onCopyChange={(edition, copy) => updateCopy(item, edition, copy)}
                    onTagClick={toggleTag}
                  />
                {/each}
              </div>
              {#if option.id === category && items.length < filtered.length}
                <div class="catalog-more">
                  <p>{category === "content" ? "Gameplay items first. " : ""}Showing {items.length} of {filtered.length} items.</p>
                  <button class="show-more" type="button" onclick={showMoreItems}>Show {nextCount} more</button>
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <footer>Preview selections reset when this page reloads. Your saved collection is unchanged.</footer>
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
    <button class="category-tab" type="button" aria-pressed={category === option.id} onclick={() => changeCategory(option.id)}
      >{option.label}</button
    >
  {/each}
  <span class="tab-highlight" aria-hidden="true"></span>
{/snippet}

{#snippet tagButton(tag: string, weight = 0)}
  {@const selected = selectedTags.includes(tag)}
  <button
    class="cloud-tag"
    type="button"
    aria-pressed={selected}
    disabled={!selected && !tagCounts.get(tag)}
    style:--tag-weight={weight}
    onclick={() => toggleTag(tag)}>{reviewTagLabel(tag)}</button
  >
{/snippet}

<style>
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
