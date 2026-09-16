<script lang="ts">
  type Props = {
    pos: "left" | "right";
    label: string;
    count: number;
    value: string;
    active?: boolean;
    onclick?: Noop;
  };

  let { pos, label, count, value, active = false, onclick }: Props = $props();
</script>

<button type="button" aria-pressed={active} data-align={pos} {onclick}>
  <span>{label}</span>
  <span class="value">
    {count} - {value}
  </span>
</button>

<style>
  button {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.75rem;
    color: var(--foreground);

    &[data-align="left"] {
      text-align: left;
    }

    &[data-align="right"] {
      text-align: right;
    }

    &[aria-pressed="true"] {
      background: color-mix(var(--accent) 15%, transparent);
    }

    &:not([aria-pressed="true"]):hover {
      background: color-mix(var(--card) 70%, transparent);
    }
  }

  .value {
    font-weight: var(--font-semibold);
    font-size: var(--text-lg);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
  }
</style>
