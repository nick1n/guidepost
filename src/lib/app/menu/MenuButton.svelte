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
  {#if log.latestInfo}
    {#key log.latestInfo.id}
      <span
        class="notification-dot info-pulse"
        aria-hidden="true"
        style:animation-delay={`${Math.min(0, log.latestInfo.recordedAt - Date.now())}ms`}
      ></span>
    {/key}
  {/if}
  {#if log.unreadError}
    {#key log.unreadError.id}
      <!-- Preserve the pulse's age when navigation remounts the menu button. -->
      <span
        class="notification-dot error-dot"
        aria-hidden="true"
        style:animation-delay={`${Math.min(0, log.unreadError.recordedAt - Date.now())}ms`}
      ></span>
    {/key}
    <span class="visually-hidden" id={`${id}-error`}>New error in the notification log</span>
  {/if}
</FloatingButton>

<style>
  .control-icon {
    animation: icon-change var(--duration-fast) var(--ease-standard);
  }

  .notification-dot {
    --dot-color: var(--destructive);

    position: absolute;
    inset-block-start: 0.125rem;
    inset-inline-start: 0.125rem;
    inline-size: 0.875rem;
    block-size: 0.875rem;
    border: 0.125rem solid var(--card);
    border-radius: 50%;
    background: var(--dot-color);
    animation: notification-pop var(--duration-slow) var(--ease-standard);

    &.info-pulse {
      --dot-color: var(--accent-blue);
      --dot-end-opacity: 0;
      --dot-end-scale: 0.75;

      opacity: 0;
    }
  }

  @keyframes notification-pop {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    18% {
      opacity: 1;
      transform: scale(1.25);
    }
    30%,
    65% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: var(--dot-end-opacity, 1);
      transform: scale(var(--dot-end-scale, 1));
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
    .notification-dot:is(.info-pulse, .error-dot) {
      animation: none;
    }
  }
</style>
