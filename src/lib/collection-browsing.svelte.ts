import { reviewEditions, reviewGameplayFirst, reviewTagLabel, reviewTags, type reviewIndex } from "#lib/catalog-view.ts";
import type { EntryState } from "#lib/types/index.ts";

export const browseCategories = [
  { id: "content", label: "Content" },
  { id: "accessories", label: "Accessories" },
  { id: "bundles", label: "Bundles" },
  { id: "homebrew", label: "Homebrew" },
] as const;

type Category = (typeof browseCategories)[number]["id"];
type Catalog = ReturnType<typeof reviewIndex>;
type Entry = Catalog["entries"][number];
type Status = "all" | "owned" | "wishlist";
type EditionReader = (item: string, edition: string) => Pick<EntryState, "owned" | "wished">;
type BrowseUrl = { href: string; searchParams: Pick<URLSearchParams, "get" | "getAll"> };
type Navigation = { current: () => BrowseUrl; replace: (url: URL) => void };
const batchSize = 100;
const searchUrlDelay = 250;

/** Owns browsing transitions; the page supplies navigation and reactive edition reads, never persistence. */
export class CollectionBrowsing {
  #catalog: Catalog;
  #getEdition: EditionReader;
  #navigation: Navigation;
  #content: Entry[];
  #category = $state<Category>("content");
  #query = $state("");
  #selectedTags = $state.raw<string[]>([]);
  #status = $state<Status>("all");
  #limits = $state<Partial<Record<Category, number>>>({});
  #retained = $state.raw<Partial<Record<Category, Entry[]>>>({});
  #urlTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(catalog: Catalog, getEdition: EditionReader, navigation: Navigation) {
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
  #limited = $derived(!this.#hasSearch && this.#status === "all");
  #filtered = $derived.by(() => {
    if (this.#limited) return this.#categoryEntries;
    return this.#categoryEntries.filter((item) => {
      if (!this.#selectedTags.every((tag) => item.tags.includes(tag))) return false;
      if (this.#searchQuery && !this.#catalog.search.get(item.id)?.includes(this.#searchQuery)) return false;
      if (this.#status === "owned" && !reviewEditions(item).some((edition) => this.#getEdition(item.id, edition.id).owned)) return false;
      if (this.#status === "wishlist" && !reviewEditions(item).some((edition) => this.#getEdition(item.id, edition.id).wished))
        return false;
      return true;
    });
  });
  #visible = $derived(this.#limited ? this.#filtered.slice(0, this.#limits[this.#category] ?? batchSize) : this.#filtered);
  #latestUnowned = $derived(
    this.#filtered.flatMap((item) => {
      const edition = reviewEditions(item).at(-1);
      return edition && edition.standalone !== false && !this.#getEdition(item.id, edition.id).owned ? [{ item, edition }] : [];
    }),
  );
  #tagCounts = $derived.by(() => {
    if (this.#filtered === this.#categoryEntries) return this.#catalog.tagViews.get(this.#category)?.counts ?? new Map<string, number>();
    return new Map(reviewTags(this.#filtered).map(({ tag, count }) => [tag, count]));
  });
  #panels = $derived(
    browseCategories.flatMap((option) => {
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
  restore = (url: BrowseUrl) => {
    this.cancelPendingUrl();
    const category = browseCategories.find(({ id }) => id === url.searchParams.get("cat"))?.id ?? "content";
    this.#setCategory(category);
    this.#query = url.searchParams.get("q") ?? "";
    const tags = this.#catalog.tags.get(category) ?? [];
    this.#selectedTags = [...new Set(url.searchParams.getAll("tag"))].filter((tag) => tags.some((value) => value.tag === tag));
  };

  cancelPendingUrl = () => {
    clearTimeout(this.#urlTimer);
    this.#urlTimer = undefined;
  };

  #writeUrl = () => {
    this.cancelPendingUrl();
    const current = this.#navigation.current();
    const url = new URL(current.href);
    if (this.#category === "content") url.searchParams.delete("cat");
    else url.searchParams.set("cat", this.#category);
    if (this.#query) url.searchParams.set("q", this.#query);
    else url.searchParams.delete("q");
    url.searchParams.delete("tag");
    for (const tag of this.#selectedTags) url.searchParams.append("tag", tag);
    if (url.href !== current.href) this.#navigation.replace(url);
  };

  setQuery = (value: string) => {
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
    this.#selectedTags = [];
  }

  changeCategory = (next: Category) => {
    this.#setCategory(next);
    this.#selectedTags = [];
    this.setQuery("");
  };

  toggleTag = (tag: string) => {
    if (!this.#tags.some((value) => value.tag === tag)) return;
    this.#selectedTags = this.#selectedTags.includes(tag)
      ? this.#selectedTags.filter((value) => value !== tag)
      : [...this.#selectedTags, tag];
    this.#writeUrl();
  };

  removeLastTag = () => {
    this.#selectedTags = this.#selectedTags.slice(0, -1);
    this.#writeUrl();
  };

  acceptTagQuery = () => {
    const match =
      this.#tags.find(({ tag }) => tag.toLowerCase() === this.#searchQuery) ??
      this.#tags.find(({ tag }) => reviewTagLabel(tag).toLowerCase() === this.#searchQuery);
    if (!match) return false;
    if (!this.#selectedTags.includes(match.tag)) this.#selectedTags = [...this.#selectedTags, match.tag];
    this.setQuery("");
    return true;
  };

  clearSearch = () => {
    this.#selectedTags = [];
    this.#status = "all";
    this.setQuery("");
  };

  toggleStatus = (next: Exclude<Status, "all">) => {
    this.#status = this.#status === next ? "all" : next;
  };

  showMoreItems = () => {
    this.#limits[this.#category] = Math.min((this.#limits[this.#category] ?? batchSize) + batchSize, this.#categoryEntries.length);
  };
}
