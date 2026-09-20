<script lang="ts">
  import { KD_ICONS, type KdIconName } from "#lib/constants.ts";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    i: KdIconName;
    label?: string;
    class?: ClassValue;
  };

  let { i, label = "img", class: className }: Props = $props();
</script>

<span class={["kd-icon", className]} role={label} aria-label={label} aria-hidden={!!label}>{KD_ICONS[i]}</span>

<style>
  :global {
    @font-face {
      font-style: normal;
      font-weight: 400;
      src:
        url("/fonts/kd-icons-v1.woff2") format("woff2"),
        url("/fonts/kd-icons-v1.woff") format("woff");
      font-family: "KD Icons";
      font-display: block;
    }
    .kd-icon {
      font-style: normal;
      font-weight: 400;
      line-height: var(--line-height-none);
      font-family: "KD Icons";
      text-transform: unset;
    }
  }
</style>
