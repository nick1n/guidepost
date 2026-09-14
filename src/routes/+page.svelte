<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { Effect } from "effect";
  import type { PointerEventHandler } from "svelte/elements";
  import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
  import VersionPicker from "#lib/components/track/VersionPicker.svelte";
  import { content } from "#lib/kdm-data.ts";
  import { navigate } from "#lib/navigation.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";

  type Accents = "primary" | "muted" | "red";

  type NavigationDestination = {
    label: string;
    href: string;
    brand: "makerworld" | "cults3d";
  };

  type NavigationItem = {
    title: string;
    note: string;
    icon: string;
    href?: string;
    destinations?: [NavigationDestination, ...NavigationDestination[]];
    accent?: Accents;
    requiresCore?: boolean;
  };

  type NavigationSection = {
    id: string;
    label: string;
    items: NavigationItem[];
  };

  const quickStartHref = resolve("/start");
  const coreVersions = content.find((item) => item.id === "core")?.versions ?? [];
  const latestCoreVersion = coreVersions.at(-1)?.v;

  const navigationSections: NavigationSection[] = [
    {
      id: "kdm",
      label: "Kingdom Death: Monster",
      items: [
        {
          title: "Quick Start",
          note: "Core - play first story showdown",
          icon: "i-material-symbols:play-circle-outline",
          href: quickStartHref,
          accent: "primary",
          requiresCore: true,
        },
        {
          title: "Collection",
          note: "Keep track of all your content",
          icon: "i-material-symbols:inventory-2-outline-sharp",
          href: resolve("/track"),
        },
        {
          title: "Hunt Events",
          note: "All 100 random hunt events",
          icon: "i-material-symbols:route-outline-sharp",
          href: resolve("/hunt"),
        },
        {
          title: "Reference Cards",
          note: "Printable 2x2 gear sized cards",
          icon: "i-material-symbols:cards-stack-outline-sharp",
          href: "https://drive.google.com/drive/folders/1s0UYjqfaR6urHFEDEpu58-42G8GFrXAR?usp=sharing",
        },
      ],
    },
    {
      id: "other",
      label: "Other games",
      items: [
        {
          title: "Star Wars: Imperial Assault",
          note: "Campaign log & tracker",
          icon: "i-material-symbols:sheets-outline",
          href: "https://boardgamegeek.com/filepage/262016/",
        },
        {
          title: "The Queen's Dilemma",
          note: "Treasury insert and Ideology upgrades",
          icon: "i-material-symbols:3d-outline-sharp",
          destinations: [
            {
              label: "MakerWorld",
              href: "https://makerworld.com/en/models/2958034",
              brand: "makerworld",
            },
            {
              label: "Cults3D",
              href: "https://cults3d.com/en/3d-model/game/queens-dilemma-treasury-insert-ideology-markers",
              brand: "cults3d",
            },
          ],
        },
        {
          title: "Dune: Imperium",
          note: "Player token upgrades",
          icon: "i-material-symbols:3d-outline-sharp",
          destinations: [
            {
              label: "MakerWorld",
              href: "https://makerworld.com/en/models/2958034",
              brand: "makerworld",
            },
            {
              label: "Cults3D",
              href: "https://cults3d.com/en/3d-model/game/queens-dilemma-treasury-insert-ideology-markers",
              brand: "cults3d",
            },
          ],
        },
        {
          title: "The King's Dilemma",
          note: "Printable reference cards",
          icon: "i-material-symbols:print-outline",
          accent: "muted",
        },
        {
          title: "Heat: Pedal to the Metal",
          note: "Legends Module",
          icon: "i-material-symbols:readiness-score-outline",
          accent: "muted",
        },
      ],
    },
    {
      id: "links",
      label: "Links",
      items: [
        {
          title: "Repo",
          note: "Please report any issues",
          icon: "i-mdi:github",
          href: "https://github.com/nick1n/guidepost",
        },
        {
          title: "Credits",
          note: "Thank yous",
          icon: "i-material-symbols:favorite-outline",
          href: resolve("/credits"),
          accent: "red",
        },
      ],
    },
  ];

  let landing: HTMLElement;
  let ownershipDialog: { show: () => void };
  let quickStartTrigger: HTMLAnchorElement | undefined;
  let selectedCoreVersion = $state(latestCoreVersion);
  let lightingFrame: number | undefined;
  let lightingX = 0;
  let lightingY = 0;
  let onpointermove = $state<PointerEventHandler<Window> | null>(moveLightingFromPointer);

  function moveLighting(x: number, y: number) {
    lightingX = x;
    lightingY = y;

    if (lightingFrame !== undefined) return;

    lightingFrame = requestAnimationFrame(() => {
      landing.style.setProperty("--shift-x", `${lightingX}px`);
      landing.style.setProperty("--shift-y", `${lightingY}px`);
      lightingFrame = undefined;
    });
  }

  function moveLightingFromPointer(event: PointerEvent) {
    const x = (event.clientX / window.innerWidth - 0.5) * 4;
    const y = (event.clientY / window.innerHeight - 0.5) * 3;
    moveLighting(x, y);
  }

  function ondeviceorientation(event: DeviceOrientationEvent) {
    if (event.beta === null && event.gamma === null) return;
    onpointermove = null;
    const x = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 35)) * 4;
    const y = Math.max(-1, Math.min(1, (event.beta ?? 45) / 45 - 1)) * 3;
    moveLighting(x, y);
  }

  function openQuickStart(event: MouseEvent) {
    if (collection.state.core?.owned) return;
    if (!(event.currentTarget instanceof HTMLAnchorElement)) return;

    quickStartTrigger = event.currentTarget;
    event.preventDefault();
    selectedCoreVersion = latestCoreVersion;
    ownershipDialog.show();
  }

  function selectCoreVersion(version: string) {
    selectedCoreVersion = version;
  }

  function confirmCoreOwnership() {
    const version = selectedCoreVersion;
    const save = Effect.suspend(() => {
      if (collection.state.core?.owned) return Effect.void;
      return collection.toggleOwned("core", { version });
    });
    collectionActions.run(save, { success: "Core game saved to your collection." });
    collectionActions.run(continueToQuickStart(), { success: false });
  }

  function continueToQuickStart() {
    return navigate(quickStartHref, "Quick start could not be opened. Please try again.");
  }

  function restoreQuickStartFocus() {
    quickStartTrigger?.focus();
  }
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

<svelte:window {onpointermove} {ondeviceorientation} />

{#snippet toolContent(i: NavigationItem)}
  <span class="tool-title">
    {i.title}
    {#if i.href?.startsWith("http")}
      <span class="external-icon i-material-symbols:arrow-outward" aria-hidden="true"></span>
    {/if}
  </span>
  <span class="tool-note">{i.note}{i.href || i.destinations ? "" : " - Coming soon"}</span>
  <span class={["tool-icon", i.icon]} aria-hidden="true"></span>
{/snippet}

<main bind:this={landing} class="landing">
  <span id="new-tab-description" hidden>Opens in a new tab</span>

  <header>
    <h1>Guidepost</h1>
    <p>board game aids left here for the next player</p>
  </header>

  <nav aria-label="Guidepost tools">
    {#each navigationSections as { id, label, items } (id)}
      <section aria-labelledby={id}>
        <h2 {id}>{label}</h2>
        {#each items as i (i.title)}
          {#if i.destinations}
            <div class={["tool has-destinations", i.accent && `accent-${i.accent}`]}>
              <a
                class={["tool-main", i.destinations[0].brand]}
                href={i.destinations[0].href}
                target="_blank"
                aria-describedby="new-tab-description"
              >
                {@render toolContent(i)}
              </a>
              <span class="tool-destinations">
                {#each i.destinations as destination (destination.href)}
                  <a
                    class={["destination", destination.brand]}
                    href={destination.href}
                    target="_blank"
                    aria-describedby="new-tab-description"
                  >
                    {destination.label}
                    <span class="external-icon i-material-symbols:arrow-outward" aria-hidden="true"></span>
                  </a>
                {/each}
              </span>
            </div>
          {:else if i.href}
            <a
              class={["tool", i.accent && `accent-${i.accent}`]}
              href={i.href}
              target={i.href.startsWith("http") ? "_blank" : undefined}
              aria-describedby={i.href.startsWith("http") ? "new-tab-description" : undefined}
              onclick={i.requiresCore ? openQuickStart : undefined}
            >
              {@render toolContent(i)}
            </a>
          {:else}
            <div class={["tool", i.accent && `accent-${i.accent}`]}>
              {@render toolContent(i)}
            </div>
          {/if}
        {/each}
      </section>
    {/each}
  </nav>

  <ConfirmDialog
    bind:this={ownershipDialog}
    title="Core game required"
    description="The quick start prologue showdown requires the **Kingdom Death: Monster** core box. Please choose the version you own to add it to your collection."
    confirmLabel="Add and continue"
    onconfirm={confirmCoreOwnership}
    confirmDisabled={!selectedCoreVersion}
    oncancel={restoreQuickStartFocus}
  >
    <VersionPicker
      versions={coreVersions}
      value={selectedCoreVersion ? [selectedCoreVersion] : []}
      onselect={selectCoreVersion}
      groupLabel="Kingdom Death: Monster core version"
      focusActive
    />
  </ConfirmDialog>

  <div class="glow" aria-hidden="true">
    <span class="glow-source ambient"></span>
    <span class="glow-source pulse"></span>
    <svg class="guidepost" viewBox="0 0 850 1100" focusable="false">
      <defs>
        <radialGradient id="lantern-glass" gradientUnits="userSpaceOnUse" cx="425" cy="504" r="78">
          <stop class="lantern-core" offset="0%" />
          <stop class="lantern-honey" offset="42%" />
          <stop class="lantern-ember" offset="100%" />
        </radialGradient>
      </defs>
      <image href={asset("logo/guidepost-min.svg")} width="850" height="1100" />
      <path
        class="lantern-glass"
        fill="url(#lantern-glass)"
        d="M360 469q0 22 8 36c5 9 3 8 11 11q24 9 40 27c8 9 12-3 25-13q41-46 22-69c-23 10-24-8-41-21l-35 20c-18 1-19 2-30 9 9-2 20-3 24-8l3 8c14 0 23-13 38-29 11 11 19 26 35 30l6-9c11 28-7 49-22 69l10-6c17-10 19-5 27-17 10-16 9-31 6-48q-15-1-24-9-3 10-7 7c-11-2-23-18-31-30-8 12-20 28-36 30l-2-7c-11 7-11 6-25 9z"
      />
    </svg>
    <span class="glow-source flicker"></span>
    <span class="glow-source candle"></span>
  </div>
</main>

<style>
  .landing {
    --color-cults3d: #822ef5;
    --color-lantern-core: #fff3cc;
    --color-lantern-ember: #ce6b29;
    --color-lantern-honey: #ffc66d;
    --color-makerworld: #08bf08;
    --color-muted-hover: var(--foreground);
    --color-shadow-edge: color-mix(var(--background) 90%, transparent);
    --gap-tool: round(clamp(0.5rem, 0.8vh, 0.75rem), 1px);
    --layer-backdrop: -1;
    --offset-tagline: -10px;
    --position-glow-x: 35%;
    --position-glow-y: 12rem;
    --position-guidepost-orb-x: 50%;
    --position-guidepost-orb-y: 44%;
    --shadow-title:
      -1px 0 0 var(--color-shadow-edge), 1px 0 0 var(--color-shadow-edge), 0 -1px 0 var(--color-shadow-edge),
      0 1px 0 var(--color-shadow-edge), 0 2px 4px color-mix(var(--background) 55%, transparent);
    --shift-hover: -0.5rem;
    --shift-x: 0px;
    --shift-y: 0px;
    --size-icon: 1.875rem;
    --space-page: round(clamp(1rem, 4vw, 3rem), 1px);
    --width-nav: 25rem;

    --duration-ambient: 43s;
    --duration-candle: 7s;
    --duration-flicker: 5s;
    --duration-pulse: 11s;
    --size-glow-ambient: max(84rem, 150vw);
    --size-glow-candle: clamp(16rem, 32vw, 26rem);
    --size-glow-flicker: clamp(18rem, 38vw, 32rem);
    --size-glow-pulse: clamp(28rem, 68vw, 58rem);
    --size-guidepost: clamp(23rem, 55vw, 38rem);
    --gradient-light-ambient:
      radial-gradient(circle at center, #fba15321 0%, transparent 36%),
      radial-gradient(ellipse at center in oklch, #f16c3736 0%, #b7453024 31%, #6c282514 54%, transparent 76%);
    --gradient-light-candle: radial-gradient(
      circle at center in oklch,
      #ffe48552 0%,
      #ff96123d 20%,
      #ff4e162e 40%,
      #c4280712 47%,
      transparent 54%
    );
    --gradient-light-flicker:
      radial-gradient(circle at center in oklch, #fff0b56b 0%, #ffc34d4d 16%, transparent 42%),
      radial-gradient(ellipse at center in oklch, #ff992e4a 0%, #f6542430 38%, #9a2a221a 60%, transparent 76%);
    --gradient-light-pulse:
      radial-gradient(circle at center in oklch, #ffe4a647 0%, #ffb2512e 18%, transparent 42%),
      radial-gradient(ellipse at center in oklch, #fb823b3b 0%, #d4403021 43%, transparent 75%);
    --gradient-page-sheen-vignette:
      linear-gradient(150deg, transparent 20%, #ffd6ad0f 50%, transparent 80%),
      radial-gradient(ellipse at center, transparent 70%, #fff0bd04 100%);

    &::before {
      z-index: var(--layer-backdrop);
      position: fixed;
      inset: 0;
      background: var(--gradient-page-sheen-vignette);
      content: "";
    }
  }

  header {
    inline-size: fit-content;
    margin-inline-start: auto;
    padding-inline: var(--space-page);
    line-height: var(--line-height-none);
    text-align: right;
    text-shadow: var(--shadow-title);
  }

  h1 {
    font-weight: var(--font-bold);
    font-size: var(--text-hero);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  p {
    contain: inline-size;
    margin-block-start: var(--offset-tagline);
    text-align: center;
  }

  nav {
    display: grid;
    max-inline-size: var(--width-nav);
    margin-inline-start: auto;
    margin-block: 1rem;
    padding: 1rem;
    gap: 1rem;
    background: color-mix(var(--background) 60%, transparent);
  }

  h2 {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-align: right;
  }

  .tool-note {
    grid-area: note;
    color: var(--color-tool-note, var(--muted-foreground));
  }

  :is(.tool, .tool-main) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "title icon"
      "note icon";
    gap: var(--gap-tool);
  }

  .tool {
    --color-tool-accent: var(--accent);

    padding-block: var(--gap-tool);
    border-block-end: var(--border-size) solid var(--color-divider);
    line-height: var(--line-height-none);
    transition: color var(--duration-fast) var(--ease-standard);

    &:any-link:is(:hover, :focus-visible),
    &:has(:any-link:is(:hover, :focus-visible)) {
      --color-tool-note: var(--color-muted-hover);
      --shift-tool-icon: var(--shift-hover);

      color: var(--color-tool-accent);
    }

    &:has(.makerworld:is(:hover, :focus-visible)) {
      --color-tool-accent: var(--color-makerworld);
    }

    &:has(.cults3d:is(:hover, :focus-visible)) {
      --color-tool-accent: var(--color-cults3d);
    }

    &.has-destinations {
      --color-primary-destination: var(--muted-foreground);
      --scale-primary-destination: 0;

      display: block;
      padding-block-end: 0;

      &:has(.tool-main:is(:hover, :focus-visible)) {
        --color-primary-destination: var(--color-muted-hover);
        --scale-primary-destination: 1;
      }
    }

    &.accent-primary {
      --color-tool-accent: var(--accent-green);

      color: var(--color-tool-accent);
    }

    &.accent-red {
      --color-tool-accent: var(--accent-red);
    }

    &.accent-muted {
      color: color-mix(var(--foreground) 25%, transparent);
    }

    &:any-link {
      position: relative;

      &::after {
        position: absolute;
        block-size: var(--border-size);
        inset-block-end: calc(-1 * var(--border-size));
        inset-inline: 0;
        transform: scaleX(0);
        transform-origin: right;
        background: var(--color-tool-accent);
        content: "";
        transition: transform var(--duration-fast) var(--ease-standard);
      }

      &:focus-visible {
        outline: none;
      }

      &:is(:hover, :focus-visible)::after {
        transform: scaleX(1);
      }
    }
  }

  .tool-title {
    grid-area: title;
    font-weight: var(--font-semibold);
    font-size: var(--text-xl);
    font-family: var(--font-display);
  }

  .tool-icon {
    grid-area: icon;
    align-self: center;
    inline-size: var(--size-icon);
    block-size: var(--size-icon);
    translate: var(--shift-tool-icon, 0);
    transition: translate var(--duration-fast) var(--ease-standard);
  }

  .tool-main:focus-visible {
    outline: none;
  }

  .tool-destinations {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .destination {
    --scale-destination: 0;

    display: inline-flex;
    position: relative;
    align-items: center;
    padding-block: var(--gap-tool);
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-standard);

    &::after {
      position: absolute;
      block-size: var(--border-size);
      inset-block-end: calc(-1 * var(--border-size));
      inset-inline: 0;
      transform: scaleX(var(--scale-destination));
      transform-origin: right;
      background: var(--color-tool-accent);
      content: "";
      transition: transform var(--duration-fast) var(--ease-standard);
    }

    &:first-child {
      --scale-destination: var(--scale-primary-destination);

      order: 1;
      color: var(--color-primary-destination);
    }

    &:is(:hover, :focus-visible) {
      --scale-destination: 1;

      color: var(--color-muted-hover);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--color-tool-accent);
      outline-offset: 2px;
    }
  }

  .glow {
    z-index: var(--layer-backdrop);
    position: fixed;
    block-size: calc(100lvh + 4rem);
    inset-block-end: -2rem;
    inset-inline: -2rem;
    overflow: hidden;
    translate: var(--shift-x) var(--shift-y);
    pointer-events: none;
    will-change: translate;
  }

  :is(.guidepost, .glow-source) {
    position: absolute;
    inset-block-end: var(--position-glow-y);
    inset-inline-start: var(--position-glow-x);
    translate: -50% 50%;
  }

  .guidepost {
    inline-size: var(--size-guidepost);
    transform-origin: var(--position-guidepost-orb-x) var(--position-guidepost-orb-y);
    translate: calc(0% - var(--position-guidepost-orb-x)) calc(100% - var(--position-guidepost-orb-y));
    rotate: -9deg;
  }

  .glow-source {
    aspect-ratio: 1;
    mix-blend-mode: screen;

    &.ambient {
      inline-size: var(--size-glow-ambient);
      background: var(--gradient-light-ambient);
      animation: ambient-pulse var(--duration-ambient) ease-in-out infinite -29s;
      opacity: 0.68;
    }

    &.pulse {
      inline-size: var(--size-glow-pulse);
      background: var(--gradient-light-pulse);
      animation: glow-pulse var(--duration-pulse) ease-in-out infinite -7s;
      opacity: 0.82;
    }

    &.flicker {
      inline-size: var(--size-glow-flicker);
      background: var(--gradient-light-flicker);
    }

    &.candle {
      inline-size: var(--size-glow-candle);
      background: var(--gradient-light-candle);
      animation: candle-flicker var(--duration-candle) linear infinite -1.3s;
      opacity: 0.68;
    }
  }

  /* The glass and nearby light share a clock, including the brief gusts. */
  :is(.lantern-glass, .glow-source.flicker) {
    animation: flicker var(--duration-flicker) linear infinite -3s;
    opacity: 0.88;
  }

  .lantern-core {
    stop-color: var(--color-lantern-core);
    animation: lantern-heat var(--duration-candle) ease-in-out infinite -1.3s;
  }

  .lantern-honey {
    stop-color: var(--color-lantern-honey);
  }

  .lantern-ember {
    stop-color: var(--color-lantern-ember);
  }

  @media (width >= 46rem) {
    .landing {
      --position-glow-x: clamp(10rem, 20%, 20rem);
      --position-glow-y: 18rem;
    }

    header {
      position: fixed;
      inset-block-end: var(--space-page);
    }
  }

  @keyframes glow-pulse {
    0%,
    100% {
      scale: 0.9;
      opacity: 0.72;
    }

    50% {
      scale: 1.12;
      opacity: 0.9;
    }
  }

  @keyframes ambient-pulse {
    0%,
    100% {
      scale: 0.86;
      opacity: 0.52;
    }

    50% {
      scale: 1.14;
      opacity: 0.76;
    }
  }

  @keyframes flicker {
    0%,
    18%,
    20.8%,
    62%,
    65.2%,
    100% {
      opacity: 0.88;
    }

    18.7%,
    63.8% {
      opacity: 0.64;
    }

    19.5%,
    62.8%,
    64.5% {
      opacity: 1;
    }
  }

  @keyframes lantern-heat {
    0%,
    34%,
    100% {
      stop-color: var(--color-lantern-core);
    }

    17%,
    51%,
    84% {
      stop-color: var(--foreground);
    }

    68% {
      stop-color: var(--color-lantern-honey);
    }
  }

  @keyframes candle-flicker {
    0%,
    100% {
      scale: 0.96;
      opacity: 0.6;
    }

    17% {
      scale: 1.04;
      opacity: 0.78;
    }

    34% {
      scale: 0.99;
      opacity: 0.67;
    }

    51% {
      scale: 1.07;
      opacity: 0.82;
    }

    68% {
      scale: 0.94;
      opacity: 0.56;
    }

    84% {
      scale: 1.02;
      opacity: 0.74;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :is(.tool, .destination, .tool-icon) {
      transition: none;
    }

    :is(a.tool, .destination)::after {
      transition: none;
    }

    .glow {
      translate: none;
    }

    :is(.glow-source.ambient, .glow-source.pulse, .glow-source.flicker, .glow-source.candle, .lantern-glass, .lantern-core) {
      animation: none;
    }
  }
</style>
