<script lang="ts">
  import { iconView } from "./statuses";
  import type { Icon, IconContext } from "#lib/constants.ts";
  let { icon, active = false, context = "control" }: { icon: Icon; active?: boolean; context?: IconContext } = $props();
  let classes = $derived(iconView(icon, { active, context }));
</script>

{#if icon === "status:cease-to-exist"}
  <span class="cease-icon" data-context={context} aria-hidden="true">
    <span class={["cease-symbol", iconView(icon, { context })[1]]} data-visible={!active}></span>
    <span class={["cease-symbol", iconView(icon, { active: true, context })[1]]} data-visible={active}></span>
  </span>
{:else}
  <span class={classes} data-context={context} aria-hidden="true"></span>
{/if}

<style>
  span {
    display: inline-block;
    flex-shrink: 0;
    inline-size: var(--size-status-icon, 1rem);
    block-size: var(--size-status-icon, 1rem);
    &[data-context="control"] {
      inline-size: var(--size-icon-control);
      block-size: var(--size-icon-control);
    }
    &[data-context="quick"] {
      color: var(--foreground);
    }
  }
  .cease-icon {
    display: inline-grid;
    rotate: 25deg;
  }
  .cease-symbol {
    grid-area: 1 / 1;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    &[data-visible="true"] {
      opacity: 1;
    }
  }
  .retired-icon {
    rotate: -70deg;
    &[data-context="control"] {
      rotate: 20deg;
    }
  }
  :global(.active) > .retired-icon[data-context="control"] {
    rotate: -70deg;
  }
  .dead-icon {
    rotate: -90deg;
  }
  .dead-icon[data-context="control"] {
    rotate: 0deg;
  }
  :global(.active) > .dead-icon[data-context="control"] {
    rotate: -90deg;
  }
  .ready-icon,
  .dodge-icon[data-context="quick"] {
    color: var(--accent-green);
  }
  .priority-icon[data-context="quick"] {
    color: var(--accent);
  }
  .knocked-icon[data-context="quick"] {
    color: var(--accent-red);
  }

  @media (prefers-reduced-motion: no-preference) {
    .cease-icon[data-context="control"] > .cease-symbol {
      transition: opacity var(--duration-slow) var(--ease-standard);
    }
    .retired-icon[data-context="control"] {
      transition: rotate var(--duration-slow) linear;
    }
    .dead-icon[data-context="control"] {
      transition: rotate var(--duration-slow) var(--ease-standard);
    }
    :global(.active) > .dead-icon[data-context="control"] {
      transition-timing-function: var(--ease-bounce);
    }
    :global(.active) > .insane-icon[data-context="control"] {
      animation: shake 55ms linear 7;
    }
    :global(.active) > .controller-icon[data-context="control"] {
      animation: controller-play var(--duration-medium) ease-in-out;
    }
    .blind-icon[data-context="quick"],
    .priority-icon[data-context="quick"],
    :global(.active) > .priority-icon[data-context="control"] {
      animation: pulse 2s ease-in-out infinite;
    }
  }
  @keyframes controller-play {
    0%,
    100% {
      rotate: 0deg;
      scale: 1;
    }
    20% {
      rotate: -10deg;
      scale: 1.06 0.94;
    }
    40% {
      rotate: 10deg;
      scale: 1;
    }
    60% {
      rotate: -6deg;
      scale: 1.03 0.97;
    }
    80% {
      rotate: 4deg;
      scale: 1;
    }
  }
  @keyframes shake {
    0%,
    100% {
      translate: 0;
    }
    25% {
      translate: -2px;
    }
    75% {
      translate: 2px;
    }
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      scale: 1.125;
    }
    50% {
      opacity: 0.2;
      scale: 1;
    }
  }
</style>
