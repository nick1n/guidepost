<script lang="ts">
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import VersionPicker from "./VersionPicker.svelte";
  import EditionPicker from "./EditionPicker.svelte";
  import TagRail from "./TagRail.svelte";
  import Pill from "./Pill.svelte";
  import { effectivePrice, formatPrice, nameById, storeUrl } from "#lib/kdm-data.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { getFilterState } from "#lib/state/filters.svelte.ts";
  import type { ContentItem } from "#lib/types/index.ts";

  type Props = {
    item: ContentItem;
  };

  let { item }: Props = $props();

  const filters = getFilterState();

  const entry = $derived(collection.get(item.id));
  const requiresOwned = $derived((item.requires ?? []).every((id) => collection.state[id]?.owned));
  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(item.url));
  const isBeta = $derived(!!item.editions);
  const price = $derived(effectivePrice(item, entry.versions ?? [], entry.editions ?? []));

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    collection.toggleOwned(item.id, { version: item.versions?.at(-1)?.v, edition: item.editions?.at(-1)?.v });
  }
</script>

<li class="card" data-owned={owned} data-beta={isBeta}>
  {#if isBeta}
    <div class="beta-ribbon" aria-hidden={true}></div>
  {/if}

  <div
    class="header"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${item.name} as owned`}
    onclick={() => collection.toggleOwned(item.id, { version: item.versions?.at(-1)?.v, edition: item.editions?.at(-1)?.v })}
    {onkeydown}
  >
    <OwnedCheckbox checked={owned} onchange={() => collection.toggleOwned(item.id)} label={item.name} --layer-control="1" />
    <div class="summary">
      <h3>
        {item.name}
      </h3>
      {#if item.alt}
        <p>{item.alt}</p>
      {/if}
    </div>
    {#if !owned}
      <WishlistButton active={!!entry.wishlisted} onchange={() => collection.toggleWishlisted(item.id)} label={item.name} />
    {/if}
  </div>

  <div class="body">
    <div class="details">
      <span class="price">{formatPrice(price)}</span>
      <span class="divider" aria-hidden={true}></span>
      <Pill tone={item.gameplay ? "accent" : "outline"} onclick={() => filters.toggleGameplay(item.gameplay)}>
        {item.gameplay ? "Gameplay" : "Models only"}
      </Pill>
      <Pill tone="neutral" onclick={() => filters.toggleKind(item.kind)}>{item.kind}</Pill>
      {#if url}
        <a href={url} target="_blank" rel="noopener noreferrer" class="store">
          Shop <span class="external-icon i-material-symbols:open-in-new" aria-hidden="true"></span>
          <span class="store-label">page for {item.name}</span>
        </a>
      {/if}
    </div>

    <TagRail tags={item.tags} onTagClick={(tag) => filters.toggleTag(tag)} />

    {#if isBeta && item.editions}
      <EditionPicker
        editions={item.editions}
        value={entry.editions}
        copyNumbers={entry.editionNumbers}
        onselect={(edition) => collection.setEdition(item.id, edition)}
        onSetCopyNumber={(edition, number) => collection.setEditionNumber(item.id, edition, number)}
      />
    {/if}

    {#if item.versions}
      <VersionPicker versions={item.versions} value={entry.versions} onselect={(version) => collection.setVersion(item.id, version)} />
    {/if}

    {#if item.requires && item.requires.length > 0}
      <div class="requirement" data-satisfied={requiresOwned}>
        <span class="requirement-mark">
          {#if requiresOwned}
            <span class="requirement-icon i-material-symbols:check" style:--icon-color="var(--accent)" aria-hidden="true"></span>
          {:else}
            <span class="requirement-icon i-material-symbols:lock" style:--icon-color="var(--contrast-foreground)" aria-hidden="true"
            ></span>
          {/if}
        </span>
        <span class="requirement-name">{item.requires.map((r) => nameById[r]?.replace(/ expansion/gi, "") ?? r).join(", ")}</span>
        <span>Required</span>
      </div>
    {/if}
  </div>
</li>

<style>
  .card {
    position: relative;
    overflow: hidden;
    border: var(--border-size) solid transparent;
    background: var(--card);
    background-clip: padding-box;
    transition: border-color var(--duration-fast) var(--ease-standard);

    &[data-owned="true"] {
      border-color: var(--accent);
    }

    &:not([data-beta="true"]) {
      border-radius: var(--radius-card);
    }
  }

  .beta-ribbon {
    position: absolute;
    inset-block-start: 1rem;
    inset-inline-start: -2.5rem;
    inline-size: 8rem;
    block-size: 1rem;
    rotate: 135deg;
    background: var(--beta);
    pointer-events: none;
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-block: 0.75rem;
    padding-inline-start: 0.75rem;
    background: var(--panel);
    cursor: pointer;

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: calc(-1 * var(--border-size));
    }
  }

  .summary {
    flex: 1;
    min-inline-size: 0;
  }

  h3,
  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h3 {
    font-weight: var(--font-semibold);
    font-size: var(--text-card-title);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
  }

  p {
    margin-block-start: 0.25rem;
    color: color-mix(var(--foreground) 60%, transparent);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .details {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .price {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .divider {
    inline-size: 1px;
    block-size: 1.25rem;
    background: var(--border);
  }

  .store {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-inline-start: auto;
    padding: 0.25rem 0.5rem;
    color: var(--accent);
    text-underline-offset: 0.25rem;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }

  .external-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }

  .store-label {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .requirement {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-inline: -0.75rem;
    margin-block-end: -0.75rem;
    padding: 0.25rem 0.75rem;
    background: var(--destructive);
    color: var(--foreground);
    line-height: 1.625;

    &[data-satisfied="true"] {
      color: var(--muted-foreground);
    }
  }

  .requirement-mark {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: 50%;
    background: var(--contrast);
    color: var(--contrast-foreground);
    font-weight: var(--font-bold);
  }

  .requirement-icon {
    display: inline-block;
    inline-size: 0.75rem;
    block-size: 0.75rem;
    color: var(--icon-color);
  }

  .requirement-name {
    font-weight: var(--font-bold);
  }
</style>
