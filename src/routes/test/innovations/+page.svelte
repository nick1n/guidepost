<script lang="ts">
  import { resolve } from "$app/paths";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import type { KdIconName } from "#lib/constants.ts";
  import { pluralize } from "#lib/helpers.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const sources: Record<string, { label: string; icon: KdIconName }> = {
    "flower-knight": { label: "Flower Knight", icon: "monster-flower-knight" },
    spidicules: { label: "Spidicules", icon: "monster-spidicules" },
  };

  function tiltOnHover(slot: HTMLDivElement) {
    const canTilt = window.matchMedia("(any-hover: hover) and (prefers-reduced-motion: no-preference)");
    const listeners = new AbortController();
    const { signal } = listeners;

    slot.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType !== "mouse" || !canTilt.matches) return;

        const { left, top, width, height } = slot.getBoundingClientRect();
        const x = (event.clientX - left) / width - 0.5;
        const y = (event.clientY - top) / height - 0.5;
        slot.style.setProperty("--tilt-x", `${y * 4}deg`);
        slot.style.setProperty("--tilt-y", `${-x * 4}deg`);
      },
      { signal },
    );
    slot.addEventListener(
      "pointerleave",
      () => {
        slot.style.removeProperty("--tilt-x");
        slot.style.removeProperty("--tilt-y");
      },
      { signal },
    );

    return () => listeners.abort();
  }
</script>

<svelte:head>
  <title>Innovation cards | Guidepost</title>
</svelte:head>

<main>
  <a href={resolve("/")}>Back to Guidepost</a>
  <h1>Innovation cards</h1>

  <div class="cards">
    {#each data.cards as card (card.id)}
      {@const source = card.source ? sources[card.source] : undefined}
      <div class="card-slot" {@attach tiltOnHover}>
        <article aria-labelledby={card.id}>
          <header>
            {#if source}
              <span class="source-crest">
                <KdIcon i={source.icon} label={source.label} />
              </span>
            {/if}
            <h2 id={card.id}>{card.name}</h2>
            {#if card.keywords}
              <p class="keywords">{card.keywords}</p>
            {/if}
          </header>

          {#if card.artwork}
            <div class="art" aria-hidden="true">
              <span
                class={["illustration", card.artwork]}
                style:--artwork-rotation={card.artworkRotation}
                style:--artwork-scale={card.artworkScale}
              ></span>
            </div>
          {/if}

          {#if card.highlight}
            <p class="highlight">{@render rules(card.highlight)}</p>
          {/if}
          {#if card.description}
            <p class="passive">{@render rules(card.description)}</p>
          {/if}

          {#each card.actions as action (action.headingId)}
            <section class="action" aria-labelledby={action.headingId}>
              <h3 id={action.headingId}>
                {#if action.endeavors > 0}
                  <span class="cost" role="img" aria-label={pluralize(action.endeavors, "endeavor")}>
                    {#each Array.from({ length: action.endeavors }, (_, index) => index + 1) as token (token)}
                      <KdIcon i="endeavor" />
                    {/each}
                  </span>
                {/if}
                <span>{@render rules(action.name)}</span>
              </h3>
              {#if action.description}
                <p class="action-description">{@render rules(action.description)}</p>
              {/if}
              {#if action.prompts}
                <table aria-labelledby={action.headingId}>
                  <tbody>
                    {#each action.prompts as { position, label, text } (position)}
                      <tr>
                        <th scope="row">{label}</th>
                        <td>{@render rules(text)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {/if}
            </section>
          {/each}
        </article>
      </div>
    {/each}
  </div>
</main>

{#snippet rules(value: string)}
  {#each value.matchAll(/\*\*([^*]+)\*\*|\*([^*]+)\*|\[(?:reaction|story)\]|[^*\[]+|./gs) as match (match.index)}
    {@const [part, bold, italic] = match}
    {#if part === "[reaction]"}
      <KdIcon i="reflex" label="reaction" />
    {:else if part === "[story]"}
      <KdIcon i="story" label="story event" />
    {:else if bold}
      <strong>{bold}</strong>
    {:else if italic}
      <em>{italic}</em>
    {:else}
      {part}
    {/if}
  {/each}
{/snippet}

<style>
  main {
    min-block-size: var(--viewport-height);
    padding-inline: max(clamp(1.25rem, 4vw, 3rem), calc((100% - 60rem) / 2));
    padding-block: clamp(1rem, 3vw, 2.5rem);
    background: var(--background);
  }

  a {
    color: var(--muted-foreground);
    font-size: var(--text-md);

    &:is(:hover, :focus-visible) {
      color: var(--accent);
    }
  }

  h1 {
    margin-block: 0.5rem 1.25rem;
    font-weight: var(--font-bold);
    font-size: var(--text-2xl);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
    gap: 1rem;
  }

  .card-slot {
    display: grid;
  }

  article {
    --paper: color-mix(in oklch, var(--grey-1) 78%, var(--innovation-action));
    --art-ink: color-mix(in oklch, var(--grey-8) 76%, var(--innovation-highlight));
    --card-padding: 0.875rem;
    padding: var(--card-padding);
    transform: perspective(55rem);
    border-radius: var(--radius-card);
    background: linear-gradient(var(--paper), var(--grey-0) 45%, var(--paper));
    box-shadow: 0 0.75rem 1.5rem color-mix(var(--contrast) 35%, transparent);
    color: var(--grey-10);
    font-size: var(--text-md);
    line-height: 1.375;
    overflow-wrap: anywhere;
  }

  header {
    display: grid;
    position: relative;
    align-content: center;
    min-block-size: 2.875rem;
    text-align: center;

    &:has(.source-crest) {
      padding-inline: 2rem;
    }
  }

  h2 {
    font-weight: var(--font-bold);
    font-size: var(--text-card-title);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  .keywords {
    margin-block-start: 0.25rem;
    color: var(--grey-7);
    font-size: var(--text-sm);
    line-height: var(--line-height-snug);
  }

  .source-crest {
    display: grid;
    position: absolute;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 3rem;
    inset-block-start: calc(-1 * var(--card-padding));
    inset-inline-start: 0;
    padding-block-end: 0.375rem;
    background: var(--innovation-highlight);
    color: var(--contrast-foreground);
    font-size: var(--text-xl);
    clip-path: polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%);
  }

  .art {
    display: grid;
    place-items: center;
    min-block-size: 7.5rem;
    margin-block: 0.25rem 0.625rem;
    color: var(--art-ink);
  }

  .illustration {
    --size-icon: 5.75rem;
    rotate: var(--artwork-rotation, none);
    scale: var(--artwork-scale, none);
  }

  .highlight,
  .passive {
    text-align: center;
    white-space: pre-line;
    text-wrap: balance;
  }

  .highlight {
    margin-block-end: 0.625rem;
    padding: 0.375rem 0.5rem;
    border: 2px solid var(--innovation-action);
    border-radius: var(--radius-control);
    background: var(--innovation-highlight);
    font-weight: var(--font-bold);
  }

  .passive + .action,
  .action + .action {
    margin-block-start: 0.625rem;
  }

  h3 {
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: var(--radius-control);
    background: var(--innovation-highlight);
    line-height: var(--line-height-snug);
  }

  h3 > span {
    padding-inline: 0.5rem;
    padding-block: calc(0.375rem + 1px) calc(0.375rem - 1px);
  }

  .cost {
    display: inline-flex;
    flex: none;
    align-items: center;
    align-self: stretch;
    background: var(--innovation-action);
    font-size: 1.125rem;
  }

  .cost :global(.kd-icon) {
    background: radial-gradient(circle closest-side, var(--contrast-foreground) 85%, transparent 85%);
  }

  .action-description {
    padding: 0.5rem 0.375rem 0;
    white-space: pre-line;
  }

  table {
    inline-size: 100%;
    margin-block-start: 0.25rem;
    border-collapse: collapse;
    text-align: start;
  }

  tr + tr {
    border-block-start: var(--border-width) solid color-mix(var(--innovation-highlight) 50%, transparent);
  }

  th,
  td {
    padding: 0.25rem 0.375rem;
    vertical-align: top;
  }

  th {
    inline-size: 2.5rem;
    color: var(--art-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (any-hover: hover) and (prefers-reduced-motion: no-preference) {
    article {
      transform: perspective(55rem) rotateX(clamp(-2deg, var(--tilt-x, 0deg), 2deg)) rotateY(clamp(-2deg, var(--tilt-y, 0deg), 2deg));
    }

    .card-slot:not(:hover) > article {
      transition: transform var(--duration-fast) var(--ease-standard);
    }
  }
</style>
