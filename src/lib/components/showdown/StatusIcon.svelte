<script lang="ts">
  import { iconView } from "./statuses";
  import type { Icon, IconContext } from "#lib/constants.ts";
  let { icon, active = false, context = "control" }: { icon: Icon; active?: boolean; context?: IconContext } = $props();
  let classes = $derived(iconView(icon, { active, context }));
</script>

<span class={classes} data-context={context} aria-hidden="true"></span>

<style>
  span {
    display: inline-block;
    flex-shrink: 0;
    inline-size: var(--size-status-icon, 1rem);
    block-size: var(--size-status-icon, 1rem);
    &[data-context="control"] {
      inline-size: 1.5rem;
      block-size: 1.5rem;
    }
    &[data-context="quick"] {
      color: var(--foreground);
    }
  }
  .cease-icon {
    rotate: 45deg;
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
    .retired-icon[data-context="control"] {
      transition: rotate 1s var(--ease-standard);
    }
    .dead-icon[data-context="control"] {
      transition: rotate var(--duration-fast) var(--ease-standard);
    }
    :global(.active) > .insane-icon[data-context="control"] {
      animation: shake 50ms linear 7;
    }
    .blind-icon[data-context="quick"],
    .priority-icon[data-context="quick"] {
      animation: pulse 2s ease-in-out infinite;
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
