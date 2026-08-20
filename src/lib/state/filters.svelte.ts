import { createContext } from "svelte";
import { defaultFilters } from "#lib/kdm-data.ts";
import type { Filters, KindFilter, StatusFilter } from "#lib/types.ts";

function createDefaultFilters(): Filters {
  return { ...defaultFilters, tags: [...defaultFilters.tags] };
}

export class FilterState {
  value = $state<Filters>(createDefaultFilters());

  set<K extends keyof Filters>(key: K, value: Filters[K]) {
    this.value = { ...this.value, [key]: value };
  }

  reset(preserveQuery = false) {
    const query = preserveQuery ? this.value.query : defaultFilters.query;
    this.value = { ...createDefaultFilters(), query };
  }

  toggleTag(tag: string) {
    this.set("tags", this.value.tags.includes(tag) ? this.value.tags.filter((t) => t !== tag) : [...this.value.tags, tag]);
  }

  toggleKind(kind: Exclude<KindFilter, "any">) {
    this.set("kind", this.value.kind === kind ? "any" : kind);
  }

  toggleGameplay(gameplay: boolean) {
    const next = gameplay ? "gameplay" : "models";
    this.set("gameplay", this.value.gameplay === next ? "any" : next);
  }

  toggleStatus(status: Extract<StatusFilter, "owned" | "wishlisted">) {
    this.set("status", this.value.status === status ? "any" : status);
  }
}

export const [getFilterState, setFilterState] = createContext<FilterState>();

export function createFilterState() {
  const filters = new FilterState();
  setFilterState(filters);
  return filters;
}
