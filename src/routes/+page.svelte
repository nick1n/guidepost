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
          note: "2x2 gear sized cards",
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
          icon: "i-game-icons:light-sabers",
          href: "https://boardgamegeek.com/filepage/262016/",
        },
        {
          title: "The Queen's Dilemma",
          note: "3d prints: treasury insert and ideology upgrades",
          icon: "i-material-symbols:chess-queen-outline",
          href: "https://cults3d.com/en/3d-model/game/queens-dilemma-treasury-insert-ideology-markers",
        },
        {
          title: "The King's Dilemma",
          note: "Printable reference cards",
          icon: "i-material-symbols:crown-outline",
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
  function moveGlow(x: number, y: number) {
    landing.style.setProperty("--glow-shift-x", x + "px");
    landing.style.setProperty("--glow-shift-y", y + "px");
  }

  function onpointermove(event: PointerEvent) {
    const x = (event.clientX / window.innerWidth - 0.5) * 30;
    const y = (event.clientY / window.innerHeight - 0.5) * 22;
    moveGlow(x, y);
  }

  function ondeviceorientation(event: DeviceOrientationEvent) {
    const x = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 35)) * 18;
    const y = Math.max(-1, Math.min(1, (event.beta ?? 45) / 45 - 1)) * 14;
    moveGlow(x, y);
  }
</script>

<svelte:window {onpointermove} {ondeviceorientation} />

{#snippet toolContent(item: NavigationItem)}
  <span class="link-title">
    {item.title}
    {#if item.href?.startsWith("http")}
      <span class="i-material-symbols:arrow-outward inline-block size-4" aria-hidden="true"></span>
    {/if}
  </span>
  <span class="link-note">{item.note}</span>
  <span class={["tool-icon", item.icon]} aria-hidden={item.href ? true : undefined} aria-label={item.href ? undefined : "Coming soon"}
  ></span>
{/snippet}

<main bind:this={landing} class="landing text-foreground relative isolate min-h-dvh overflow-x-hidden">
  <header class="site-header relative z-10 leading-none">
    <h1 class="site-title font-display text-[clamp(5rem,10vw,9rem)] font-bold tracking-tighter">Guidepost</h1>
    <p class="site-subtitle text-muted-foreground text-shadow -mt-2 text-[.8rem] text-pretty">
      some board game tools <a href="https://github.com/nick1n" target="_blank">I</a> wanted, left here for the next player
    </p>
  </header>

  <nav aria-label="Guidepost tools" class="nav-region relative z-10 ml-auto flex w-full max-w-96 flex-col gap-6">
    {#each navigationSections as { id, label, items } (id)}
      <section aria-labelledby={id}>
        <h2 {id} class="section-label">{label}</h2>
        {#each items as item (item.title)}
          {#if item.href}
            <a
              class={["tool-link", item.accent && `accent-${item.accent}`]}
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
            >
              {@render toolContent(item)}
            </a>
          {:else}
            <div class={["tool-link", item.accent && `accent-${item.accent}`]} aria-disabled="true">
              {@render toolContent(item)}
            </div>
          {/if}
        {/each}
      </section>
    {/each}
  </nav>

  <div class="ambient" aria-hidden="true"></div>
</main>

<style>
  :global(html:has(.landing)) {
    scrollbar-gutter: auto;
  }

  .site-header {
    inline-size: fit-content;
    max-inline-size: 100%;
    margin-bottom: 2rem;
    margin-inline-start: auto;
    text-align: right;
    text-shadow:
      0 0 1px #000,
      0 0 2px #000,
      0 0 3px #000,
      0 0 2px #000;

    @media (min-width: 46rem) {
      position: fixed;
      bottom: var(--page-padding);
      left: var(--page-padding);
      max-width: calc(100% - 31rem);
      text-align: left;
      margin-bottom: 0;
      margin-inline-start: 0;
    }
  }

  .site-title {
    margin: 0;
  }

  .site-subtitle {
    contain: inline-size;
    inline-size: 100%;
  }

  .landing {
    --glow-shift-x: 0px;
    --glow-shift-y: 0px;
    --page-padding: clamp(1.25rem, 4vw, 3rem);

    padding: var(--page-padding);
  }

  .landing::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(115deg in oklch, transparent 20%, color-mix(in srgb, var(--foreground) 1.8%, transparent) 50%, transparent 70%),
      radial-gradient(circle at 80% 15% in oklch, color-mix(in srgb, var(--foreground) 2.5%, transparent), transparent 32%);
    content: "";
  }

  .ambient {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    transform: translate3d(var(--glow-shift-x), var(--glow-shift-y), 0);
    will-change: transform;

    @media (min-width: 46rem) {
      inset: -5%;
    }
  }

  .ambient::before,
  .ambient::after {
    position: absolute;
    bottom: -5%;
    left: -10%;
    border-radius: 9999px;
    content: "";
    transform-origin: 42% 70%;
    aspect-ratio: 1;
    animation: glow-pulse 32s ease-in-out infinite;

    @media (min-width: 46rem) {
      bottom: -22%;
    }
  }

  .ambient::before {
    width: min(72rem, 125vw);
    background: radial-gradient(
      ellipse at center in oklch,
      color-mix(in oklch, var(--accent-red) 22%, transparent) 0%,
      color-mix(in oklch, var(--accent-red) 10%, transparent) 30%,
      transparent 70%
    );
  }

  .ambient::after {
    bottom: 4%;
    left: 3%;
    width: min(36rem, 62vw);
    background: radial-gradient(
      ellipse at center in oklch,
      color-mix(in oklch, var(--secondary) 28%, transparent) 0%,
      color-mix(in oklch, var(--accent-red) 8%, transparent) 42%,
      transparent 72%
    );
    animation:
      glow-pulse 32s ease-in-out infinite 16s,
      flicker 13s linear infinite;

    @media (min-width: 46rem) {
      bottom: -15%;
    }
  }

  .section-label {
    margin-bottom: clamp(0.4rem, 1vw, 0.7rem);
    color: var(--muted-foreground);
    font-size: 0.7rem;
    border-bottom: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  }

  .tool-link {
    --link-accent: var(--accent);
    --link-accent-hover: var(--accent);

    display: grid;
    min-height: clamp(3.15rem, 2.8rem + 1vw, 3.7rem);
    grid-template-areas:
      "title icon"
      "note icon";
    grid-template-columns: minmax(0, 1fr) auto;
    align-content: center;
    column-gap: 1rem;
    border-bottom: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--foreground);
    text-decoration: none;
    transition:
      color 180ms ease,
      border-color 180ms ease,
      padding 180ms ease;
  }

  .tool-link:hover,
  .tool-link:focus-visible {
    padding-right: 0.4rem;
    border-color: color-mix(in srgb, var(--link-accent) 65%, transparent);
    color: var(--link-accent-hover);
    outline: none;
  }

  .accent-primary {
    --link-accent: var(--accent-green);
    --link-accent-hover: color-mix(in oklch, var(--accent-green) 80%, var(--foreground));

    color: var(--link-accent);
  }

  .accent-red {
    --link-accent: var(--accent-red);
    --link-accent-hover: color-mix(in oklch, var(--accent-red) 80%, var(--foreground));

    color: var(--link-accent);
  }

  .accent-muted {
    --link-accent: color-mix(in srgb, var(--foreground) 50%, transparent);
    --link-accent-hover: var(--link-accent);

    color: var(--link-accent);
    cursor: default;
  }

  .accent-muted:hover {
    padding-right: 0;
    border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--link-accent);
  }

  .link-title {
    grid-area: title;
    font-family: var(--font-display, "Barlow Condensed", "Inter", sans-serif);
    font-size: 1.2rem;
    font-weight: 650;
    line-height: 1.1;
  }

  .link-note {
    grid-area: note;
    margin-top: 0.2rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
    line-height: 1.25;
  }

  .tool-icon {
    grid-area: icon;
    align-self: center;
    justify-self: end;
    width: 24px;
    height: 24px;
  }

  @keyframes glow-pulse {
    0%,
    100% {
      transform: scale(0.8);
    }

    50% {
      transform: scale(1.2);
    }
  }

  @keyframes firelight {
    0%,
    57%,
    59%,
    61%,
    64%,
    100% {
      opacity: 0.7;
    }

    58% {
      opacity: 0.2;
    }

    60% {
      opacity: 0.9;
    }

    62% {
      opacity: 0.4;
    }
  }

  @keyframes flicker {
    0%,
    19.9%,
    22%,
    62.9%,
    64%,
    64.9%,
    70%,
    100% {
      opacity: 0.9;
    }
    20%,
    21.9%,
    63%,
    63.9%,
    65%,
    69.9% {
      opacity: 0.7;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient {
      transform: none;
      transition: none;
    }

    .ambient::before,
    .ambient::after {
      animation: none;
    }
  }
</style>
