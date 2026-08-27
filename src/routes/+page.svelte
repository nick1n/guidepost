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
    landing.style.setProperty("--shift-glow-x", x + "px");
    landing.style.setProperty("--shift-glow-y", y + "px");
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

{#snippet toolContent(i: NavigationItem)}
  <span class="tool-title">
    {i.title}
    {#if i.href?.startsWith("http")}
      <span class="i-material-symbols:arrow-outward" aria-hidden="true"></span>
    {/if}
  </span>
  <span class="tool-note">{i.note}{i.href ? "" : " - Coming soon"}</span>
  <span class={["tool-icon", i.icon]} aria-hidden="true"></span>
{/snippet}

<main bind:this={landing} class="landing">
  <span id="new-tab-description" hidden>Opens in a new tab</span>

  <header>
    <h1>Guidepost</h1>
    <p>
      some board game tools
      <a href="https://github.com/nick1n" target="_blank" aria-label="link to my GitHub page" aria-describedby="new-tab-description">I</a>
      wanted, left here for the next player
    </p>
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
  </div>
</main>

<style>
  .landing {
    --space-page: clamp(1.25rem, 4vw, 3rem);
    --space-header: 2rem;
    --space-note: 2px;
    --clearance-header: 31rem;
    --offset-tagline: -0.5rem;
    --width-nav: 24rem;
    --gap-nav: 1.5rem;
    --gap-tool: 1rem;
    --height-tool: clamp(3.15rem, 2.8rem + 1vw, 3.7rem);
    --shift-glow-x: 0px;
    --shift-glow-y: 0px;
    --shift-hover: 0.4rem;
    --size-icon: 1.5rem;
    --size-external: 1rem;
    --size-glow-ambient: max(84rem, 150vw);
    --size-glow-pulse: clamp(28rem, 68vw, 58rem);
    --size-glow-flicker: clamp(18rem, 38vw, 32rem);
    --layer-content: 1;
    --layer-vignette: 0;
    --layer-backdrop: -1;
    --color-line: color-mix(in srgb, var(--foreground) 12%, transparent);
    --color-primary-hover: color-mix(in oklch, var(--accent-green) 80%, var(--foreground));
    --color-red-hover: color-mix(in oklch, var(--accent-red) 80%, var(--foreground));
    --color-accent-muted: color-mix(in srgb, var(--foreground) 50%, transparent);
    --shadow-title: 0 0 1px var(--background), 0 0 2px var(--background), 0 0 3px var(--background), 0 0 2px var(--background);
    --duration-pulse: 28s;
    --duration-flicker: 21s;
    --duration-ambient: 96s;
    --gradient-page-sheen:
      linear-gradient(115deg in oklch, transparent 20%, color-mix(in srgb, #ffd6ad 2%, transparent) 50%, transparent 70%),
      radial-gradient(circle at 80% 15% in oklch, color-mix(in srgb, #ffc48e 2.5%, transparent), transparent 32%);
    --gradient-vignette-warm:
      radial-gradient(circle at 0% 0%, color-mix(in srgb, #dc7044 6%, transparent) 0%, transparent 31%),
      radial-gradient(circle at 100% 0%, color-mix(in srgb, #c65538 4%, transparent) 0%, transparent 29%),
      radial-gradient(circle at 100% 100%, color-mix(in srgb, #a63b30 6%, transparent) 0%, transparent 32%),
      radial-gradient(circle at 0% 100%, color-mix(in srgb, #f09a55 10%, transparent) 0%, transparent 35%),
      radial-gradient(
        ellipse at center in oklch,
        transparent 44%,
        color-mix(in srgb, #743025 7%, transparent) 72%,
        color-mix(in srgb, #160807 48%, transparent) 100%
      );
    --gradient-light-ambient:
      radial-gradient(circle at 52% 54% in oklch, color-mix(in srgb, #f3a25d 13%, transparent) 0%, transparent 36%),
      radial-gradient(
        ellipse at center in oklch,
        color-mix(in srgb, #e56f3f 21%, transparent) 0%,
        color-mix(in srgb, #ad4735 14%, transparent) 31%,
        color-mix(in srgb, #662a27 8%, transparent) 54%,
        transparent 76%
      );
    --gradient-light-pulse:
      radial-gradient(
        circle at 45% 47% in oklch,
        color-mix(in srgb, #ffe4ad 28%, transparent) 0%,
        color-mix(in srgb, #ffb35d 18%, transparent) 18%,
        transparent 42%
      ),
      radial-gradient(
        ellipse at center in oklch,
        color-mix(in srgb, #f08445 23%, transparent) 0%,
        color-mix(in srgb, #c74335 13%, transparent) 43%,
        transparent 75%
      );
    --gradient-light-flicker:
      radial-gradient(
        circle at 44% 43% in oklch,
        color-mix(in srgb, #fff0bd 42%, transparent) 0%,
        color-mix(in srgb, #ffc45e 30%, transparent) 16%,
        transparent 42%
      ),
      radial-gradient(
        ellipse at 50% 57% in oklch,
        color-mix(in srgb, #ff9b3f 29%, transparent) 0%,
        color-mix(in srgb, #e4582f 19%, transparent) 38%,
        color-mix(in srgb, #8e2d26 10%, transparent) 60%,
        transparent 76%
      );

    position: relative;
    isolation: isolate;
    min-block-size: 100dvb;
    padding: var(--space-page);
    overflow-x: clip;
    color: var(--foreground);
    font-family: var(--font-sans);

    &::before {
      position: absolute;
      inset: 0;
      z-index: var(--layer-backdrop);
      background: var(--gradient-page-sheen);
      content: "";
    }

    &::after {
      position: fixed;
      inset: 0;
      z-index: var(--layer-vignette);
      background: var(--gradient-vignette-warm);
      content: "";
      pointer-events: none;
    }

    > header {
      position: relative;
      z-index: var(--layer-content);
      inline-size: fit-content;
      max-inline-size: 100%;
      margin-block-end: var(--space-header);
      margin-inline-start: auto;
      line-height: var(--line-height-none);
      text-align: right;
      text-shadow: var(--shadow-title);

      @media (width >= 46rem) {
        position: fixed;
        inset-block-end: var(--space-page);
        inset-inline-start: var(--space-page);
        max-inline-size: calc(100% - var(--clearance-header));
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
        margin-block-start: var(--offset-tagline);
        color: var(--muted-foreground);
        font-size: var(--text-sm);
        text-wrap: pretty;
        text-align: center;
      }
    }

    > nav {
      position: relative;
      z-index: var(--layer-content);
      display: flex;
      flex-direction: column;
      gap: var(--gap-nav);
      inline-size: 100%;
      max-inline-size: var(--width-nav);
      margin-inline-start: auto;

      h2 {
        border-block-end: var(--border-size) solid var(--color-line);
        color: var(--muted-foreground);
        font-size: var(--text-sm);
      }
    }

    .tool {
      --color-link-accent: var(--accent);
      --color-link-accent-hover: var(--accent);
      --color-line-hover: color-mix(in srgb, var(--color-link-accent) 65%, transparent);

      display: grid;
      min-block-size: var(--height-tool);
      grid-template-areas:
        "title icon"
        "note icon";
      grid-template-columns: minmax(0, 1fr) auto;
      align-content: center;
      column-gap: var(--gap-tool);
      border-block-end: var(--border-size) solid var(--color-line);
      color: var(--foreground);
      text-decoration: none;
      transition:
        color var(--duration-fast) var(--ease-standard),
        border-color var(--duration-fast) var(--ease-standard),
        padding var(--duration-fast) var(--ease-standard);

      &:is(:hover, :focus-visible) {
        padding-inline-end: var(--shift-hover);
        border-color: var(--color-line-hover);
        color: var(--color-link-accent-hover);
        outline: none;
      }

      &.accent-primary {
        --color-link-accent: var(--accent-green);
        --color-link-accent-hover: var(--color-primary-hover);

        color: var(--color-link-accent);
      }

      &.accent-red {
        --color-link-accent: var(--accent-red);
        --color-link-accent-hover: var(--color-red-hover);

        color: var(--color-link-accent);
      }

      &.accent-muted {
        --color-link-accent: var(--color-accent-muted);
        --color-link-accent-hover: var(--color-link-accent);

        color: var(--color-link-accent);

        &:hover {
          padding-inline-end: 0;
          border-color: var(--color-line);
          color: var(--color-link-accent);
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
        inline-size: var(--size-external);
        block-size: var(--size-external);
      }
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
      position: fixed;
      inset: 0;
      z-index: var(--layer-backdrop);
      overflow: hidden;
      pointer-events: none;
      translate: var(--shift-glow-x) var(--shift-glow-y);
      will-change: translate;

      @media (width >= 46rem) {
        inset: -5%;
      }

      .glow-source {
        position: absolute;
        aspect-ratio: 1;
        border-radius: var(--radius-full);
        mix-blend-mode: screen;
        transform-origin: 42% 68%;

        &.ambient {
          bottom: -76%;
          left: 8%;
          inline-size: var(--size-glow-ambient);
          background: var(--gradient-light-ambient);
          filter: saturate(1.12);
          opacity: 0.68;
          translate: -50% 0;
          animation: ambient-pulse var(--duration-ambient) ease-in-out infinite -29s;
        }

        &.pulse {
          bottom: -16%;
          left: -14%;
          inline-size: var(--size-glow-pulse);
          background: var(--gradient-light-pulse);
          filter: saturate(1.12);
          opacity: 0.82;
          animation: glow-pulse var(--duration-pulse) ease-in-out infinite -7s;
        }

        &.flicker {
          bottom: 5%;
          left: 8%;
          inline-size: var(--size-glow-flicker);
          background: var(--gradient-light-flicker);
          filter: saturate(1.16);
          opacity: 0.88;
          animation: flicker var(--duration-flicker) linear infinite;
        }

        @media (width >= 46rem) {
          &.ambient {
            bottom: -98%;
            left: 12%;
          }

          &.pulse {
            bottom: -31%;
            left: -10%;
          }

          &.flicker {
            bottom: -8%;
            left: 9%;
          }
        }
      }
    }
  }

  @keyframes glow-pulse {
    0%,
    100% {
      filter: saturate(1.08) brightness(0.94);
      opacity: 0.72;
      scale: 0.9;
    }

    50% {
      filter: saturate(1.16) brightness(1.04);
      opacity: 0.9;
      scale: 1.12;
    }
  }

  @keyframes ambient-pulse {
    0%,
    100% {
      filter: saturate(1.08) brightness(0.94);
      opacity: 0.52;
      scale: 0.86;
      translate: -52% 2%;
    }

    50% {
      filter: saturate(1.16) brightness(1.03);
      opacity: 0.76;
      scale: 1.14;
      translate: -48% -1%;
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
      filter: saturate(1.16) brightness(1);
      opacity: 0.88;
      scale: 1;
    }

    68%,
    69.4%,
    70.1% {
      filter: saturate(1.28) brightness(0.76) hue-rotate(-6deg);
      opacity: 0.5;
      scale: 0.97;
    }

    68.2%,
    69.65%,
    70.35% {
      filter: saturate(1.08) brightness(1.18) hue-rotate(3deg);
      opacity: 1;
      scale: 1.035;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glow {
      translate: none;
      transition: none;

      .glow-source {
        animation: none;
      }
    }
  }
</style>
