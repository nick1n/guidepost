<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import type { PointerEventHandler } from "svelte/elements";

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
  };

  type NavigationSection = {
    id: string;
    label: string;
    items: NavigationItem[];
  };

  const navigationSections: NavigationSection[] = [
    {
      id: "kdm",
      label: "Kingdom Death: Monster",
      items: [
        {
          title: "Quick Start",
          note: "Core game only - play prologue showdown",
          icon: "i-material-symbols:play-circle-outline",
          href: resolve("/start"),
          accent: "primary",
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
    const x = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 35)) * 3;
    const y = Math.max(-1, Math.min(1, (event.beta ?? 45) / 45 - 1)) * 2;
    moveLighting(x, y);
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
            <div class={["tool", "has-destinations", i.accent && `accent-${i.accent}`]}>
              <a class="tool-main" href={i.destinations[0].href} target="_blank" aria-describedby="new-tab-description">
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

  <div class="glow" aria-hidden="true">
    <span class="glow-source ambient"></span>
    <span class="glow-source pulse"></span>
    <img class="guidepost" src={asset("logo/guidepost-min.svg")} alt="guidepost" />
    <span class="glow-source flicker"></span>
    <span class="glow-source candle"></span>
  </div>
</main>

<style>
  .landing {
    --space-page: clamp(1.25rem, 4vw, 3rem);
    --offset-tagline: -10px;
    --width-nav: 24rem;
    --gap-tool: 0.5rem;
    --position-glow-x: 35%;
    --position-glow-y: 12rem;
    --position-guidepost-orb-x: 50%;
    --position-guidepost-orb-y: 44%;
    --shift-x: 0px;
    --shift-y: 0px;
    --shift-hover: 0.4rem;
    --size-icon: 1.5rem;
    --size-external: 1rem;
    --size-glow-ambient: max(84rem, 150vw);
    --size-glow-pulse: clamp(28rem, 68vw, 58rem);
    --size-glow-flicker: clamp(18rem, 38vw, 32rem);
    --size-glow-candle: clamp(16rem, 32vw, 26rem);
    --size-guidepost: clamp(23rem, 55vw, 38rem);
    --layer-backdrop: -1;
    --color-muted-hover: color-mix(var(--foreground) 75%, transparent);
    --color-makerworld: #08bf08;
    --color-cults3d: #822ef5;
    --color-shadow-edge: color-mix(var(--background) 90%, transparent);
    --shadow-title:
      -1px 0 0 var(--color-shadow-edge), 1px 0 0 var(--color-shadow-edge), 0 -1px 0 var(--color-shadow-edge),
      0 1px 0 var(--color-shadow-edge), 0 2px 4px color-mix(var(--background) 55%, transparent);
    --duration-pulse: 11s;
    --duration-flicker: 5s;
    --duration-ambient: 43s;
    --duration-candle: 7s;
    --gradient-page-sheen-vignette:
      linear-gradient(150deg, transparent 20%, #ffd6ad0f 50%, transparent 80%),
      radial-gradient(ellipse at center, transparent 70%, #fff0bd04 100%);
    --gradient-light-ambient:
      radial-gradient(circle at center, #fba15321 0%, transparent 36%),
      radial-gradient(ellipse at center in oklch, #f16c3736 0%, #b7453024 31%, #6c282514 54%, transparent 76%);
    --gradient-light-pulse:
      radial-gradient(circle at center in oklch, #ffe4a647 0%, #ffb2512e 18%, transparent 42%),
      radial-gradient(ellipse at center in oklch, #fb823b3b 0%, #d4403021 43%, transparent 75%);
    --gradient-light-flicker:
      radial-gradient(circle at center in oklch, #fff0b56b 0%, #ffc34d4d 16%, transparent 42%),
      radial-gradient(ellipse at center in oklch, #ff992e4a 0%, #f6542430 38%, #9a2a221a 60%, transparent 76%);
    --gradient-light-candle: radial-gradient(
      circle at center in oklch,
      #ffe48552 0%,
      #ff96123d 20%,
      #ff4e162e 40%,
      #c4280712 47%,
      transparent 54%
    );

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
    text-wrap: pretty;
  }

  nav {
    display: grid;
    max-inline-size: var(--width-nav);
    margin-inline-start: auto;
    margin-block: 1rem;
    padding: 1rem;
    gap: 1rem;
    background: color-mix(var(--background) 50%, transparent);
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
    --color-tool-hover: var(--accent);

    padding-block: var(--gap-tool);
    border-block-end: var(--border-size) solid color-mix(var(--foreground) 15%, transparent);
    font-size: var(--text-sm);
    line-height: var(--line-height-none);

    &.has-destinations {
      --color-primary-destination: var(--muted-foreground);
      --scale-primary-destination: 0;

      display: block;
      padding-block-end: 0;
      transition: color var(--duration-fast) var(--ease-standard);

      &:has(:is(.tool-main, .destination):is(:hover, :focus-visible)) {
        --color-tool-note: var(--color-muted-hover);
        --shift-tool-icon: calc(-1 * var(--shift-hover));

        color: var(--color-tool-hover);
      }

      &:has(.tool-main:is(:hover, :focus-visible)) {
        --color-primary-destination: var(--foreground);
        --scale-primary-destination: 1;
      }
    }

    &.accent-primary {
      --color-tool-hover: var(--accent-green);

      color: var(--accent-green);
    }

    &.accent-red {
      --color-tool-hover: var(--accent-red);
    }

    &.accent-muted {
      color: color-mix(var(--foreground) 25%, transparent);
    }
  }

  a.tool {
    position: relative;
    transition:
      color var(--duration-fast) var(--ease-standard),
      padding var(--duration-fast) var(--ease-standard);

    &::after {
      position: absolute;
      block-size: var(--border-size);
      inset-block-end: calc(-1 * var(--border-size));
      inset-inline: 0;
      transform: scaleX(0);
      transform-origin: right;
      background: var(--color-tool-hover);
      content: "";
      transition: transform var(--duration-fast) var(--ease-standard);
    }

    &:is(:hover, :focus-visible) {
      --color-tool-note: var(--color-muted-hover);

      padding-inline-end: var(--shift-hover);
      outline: none;
      color: var(--color-tool-hover);

      &::after {
        transform: scaleX(1);
      }
    }
  }

  .tool-title {
    grid-area: title;
    font-weight: var(--font-semibold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }

  .external-icon {
    display: inline-block;
    inline-size: var(--size-external);
    block-size: var(--size-external);
  }

  .tool-icon {
    grid-area: icon;
    align-self: center;
    inline-size: var(--size-icon);
    block-size: var(--size-icon);
    translate: var(--shift-tool-icon, 0);
    transition: translate var(--duration-fast) var(--ease-standard);
  }

  .tool-main {
    &:focus-visible {
      outline: none;
    }
  }

  .tool-destinations {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .destination {
    --color-destination: var(--accent);
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
      background: var(--color-destination);
      content: "";
      transition: transform var(--duration-fast) var(--ease-standard);
    }

    &.makerworld {
      --color-destination: var(--color-makerworld);
    }

    &.cults3d {
      --color-destination: var(--color-cults3d);
    }

    &:first-child {
      --scale-destination: var(--scale-primary-destination);

      order: 1;
      color: var(--color-primary-destination);
    }

    &:is(:hover, :focus-visible) {
      --scale-destination: 1;

      color: var(--foreground);
    }

    &:focus-visible {
      outline: calc(2 * var(--border-size)) solid var(--color-destination);
      outline-offset: 2px;
    }
  }

  .glow {
    z-index: var(--layer-backdrop);
    position: fixed;
    inset: -2rem;
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
      animation: flicker var(--duration-flicker) linear infinite;
      opacity: 0.88;
    }

    &.candle {
      inline-size: var(--size-glow-candle);
      background: var(--gradient-light-candle);
      animation: candle-flicker var(--duration-candle) linear infinite -1.3s;
      opacity: 0.68;
    }
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
    67.9%,
    68.5%,
    69.3%,
    70%,
    70.8%,
    100% {
      scale: 1;
      opacity: 0.88;
    }

    68%,
    69.4%,
    70.1% {
      scale: 0.97;
      opacity: 0.5;
    }

    68.2%,
    69.65%,
    70.35% {
      scale: 1.035;
      opacity: 1;
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
    :is(a.tool, .has-destinations, .destination, .tool-icon) {
      transition: none;
    }

    :is(a.tool, .destination)::after {
      transition: none;
    }

    .glow {
      translate: none;
    }

    .glow-source {
      animation: none;
    }
  }
</style>
