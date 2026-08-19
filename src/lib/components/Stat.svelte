<script lang="ts">
  type Props = {
    pos: "left" | "right" | "center";
    label: string;
    count: number;
    value: string;
    accent?: boolean;
  };

  let { pos, label, count, value, accent = false }: Props = $props();
</script>

<div class={["flex flex-col", "text-" + pos]}>
  <span class="text-foreground">{label}</span>
  <span class={["font-display text-xl font-semibold tabular-nums leading-tight", accent ? "text-accent" : "text-foreground"]}>
    {count} - {value}
  </span>
</div>
