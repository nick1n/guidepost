<script lang="ts">
  let landing: HTMLElement;

  function moveGlow(x: number, y: number) {
    landing.style.setProperty("--glow-shift-x", `${x}px`);
    landing.style.setProperty("--glow-shift-y", `${y}px`);
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

<svelte:head>
  <title>Guidepost — Board game companions</title>
  <meta
    name="description"
    content="Collection tracking, campaign tools, and play aids for Kingdom Death: Monster and other tabletop games."
  />
</svelte:head>

<svelte:window {onpointermove} {ondeviceorientation} />

<main
  bind:this={landing}
  class="landing text-foreground relative isolate flex min-h-dvh flex-col justify-between overflow-hidden p-[clamp(1.25rem,4vw,3rem)]"
>
  <header class="relative z-10 order-last leading-none">
    <h1 class="font-display text-[clamp(4rem,11vw,9rem)] font-bold tracking-tighter">Guidepost</h1>
    <p class="text-muted-foreground text-shadow px-.5% -mt-2 text-sm">
      some board game tools <a href="https://github.com/nick1n" target="_blank">I</a> wanted, left here for the next player
    </p>
  </header>

  <div class="relative z-10 flex justify-end gap-6">
    <nav aria-label="Guidepost tools" class="w-full max-w-96">
      <section aria-labelledby="kdm-tools">
        <h2 id="kdm-tools" class="section-label">Kingdom Death: Monster</h2>
        <a class="tool-link tool-link-primary" href="/start">
          <span class="link-title">Quick start</span>
          <span class="link-note">Core game only - play prologue showdown</span>
          <span class="tool-icon i-material-symbols:play-circle-outline size-5" aria-hidden="true"></span>
        </a>
        <a class="tool-link" href="/track">
          <span class="link-title">Collection</span>
          <span class="link-note">Keep track of all your content</span>
          <span class="tool-icon i-material-symbols:inventory-2-outline-sharp size-5" aria-hidden="true"></span>
        </a>
        <a class="tool-link" href="/hunt">
          <span class="link-title">Hunt Events</span>
          <span class="link-note">All 100 random hunt events</span>
          <span class="tool-icon i-material-symbols:route-outline-sharp size-5" aria-hidden="true"></span>
        </a>
        <a class="tool-link" href="https://drive.google.com/drive/folders/1s0UYjqfaR6urHFEDEpu58-42G8GFrXAR?usp=sharing" target="_blank">
          <span class="link-title">Reference Cards</span>
          <span class="link-note">2x2 gear sized cards</span>
          <span class="tool-icon i-material-symbols:arrow-outward size-5" aria-hidden="true"></span>
        </a>
      </section>

      <section class="mt-6" aria-labelledby="other-tools">
        <h2 id="other-tools" class="section-label">Other games</h2>
        <a class="tool-link" href="https://boardgamegeek.com/filepage/262016/" target="_blank">
          <span class="link-title">Star Wars: Imperial Assault</span>
          <span class="link-note">Campaign log & tracker</span>
          <span class="tool-icon i-material-symbols:arrow-outward size-5" aria-hidden="true"></span>
        </a>
        <div class="tool-link tool-link-muted" aria-disabled="true">
          <span class="link-title">The King's Dilemma</span>
          <span class="link-note">Printable reference cards</span>
          <span class="tool-icon i-material-symbols:crown-outline size-5" aria-label="Coming soon"></span>
        </div>
        <div class="tool-link tool-link-muted" aria-disabled="true">
          <span class="link-title">Heat: Pedal to the Metal</span>
          <span class="link-note">Legends Module</span>
          <span class="tool-icon i-material-symbols:readiness-score-outline" aria-label="Coming soon"></span>
        </div>
      </section>

      <section class="mt-6" aria-labelledby="links">
        <h2 id="other-tools" class="section-label">Links</h2>
        <a class="tool-link" href="https://github.com/nick1n/guidepost" target="_blank">
          <span class="link-title">Repo</span>
          <span class="link-note">Please report any issues</span>
          <span class="tool-icon i-mdi:github size-5" aria-hidden="true"></span>
        </a>
        <a class="tool-link" href="/credits">
          <span class="link-title">Credits</span>
          <span class="link-note">Thank yous</span>
          <span class="tool-icon i-material-symbols:favorite-outline size-5" aria-hidden="true"></span>
        </a>
      </section>
    </nav>
  </div>

  <div class="ambient" aria-hidden="true"></div>
</main>

<style>
  :global(html:has(.landing)) {
    scrollbar-gutter: auto;
  }

  header {
    text-shadow:
      0 0 1px #000,
      0 0 2px #000,
      0 0 3px #000,
      0 0 2px #000;
  }

  .landing {
    --glow-shift-x: 0px;
    --glow-shift-y: 0px;
  }

  .landing::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(115deg in oklch, transparent 20%, rgb(255 255 255 / 0.018) 50%, transparent 70%),
      radial-gradient(circle at 80% 15% in oklch, rgb(255 255 255 / 0.025), transparent 32%);
    content: "";
  }

  .ambient {
    position: absolute;
    inset: -5%;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    transform: translate3d(var(--glow-shift-x), var(--glow-shift-y), 0);
    will-change: transform;
  }

  .ambient::before,
  .ambient::after {
    position: absolute;
    bottom: -22%;
    left: -10%;
    border-radius: 9999px;
    content: "";
    transform-origin: 42% 70%;
    aspect-ratio: 1;
    animation: glow-pulse 32s ease-in-out infinite;
  }

  .ambient::before {
    width: min(72rem, 125vw);
    background: radial-gradient(ellipse at center in oklch, rgb(225 64 17 / 0.22) 0%, rgb(207 85 20 / 0.1) 30%, transparent 70%);
  }

  .ambient::after {
    bottom: -15%;
    left: 3%;
    width: min(36rem, 62vw);
    background: radial-gradient(ellipse at center in oklch, rgb(255 190 99 / 0.28) 0%, rgb(225 64 17 / 0.08) 42%, transparent 72%);
    animation:
      glow-pulse 32s ease-in-out infinite 16s,
      flicker 13s linear infinite;
  }

  .section-label {
    margin-bottom: clamp(0.4rem, 1vw, 0.7rem);
    color: var(--muted-foreground);
    font-size: 0.7rem;
    border-bottom: 2px solid rgb(253 255 254 / 0.12);
  }

  .tool-link {
    display: grid;
    min-height: clamp(3.15rem, 2.8rem + 1vw, 3.7rem);
    grid-template-areas:
      "title icon"
      "note icon";
    grid-template-columns: minmax(0, 1fr) auto;
    align-content: center;
    column-gap: 1rem;
    border-bottom: 2px solid rgb(253 255 254 / 0.12);
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
    border-color: rgb(17 178 225 / 0.65);
    color: var(--accent);
    outline: none;
  }

  .tool-link-primary {
    color: #4ae111;
  }

  .tool-link-primary:hover,
  .tool-link-primary:focus-visible {
    border-color: rgb(74 225 17 / 0.7);
    color: #77ed4b;
  }

  .tool-link-muted {
    color: rgb(253 255 254 / 0.5);
    cursor: default;
  }

  .tool-link-muted:hover {
    padding-right: 0;
    border-color: rgb(253 255 254 / 0.12);
    color: rgb(253 255 254 / 0.5);
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
    font-size: 0.7rem;
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
