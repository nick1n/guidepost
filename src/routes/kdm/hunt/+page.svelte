<script module lang="ts">
  import { asset } from "$app/paths";
  import type { AssetPath } from "$app/types";
  import { backOut, cubicOut } from "svelte/easing";
  import { prefersReducedMotion as reducedMotion } from "svelte/motion";
  import { huntDefaults } from "#lib/kdm/hunt/preference-store.ts";
  import { huntImages } from "#lib/kdm/hunt/cards.ts";

  const duration = 500;
  const selectionDelay = 250;
  const defaultBack = huntImages(1, huntDefaults).back;

  // Card paths are constructed from the local deck definitions and verified against static assets in tests.
  function cardAsset(path: string) {
    return asset(path as AssetPath);
  }

  function slide(_node: Element, { direction }: { direction: 1 | -1 }) {
    return {
      duration: reducedMotion.current ? 0 : duration,
      easing: direction === -1 ? backOut : cubicOut,
      css: (t: number, u: number) => `transform: translateX(${direction * u * 150}%) rotateZ(${direction * u * 15}deg); opacity: ${t}`,
    };
  }
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { getHuntPreferences } from "#lib/kdm/hunt/preferences.svelte.ts";
  import HuntPicker from "#lib/kdm/hunt/HuntPicker.svelte";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import MenuButton from "#lib/app/menu/MenuButton.svelte";
  import { swipe, type SwipeDirection } from "#lib/swipe.ts";

  const preferences = getHuntPreferences();
  const loaded = new SvelteSet<string>();
  const failed = new SvelteSet<string>();
  let card = $state(1);
  let artworkCard = $state(1);
  let showCard = $state(false);
  let rotation = $state(0);
  let hasClicked = $state(false);
  let drawing = $state(false);
  let selecting = $state(false);
  let selectionTimer: Timeout;
  let flipping = $state(false);
  let firstRand = $state(0);
  let secondRand = $state(0);
  let retry = $state(0);
  let picker: HuntPicker;
  let slideElement = $state<HTMLDivElement>();
  let drawingElement: HTMLDivElement | undefined;
  let selectionElement = $state<HTMLDivElement>();
  let cardElement: HTMLButtonElement | undefined;
  let flipSource: { element: HTMLButtonElement; front: string } | undefined;
  let retryFocus: { front: string; retry: number } | undefined;

  const images = $derived(huntImages(artworkCard, preferences));
  const frontSrc = $derived(images.front);
  const backSrc = $derived(images.back);
  // Selecting different artwork restores its deck back; a completed flip can override this face.
  let backFace = $derived({ front: frontSrc, src: backSrc });
  const sources = $derived(preferences.ready ? [images.front, images.back, ...(images.reverse ? [images.reverse] : [])] : []);
  const loading = $derived(!preferences.ready || sources.some((src) => !loaded.has(src)));
  const loadError = $derived(sources.some((src) => failed.has(src)));
  const busy = $derived(drawing || loading || selecting || !!selectionElement);
  const showReverse = $derived(backFace.src === images.reverse);
  const first = $derived(drawing ? firstRand : Math.floor(card / 10) % 10);
  const second = $derived(drawing ? secondRand : card % 10);
  const face = $derived.by(() => {
    if (showCard) return "front";
    if (showReverse) return "reverse";
    return "card back";
  });

  // Random draws need changing dice values while the outgoing card animates.
  $effect(() => {
    if (!drawing || loadError || reducedMotion.current) return;
    const interval = setInterval(() => {
      firstRand = Math.floor(Math.random() * 10);
      secondRand = Math.floor(Math.random() * 10);
    }, 200);
    return () => clearInterval(interval);
  });

  onDestroy(() => clearTimeout(selectionTimer));

  function flip(direction?: SwipeDirection) {
    hasClicked = true;
    if (flipping || busy || loadError || !cardElement) return;
    const turn = direction ?? (showCard ? "left" : "right");
    flipSource = { element: cardElement, front: frontSrc };
    rotation += turn === "left" ? -180 : 180;
    showCard = !showCard;
    flipping = true;
    if (reducedMotion.current) finishFlip(cardElement);
  }

  function finishFlip(element: HTMLButtonElement) {
    if (flipSource?.element !== element) return;
    if (frontSrc === flipSource.front && images.reverse) backFace = { front: frontSrc, src: images.reverse };
    flipSource = undefined;
    flipping = false;
  }

  function finishTransition(event: TransitionEvent) {
    if (event.target === event.currentTarget && event.propertyName === "transform") finishFlip(event.currentTarget as HTMLButtonElement);
  }

  function trackCard(element: HTMLButtonElement) {
    cardElement = element;
    const focus = retryFocus;
    retryFocus = undefined;
    const document = element.ownerDocument;
    if (focus?.front === frontSrc && focus.retry === retry && document.activeElement === document.body && document.hasFocus()) {
      element.focus({ preventScroll: true });
    }
    return () => {
      if (cardElement === element) cardElement = undefined;
      // A deck change can remove the card before its rotation emits a completion event.
      finishFlip(element);
    };
  }

  function onclick(event: MouseEvent) {
    if (event.detail === 0) {
      flip();
      return;
    }
    const bounds = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
    flip(event.clientX < bounds.left + bounds.width / 2 ? "left" : "right");
  }

  function conceal() {
    retryFocus = undefined;
    flipSource = undefined;
    flipping = false;
    rotation = Math.round(rotation / 360) * 360;
    showCard = false;
    backFace = { front: frontSrc, src: backSrc };
  }

  function draw() {
    if (flipping || drawing) return;
    drawingElement = !busy && !loadError ? slideElement : undefined;
    clearTimeout(selectionTimer);
    selecting = false;
    drawing = true;
    if (!drawingElement) finishDraw();
  }

  function finishDraw() {
    drawingElement = undefined;
    conceal();
    card = Math.floor(Math.random() * 100) + 1;
    artworkCard = card;
    drawing = false;
  }

  function onoutroend(event: Event) {
    if (event.target === selectionElement) selectionElement = undefined;
    // Artwork changes can leave an older card animating alongside this draw.
    if (event.target === drawingElement) finishDraw();
  }

  function selectHunt() {
    if (drawing || flipping) return;
    if (showCard) flip();
    picker.show();
  }

  function select(cardNumber: number) {
    if (cardNumber === card && !selecting && !selectionElement) return;
    if (!busy && !loadError) selectionElement = slideElement;
    selecting = true;
    conceal();
    card = cardNumber;
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      artworkCard = card;
      selecting = false;
    }, selectionDelay);
  }

  function imageEvents(path: string) {
    return {
      onload() {
        failed.delete(path);
        loaded.add(path);
      },
      onerror() {
        failed.add(path);
      },
    };
  }

  function retryImages(event: MouseEvent) {
    const button = event.currentTarget as HTMLButtonElement;
    retryFocus = button.ownerDocument.activeElement === button ? { front: frontSrc, retry: retry + 1 } : undefined;
    for (const src of sources) {
      loaded.delete(src);
      failed.delete(src);
    }
    retry += 1;
  }

  function cancelRetryFocus(event: Event) {
    if (event.type !== "focusin" || event.target !== document.body) retryFocus = undefined;
  }

  function onkeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector("dialog[open]")
    )
      return;
    const target = event.composedPath()[0];
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role=textbox]"))) return;
    switch (event.key) {
      case "r":
      case "R":
        event.preventDefault();
        draw();
        break;
      case "/":
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        selectHunt();
        break;
      case "f":
      case "F":
      case "ArrowLeft":
      case "ArrowRight":
        event.preventDefault();
        flip(event.key === "ArrowLeft" ? "left" : "right");
        break;
    }
  }
</script>

<svelte:document onfocusin={cancelRetryFocus} onpointerdown={cancelRetryFocus} />
<svelte:window {onkeydown} />

<svelte:head>
  <title>Hunt Events | Guidepost</title>
  {#if !preferences.ready || images.back === defaultBack}
    <link rel="prefetch" as="image" href={cardAsset(defaultBack)} />
  {/if}
  <meta name="description" content="Draw and select all 100 Kingdom Death: Monster hunt events with card images by Fen, Kekasi, and CCG." />
</svelte:head>

<main style:--duration-flip={`${duration}ms`}>
  <h1 class="visually-hidden">Hunt events</h1>
  <div hidden>
    {#key retry}
      {#each sources as src (src)}
        <img src={cardAsset(src)} alt="" {...imageEvents(src)} />
      {/each}
    {/key}
  </div>
  <div class="stage" style:--aspect={images.aspectRatio}>
    {#if !busy && !loadError}
      {#key `${images.front}:${retry}`}
        <div class="slide" bind:this={slideElement} {onoutroend} in:slide|global={{ direction: -1 }} out:slide|global={{ direction: 1 }}>
          <button
            class="card"
            type="button"
            aria-label={`Flip hunt event ${card}, showing ${face}`}
            aria-keyshortcuts="ArrowLeft ArrowRight"
            title="Flip card (Left/Right arrows)"
            aria-disabled={flipping || undefined}
            style:--rotation={`${rotation}deg`}
            {onclick}
            ontransitionend={finishTransition}
            ontransitioncancel={finishTransition}
            {@attach trackCard}
            {@attach swipe({ onSwipe: flip })}
          >
            <img class={["back", showReverse && "is-hidden"]} src={cardAsset(images.back)} alt="" aria-hidden="true" />
            {#if images.reverse}
              <img class={["back", !showReverse && "is-hidden"]} src={cardAsset(images.reverse)} alt="" aria-hidden="true" />
            {/if}
            <img class="front" src={cardAsset(images.front)} alt="" aria-hidden="true" />
            {#if !hasClicked && !showCard}<span class="ripple" aria-hidden="true"></span>{/if}
          </button>
        </div>
      {/key}
    {/if}
    {#if loadError}
      <div class="load-status" role="alert">
        <p>Could not load this hunt card. Check your connection and try again.</p>
        <button class="retry" type="button" onclick={retryImages}>Retry images</button>
      </div>
    {:else if busy}<p class="load-status" role="status">Drawing...</p>{/if}
  </div>
  <footer>
    <button
      class="selection"
      type="button"
      onclick={selectHunt}
      disabled={drawing}
      aria-disabled={flipping || undefined}
      aria-label={`Select hunt event, current event ${card}`}
      aria-keyshortcuts="/ ArrowUp ArrowDown"
      title="Select event (/, Up/Down arrows)"
    >
      <span class="dice" aria-hidden="true">
        <span class="die light" style:--roll={drawing && !reducedMotion.current ? `${-45 - (secondRand / 9) * 360}deg` : "-45deg"}>
          <span>
            {#if first === 0}<KdIcon i="lantern" />{:else}{first}{/if}
          </span>
        </span>
        <span class="die" style:--roll={drawing && !reducedMotion.current ? `${45 + (firstRand / 9) * 360}deg` : "45deg"}>
          <span>
            {#if second === 0}<KdIcon i="lantern" />{:else}{second}{/if}
          </span>
        </span>
      </span>
      <span class="selection-label">Event {card}<span>Select event</span></span>
    </button>
    <button class="random" type="button" onclick={draw} disabled={drawing || flipping} aria-keyshortcuts="r" title="Random event (R)">
      <span>
        {#if drawing}Drawing{:else}Random{/if}
      </span>
      <span class="control-icon i-material-symbols:playing-cards-outline" aria-hidden="true"></span>
    </button>
    <div class="menu"><MenuButton /></div>
  </footer>
  <p class="visually-hidden" aria-live="polite">Hunt event {card}, {face}.</p>
</main>

<HuntPicker bind:this={picker} {card} onselect={select} />

<style>
  main {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    block-size: calc(100dvh - var(--border-width));
    padding: max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom))
      max(0.5rem, env(safe-area-inset-left));
    /* Keep animations within the viewport while allowing the card to cross the footer. */
    overflow: clip;
    gap: 0.5rem;
    background:
      radial-gradient(ellipse at 50% 40%, color-mix(var(--hunt-event-background) 15%, transparent), transparent 70%), var(--background);
  }
  .stage {
    container-type: size;
    display: grid;
    z-index: 1;
    place-items: center;
    min-block-size: 0;
  }
  .slide {
    display: grid;
    z-index: 1;
    grid-area: 1 / 1;
    perspective: 1000px;
  }
  .card {
    position: relative;
    aspect-ratio: var(--aspect);
    inline-size: min(100cqw, calc(100cqh * var(--aspect)));
    transform: rotateY(var(--rotation));
    transform-style: preserve-3d;
    border-radius: var(--radius-card);
    box-shadow: 0 0.75rem 3rem #00000080;
    touch-action: pan-y pinch-zoom;
    transition: transform var(--duration-flip) cubic-bezier(0.3, 1.4, 0.6, 1);
  }
  img {
    position: absolute;
    inline-size: 100%;
    block-size: 100%;
    inset: 0;
    border-radius: inherit;
    backface-visibility: hidden;
    &.is-hidden {
      visibility: hidden;
    }
  }
  .front {
    transform: rotateY(180deg);
  }
  .ripple {
    --size-ripple: 25rem;
    position: absolute;
    /* Render at full size so the animation only scales down. */
    inline-size: var(--size-ripple);
    block-size: var(--size-ripple);
    inset-block-start: 50%;
    inset-inline-start: 50%;
    border: calc(var(--size-ripple) / 10) solid var(--foreground);
    border-radius: 50%;
    animation: ripple 2s 5s ease-out infinite;
    opacity: 0;
    pointer-events: none;
  }
  .load-status {
    grid-area: 1 / 1;
    max-inline-size: 20rem;
    padding: 1rem;
    border-radius: var(--radius-control);
    background: var(--panel);
    text-align: center;
    &[role="alert"] {
      z-index: 2;
    }
  }
  .retry {
    min-block-size: 2.75rem;
    margin-block-start: 0.75rem;
    padding-inline: 1rem;
    border: var(--border-width) solid var(--accent);
    border-radius: var(--radius-control);
  }
  footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 0.25rem;
  }
  .menu {
    justify-self: end;
  }
  .selection {
    display: flex;
    align-items: center;
    justify-self: start;
    min-block-size: var(--size-floating-control);
    padding-inline: 0.375rem;
    gap: 0.75rem;
    border-radius: var(--radius-control);
    text-align: start;
    &:is(:hover, :focus-visible) {
      background: var(--card);
    }
  }
  .dice {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }
  .die {
    display: grid;
    place-items: center;
    inline-size: 1.875rem;
    block-size: 1.875rem;
    rotate: var(--roll);
    border: var(--border-width) solid var(--grey-2);
    border-radius: var(--radius-control);
    background: var(--background);
    color: var(--foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-xl);
    line-height: var(--line-height-none);
    font-variant-numeric: tabular-nums;
    transition: rotate 200ms ease-in-out;
    &.light {
      background: var(--grey-0);
      color: var(--contrast);
    }
    & > span {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
      rotate: -45deg;
    }
    &.light > span {
      rotate: 45deg;
    }
  }
  .selection-label {
    display: none;
    font-weight: var(--font-bold);
    line-height: var(--line-height-snug);
    & > span {
      display: block;
      color: var(--muted-foreground);
      font-weight: var(--font-normal);
      font-size: var(--text-sm);
    }
  }
  .random {
    --accent: var(--grey-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    inline-size: 8rem;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    line-height: var(--line-height-none);
    transition: var(--transition-colors);
    &:is(:hover, :focus-visible):not(:disabled) {
      border-color: var(--accent);
      background: var(--card);
    }
    & .control-icon {
      scale: 1 -1;
    }
  }
  :is(.selection, .random):disabled {
    cursor: default;
    opacity: 0.5;
  }
  @keyframes ripple {
    from {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0.8;
    }
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
  @media (min-width: 40rem) {
    .selection {
      padding-inline: 0.75rem;
    }
    .selection-label {
      display: block;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
    .die {
      transition: none;
    }
    .ripple {
      display: none;
      animation: none;
    }
  }
</style>
