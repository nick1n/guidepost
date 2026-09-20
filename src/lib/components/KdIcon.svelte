<script lang="ts">
  import { KD_ICONS, type KdIconName } from "#lib/constants.ts";

  type Props = {
    i: KdIconName;
    label?: string;
  };

  let { i, label = "img" }: Props = $props();
</script>

<span class="kd-icon" role={label} aria-label={label} aria-hidden={!!label}>{KD_ICONS[i]}</span>

<style>
  :global(.kd-icon) {
    font-weight: 400;
    font-style: normal;
    font-family: "KD Icons";
    line-height: var(--line-height-none);
  }
</style>
