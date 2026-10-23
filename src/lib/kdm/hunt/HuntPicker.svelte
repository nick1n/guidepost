<script module lang="ts">
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
</script>

<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { prefersReducedMotion as reducedMotion } from "svelte/motion";
  import { DURATION_FAST } from "#lib/constants.ts";
  import { createSwipeDismiss } from "#lib/swipe-dismiss.svelte.ts";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { selectDigit } from "./cards.ts";

  let { card, onselect }: { card: number; onselect: (card: number) => void } = $props();
  const id = $props.id();
  let dialog: HTMLDialogElement;
  let open = $state(false);
  let keyboard = $state(false);
  let closing = false;
  let closeTimer: Timeout;
  let numberPlace = 10;
  let activePlace = 10;
  const dismissal = createSwipeDismiss(close);

  onDestroy(() => clearTimeout(closeTimer));

  export function show() {
    if (dialog.open || closing) return;
    numberPlace = 10;
    activePlace = 10;
    keyboard = false;
    dismissal.reset();
    dialog.showModal();
    open = true;
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  async function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dismissal.reset();
    // Re-enable transitions after dragging before removing the native open state.
    await tick();
    if (!dialog.isConnected) return;
    dialog.close();
    open = false;
    closeTimer = setTimeout(finishClose, reducedMotion.current ? 0 : DURATION_FAST + 50);
  }

  function finishClose() {
    clearTimeout(closeTimer);
    closing = false;
  }

  function ontransitionend(event: TransitionEvent) {
    if (closing && !dialog.open && event.target === dialog.firstElementChild && event.propertyName === "translate") finishClose();
  }

  function onclick(event: MouseEvent) {
    if (event.target === dialog) close();
  }

  function oncancel(event: Event) {
    event.preventDefault();
    close();
  }

  function onpointerdown() {
    keyboard = false;
  }

  function onfocusin(event: FocusEvent) {
    const column = (event.target as Element).closest<HTMLElement>("[data-place]");
    if (column) activePlace = Number(column.dataset.place);
  }

  function focusDigit(place: number, digit: number) {
    dialog.querySelector<HTMLButtonElement>(`[data-place="${place}"] [data-digit="${digit}"]`)?.focus();
  }

  function chooseDigit(place: number, digit: number) {
    onselect(selectDigit(card, place, digit));
    focusDigit(place, digit);
  }

  function onkeydown(event: KeyboardEvent) {
    if (!dialog.open || closing || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) void close();
      return;
    }
    if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End" || /^[0-9]$/.test(event.key)) {
      keyboard = true;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      if (event.repeat) return;
      chooseDigit(numberPlace, Number(event.key));
      numberPlace = numberPlace === 10 ? 1 : 10;
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-digit]");
    const place = button ? Number(button.closest<HTMLElement>("[data-place]")?.dataset.place) : activePlace;
    const selected = place === 10 ? Math.floor(card / 10) % 10 : card % 10;
    const index = digits.indexOf(selected);
    let digit: number;
    switch (event.key) {
      case "ArrowUp":
        digit = digits[(index + digits.length - 1) % digits.length];
        break;
      case "ArrowDown":
        digit = digits[(index + 1) % digits.length];
        break;
      case "Home":
        digit = digits[0];
        break;
      case "End":
        digit = digits[digits.length - 1];
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const next = event.key === "ArrowLeft" ? 10 : 1;
        focusDigit(next, next === 10 ? Math.floor(card / 10) % 10 : card % 10);
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    chooseDigit(place, digit);
  }
</script>

<div class={["scrim", open && "is-open"]} aria-hidden="true"></div>
<dialog
  bind:this={dialog}
  aria-labelledby={`${id}-title`}
  aria-describedby={`${id}-keys`}
  data-dragging={dismissal.distance > 0}
  style:--drag={`${dismissal.distance}px`}
  {onclick}
  {oncancel}
  {onkeydown}
  {onpointerdown}
  {onfocusin}
  {ontransitionend}
  {@attach dismissal.attach}
>
  <div class="sheet">
    <header data-drag-handle>
      <span class="grip" aria-hidden="true"></span>
      <h2 id={`${id}-title`}>Select hunt event</h2>
      <p id={`${id}-keys`} class="visually-hidden">
        Use Up and Down to select a digit and Left and Right to switch columns. Number keys alternate between tens and ones. Enter or Escape
        closes the dialog.
      </p>
    </header>
    <div class={["dice", keyboard && "keyboard"]}>
      {#each [10, 1] as place (place)}
        {@const selected = place === 10 ? Math.floor(card / 10) % 10 : card % 10}
        <fieldset class={place === 1 ? "ones" : undefined} data-place={place}>
          <legend>{place === 10 ? "tens" : "ones"}</legend>
          <div class="stack">
            {#each digits as digit (digit)}
              <button
                class={["die", place === 10 && "light"]}
                type="button"
                aria-label={`${place === 10 ? "tens" : "ones"} ${digit}`}
                aria-pressed={selected === digit}
                tabindex={selected === digit ? 0 : -1}
                data-digit={digit}
                onclick={() => onselect(selectDigit(card, place, digit))}
              >
                <span>
                  {#if digit === 0}<KdIcon i="lantern" />{:else}{digit}{/if}
                </span>
              </button>
            {/each}
          </div>
        </fieldset>
      {/each}
    </div>
    <footer><button class="close" type="button" onclick={close}>Close</button></footer>
  </div>
</dialog>

<style>
  .scrim {
    z-index: 4;
    position: fixed;
    inset: 0;
    background: #00000080;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--duration-fast),
      visibility var(--duration-fast);

    &.is-open {
      opacity: 1;
      visibility: visible;
    }
  }
  dialog {
    inline-size: max-content;
    max-inline-size: calc(100% - 2rem);
    max-block-size: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: var(--foreground);
    transition:
      display var(--duration-fast),
      overlay var(--duration-fast);
    transition-behavior: allow-discrete;
    &[open] {
      display: grid;
    }
    &::backdrop {
      background: transparent;
    }
  }
  .sheet {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: 0;
    max-block-size: inherit;
    translate: 0 calc(50dvh + 50%);
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-card);
    background: var(--surface-glass);
    backdrop-filter: var(--filter-glass);
    box-shadow:
      0 1rem 4rem #00000099,
      inset 0 1px #ffffff0a;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard);
  }
  dialog[open] .sheet {
    translate: 0 var(--drag);
    opacity: 1;
  }
  dialog[data-dragging="true"] .sheet {
    transition: none;
  }
  header {
    display: grid;
    justify-items: center;
    padding: 0.75rem 1rem 1rem;
    gap: 0.75rem;
    cursor: grab;
    touch-action: none;
  }
  .grip {
    inline-size: 2.5rem;
    block-size: 0.25rem;
    border-radius: var(--radius-control);
    background: var(--grey-6);
  }
  h2 {
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }
  .close {
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem 1rem;
    border: var(--border-width) solid var(--grey-6);
    border-radius: var(--radius-control);
    background: var(--card);
    font-weight: var(--font-bold);
    touch-action: pan-x;
    transition: var(--transition-colors);
    &:is(:hover, :focus-visible) {
      border-color: var(--grey-4);
      background: var(--grey-7);
    }
  }
  footer {
    padding: 0.5rem 1rem 1rem;
  }
  .dice {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    justify-content: center;
    min-block-size: 0;
    padding-inline: 1rem;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    gap: 2.5rem;
  }
  fieldset {
    display: grid;
    justify-items: center;
    min-inline-size: 0;
  }
  .keyboard fieldset:focus-within legend {
    position: relative;
    isolation: isolate;
    color: var(--accent-foreground);
    &::before,
    &::after {
      content: "";
      position: absolute;
      z-index: -1;
    }
    &::before {
      inset: 0 -0.75rem;
      background: var(--blue-4);
    }
    &::after {
      z-index: -2;
      inset: 0.25rem -1.25rem -0.25rem;
      background: var(--blue-5);
      clip-path: polygon(
        0 0,
        100% 0,
        calc(100% - 0.375rem) 50%,
        100% 100%,
        calc(100% - 0.5rem) 100%,
        calc(100% - 0.5rem) calc(100% - 0.25rem),
        0.5rem calc(100% - 0.25rem),
        0.5rem 100%,
        0 100%,
        0.375rem 50%
      );
    }
  }
  legend {
    margin-block-end: 1rem;
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-align: center;
  }
  .stack {
    display: grid;
    grid-template-rows: repeat(9, 2.25rem) 2.75rem;
    inline-size: 5.25rem;
    padding-inline: 0.125rem;
    padding-block-end: 1.125rem;
  }
  .die {
    display: grid;
    place-items: center;
    justify-self: end;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    rotate: 45deg;
    border: var(--border-width) solid var(--grey-4);
    border-radius: var(--radius-control);
    background: var(--background);
    color: var(--foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-xl);
    line-height: var(--line-height-none);
    font-variant-numeric: tabular-nums;
    transition: var(--transition-colors);
    &:nth-child(even) {
      justify-self: start;
    }
    &.light {
      background: var(--grey-0);
      color: var(--contrast);
    }
    &[aria-pressed="true"] {
      border-color: var(--accent);
      outline: var(--border-width) solid var(--accent);
      outline-offset: 0.125rem;
      box-shadow: 0 0 1rem color-mix(var(--accent) 40%, transparent);
    }
    &:is(:hover, :focus-visible) {
      border-color: var(--accent);
      box-shadow: 0 0 1rem color-mix(var(--accent) 40%, transparent);
    }
    & > span {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
      rotate: -45deg;
    }
  }
  .ones .die {
    justify-self: start;
    &:nth-child(even) {
      justify-self: end;
    }
  }
  @starting-style {
    dialog[open] .sheet {
      translate: 0 calc(50dvh + 50%);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    dialog[open] .sheet {
      translate: 0 var(--drag);
    }
  }
</style>
