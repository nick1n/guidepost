<script module lang="ts">
  import type { Density, Snap } from "#lib/kdm/showdown/display.svelte.ts";

  const densities: { value: Density; label: string; size: string }[] = [
    { value: "compact", label: "Compact", size: "2rem" },
    { value: "default", label: "Default", size: "2.75rem" },
    { value: "comfortable", label: "Comfortable", size: "3.5rem" },
  ];
  const snaps: Snap[] = ["left", "center", "right", "free"];
  const themes = [
    { label: "Obsidian", href: "/kdm/showdown1" },
    { label: "Folio", href: "/kdm/showdown2" },
    { label: "Signal", href: "/kdm/showdown3" },
  ] as const;
  const statuses = [
    ["status:threat", "Threat", "Marked as a threat"],
    ["status:act", "Acted", "Has acted this round"],
    ["status:knocked-down", "Down", "Knocked down"],
    ["priority", "Priority", "Priority target"],
    ["status:blind-spot", "In blind spot", "In the monster's blind spot"],
    ["status:deaf", "Deaf", "Deaf"],
    ["status:blind", "Blind", "Blind"],
  ] as const;
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getShowdownDisplay } from "#lib/kdm/showdown/display.svelte.ts";
  import ToggleButton from "#lib/components/ToggleButton.svelte";
  import StatusIcon from "#lib/kdm/ui/status/StatusIcon.svelte";

  let { onnavigate }: { onnavigate: (event: MouseEvent, href: string) => void } = $props();
  const display = getShowdownDisplay();
  const id = $props.id();
</script>

<section aria-labelledby={`${id}-heading`}>
  <h3 id={`${id}-heading`}>Showdown</h3>
  <p>Display preferences apply to all showdown themes for this session.</p>
  {#if display.summary}
    <div class="summary">{@render display.summary()}</div>
  {/if}
  <fieldset>
    <legend>Survivor colors</legend>
    <ToggleButton
      pressed={display.settings.brightenZachary}
      onclick={() => (display.settings.brightenZachary = !display.settings.brightenZachary)}
    >
      Brighten Zachary
    </ToggleButton>
  </fieldset>
  <fieldset>
    <legend>Dashboard snap</legend>
    <div class="options snap">
      {#each snaps as value (value)}
        <ToggleButton pressed={display.settings.snap === value} onclick={() => display.setSnap(value)}>
          {value[0].toUpperCase() + value.slice(1)}
        </ToggleButton>
      {/each}
    </div>
  </fieldset>
  <fieldset>
    <legend>Interface density</legend>
    <div class="options">
      {#each densities as option (option.value)}
        <ToggleButton
          style={`min-block-size: ${option.size}`}
          pressed={display.settings.density === option.value}
          onclick={() => (display.settings.density = option.value)}>{option.label}</ToggleButton
        >
      {/each}
    </div>
  </fieldset>
  <fieldset>
    <legend>Attribute and token colors</legend>
    <label for={`${id}-border`}>
      Border lightness <output for={`${id}-border`}>{display.settings.borderLightness}%</output>
      <input id={`${id}-border`} type="range" min="0" max="100" step="1" bind:value={display.settings.borderLightness} />
    </label>
    <label for={`${id}-foreground`}>
      Foreground lightness <output for={`${id}-foreground`}>{display.settings.foregroundLightness}%</output>
      <input id={`${id}-foreground`} type="range" min="0" max="100" step="1" bind:value={display.settings.foregroundLightness} />
    </label>
    <label for={`${id}-background`}>
      Background lightness <output for={`${id}-background`}>{display.settings.backgroundLightness}%</output>
      <input id={`${id}-background`} type="range" min="0" max="100" step="1" bind:value={display.settings.backgroundLightness} />
    </label>
  </fieldset>
  <fieldset>
    <legend>Theme</legend>
    <nav class="options" aria-label="Showdown themes">
      {#each themes as theme (theme.href)}
        <a
          href={resolve(theme.href)}
          aria-current={page.route.id === theme.href ? "page" : undefined}
          onclick={(event) => onnavigate(event, resolve(theme.href))}>{theme.label}</a
        >
      {/each}
    </nav>
  </fieldset>
  <details>
    <summary>Quick view key</summary>
    <dl>
      <div>
        <dt>M / T</dt>
        <dd>Monster movement and toughness</dd>
      </div>
      <div>
        <dt>Ready</dt>
        <dd>Alive and ready to act</dd>
      </div>
      {#each statuses as [icon, label, description] (icon)}
        <div>
          <dt><StatusIcon {icon} active context="legend" />{label}</dt>
          <dd>{description}</dd>
        </div>
      {/each}
      <div>
        <dt><span class="key-icon i-material-symbols:filter-none" aria-hidden="true"></span>Tokens</dt>
        <dd>Total tokens, including bleeding</dd>
      </div>
      <div>
        <dt><span class="key-icon i-material-symbols:bolt" aria-hidden="true"></span>Actions</dt>
        <dd>Available survival actions</dd>
      </div>
    </dl>
  </details>
  <p>Design preview. Rules and setup are illustrative.</p>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
  }
  h3 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
  }
  p {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: var(--line-height-snug);
  }
  .summary {
    padding: 0.75rem;
    border-radius: var(--radius-control);
    background: var(--background);
  }
  fieldset {
    min-inline-size: 0;
  }
  legend {
    margin-block-end: 0.5rem;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
  }
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    gap: 0.5rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--card);
    font-size: var(--text-sm);
    transition: var(--transition-colors);

    &[aria-current="page"] {
      border-color: var(--accent);
      background: var(--blue-7);
    }
  }
  .options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 0.25rem;
  }
  .snap {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    font-size: var(--text-sm);
  }
  output {
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }
  input {
    grid-column: 1 / -1;
    inline-size: 100%;
    min-block-size: 2.75rem;
    accent-color: var(--accent);
  }
  summary {
    padding-block: 0.75rem;
    cursor: pointer;
    font-size: var(--text-md);
  }
  dl {
    display: grid;
    padding-block: 0.5rem;
    gap: 0.75rem;
    font-size: var(--text-sm);
  }
  dl > div {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.5rem;
  }
  dt {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  dd {
    color: var(--muted-foreground);
  }
  .key-icon {
    --size-icon: 1rem;
  }
  @media (hover: hover) {
    a:hover {
      border-color: var(--accent);
      background: var(--blue-8);
    }
  }
</style>
