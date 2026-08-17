<script lang="ts">
  type Props = {
    pos: "left" | "right" | "center";
    label: string;
    value: string | number;
    accent?: boolean;
  };

  let { pos, label, value, accent = false }: Props = $props();
</script>

<div class={["flex flex-col", "text-" + pos]}>
  <span class="text-foreground">{label}</span>
  <span class={["font-display text-xl font-semibold tabular-nums leading-tight", accent ? "text-accent" : "text-foreground"]}>
    {value}
  </span>
</div>
