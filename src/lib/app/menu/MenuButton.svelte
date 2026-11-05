<script lang="ts">
  import { getSiteMenu } from "#lib/app/menu/site-menu.svelte.ts";
  import { getNotificationLog } from "#lib/app/notifications/notification-log.svelte.ts";
  import FloatingButton from "#lib/components/FloatingButton.svelte";

  const menu = getSiteMenu();
  const log = getNotificationLog();
  const id = $props.id();
  const pulse = $derived(log.unread);
  const hasUnreadError = $derived(log.unreadKind === "error");
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
  aria-describedby={hasUnreadError ? `${id}-error` : undefined}
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
  {#if pulse}
    {#key pulse.id}
      <!-- Preserve the pulse's age when navigation remounts the menu button. -->
      <span
        class={["notification-dot", hasUnreadError ? "persistent" : "transient"]}
        data-kind={pulse.kind}
        aria-hidden="true"
        style:animation-delay={`${Math.min(0, pulse.recordedAt - Date.now())}ms`}
      ></span>
    {/key}
  {/if}
  {#if hasUnreadError}
    <span class="visually-hidden" id={`${id}-error`}>New error in the notification log</span>
  {/if}
</FloatingButton>

<style>
  .control-icon {
    animation: icon-change var(--duration-fast) var(--ease-standard);
  }

  .notification-dot {
    --dot-color: var(--accent-blue);

    position: absolute;
    inline-size: 0.875rem;
    block-size: 0.875rem;
    inset-inline-start: 0.125rem;
    inset-block-start: 0.125rem;
    border: var(--border-width) solid var(--card);
    border-radius: 50%;
    background: var(--dot-rest-color, var(--dot-color));
    animation: notification-pop var(--duration-slow) var(--ease-standard);

    &.transient {
      --dot-end-opacity: 0;
      --dot-end-scale: 0.75;

      opacity: 0;
    }
    &.persistent {
      --dot-rest-color: var(--destructive);
    }
    &[data-kind="error"] {
      --dot-color: var(--destructive);
    }
    &[data-kind="success"] {
      --dot-color: var(--accent-green);
    }
  }

  @keyframes notification-pop {
    0% {
      transform: scale(0.5);
      background: var(--dot-color);
      opacity: 0;
    }
    18% {
      transform: scale(1.25);
      opacity: 1;
    }
    30%,
    65% {
      transform: scale(1);
      background: var(--dot-color);
      opacity: 1;
    }
    100% {
      transform: scale(var(--dot-end-scale, 1));
      background: var(--dot-rest-color, var(--dot-color));
      opacity: var(--dot-end-opacity, 1);
    }
  }

  @keyframes icon-change {
    from {
      transform: scale(0.5);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .control-icon,
    .notification-dot {
      animation: none;
    }
  }
</style>
