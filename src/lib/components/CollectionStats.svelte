<script lang="ts">
  import { formatPrice } from "$lib/kdm-data";
  import Stat from "./Stat.svelte";

  type Props = {
    ownedCount: number;
    totalCount: number;
    ownedValue: number;
    wishlistCount: number;
    wishlistValue: number;
  };

  let {
    ownedCount,
    totalCount,
    ownedValue,
    wishlistCount,
    wishlistValue,
  }: Props = $props();

  const pct = $derived(
    totalCount ? Math.round((ownedCount / totalCount) * 100) : 0,
  );
  const wishPct = $derived(
    totalCount ? Math.round((wishlistCount / totalCount) * 100) : 0,
  );
</script>

<section
  aria-label="Collection totals"
  class=" top-0 sticky overflow-hidden bg-panel z-1"
>
  <div class="flex items-end justify-between gap-4 py-2 px-3">
    <Stat pos="left" label="Owned" value={`${ownedCount}`} />
    <Stat pos="center" label="Value" value={formatPrice(ownedValue)} accent />
    <Stat
      pos="right"
      label="Wishlist"
      value={`${wishlistCount} · ${formatPrice(wishlistValue)}`}
    />
  </div>
  <div class="flex justify-between h-1 overflow-hidden" title="{pct}%">
    <div class="h-full bg-accent transition-all" style:width="{pct}%"></div>
    <div
      class="h-full bg-amber-600 transition-all"
      style:width="{wishPct}%"
    ></div>
  </div>
</section>
