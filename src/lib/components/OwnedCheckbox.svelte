<script lang="ts">
  type Props = {
    checked: boolean;
    onchange: () => void;
    label: string;
  };

  let { checked, onchange, label }: Props = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  onclick={(event) => {
    event.stopPropagation();
    onchange();
  }}
  class={[
    "flex size-7 shrink-0 items-center justify-center border-2 transition-colors isolate border-foreground inset-ring-2 inset-ring-black",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    checked ? "bg-foreground" : "bg-black",
  ]}
>
  <span class="sr-only">{checked ? `Owned: ${label}` : `Mark ${label} as owned`}</span>
</button>
