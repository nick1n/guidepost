<script module lang="ts">
  type Point = { x: number; y: number; bounds: DOMRect };
  type Press = Point & { id: number };
  type Ripple = { x: number; y: number; radius: number; complete: boolean; fading: boolean };

  function measureRipple(surface: HTMLElement, point?: Point, bounds = surface.getBoundingClientRect()) {
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    const x = point ? ((point.x - bounds.left) * width) / bounds.width : width / 2;
    const y = point ? ((point.y - bounds.top) * height) / bounds.height : height / 2;
    return { x, y, radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) };
  }
</script>

<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import { DURATION_FAST, DURATION_HOLD } from "#lib/constants.ts";

  // Render a native button with the supplied events and place the ripple inside its positioned surface.
  // coverParent lets a header's ripple cover sibling actions without making those actions hold targets.
  let {
    ontap,
    onhold,
    holdHint,
    coverParent = false,
    children,
  }: {
    ontap: () => void;
    onhold?: () => string | void;
    holdHint?: string;
    coverParent?: boolean;
    children: Snippet<[typeof events, Snippet, boolean]>;
  } = $props();
  const hintId = $props.id();
  let ripple = $state<Ripple | null>(null);
  let rippleId = $state(0);
  let announcement = $state("");
  let holding = $state(false);
  let pointer: Press | undefined;
  let spaceDown = false;
  let suppressClick = false;
  let completed = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  function showRipple(button: HTMLButtonElement, point?: Point) {
    clearTimeout(fadeTimer);
    const surface = coverParent ? button.parentElement! : button;
    const geometry = measureRipple(surface, point, !coverParent ? point?.bounds : undefined);
    rippleId += 1;
    ripple = { ...geometry, complete: false, fading: false };
    completed = false;
    suppressClick = false;
    announcement = "";
  }

  function fadeRipple() {
    clearTimeout(fadeTimer);
    holding = false;
    if (!ripple) return;
    ripple.fading = true;
    fadeTimer = setTimeout(() => (ripple = null), DURATION_FAST);
  }

  function completeHold() {
    holdTimer = undefined;
    completed = true;
    holding = true;
    suppressClick = true;
    if (ripple) ripple.complete = true;
    announcement = onhold?.() ?? "";
  }

  function startHold() {
    clearTimeout(holdTimer);
    if (onhold) {
      holding = true;
      holdTimer = setTimeout(completeHold, DURATION_HOLD);
    }
  }

  function cancelPress() {
    if (!pointer && !spaceDown) return;
    clearTimeout(holdTimer);
    pointer = undefined;
    spaceDown = false;
    suppressClick = true;
    fadeRipple();
  }

  function onpointerdown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || pointer || spaceDown) return;
    const button = event.currentTarget as HTMLButtonElement;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, bounds: button.getBoundingClientRect() };
    showRipple(button, pointer);
    startHold();
  }

  function onpointermove(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    const { x, y, bounds } = pointer;
    if (
      Math.hypot(event.clientX - x, event.clientY - y) >= 6 ||
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      cancelPress();
  }

  function onpointerup(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    clearTimeout(holdTimer);
    pointer = undefined;
    suppressClick = completed;
    fadeRipple();
  }

  function onpointercancel(event: PointerEvent) {
    if (pointer?.id === event.pointerId) cancelPress();
  }

  function onclick(event: MouseEvent) {
    if (suppressClick && event.detail > 0) {
      suppressClick = false;
      return;
    }
    suppressClick = false;
    if (!ripple || event.detail === 0) {
      showRipple(event.currentTarget as HTMLButtonElement);
      fadeTimer = setTimeout(fadeRipple, DURATION_FAST / 2);
    }
    ontap();
  }

  function onkeydown(event: KeyboardEvent) {
    const button = event.currentTarget as HTMLButtonElement;
    if (event.repeat && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && event.shiftKey && onhold) {
      event.preventDefault();
      cancelPress();
      showRipple(button);
      completeHold();
      fadeTimer = setTimeout(fadeRipple, DURATION_FAST);
    } else if (event.key === " ") {
      event.preventDefault();
      if (pointer || spaceDown) return;
      spaceDown = true;
      showRipple(button);
      startHold();
    } else if (event.key === "Enter") suppressClick = false;
  }

  function onkeyup(event: KeyboardEvent) {
    if (event.key !== " ") return;
    event.preventDefault();
    if (!spaceDown) return;
    spaceDown = false;
    clearTimeout(holdTimer);
    if (!completed) ontap();
    suppressClick = false;
    fadeRipple();
  }

  function oncontextmenu(event: MouseEvent) {
    if (onhold) event.preventDefault();
  }

  function dismissWithEscape(event: KeyboardEvent) {
    if (event.key === "Escape") cancelPress();
  }

  onDestroy(() => {
    clearTimeout(holdTimer);
    clearTimeout(fadeTimer);
  });

  const events = {
    onclick,
    onpointerdown,
    onkeydown,
    onkeyup,
    oncontextmenu,
    onblur: cancelPress,
    get "aria-describedby"() {
      return onhold && holdHint ? hintId : undefined;
    },
  };
</script>

<svelte:window {onpointermove} {onpointerup} {onpointercancel} onblur={cancelPress} onresize={cancelPress} onkeydown={dismissWithEscape} />
<svelte:document onvisibilitychange={cancelPress} />

{@render children(events, paint, holding)}
{#if onhold}
  {#if holdHint}<span class="visually-hidden" id={hintId}>{holdHint}</span>{/if}
  <span class="visually-hidden" role="status">{announcement}</span>
{/if}

{#snippet paint()}
  <span class="ripple-layer" aria-hidden="true">
    {#if ripple}
      {#key rippleId}
        <span
          class={["ripple", ripple.complete && "complete", ripple.fading && "fading"]}
          data-hold={Boolean(onhold)}
          style:--point-x={`${ripple.x}px`}
          style:--point-y={`${ripple.y}px`}
          style:--radius-ripple={`${ripple.radius}px`}
          style:--duration-hold={`${DURATION_HOLD}ms`}
        ></span>
      {/key}
    {/if}
  </span>
{/snippet}

<style>
  .ripple-layer {
    position: absolute;
    inset: 0;
    overflow: clip;
    border-radius: inherit;
    pointer-events: none;
  }
  .ripple {
    position: absolute;
    inset: 0;
    background: var(--foreground);
    opacity: 0.08;
    clip-path: circle(0.5rem at var(--point-x) var(--point-y));
    transition: opacity var(--duration-fast);
    &.complete {
      animation: none;
      clip-path: none;
      opacity: 0.12;
    }
    &.fading {
      animation-play-state: paused;
      opacity: 0;
    }
  }
  @keyframes hold-ripple {
    to {
      clip-path: circle(var(--radius-ripple) at var(--point-x) var(--point-y));
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .ripple[data-hold="true"]:not(.complete) {
      animation: hold-ripple calc(var(--duration-hold) * 0.875) calc(var(--duration-hold) * 0.125) linear forwards;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ripple {
      transition: none;
    }
  }
</style>
