<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";

  const generatedId = $props.id();
  let {
    value = $bindable(0),
    label,
    id = generatedId,
    class: className,
    shape = "default",
    large = false,
    min,
    max,
    selected = false,
    expanded,
    controls,
    icon,
    ontap,
    onhold,
    holdHint = "Click to decrease by one. Hold or press Shift+Enter to edit the value.",
  }: {
    value?: number;
    label: string;
    id?: string;
    class?: ClassValue;
    shape?: "default" | "armor" | "circle";
    large?: boolean;
    min?: number;
    max?: number;
    selected?: boolean;
    expanded?: boolean;
    controls?: string;
    icon?: Snippet;
    ontap?: () => void;
    onhold?: () => void;
    holdHint?: string;
  } = $props();

  let editing = $state(false);
  let draft = $state<number | undefined>();
  let button: HTMLButtonElement | undefined;

  function focus() {
    button?.focus();
  }

  function clamp(next: number) {
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.trunc(next)));
  }

  function decrease() {
    if (ontap) ontap();
    else value = Math.max(min ?? -Infinity, value - 1);
  }

  function edit() {
    if (onhold) onhold();
    else {
      draft = value;
      editing = true;
    }
  }

  function onblur() {
    if (!editing) return;
    if (draft !== undefined && Number.isFinite(draft)) value = clamp(draft);
    editing = false;
  }

  async function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") editing = false;
    else onblur();
    await tick();
    focus();
  }
</script>

<span class={["counter", className]} data-shape={shape} data-large={large} data-selected={selected}>
  {#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
  {#if editing}
    <input
      {id}
      type="number"
      aria-label={label}
      {min}
      {max}
      step="1"
      bind:value={draft}
      {onblur}
      {onkeydown}
      {@attach (element) => {
        element.focus();
        element.select();
      }}
    />
  {:else}
    <HoldRipple ontap={decrease} onhold={edit} {holdHint}>
      {#snippet children(events, paint)}
        <button
          {id}
          type="button"
          aria-label={`${label}: ${value}`}
          aria-expanded={expanded}
          aria-controls={controls}
          {...events}
          {@attach (element) => {
            button = element;
            return () => (button = undefined);
          }}
        >
          {value}
          {@render paint()}
        </button>
      {/snippet}
    </HoldRipple>
  {/if}
</span>

<style>
  .counter {
    --counter-inline: min(var(--size-control), var(--size-number-max));
    --counter-block: var(--size-control);
    --counter-text: calc(var(--text-num-input) * var(--scale-control-content));

    display: inline-grid;
    position: relative;
    inline-size: var(--counter-inline);
    block-size: var(--counter-block);
    border: var(--counter-border, var(--border-width) solid var(--field-border, color-mix(var(--identity) 60%, var(--panel))));
    border-radius: var(--counter-radius, var(--radius-control));
    background: var(--counter-bg, var(--field-bg, color-mix(var(--identity) 18%, var(--panel))));
    color: var(--counter-fg, var(--field-fg, color-mix(var(--identity) 55%, var(--foreground))));
    font-weight: var(--counter-weight, var(--font-bold));
    font-size: var(--counter-text);
    font-family: var(--counter-font, var(--font-sans));

    &[data-shape="circle"] {
      --counter-block: var(--counter-inline);
      border-radius: 50%;
    }
    &[data-large="true"] {
      --counter-inline: 4.5rem;
      --counter-block: 4.5rem;
      --counter-text: 3.125rem;
    }
    &[data-selected="true"] {
      outline: var(--border-width) solid var(--field-border);
      outline-offset: var(--border-width);
    }
  }
  .counter :is(button, input) {
    grid-area: 1 / 1;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: var(--line-height-none);
    text-align: center;
  }
  button {
    position: relative;
    -webkit-touch-callout: none;
  }
  input {
    appearance: textfield;
    user-select: text;
    &::-webkit-inner-spin-button {
      appearance: none;
    }
  }
  .icon {
    display: grid;
    position: absolute;
    place-items: center;
    inset: 0;
    color: color-mix(var(--identity) 42%, var(--foreground));
    opacity: 0.2;
    pointer-events: none;
  }
  :global(.folio) .counter[data-shape="armor"] {
    border-radius: 0.25rem 0.25rem 50% 50% / 0.25rem 0.25rem 35% 35%;
  }
  :global(.obsidian) .counter[data-shape="armor"] {
    border-radius: 1rem 1rem 50% 50% / 0.5rem 0.5rem 70% 70%;
  }
</style>
