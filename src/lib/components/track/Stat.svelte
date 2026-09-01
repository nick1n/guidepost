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

<button type="button" aria-pressed={active} data-align={pos} {onclick}>
  <span>{label}</span>
  <span class={["value", accent && "is-accent"]}>
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

    &[data-align="center"] {
      text-align: center;
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

  .value.is-accent {
    color: var(--accent);
  }
</style>
