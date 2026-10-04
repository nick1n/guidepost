<script lang="ts">
  let {
    name,
    max,
    marks,
    milestones = [],
    variant,
    value = $bindable(0),
  }: { name: string; max: number; marks: number[]; milestones?: string[]; variant: number; value?: number } = $props();
  let next = $derived(marks.findIndex((mark) => value < mark));
  const id = $props.id();
  function setValue(next: number) {
    value = Math.max(0, Math.min(max, Math.round(next || 0)));
  }
  function oninput(event: Event) {
    setValue((event.currentTarget as HTMLInputElement).valueAsNumber);
  }
</script>

<div class={["track", variant === 2 && "journey", variant === 3 && "segmented"]}>
  <div class="track-heading">
    {#if variant === 3}
      <label for={`${id}-range`}>{name}</label><output for={`${id}-range`}>{value}</output>
    {:else}
      <span id={`${id}-name`}>{name}</span>
      <div class="stepper">
        <button aria-label={`Decrease ${name}`} disabled={value <= 0} onclick={() => setValue(value - 1)}>
          <span class="step-icon i-material-symbols:remove" aria-hidden="true"></span>
        </button>
        <output aria-live="polite">{value}</output>
        <button aria-label={`Increase ${name}`} disabled={value >= max} onclick={() => setValue(value + 1)}>
          <span class="step-icon i-material-symbols:add" aria-hidden="true"></span>
        </button>
      </div>
    {/if}
  </div>
  <div class={["slider", variant !== 3 && "readonly"]}>
    <div class="rail" aria-hidden="true">
      <span class="fill" style:inline-size={`${(value / max) * 100}%`}></span>
      {#if variant === 3}
        <div class="segments">
          {#each Array.from({ length: max }, (_, i) => i + 1) as step (step)}<span></span>{/each}
        </div>
      {/if}
      {#each marks as mark (mark)}
        <span class={["milestone", value >= mark && "reached"]} style:left={`${(mark / max) * 100}%`}></span>
      {/each}
    </div>
    {#if variant === 3}
      <input
        id={`${id}-range`}
        type="range"
        min="0"
        {max}
        step="1"
        {value}
        {oninput}
        aria-valuetext={`${value} of ${max}`}
        aria-describedby={`${id}-milestones`}
      />
    {:else}
      <progress class="visually-hidden" {value} {max} aria-labelledby={`${id}-name`} aria-describedby={`${id}-milestones`}></progress>
    {/if}
  </div>
  <p id={`${id}-milestones`} class="next" aria-live="polite">
    {next < 0 ? `${milestones.at(-1) ?? "Final milestone"} reached` : `Next: ${milestones[next] ?? "Milestone"} at ${marks[next]}`}
  </p>
</div>

<style>
  .next {
    margin-block-start: -0.5rem;
    padding: 0 0.5rem 0.625rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    pointer-events: none;
  }
  .track-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-inline: 0.5rem;
    gap: 0.25rem;
    font-size: var(--text-sm);
    line-height: 1.25rem;
  }
  output {
    min-inline-size: 1.5rem;
    color: var(--foreground);
    font-size: var(--text-sm);
    font-variant-numeric: lining-nums tabular-nums;
    text-align: center;
  }
  .slider {
    position: relative;
    block-size: var(--size-control);
  }
  .rail {
    position: absolute;
    block-size: 0.375rem;
    inset-block-start: calc(50% - 0.25rem);
    inset-inline: 1.375rem;
    border-radius: 1rem;
    background: var(--card);
  }
  .fill {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: var(--identity);
  }
  .milestone {
    position: absolute;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    inset-block-start: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    border: 1px solid var(--muted-foreground);
    background: var(--panel);
    &.reached {
      border-color: var(--foreground);
      background: var(--identity);
    }

    :global(.signal) & {
      inline-size: 0.75rem;
      block-size: 0.75rem;
      transform: translate(-50%, -50%);
    }
  }
  input {
    display: block;
    appearance: none;
    position: relative;
    inline-size: 100%;
    block-size: var(--size-control);
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  input::-webkit-slider-runnable-track {
    block-size: var(--size-control);
    background: transparent;
  }
  input::-moz-range-track {
    block-size: var(--size-control);
    background: transparent;
  }
  input::-webkit-slider-thumb {
    appearance: none;
    inline-size: var(--size-control);
    block-size: var(--size-control);
    background: radial-gradient(circle, var(--foreground) 0 0.375rem, var(--background) 0.375rem 0.5rem, transparent 0.5rem);
  }
  input::-moz-range-thumb {
    inline-size: var(--size-control);
    block-size: var(--size-control);
    border: 0;
    background: radial-gradient(circle, var(--foreground) 0 0.375rem, var(--background) 0.375rem 0.5rem, transparent 0.5rem);
  }
  .journey .rail {
    block-size: 0.625rem;
    inset-block-start: calc(50% - 0.25rem);
  }
  .journey .milestone {
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  .segmented .rail {
    block-size: 0.625rem;
    inset-block-start: calc(50% - 0.375rem);
  }
  .segments {
    display: flex;
    position: absolute;
    inset: 0;
  }
  .segments span {
    flex: 1;
    border-inline-end: 2px solid var(--panel);
  }
  .stepper {
    display: flex;
    align-items: center;
  }
  button {
    display: grid;
    place-items: center;
    inline-size: var(--size-control);
    block-size: var(--size-control);
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 15%, var(--panel));
    &:disabled {
      background: transparent;
      color: var(--muted-foreground);
    }
  }
  .step-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .readonly {
    block-size: 1rem;
    margin-block-end: 0.375rem;
  }
  .readonly .rail {
    inset-inline: 0.75rem;
  }
</style>
