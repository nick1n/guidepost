<script lang="ts">
  import type { Edition } from "#lib/kdm-data.ts";

  type Props = {
    versions: Edition[];
    value?: string[];
    onselect: (v: string) => void;
  };

  let { versions, value = [], onselect }: Props = $props();
</script>

<div class="flex items-center gap-1" role="group" aria-label="Versions owned">
  <span class="mr-1 text-muted-foreground">Version</span>
  {#each versions as version (version.v)}
    {@const active = value.includes(version.v)}
    <button
      type="button"
      aria-pressed={active}
      onclick={(event) => {
        event.stopPropagation();
        onselect(version.v);
      }}
      class={[
        "min-w-11 cursor-pointer rounded-lg px-2 py-1 tabular-nums transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active ? "bg-accent text-accent-foreground" : "bg-panel text-foreground hover:bg-panel hover:text-foreground",
      ]}
    >
      {version.v}
    </button>
  {/each}
</div>
