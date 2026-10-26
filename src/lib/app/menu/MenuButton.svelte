<script lang="ts">
  import { getSiteMenu } from "#lib/app/menu/site-menu.svelte.ts";
  import { getNotificationLog } from "#lib/app/notifications/notification-log.svelte.ts";
  import FloatingButton from "#lib/components/FloatingButton.svelte";

  const menu = getSiteMenu();
  const log = getNotificationLog();
  const id = $props.id();
  const action = $derived.by(() => {
    if (!menu.open) return { label: "Open menu", icon: "menu", run: () => menu.onopen() };
    if (menu.onback) return { label: "Back to menu", icon: "back", run: menu.onback };
    return { label: "Close menu", icon: "close", run: () => menu.onclose() };
  });

  function onclick() {
    action.run();
  }
</script>

<FloatingButton
  label={action.label}
  data-menu-trigger
  aria-haspopup="dialog"
  aria-expanded={menu.open}
  aria-describedby={log.unreadError ? `${id}-error` : undefined}
  {onclick}
>
  {#key action.icon}
    <span
      class={[
        "control-icon",
        action.icon === "back" && "i-material-symbols:arrow-back",
        action.icon === "close" && "i-material-symbols:close",
        action.icon === "menu" && "i-material-symbols:menu",
      ]}
      aria-hidden="true"
    ></span>
  {/key}
  {#if log.unreadError}
    {#key log.unreadError.id}
      <!-- Preserve the pulse's age when navigation remounts the menu button. -->
      <span class="error-dot" aria-hidden="true" style:animation-delay={`${Math.min(0, log.unreadError.recordedAt - Date.now())}ms`}></span>
    {/key}
    <span class="visually-hidden" id={`${id}-error`}>New error in the notification log</span>
  {/if}
</FloatingButton>

<style>
  .control-icon {
    animation: icon-change var(--duration-fast) var(--ease-standard);
  }

  .error-dot {
    position: absolute;
    inset-block-start: 0.375rem;
    inset-inline-end: 0.375rem;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 50%;
    background: var(--destructive);
    animation: error-pulse var(--duration-slow) var(--ease-standard);
  }

  @keyframes error-pulse {
    50% {
      transform: scale(1.5);
      box-shadow: 0 0 0 0.25rem color-mix(var(--destructive) 25%, transparent);
    }
  }

  @keyframes icon-change {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .control-icon,
    .error-dot {
      animation: none;
    }
  }
</style>
