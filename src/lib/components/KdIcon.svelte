<script lang="ts">
  import { KD_ICONS, type KdIconName } from "#lib/constants.ts";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    i: KdIconName;
    label?: string;
    text?: string;
    num?: number;
    class?: ClassValue;
  };

  let { i, label, text, num, class: className }: Props = $props();
</script>

<span
  class={["kd-icon", className]}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  data-text={text || undefined}
  data-num={num ?? undefined}
>
  {KD_ICONS[i]}
</span>

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
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    .kd-icon {
      display: inline-block;
      font-style: normal;
      font-weight: 400;
      line-height: var(--line-height-none);
      font-family: "KD Icons";
      text-rendering: geometricPrecision;
      text-transform: unset;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;

      &[data-num],
      &[data-text] {
        position: relative;

        &::after {
          display: grid;
          position: absolute;
          place-items: center;
          inset: 0;
          padding-left: 0.15em;
          content: attr(data-text);
          color: var(--kd-icon-text, var(--background));
          font-size: 0.65em;
          line-height: var(--line-height-none);
          font-family: var(--font-sans);
        }
      }

      &[data-num]::after {
        align-items: start;
        padding: 0;
        content: attr(data-num);
      }
    }
  }
</style>
