<script lang="ts">
  import type { Edition } from "#lib/types/index.ts";

  type Props = {
    versions: Edition[];
    value?: string[];
    onselect: (v: string) => void;
  };

  let { versions, value = [], onselect }: Props = $props();

  function selectVersion(event: MouseEvent, version: string) {
    event.stopPropagation();
    onselect(version);
  }
</script>

<div class="flex items-center gap-1" role="group" aria-label="Versions owned">
  <span class="text-muted-foreground mr-1">Version</span>
  {#each versions as version (version.v)}
    {@const active = value.includes(version.v)}
    <button
      type="button"
      aria-pressed={active}
      onclick={(event) => selectVersion(event, version.v)}
      class={[
        "min-w-11 cursor-pointer rounded-lg px-2 py-1 tabular-nums transition-colors",
        "focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
        active ? "bg-accent text-accent-foreground" : "bg-panel text-foreground hover:bg-panel hover:text-foreground",
      ]}
    >
      {version.v}
    </button>
  {/each}
</div>
