<script lang="ts">
  type Props = {
    checked: boolean;
    onchange: () => void;
    label: string;
  };

  let { checked, onchange, label }: Props = $props();

  function onclick(event: MouseEvent) {
    event.stopPropagation();
    onchange();
  }
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  {onclick}
  class={[
    "border-foreground isolate flex size-30px shrink-0 items-center justify-center border-2 inset-ring-2 inset-ring-black transition-colors",
    "focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
    checked ? "bg-foreground" : "bg-black",
  ]}
>
  <span class="sr-only">{checked ? `Owned: ${label}` : `Mark ${label} as owned`}</span>
</button>
