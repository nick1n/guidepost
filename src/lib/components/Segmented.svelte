<script lang="ts" generics="T extends string">
  type Option = { value: T; label: string };

  type Props = {
    label: string;
    value: T;
    options: Option[];
    onchange: (v: T) => void;
  };

  let { label, value, options, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <span class="text-muted-foreground">{label}</span>
  <div class="flex flex-wrap gap-1">
    {#each options as option (option.value)}
      {@const active = option.value === value}
      <button
        type="button"
        aria-pressed={active}
        onclick={() => onchange(option.value)}
        class={[
          "rounded-lg px-3 py-2 transition-colors",
          active ? "bg-accent text-accent-foreground" : "bg-panel/70 text-foreground/70 hover:bg-panel hover:text-foreground",
        ]}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>
