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

<section aria-label="Collection totals">
  <div class="totals">
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
  <div class="meter" title="{pct}%">
    <div class="owned" style:--progress={`${pct}%`}></div>
    <div class="wishlist" style:--progress={`${wishPct}%`}></div>
  </div>
</section>

<style>
  section {
    z-index: 1;
    position: sticky;
    inset-block-start: 0;
    background: var(--panel);
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meter {
    display: flex;
    justify-content: space-between;
    overflow: hidden;
    block-size: 2px;
  }

  :is(.owned, .wishlist) {
    inline-size: var(--progress);
    block-size: 100%;
    transition: inline-size var(--duration-fast) var(--ease-standard);
  }

  .owned {
    background: var(--accent);
  }

  .wishlist {
    background: var(--accent-red);
  }
</style>
