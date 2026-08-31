<script lang="ts">
  type Props = {
    pos: "left" | "right" | "center";
    label: string;
    count: number;
    value: string;
    accent?: boolean;
    active?: boolean;
    onclick?: () => void;
  };

  let { pos, label, count, value, accent = false, active = false, onclick }: Props = $props();
</script>

<button
  type="button"
  aria-pressed={active}
  {onclick}
  class={[
    "flex w-full cursor-pointer flex-col px-3 py-2",
    "text-" + pos,
    active ? "bg-accent/15 text-accent" : "hover:bg-card/70 focus-visible:outline-accent focus-visible:outline-2",
  ]}
>
  <span class="text-foreground">{label}</span>
  <span class={["font-display text-xl leading-tight font-semibold tabular-nums", accent ? "text-accent" : "text-foreground"]}>
    {count} - {value}
  </span>
</button>
