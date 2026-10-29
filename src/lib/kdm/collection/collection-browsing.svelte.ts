import {
  reviewEditions,
  reviewGameplayFirst,
  reviewTagCounts,
  reviewTagLabel,
  type CatalogEntry,
  type CatalogIndex,
} from "#lib/catalog-view.ts";
import type { EntryState } from "#lib/types/index.ts";
import { categories, formatCollectionHash, type Category, type CollectionView } from "./url.ts";

type Status = "all" | "owned" | "wishlist";
type EditionReader = (item: string, edition: string) => Pick<EntryState, "owned" | "wished">;
type Navigation = { current: () => CollectionView; replace: (view: CollectionView) => void };
const batchSize = 100;
const searchUrlDelay = 250;

/**
 * Owns browsing transitions; the page supplies navigation and reactive edition reads, never persistence.
 * Arrow fields retain this when passed to Svelte or timers; other operations use ordinary methods.
 */
export class CollectionBrowsing {
  #catalog: CatalogIndex;
  #getEdition: EditionReader;
  #navigation: Navigation;
  #content: CatalogEntry[];
  #category = $state<Category>("content");
  #query = $state("");
  #selectedTags = $state.raw<string[]>([]);
  #status = $state<Status>("all");
  #limits = $state<Partial<Record<Category, number>>>({});
  #resultLimit = $state(batchSize);
  #retained = $state.raw<Partial<Record<Category, CatalogEntry[]>>>({});
  #urlTimer: Timeout;

  constructor(catalog: CatalogIndex, getEdition: EditionReader, navigation: Navigation) {
    this.#catalog = catalog;
    this.#getEdition = getEdition;
    this.#navigation = navigation;
    this.#content = reviewGameplayFirst(catalog.byCategory.get("content") ?? []);
    this.#retained = { content: this.#content.slice(0, batchSize) };
  }

  get category() {
    return this.#category;
  }
  get query() {
    return this.#query;
  }
  get selectedTags() {
    return this.#selectedTags;
  }
  get status() {
    return this.#status;
  }

  #searchQuery = $derived(this.#query.trim().toLowerCase());
  #categoryEntries = $derived.by(() =>
    this.#category === "content" ? this.#content : (this.#catalog.byCategory.get(this.#category) ?? []),
  );
  #tags = $derived.by(() => this.#catalog.tags.get(this.#category) ?? []);
  #cloudTags = $derived.by(() => (this.#category === "content" ? (this.#catalog.tagViews.get(this.#category)?.cloud ?? []) : this.#tags));
  #allTags = $derived.by(() => this.#catalog.tagViews.get(this.#category)?.all ?? []);
  #hasSearch = $derived(!!this.#searchQuery || this.#selectedTags.length > 0);
  #unfiltered = $derived(!this.#hasSearch && this.#status === "all");
  // Tag candidates remain stable while the text query changes.
  #tagged = $derived(
    this.#selectedTags.length
      ? this.#categoryEntries.filter((item) => this.#selectedTags.every((tag) => item.tags.includes(tag)))
      : this.#categoryEntries,
  );
  #filtered = $derived.by(() => {
    const query = this.#searchQuery;
    const status = this.#status;
    if (!query && status === "all") return this.#tagged;
    return this.#tagged.filter((item) => {
      if (query && !this.#catalog.search.get(item.id)?.includes(query)) return false;
      if (status === "all") return true;
      const field = status === "owned" ? "owned" : "wished";
      return reviewEditions(item).some((edition) => this.#getEdition(item.id, edition.id)[field]);
    });
  });
  #limit = $derived(this.#unfiltered ? (this.#limits[this.#category] ?? batchSize) : this.#resultLimit);
  #visible = $derived(this.#filtered.slice(0, this.#limit));
  #latestUnowned = $derived(
    this.#filtered.flatMap((item) => {
      const edition = reviewEditions(item).at(-1);
      return edition && !edition.includedOnly && !this.#getEdition(item.id, edition.id).owned ? [{ item, edition }] : [];
    }),
  );
  #tagCounts = $derived.by(() => {
    if (this.#filtered === this.#categoryEntries) return this.#catalog.tagViews.get(this.#category)?.counts ?? new Map<string, number>();
    return reviewTagCounts(this.#filtered);
  });
  #panels = $derived(
    categories.flatMap((option) => {
      const retained = this.#retained[option.id];
      return retained ? [{ ...option, items: option.id === this.#category ? this.#visible : retained }] : [];
    }),
  );

  get tags() {
    return this.#tags;
  }
  get cloudTags() {
    return this.#cloudTags;
  }
  get allTags() {
    return this.#allTags;
  }
  get hasSearch() {
    return this.#hasSearch;
  }
  get filtered() {
    return this.#filtered;
  }
  get visible() {
    return this.#visible;
  }
  get nextCount() {
    return Math.min(batchSize, this.#filtered.length - this.#visible.length);
  }
  get latestUnowned() {
    return this.#latestUnowned;
  }
  get tagCounts() {
    return this.#tagCounts;
  }
  /** Keep these panels keyed and mounted, hiding inactive ones to preserve their card controls. */
  get panels() {
    return this.#panels;
  }

  /** Restore navigation without writing back or letting a pending search overwrite the destination. */
  restore(view: CollectionView) {
    this.cancelPendingUrl();
    const tags = this.#catalog.tags.get(view.category) ?? [];
    const selected = [...new Set(view.tags)].filter((tag) => tags.some((value) => value.tag === tag));
    // Our own URL updates must preserve expanded result batches and retained card state.
    if (
      view.category === this.#category &&
      view.query === this.#query &&
      selected.length === this.#selectedTags.length &&
      selected.every((tag, index) => tag === this.#selectedTags[index])
    )
      return;
    this.#setCategory(view.category);
    this.#query = view.query;
    this.#setTags(selected);
  }

  cancelPendingUrl() {
    clearTimeout(this.#urlTimer);
    this.#urlTimer = undefined;
  }

  #writeUrl = () => {
    this.cancelPendingUrl();
    const view = { category: this.#category, query: this.#query, tags: this.#selectedTags };
    if (formatCollectionHash(view) !== formatCollectionHash(this.#navigation.current())) this.#navigation.replace(view);
  };

  #setTags(tags: string[]) {
    this.#selectedTags = tags;
    this.#resultLimit = batchSize;
  }

  setQuery = (value: string) => {
    if (value.trim().toLowerCase() !== this.#searchQuery) this.#resultLimit = batchSize;
    this.#query = value;
    this.cancelPendingUrl();
    if (value) this.#urlTimer = setTimeout(this.#writeUrl, searchUrlDelay);
    else this.#writeUrl();
  };

  #setCategory(next: Category) {
    if (next === this.#category) return;
    // Capture outgoing results before clearing filters so hidden cards are not rebuilt.
    this.#retained = {
      ...this.#retained,
      [this.#category]: this.#visible,
      [next]: this.#retained[next] ?? (this.#catalog.byCategory.get(next) ?? []).slice(0, this.#limits[next] ?? batchSize),
    };
    this.#category = next;
  }

  changeCategory(next: Category) {
    this.#setCategory(next);
    this.#setTags([]);
    this.#writeUrl();
  }

  toggleTag = (tag: string) => {
    if (!this.#tags.some((value) => value.tag === tag)) return;
    this.#setTags(this.#selectedTags.includes(tag) ? this.#selectedTags.filter((value) => value !== tag) : [...this.#selectedTags, tag]);
    this.#writeUrl();
  };

  removeLastTag() {
    this.#setTags(this.#selectedTags.slice(0, -1));
    this.#writeUrl();
  }

  acceptTagQuery() {
    const match =
      this.#tags.find(({ tag }) => tag.toLowerCase() === this.#searchQuery) ??
      this.#tags.find(({ tag }) => reviewTagLabel(tag).toLowerCase() === this.#searchQuery);
    if (!match) return false;
    if (!this.#selectedTags.includes(match.tag)) this.#setTags([...this.#selectedTags, match.tag]);
    this.setQuery("");
    return true;
  }

  clearSearch = () => {
    this.#setTags([]);
    this.#status = "all";
    this.setQuery("");
  };

  toggleStatus(next: Exclude<Status, "all">) {
    this.#status = this.#status === next ? "all" : next;
    this.#resultLimit = batchSize;
  }

  showMoreItems = () => {
    const limit = Math.min(this.#limit + batchSize, this.#filtered.length);
    if (this.#unfiltered) {
      this.#limits[this.#category] = limit;
    } else {
      this.#resultLimit = limit;
    }
  };
}
