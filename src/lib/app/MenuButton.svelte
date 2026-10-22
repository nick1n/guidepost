<script lang="ts">
  import { getSiteMenu } from "#lib/app/site-menu.svelte.ts";
  import FloatingButton from "../components/FloatingButton.svelte";

  const menu = getSiteMenu();
  const action = $derived(
    menu.open
      ? menu.onback
        ? { label: "Back to menu", icon: "back", run: menu.onback }
        : { label: "Close menu", icon: "close", run: () => menu.onclose() }
      : { label: "Open menu", icon: "menu", run: () => menu.onopen() },
  );

  function onclick() {
    action.run?.();
  }
</script>

<FloatingButton label={action.label} data-menu-trigger aria-haspopup="dialog" aria-expanded={menu.open} {onclick}>
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
</FloatingButton>

<style>
  span {
    animation: icon-change var(--duration-fast) var(--ease-standard);
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
    span {
      animation: none;
    }
  }
</style>
