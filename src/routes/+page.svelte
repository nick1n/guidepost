<script lang="ts">
  import { resolve } from "$app/paths";

  type Accents = "primary" | "muted" | "red";

  type NavigationItem = {
    title: string;
    note: string;
    icon: string;
    href?: string;
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
          title: "Quick start",
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
          href: "https://cults3d.com/en/3d-model/game/queens-dilemma-treasury-insert-ideology-markers",
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

  const vignetteMovement = 0.6;
  let landing: HTMLElement;
  function moveLighting(x: number, y: number) {
    landing.style.setProperty("--shift-glow-x", x + "px");
    landing.style.setProperty("--shift-glow-y", y + "px");
    landing.style.setProperty("--shift-vignette-x", x * vignetteMovement + "px");
    landing.style.setProperty("--shift-vignette-y", y * vignetteMovement + "px");
  }

  function onpointermove(event: PointerEvent) {
    const x = (event.clientX / window.innerWidth - 0.5) * 30;
    const y = (event.clientY / window.innerHeight - 0.5) * 22;
    moveLighting(x, y);
  }

  function ondeviceorientation(event: DeviceOrientationEvent) {
    const x = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 35)) * 18;
    const y = Math.max(-1, Math.min(1, (event.beta ?? 45) / 45 - 1)) * 14;
    moveLighting(x, y);
  }
</script>

<svelte:window {onpointermove} {ondeviceorientation} />

{#snippet toolContent(i: NavigationItem)}
  <span class="tool-title">
    {i.title}
    {#if i.href?.startsWith("http")}
      <span class="external-icon i-material-symbols:arrow-outward" aria-hidden="true"></span>
    {/if}
  </span>
  <span class="tool-note">{i.note}{i.href ? "" : " - Coming soon"}</span>
  <span class={["tool-icon", i.icon]} aria-hidden="true"></span>
{/snippet}

<main bind:this={landing} class="landing">
  <span id="new-tab-description" hidden>Opens in a new tab</span>

  <header>
    <h1>Guidepost</h1>
    <p>some board game tools I wanted, left here for the next player</p>
  </header>

  <nav aria-label="Guidepost tools">
    {#each navigationSections as { id, label, items } (id)}
      <section aria-labelledby={id}>
        <h2 {id}>{label}</h2>
        {#each items as i (i.title)}
          {#if i.href}
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
    <span class="glow-source flicker"></span>
    <span class="glow-source candle"></span>
  </div>
</main>

<style>
  .landing {
    --space-page: clamp(1.25rem, 4vw, 3rem);
    --space-header: 2rem;
    --space-note: 3px;
    --clearance-header: 31rem;
    --offset-tagline: -0.5rem;
    --width-nav: 24rem;
    --gap-nav: 1.5rem;
    --gap-tool: 1rem;
    --height-tool: clamp(3.15rem, 2.8rem + 1vw, 3.7rem);
    --position-glow-x: 35%;
    --position-glow-y: 6rem;
    --shift-glow-x: 0px;
    --shift-glow-y: 0px;
    --shift-vignette-x: 0px;
    --shift-vignette-y: 0px;
    --shift-hover: 0.4rem;
    --size-icon: 1.5rem;
    --size-external: 1rem;
    --size-glow-ambient: max(84rem, 150vw);
    --size-glow-pulse: clamp(28rem, 68vw, 58rem);
    --size-glow-flicker: clamp(18rem, 38vw, 32rem);
    --size-glow-candle: clamp(16rem, 32vw, 26rem);
    --layer-content: 1;
    --layer-backdrop: -1;
    --background-nav: color-mix(var(--background) 50%, transparent);
    --color-line: color-mix(var(--foreground) 15%, transparent);
    --color-accent-muted: color-mix(var(--foreground) 25%, transparent);
    --color-shadow-edge: color-mix(var(--background) 90%, transparent);
    --color-shadow-soft: color-mix(var(--background) 55%, transparent);
    --shadow-title:
      -1px 0 0 var(--color-shadow-edge), 1px 0 0 var(--color-shadow-edge), 0 -1px 0 var(--color-shadow-edge),
      0 1px 0 var(--color-shadow-edge), 0 2px 4px var(--color-shadow-soft);
    --duration-pulse: 7s;
    --duration-flicker: 23s;
    --duration-ambient: 43s;
    --duration-candle: 3s;
    --gradient-page-sheen:
      linear-gradient(115deg, transparent 20%, #ffd6ad0e 50%, transparent 80%),
      radial-gradient(circle at 80% 15%, #ffc48e06, transparent 32%);
    --gradient-vignette-warm: radial-gradient(ellipse at center, transparent 70%, #fff0bd14 100%);
    --gradient-light-ambient:
      radial-gradient(circle at 52% 54%, #f3a25d21 0%, transparent 36%),
      radial-gradient(ellipse at center in oklch, #e56f3f36 0%, #ad473524 31%, #662a2714 54%, transparent 76%);
    --gradient-light-pulse:
      radial-gradient(circle at 45% 47% in oklch, #ffe4ad47 0%, #ffb35d2e 18%, transparent 42%),
      radial-gradient(ellipse at center in oklch, #f084453b 0%, #c7433521 43%, transparent 75%);
    --gradient-light-flicker:
      radial-gradient(circle at 44% 43% in oklch, #fff0bd6b 0%, #ffc45e4d 16%, transparent 42%),
      radial-gradient(ellipse at 50% 57% in oklch, #ff9b3f4a 0%, #e4582f30 38%, #8e2d261a 60%, transparent 76%);
    --gradient-light-candle: radial-gradient(
      circle at 44% 56% in oklch,
      #ffe49a52 0%,
      #ff9a333d 20%,
      #ff572b2e 42%,
      #a92f1512 64%,
      transparent 78%
    );

    position: relative;
    min-block-size: 100dvb;
    padding: var(--space-page);
    overflow-x: clip;
    isolation: isolate;
    color: var(--foreground);
    font-family: var(--font-sans);

    &::before {
      z-index: var(--layer-backdrop);
      position: absolute;
      inset: 0;
      background: var(--gradient-page-sheen);
      content: "";
    }

    &::after {
      position: fixed;
      inset: -1rem;
      translate: var(--shift-vignette-x) var(--shift-vignette-y);
      background: var(--gradient-vignette-warm);
      content: "";
      pointer-events: none;
    }
  }

  header {
    z-index: var(--layer-content);
    position: relative;
    inline-size: fit-content;
    max-inline-size: 100%;
    margin-inline-start: auto;
    margin-block-end: var(--space-header);
    line-height: var(--line-height-none);
    text-align: right;
    text-shadow: var(--shadow-title);
  }

  h1 {
    margin: 0;
    font-weight: var(--font-bold);
    font-size: var(--text-hero);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  p {
    contain: inline-size;
    inline-size: 100%;
    margin-block-start: var(--offset-tagline);
    color: var(--foreground);
    font-size: var(--text-sm);
    text-align: center;
    text-wrap: pretty;
  }

  nav {
    display: grid;
    z-index: var(--layer-content);
    position: relative;
    inline-size: 100%;
    max-inline-size: var(--width-nav);
    margin-inline-start: auto;
    padding: 1rem;
    gap: var(--gap-nav);
    background: var(--background-nav);
  }

  h2 {
    border-block-end: var(--border-size) solid var(--color-line);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  .tool {
    --color-tool: var(--foreground);
    --color-tool-hover: var(--accent);

    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "title icon"
      "note icon";
    column-gap: var(--gap-tool);
    align-content: center;
    min-block-size: var(--height-tool);
    border-block-end: var(--border-size) solid var(--color-line);
    color: var(--color-tool);

    &.accent-primary {
      --color-tool: var(--accent-green);
      --color-tool-hover: var(--accent-green);
    }

    &.accent-red {
      --color-tool-hover: var(--accent-red);
    }

    &.accent-muted {
      --color-tool: var(--color-accent-muted);
    }
  }

  a.tool {
    position: relative;
    text-decoration: none;
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
      pointer-events: none;
      transition: transform var(--duration-fast) var(--ease-standard);
    }

    &:is(:hover, :focus-visible) {
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
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
  }

  .external-icon {
    display: inline-block;
    inline-size: var(--size-external);
    block-size: var(--size-external);
  }

  .tool-note {
    grid-area: note;
    margin-block-start: var(--space-note);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: var(--line-height-snug);
  }

  .tool-icon {
    display: inline-block;
    grid-area: icon;
    align-self: center;
    justify-self: end;
    inline-size: var(--size-icon);
    block-size: var(--size-icon);
  }

  .glow {
    z-index: var(--layer-backdrop);
    position: fixed;
    inset: -2rem;
    overflow: hidden;
    translate: var(--shift-glow-x) var(--shift-glow-y);
    pointer-events: none;
    will-change: translate;
  }

  .glow-source {
    position: absolute;
    aspect-ratio: 1;
    inset-block-end: var(--position-glow-y);
    inset-inline-start: var(--position-glow-x);
    translate: -50% 50%;
    border-radius: var(--radius-full);
    mix-blend-mode: screen;

    &.ambient {
      inline-size: var(--size-glow-ambient);
      background: var(--gradient-light-ambient);
      animation: ambient-pulse var(--duration-ambient) ease-in-out infinite -29s;
      filter: saturate(1.12);
      opacity: 0.68;
    }

    &.pulse {
      inline-size: var(--size-glow-pulse);
      background: var(--gradient-light-pulse);
      animation: glow-pulse var(--duration-pulse) ease-in-out infinite -7s;
      filter: saturate(1.12);
      opacity: 0.82;
    }

    &.flicker {
      inline-size: var(--size-glow-flicker);
      background: var(--gradient-light-flicker);
      animation: flicker var(--duration-flicker) linear infinite;
      filter: saturate(1.16);
      opacity: 0.88;
    }

    &.candle {
      inline-size: var(--size-glow-candle);
      background: var(--gradient-light-candle);
      animation: candle-flicker var(--duration-candle) linear infinite -1.3s;
      filter: saturate(1.28);
      opacity: 0.68;
    }
  }

  @media (width >= 46rem) {
    .landing {
      --position-glow-x: 22%;
      --position-glow-y: 8rem;
    }

    header {
      position: fixed;
      max-inline-size: calc(100% - var(--clearance-header));
      margin-inline-start: 0;
      margin-block-end: 0;
      inset-block-end: var(--space-page);
      inset-inline-start: var(--space-page);
      text-align: left;
    }

    .glow {
      inset: -5%;
    }
  }

  @keyframes glow-pulse {
    0%,
    100% {
      scale: 0.9;
      filter: saturate(1.08) brightness(0.94);
      opacity: 0.72;
    }

    50% {
      scale: 1.12;
      filter: saturate(1.16) brightness(1.04);
      opacity: 0.9;
    }
  }

  @keyframes ambient-pulse {
    0%,
    100% {
      translate: -52% 52%;
      scale: 0.86;
      filter: saturate(1.08) brightness(0.94);
      opacity: 0.52;
    }

    50% {
      translate: -48% 49%;
      scale: 1.14;
      filter: saturate(1.16) brightness(1.03);
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
      filter: saturate(1.16) brightness(1);
      opacity: 0.88;
    }

    68%,
    69.4%,
    70.1% {
      scale: 0.97;
      filter: saturate(1.28) brightness(0.76) hue-rotate(-6deg);
      opacity: 0.5;
    }

    68.2%,
    69.65%,
    70.35% {
      scale: 1.035;
      filter: saturate(1.08) brightness(1.18) hue-rotate(3deg);
      opacity: 1;
    }
  }

  @keyframes candle-flicker {
    0%,
    100% {
      translate: -50% 51%;
      scale: 0.96;
      filter: saturate(1.28) brightness(0.9);
      opacity: 0.6;
    }

    17% {
      translate: -51% 49%;
      scale: 1.04;
      filter: saturate(1.38) brightness(1.08);
      opacity: 0.78;
    }

    34% {
      translate: -49% 50%;
      scale: 0.99;
      filter: saturate(1.32) brightness(0.96);
      opacity: 0.67;
    }

    51% {
      translate: -50.5% 48.5%;
      scale: 1.07;
      filter: saturate(1.4) brightness(1.12);
      opacity: 0.82;
    }

    68% {
      translate: -48.8% 50.8%;
      scale: 0.94;
      filter: saturate(1.25) brightness(0.86);
      opacity: 0.56;
    }

    84% {
      translate: -50.8% 49.5%;
      scale: 1.02;
      filter: saturate(1.35) brightness(1.03);
      opacity: 0.74;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    a.tool::after {
      transition: none;
    }

    .glow {
      translate: none;
    }

    .landing::after {
      translate: none;
    }

    .glow-source {
      animation: none;
    }
  }
</style>
