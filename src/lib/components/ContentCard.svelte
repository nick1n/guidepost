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

<li
  class={[
    "bg-card relative overflow-hidden border-2 bg-clip-padding transition-colors",
    owned ? "border-accent" : "border-transparent",
    isBeta ? "" : "rounded-2xl",
  ]}
>
  {#if isBeta}
    <div class="bg-beta pointer-events-none absolute top-4 -left-10 h-4 w-32 rotate-135 py-1" aria-hidden={true}></div>
  {/if}

  <div
    class="bg-panel flex cursor-pointer items-start gap-3 py-3 pl-3"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${item.name} as owned`}
    onclick={() => collection.toggleOwned(item.id, { version: item.versions?.at(-1)?.v, edition: item.editions?.at(-1)?.v })}
    {onkeydown}
  >
    <OwnedCheckbox checked={owned} onchange={() => collection.toggleOwned(item.id)} label={item.name} />
    <div class="min-w-0 flex-1">
      <h3 class="font-display truncate text-2xl leading-tight font-semibold">
        {item.name}
      </h3>
      {#if item.alt}
        <p class="text-foreground/60 mt-1 truncate">{item.alt}</p>
      {/if}
    </div>
    {#if !owned}
      <WishlistButton active={!!entry.wishlisted} onchange={() => collection.toggleWishlisted(item.id)} label={item.name} />
    {/if}
  </div>

  <div class="flex flex-col gap-3 px-3 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-accent tabular-nums">{formatPrice(price)}</span>
      <span class="bg-border h-5 w-px" aria-hidden={true}></span>
      <Pill tone={item.gameplay ? "accent" : "outline"} onclick={() => filters.toggleGameplay(item.gameplay)}>
        {item.gameplay ? "Gameplay" : "Models only"}
      </Pill>
      <Pill tone="neutral" onclick={() => filters.toggleKind(item.kind)}>{item.kind}</Pill>
      {#if url}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent ml-auto inline-flex items-center gap-1 px-2 py-1 underline-offset-4 hover:underline"
        >
          Shop <span class="i-material-symbols:open-in-new size-4" aria-hidden="true"></span>
          <span class="sr-only">page for {item.name}</span>
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
      <div
        class={[
          "bg-destructive -mx-3 -mb-3 flex items-center gap-2 px-3 py-1 leading-relaxed",
          requiresOwned ? "text-muted-foreground" : "text-foreground",
        ]}
      >
        <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-black font-bold text-white">
          {#if requiresOwned}
            <span class="i-material-symbols:check text-accent size-3" aria-hidden="true"></span>
          {:else}
            <span class="i-material-symbols:lock size-3" aria-hidden="true"></span>
          {/if}
        </span>
        <span class="font-bold">{item.requires.map((r) => nameById[r]?.replace(/ expansion/gi, "") ?? r).join(", ")}</span>
        <span>Required</span>
      </div>
    {/if}
  </div>
</li>
