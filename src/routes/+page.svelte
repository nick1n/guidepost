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
  <span class="tool-title">
    {item.title}
    {#if item.href?.startsWith("http")}
      <span class="i-material-symbols:arrow-outward" aria-hidden="true"></span>
    {/if}
  </span>
  <span class="tool-note">{item.note}</span>
  <span class={["tool-icon", item.icon]} aria-hidden={item.href ? true : undefined} aria-label={item.href ? undefined : "Coming soon"}
  ></span>
{/snippet}

<main bind:this={landing} class="landing">
  <header>
    <h1>Guidepost</h1>
    <p>
      some board game tools <a href="https://github.com/nick1n" target="_blank">I</a> wanted, left here for the next player
    </p>
  </header>

  <nav aria-label="Guidepost tools">
    {#each navigationSections as { id, label, items } (id)}
      <section aria-labelledby={id}>
        <h2 {id}>{label}</h2>
        {#each items as item (item.title)}
          {#if item.href}
            <a
              class={["tool", item.accent && `accent-${item.accent}`]}
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
            >
              {@render toolContent(item)}
            </a>
          {:else}
            <div class={["tool", item.accent && `accent-${item.accent}`]} aria-disabled="true">
              {@render toolContent(item)}
            </div>
          {/if}
        {/each}
      </section>
    {/each}
  </nav>

  <div class="glow" aria-hidden="true"></div>
</main>

<style>
  :global(html:has(.landing)) {
    scrollbar-gutter: auto;
  }

  .landing {
    --glow-shift-x: 0px;
    --glow-shift-y: 0px;
    --page-space: clamp(1.25rem, 4vw, 3rem);
    --header-space: 2rem;
    --header-clearance: 31rem;
    --tagline-offset: -0.5rem;
    --nav-width: 24rem;
    --nav-gap: 1.5rem;
    --tool-height: clamp(3.15rem, 2.8rem + 1vw, 3.7rem);
    --tool-gap: 1rem;
    --note-space: 2px;
    --hover-shift: 0.4rem;
    --icon-size: 1.5rem;
    --external-size: 1rem;
    --content-layer: 1;
    --backdrop-layer: -1;
    --line-color: color-mix(in srgb, var(--foreground) 12%, transparent);
    --primary-hover: color-mix(in oklch, var(--accent-green) 80%, var(--foreground));
    --red-hover: color-mix(in oklch, var(--accent-red) 80%, var(--foreground));
    --accent-muted: color-mix(in srgb, var(--foreground) 50%, transparent);
    --title-shadow: 0 0 1px var(--background), 0 0 2px var(--background), 0 0 3px var(--background), 0 0 2px var(--background);
    --glow-cycle: 32s;
    --flicker-cycle: 13s;
    --large-glow: min(72rem, 125vw);
    --small-glow: min(36rem, 62vw);
    --page-sheen:
      linear-gradient(115deg in oklch, transparent 20%, color-mix(in srgb, var(--foreground) 1.8%, transparent) 50%, transparent 70%),
      radial-gradient(circle at 80% 15% in oklch, color-mix(in srgb, var(--foreground) 2.5%, transparent), transparent 32%);
    --large-light: radial-gradient(
      ellipse at center in oklch,
      color-mix(in oklch, var(--accent-red) 22%, transparent) 0%,
      color-mix(in oklch, var(--accent-red) 10%, transparent) 30%,
      transparent 70%
    );
    --small-light: radial-gradient(
      ellipse at center in oklch,
      color-mix(in oklch, var(--secondary) 28%, transparent) 0%,
      color-mix(in oklch, var(--accent-red) 8%, transparent) 42%,
      transparent 72%
    );

    position: relative;
    isolation: isolate;
    min-block-size: 100dvb;
    padding: var(--page-space);
    overflow-x: clip;
    color: var(--foreground);
    font-family: var(--font-sans);

    &::before {
      position: absolute;
      inset: 0;
      z-index: var(--backdrop-layer);
      background: var(--page-sheen);
      content: "";
    }

    > header {
      position: relative;
      z-index: var(--content-layer);
      inline-size: fit-content;
      max-inline-size: 100%;
      margin-block-end: var(--header-space);
      margin-inline-start: auto;
      line-height: var(--line-height-none);
      text-align: right;
      text-shadow: var(--title-shadow);

      @media (width >= 46rem) {
        position: fixed;
        inset-block-end: var(--page-space);
        inset-inline-start: var(--page-space);
        max-inline-size: calc(100% - var(--header-clearance));
        margin-block-end: 0;
        margin-inline-start: 0;
        text-align: left;
      }

      h1 {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--text-hero);
        font-weight: var(--font-bold);
        letter-spacing: var(--letter-spacing-tight);
      }

      p {
        contain: inline-size;
        inline-size: 100%;
        margin-block-start: var(--tagline-offset);
        color: var(--muted-foreground);
        font-size: var(--text-sm);
        text-wrap: pretty;
        text-align: center;
      }
    }

    > nav {
      position: relative;
      z-index: var(--content-layer);
      display: flex;
      flex-direction: column;
      gap: var(--nav-gap);
      inline-size: 100%;
      max-inline-size: var(--nav-width);
      margin-inline-start: auto;

      h2 {
        border-block-end: var(--border-size) solid var(--line-color);
        color: var(--muted-foreground);
        font-size: var(--text-sm);
      }
    }

    .tool {
      --link-accent: var(--accent);
      --link-accent-hover: var(--accent);
      --line-hover: color-mix(in srgb, var(--link-accent) 65%, transparent);

      display: grid;
      min-block-size: var(--tool-height);
      grid-template-areas:
        "title icon"
        "note icon";
      grid-template-columns: minmax(0, 1fr) auto;
      align-content: center;
      column-gap: var(--tool-gap);
      border-block-end: var(--border-size) solid var(--line-color);
      color: var(--foreground);
      text-decoration: none;
      transition:
        color var(--duration-fast) var(--ease-standard),
        border-color var(--duration-fast) var(--ease-standard),
        padding var(--duration-fast) var(--ease-standard);

      &:is(:hover, :focus-visible) {
        padding-inline-end: var(--hover-shift);
        border-color: var(--line-hover);
        color: var(--link-accent-hover);
        outline: none;
      }

      &.accent-primary {
        --link-accent: var(--accent-green);
        --link-accent-hover: var(--primary-hover);

        color: var(--link-accent);
      }

      &.accent-red {
        --link-accent: var(--accent-red);
        --link-accent-hover: var(--red-hover);

        color: var(--link-accent);
      }

      &.accent-muted {
        --link-accent: var(--accent-muted);
        --link-accent-hover: var(--link-accent);

        color: var(--link-accent);

        &:hover {
          padding-inline-end: 0;
          border-color: var(--line-color);
          color: var(--link-accent);
        }
      }
    }

    .tool-title {
      grid-area: title;
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      line-height: var(--line-height-tight);

      > span {
        display: inline-block;
        inline-size: var(--external-size);
        block-size: var(--external-size);
      }
    }

    .tool-note {
      grid-area: note;
      margin-block-start: var(--note-space);
      color: var(--muted-foreground);
      font-size: var(--text-sm);
      line-height: var(--line-height-snug);
    }

    .tool-icon {
      display: inline-block;
      grid-area: icon;
      align-self: center;
      justify-self: end;
      inline-size: var(--icon-size);
      block-size: var(--icon-size);
    }

    .glow {
      position: fixed;
      inset: 0;
      z-index: var(--backdrop-layer);
      overflow: hidden;
      pointer-events: none;
      transform: translate3d(var(--glow-shift-x), var(--glow-shift-y), 0);
      will-change: transform;

      @media (width >= 46rem) {
        inset: -5%;
      }

      &::before,
      &::after {
        position: absolute;
        bottom: -5%;
        left: -10%;
        aspect-ratio: 1;
        border-radius: var(--radius-full);
        content: "";
        transform-origin: 42% 70%;
        animation: glow-pulse var(--glow-cycle) ease-in-out infinite;

        @media (width >= 46rem) {
          bottom: -22%;
        }
      }

      &::before {
        inline-size: var(--large-glow);
        background: var(--large-light);
      }

      &::after {
        bottom: 4%;
        left: 3%;
        inline-size: var(--small-glow);
        background: var(--small-light);
        animation:
          glow-pulse var(--glow-cycle) ease-in-out infinite calc(var(--glow-cycle) / 2),
          flicker var(--flicker-cycle) linear infinite;

        @media (width >= 46rem) {
          bottom: -15%;
        }
      }
    }
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
    .glow {
      transform: none;
      transition: none;

      &::before,
      &::after {
        animation: none;
      }
    }
  }
</style>
