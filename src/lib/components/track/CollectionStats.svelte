<script lang="ts">
  import { formatPrice } from "#lib/kdm-data.ts";
  import { getFilterState } from "#lib/state/filters.svelte.ts";
  import Stat from "./Stat.svelte";

  type Props = {
    ownedCount: number;
    totalCount: number;
    ownedValue: number;
    wishlistCount: number;
    wishlistValue: number;
  };

  let { ownedCount, totalCount, ownedValue, wishlistCount, wishlistValue }: Props = $props();

  const filters = getFilterState();

  const pct = $derived(totalCount ? Math.round((ownedCount / totalCount) * 100) : 0);
  const wishPct = $derived(totalCount ? Math.round((wishlistCount / totalCount) * 100) : 0);
</script>

<section aria-label="Collection totals" class=" bg-panel sticky top-0 z-1 overflow-hidden">
  <div class="grid grid-cols-2">
    <Stat
      pos="left"
      label="Owned"
      count={ownedCount}
      value={formatPrice(ownedValue)}
      active={filters.value.status === "owned"}
      onclick={() => filters.toggleStatus("owned")}
    />
    <Stat
      pos="right"
      label="Wishlist"
      count={wishlistCount}
      value={formatPrice(wishlistValue)}
      active={filters.value.status === "wishlisted"}
      onclick={() => filters.toggleStatus("wishlisted")}
    />
  </div>
  <div class="h-2px flex justify-between overflow-hidden" title="{pct}%">
    <div class="bg-accent h-full transition-all" style:width="{pct}%"></div>
    <div class="bg-secondary h-full transition-all" style:width="{wishPct}%"></div>
  </div>
</section>
