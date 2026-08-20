<script lang="ts">
  import { formatPrice } from "#lib/kdm-data.ts";
  import type { StatusFilter } from "#lib/filters.ts";
  import Stat from "./Stat.svelte";

  type Props = {
    ownedCount: number;
    totalCount: number;
    ownedValue: number;
    wishlistCount: number;
    wishlistValue: number;
    status: StatusFilter;
    onownedclick: () => void;
    onwishlistclick: () => void;
  };

  let { ownedCount, totalCount, ownedValue, wishlistCount, wishlistValue, status, onownedclick, onwishlistclick }: Props = $props();

  const pct = $derived(totalCount ? Math.round((ownedCount / totalCount) * 100) : 0);
  const wishPct = $derived(totalCount ? Math.round((wishlistCount / totalCount) * 100) : 0);
</script>

<section aria-label="Collection totals" class=" bg-panel sticky top-0 z-1 overflow-hidden">
  <div class="grid grid-cols-2">
    <Stat pos="left" label="Owned" count={ownedCount} value={formatPrice(ownedValue)} active={status === "owned"} onclick={onownedclick} />
    <Stat
      pos="right"
      label="Wishlist"
      count={wishlistCount}
      value={formatPrice(wishlistValue)}
      active={status === "wishlisted"}
      onclick={onwishlistclick}
    />
  </div>
  <div class="h-2px flex justify-between overflow-hidden" title="{pct}%">
    <div class="bg-accent h-full transition-all" style:width="{pct}%"></div>
    <div class="bg-secondary h-full transition-all" style:width="{wishPct}%"></div>
  </div>
</section>
