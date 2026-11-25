<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import type { KdIconName } from "#lib/constants.ts";
  const marks = { Settlement: "lantern", Hunt: "movement", Showdown: "swords" } as const;
  let { phase, context, title, subject }: { phase: keyof typeof marks; context: string; title: string; subject?: KdIconName } = $props();
</script>

<div class="cover">
  <div class="copy">
    <p class="phase"><KdIcon i={marks[phase]} />{phase}</p>
    <h2>{title}</h2>
    <p class="context">{context}</p>
  </div>
  <div class="hand" aria-hidden="true">
    <span class="back first"></span>
    <span class="back second"></span>
    <span class="face"><KdIcon i={subject ?? marks[phase]} /></span>
  </div>
</div>

<style>
  .cover {
    display: grid;
    position: relative;
    grid-template-columns: minmax(0, 1fr) 41%;
    align-items: center;
    padding: 0.875rem 0.75rem 1.125rem 1rem;
    overflow: hidden;
    background: var(--background);
    isolation: isolate;
    color: var(--foreground);
  }
  .cover::before {
    z-index: -1;
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, var(--red-10), var(--red-8));
    content: "";
    clip-path: polygon(66% 0, 100% 0, 100% 100%, 36% 100%);
  }
  .phase {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--identity-3, var(--muted-foreground));
    font-size: var(--text-md);
  }
  h2 {
    max-inline-size: 100%;
    margin-block: 0.5rem 0.375rem;
    font:
      italic clamp(2rem, 10.5cqi, 3.5rem)/0.92 Georgia,
      serif;
    letter-spacing: -0.065em;
    text-wrap: balance;
  }
  .context {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .hand {
    position: relative;
    justify-self: center;
    aspect-ratio: 0.7;
    inline-size: clamp(3.625rem, 18cqi, 5rem);
  }
  .hand span:not(:global(.kd-icon)) {
    position: absolute;
    inset: 0;
    transform-origin: 50% 104%;
    border-radius: 0.375rem;
    box-shadow: 0 2px 5px #0006;
  }
  .back {
    border: 1px solid var(--identity-4, var(--muted-foreground));
    background: repeating-linear-gradient(45deg, var(--red-9) 0 3px, var(--red-7) 3px 4px);
  }
  .first {
    rotate: -21deg;
  }
  .second {
    rotate: -6deg;
  }
  .face {
    display: grid;
    place-items: center;
    rotate: 11deg;
    border: 3px solid var(--identity-1, var(--foreground));
    outline: 1px solid var(--grey-6);
    outline-offset: -5px;
    background: var(--identity-1, var(--foreground));
    color: var(--contrast);
    font-size: clamp(2.25rem, 11cqi, 3.25rem);
  }
  .face::before,
  .face::after {
    position: absolute;
    inline-size: 0.25rem;
    block-size: 0.25rem;
    rotate: 45deg;
    background: currentColor;
    content: "";
  }
  .face::before {
    inset: 0.5rem auto auto 0.5rem;
  }
  .face::after {
    inset: auto 0.5rem 0.5rem auto;
  }
</style>
