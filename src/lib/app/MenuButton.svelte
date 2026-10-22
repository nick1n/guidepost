<script lang="ts">
  import { getSiteMenu } from "#lib/app/site-menu.svelte.ts";
  import FloatingButton from "../components/FloatingButton.svelte";

  let { onclose, onback }: { onclose?: Noop; onback?: Noop } = $props();
  const menu = getSiteMenu();
  const action = $derived(
    menu.open
      ? onback
        ? { label: "Back to menu", icon: "back", run: onback }
        : { label: "Close menu", icon: "close", run: onclose }
      : { label: "Open menu", icon: "menu", run: () => menu.onopen() },
  );

  function onclick() {
    action.run?.();
  }
</script>

<FloatingButton
  label={action.label}
  data-menu-trigger={onclose ? undefined : true}
  aria-haspopup="dialog"
  aria-expanded={menu.open}
  style={menu.open && !onclose ? "visibility: hidden" : undefined}
  {onclick}
>
  <span
    class={[
      "control-icon",
      action.icon === "back" && "i-material-symbols:arrow-back",
      action.icon === "close" && "i-material-symbols:close",
      action.icon === "menu" && "i-material-symbols:menu",
    ]}
    aria-hidden="true"
  ></span>
</FloatingButton>
