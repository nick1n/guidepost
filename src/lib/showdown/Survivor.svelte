<script lang="ts">
  import AttributeTokens from "./AttributeTokens.svelte";
  import Section from "./Section.svelte";
  import Gear from "./Gear.svelte";
  import EntryList from "./EntryList.svelte";
  import ProgressTrack from "./ProgressTrack.svelte";
  import { attributes, abbreviations, availableActions, statusText, type Sheet } from "./data";

  let {
    person,
    number,
    variant,
    sheet = $bindable(),
  }: {
    person: { name: string; color: string; gender: string };
    number: number;
    variant: number;
    sheet: Sheet;
  } = $props();

  let armorValues = $state([0, 0, 0, 0, 1, 0]);
  let injuries = $state<Record<string, boolean>>({});
  let notes = $state("");
  let gear = $state<(string | null)[]>(["Fist & Tooth", "Founding Stone", "Cloth", ...Array<null>(10).fill(null)]);
  let selectedGear = $state<number | null>(null);
  let draggedGear = $state<number | null>(null);
  let development = $state([0, 0, 0, 0]);

  let selectedAction = $state("");
  function selectAction(action: string) {
    selectedAction = selectedAction === action ? "" : action;
  }

  function toggleStatus(status: string) {
    sheet.statuses = sheet.statuses.includes(status) ? sheet.statuses.filter((value) => value !== status) : [...sheet.statuses, status];
  }

  const armor = ["Insanity", "Head", "Arms", "Body", "Waist", "Legs"] as const;
  const tracks = [
    { name: "Hunt XP", max: 16, marks: [2, 6, 10, 15, 16] },
    { name: "Courage", max: 9, marks: [3, 9] },
    { name: "Understanding", max: 9, marks: [3, 9] },
    { name: "Weapon Proficiency", max: 8, marks: [3, 8] },
  ];
</script>

{#snippet identity()}
  <header class="identity">
    <div class="identity-copy">
      <p class="eyebrow">Survivor {String(number).padStart(2, "0")} <span>{person.gender}</span></p>
      <h2>{person.name}</h2>
    </div>
    <div class="survival">
      <label for={`survival-${number}`}>Survival</label>
      <input id={`survival-${number}`} type="number" min="0" max="99" step="1" bind:value={sheet.survival} />
    </div>
  </header>
{/snippet}

{#snippet statistics()}
  <div class="combat">
    <div class="stats">
      {#each attributes as attribute, index (attribute)}
        <div class="stat">
          <span class="stat-label" aria-label={attribute}>{abbreviations[index]}</span>
          <input class="attribute-value" type="number" aria-label={`${person.name} ${attribute}`} bind:value={sheet.attributes[index]} />
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet protection()}
  <div class="combat">
    <div class="armor">
      {#each armor as location, index (location)}
        <div class="armor-cell">
          <span>{location === "Insanity" ? "Insanity" : location}</span><input
            class="armor-value"
            aria-label={`${person.name} ${location}`}
            type="number"
            min="0"
            max="99"
            bind:value={armorValues[index]}
          />
          <div class="injuries">
            {#if index === 1}<span class="injury-gap" aria-hidden="true"></span>{/if}
            {#each index === 0 ? ["Light"] : index === 1 ? ["Heavy"] : ["Light", "Heavy"] as injury (injury)}
              <label class="injury-target">
                <input
                  type="checkbox"
                  bind:checked={injuries[location + injury]}
                  aria-label={`${person.name} ${location} ${injury} injury`}
                />
                <span aria-hidden="true">{injury === "Light" ? "L" : "H"}</span>
              </label>
            {/each}
            {#if index === 0}<span class="injury-gap" aria-hidden="true"></span>{/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
  <p class="legend hidden">L: Light injury / H: Heavy injury</p>
{/snippet}

{#snippet conditions()}
  <div class="conditions">
    <button class={["condition", sheet.threat && "active"]} aria-pressed={sheet.threat} onclick={() => (sheet.threat = !sheet.threat)}>
      Threat
    </button>
    <button class={["condition", sheet.acted && "active"]} aria-pressed={sheet.acted} onclick={() => (sheet.acted = !sheet.acted)}>
      <span aria-hidden="true">{sheet.acted ? "✓" : "○"}</span> Acted
    </button>
    {#each ["Monster Controller", "Blind Spot", "Knocked Down"] as status (status)}
      <button
        class={["condition", sheet.statuses.includes(status) && "active"]}
        aria-pressed={sheet.statuses.includes(status)}
        onclick={() => toggleStatus(status)}
      >
        {status}
      </button>
    {/each}
    <button class={["condition", sheet.dead && "active"]} aria-pressed={sheet.dead} onclick={() => (sheet.dead = !sheet.dead)}>Dead</button>
    <button
      class={["condition", sheet.statuses.includes("Retired") && "active"]}
      aria-pressed={sheet.statuses.includes("Retired")}
      onclick={() => toggleStatus("Retired")}
    >
      Retired
    </button>
  </div>
{/snippet}

{#snippet tokenControls()}
  <AttributeTokens owner={person.name} names={attributes} labels={abbreviations} bind:counts={sheet.tokens} />
  <div class="extra-tokens">
    <label>Bleeding <input type="number" min="0" max="5" bind:value={sheet.bleeding} /></label>
    <button
      class={["condition", sheet.priority && "active"]}
      aria-pressed={sheet.priority}
      onclick={() => (sheet.priority = !sheet.priority)}
    >
      Priority Target
    </button>
  </div>
{/snippet}

{#snippet actions()}
  <div class="action-list">
    <button
      class={["action", selectedAction === "Move" && "chosen"]}
      aria-pressed={selectedAction === "Move"}
      onclick={() => selectAction("Move")}
    >
      <span>Move</span><small>{sheet.attributes[0] ?? 0} spaces</small>
      <span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
    </button>
    <button
      class={["action", selectedAction === "Attack" && "chosen"]}
      aria-pressed={selectedAction === "Attack"}
      onclick={() => selectAction("Attack")}
    >
      <span>Attack</span><small>1 action</small><span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
    </button>
  </div>
{/snippet}

{#snippet survivalActions()}
  <div class="survival-actions">
    {#each ["Dodge", "Dash", "Surge", "Encourage", "Endure"] as action, index (action)}
      <button
        class={["survival-action", selectedAction === action && "chosen"]}
        disabled={index !== 0 || !availableActions(sheet)}
        aria-pressed={selectedAction === action}
        onclick={() => selectAction(action)}
      >
        <span>{action}</span><small>{index === 0 ? (availableActions(sheet) ? "1 survival" : "Unavailable") : "Locked"}</small>
      </button>
    {/each}
  </div>
{/snippet}

<div class="survivor">
  {#if sheet.statuses.includes("Blind Spot")}<div class="blind-banner">
      <span class="blind-icon i-material-symbols:visibility" aria-hidden="true"></span>Blind Spot Active
    </div>{/if}
  {@render identity()}
  {#if variant === 3}
    <Section
      title="Combat"
      meta={`Movement: ${sheet.attributes[0] ?? 0} / Insanity: ${armorValues[0] ?? 0} / Bleeding: ${sheet.bleeding ?? 0}`}
    >
      {@render statistics()}
      <h3>Armor & Injuries</h3>
      {@render protection()}
      <h3>Tokens</h3>
      {@render tokenControls()}
    </Section>
    <Section title="Actions" meta={selectedAction || "None Selected"}>
      {@render actions()}
      <h3>Survival Actions <small>{sheet.survival ?? 0} survival</small></h3>
      {@render survivalActions()}
      {#if selectedAction}
        <p class="selection" role="status">Selected: {selectedAction}</p>
      {/if}
    </Section>
    <Section title="Status" meta={statusText(sheet)}>{@render conditions()}</Section>
  {:else}
    {#if variant === 2}
      <Section title="Vital Signs" meta={`Movement: ${sheet.attributes[0] ?? 0} / Insanity: ${armorValues[0] ?? 0}`}>
        {@render statistics()}
        {@render protection()}
      </Section>
    {:else}
      <Section title="Attributes" meta={`Movement: ${sheet.attributes[0] ?? 0}`}>{@render statistics()}</Section>
      <Section title="Armor & Injuries" meta={`Insanity: ${armorValues[0] ?? 0}`}>{@render protection()}</Section>
    {/if}
    <Section title="Tokens" meta={`Bleeding: ${sheet.bleeding ?? 0}`}>{@render tokenControls()}</Section>
    <Section title="Status" meta={statusText(sheet)}>{@render conditions()}</Section>
    <Section title="Actions" meta={selectedAction || "None Selected"}>
      {@render actions()}
      {#if selectedAction === "Move" || selectedAction === "Attack"}
        <p class="selection" role="status">
          Selected: {selectedAction}
        </p>
      {/if}
    </Section>
    <Section title="Survival Actions" meta="Dodge">
      {@render survivalActions()}
      {#if selectedAction && selectedAction !== "Move" && selectedAction !== "Attack"}
        <p class="selection" role="status">
          Selected: {selectedAction}
        </p>
      {/if}
    </Section>
  {/if}
  <Section title="Gear Grid" meta={`${gear.slice(1, 9).filter(Boolean).length} Gear: 1 Melee Weapon, 1 Armor`}>
    <Gear bind:slots={gear} bind:selected={selectedGear} bind:dragged={draggedGear} />
  </Section>
  <Section title="Trinkets and Baubles" meta={`${gear.slice(10).filter(Boolean).length || "No"} Gear`}>
    <Gear bind:slots={gear} bind:selected={selectedGear} bind:dragged={draggedGear} start={10} count={3} slotLabel="Trinket Slot" />
  </Section>
  {#each ["Fighting Arts", "Disorders", "Abilities", "Impairments"] as section (section)}<EntryList title={section} />
  {/each}
  <Section title="Development" meta={`Hunt XP: ${development[0]} | Courage: ${development[1]} | Understanding: ${development[2]}`}>
    {#each tracks as track, index (track.name)}
      <ProgressTrack {...track} {variant} bind:value={development[index]} />
    {/each}
  </Section>
  <Section title="Notes" meta={notes.trim() ? "Notes Added" : "No Notes"}>
    <textarea bind:value={notes} aria-label={`Notes for ${person.name}`} placeholder="Notes…" rows="3"></textarea>
  </Section>
</div>

<style>
  .identity {
    display: flex;
    align-items: center;
    padding: 0.625rem 0.375rem;
    gap: 0.5rem;
    border-radius: var(--radius-control);
    background: var(--identity);
    color: var(--identity-ink);
  }
  .identity-copy {
    flex: 1;
    min-inline-size: 0;
  }
  .eyebrow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    font-size: var(--text-xs);
  }
  h2 {
    font-size: 2rem;
    line-height: 1.2;
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }
  .survival {
    display: grid;
    justify-items: center;
    padding-inline-start: 0.625rem;
    gap: 0.125rem;
    border-inline-start: 1px solid var(--color-divider);
  }
  .survival label {
    font-size: var(--text-xs);
  }
  input[type="number"] {
    appearance: textfield;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 1px solid color-mix(var(--identity) 60%, var(--panel));
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 18%, var(--panel));
    text-align: center;
    &::-webkit-inner-spin-button {
      appearance: none;
    }
  }
  .survival input {
    border-radius: 50%;
    border-color: color-mix(var(--identity-ink) 42%, transparent);
    background: color-mix(var(--identity-ink) 12%, transparent);
    color: var(--identity-ink);
    font-weight: var(--font-bold);
    font-size: 1.625rem;
    font-variant-numeric: lining-nums tabular-nums;
  }
  :global(.folio) .survival {
    padding-inline-start: 0.75rem;
  }
  :global(.folio) .survival label {
    font-style: italic;
    font-family: var(--font-editorial);
  }
  :global(.folio) .survival input {
    border: 0;
    border-radius: 0;
    border-block-end: 2px solid currentColor;
    background: transparent;
    font-weight: var(--font-normal);
    font-family: var(--font-editorial);
  }
  :global(.signal) .survival {
    padding: 0.25rem;
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    border-inline-start: 0;
    background: color-mix(var(--identity-ink) 10%, transparent);
  }
  :global(.signal) .survival input {
    border: 0;
    border-radius: 0.75rem 0.25rem 0.75rem 0.25rem;
    background: var(--identity-ink);
    color: var(--identity);
  }
  .stats,
  .armor {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.125rem;
  }
  .stat {
    padding-block: 0.25rem;
    text-align: center;
  }
  .stat-label {
    display: block;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .attribute-value {
    display: block;
    margin-inline: auto;
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-size: 1.375rem;
    line-height: 1.3;
    font-variant-numeric: lining-nums tabular-nums;
  }
  .armor {
    row-gap: 0.625rem;
    margin-block-start: 0.375rem;
  }
  .armor-cell {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 0.125rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .armor-value {
    color: var(--foreground);
    font-size: 1.125rem;
  }
  .injuries {
    display: grid;
    gap: 0.125rem;
  }
  .injury-gap {
    block-size: 2.75rem;
  }
  .injury-target {
    display: grid;
    cursor: pointer;
  }
  input[type="checkbox"] {
    appearance: none;
    grid-area: 1 / 1;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 0;
    cursor: pointer;
    &:checked + span {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  .injury-target span {
    display: grid;
    grid-area: 1 / 1;
    place-items: center;
    place-self: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border: 1px solid var(--muted-foreground);
    border-radius: 0.25rem;
    pointer-events: none;
  }
  .legend {
    margin-block-start: 0.375rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .extra-tokens {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    margin-block-start: 0.375rem;
    gap: 0.375rem;
  }
  .extra-tokens label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--text-sm);
  }
  .conditions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .condition {
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    &.active {
      border-color: transparent;
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  h3 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block: 0.75rem 0.375rem;
    gap: 0.25rem;
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-size: var(--text-sm);
  }
  h3 small {
    color: var(--muted-foreground);
    font-weight: var(--font-normal);
    font-size: var(--text-xs);
  }
  .action-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .action {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    min-block-size: 3.5rem;
    padding: 0.5rem;
    gap: 0.125rem;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 22%, var(--panel));
    font-size: var(--text-sm);
    text-align: start;
    &.chosen {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  .action small {
    grid-row: 2;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .action-arrow {
    grid-row: 1 / 3;
    grid-column: 2;
    inline-size: 1rem;
    block-size: 1rem;
  }
  .selection {
    margin-block-start: 0.375rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .survival-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .survival-action {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    min-block-size: 2.75rem;
    padding: 0.375rem;
    gap: 0.25rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-sm);
    &.chosen {
      background: var(--identity);
      color: var(--identity-ink);
    }
    &:disabled {
      color: var(--muted-foreground);
      cursor: default;
    }
  }
  .survival-action small {
    font-size: var(--text-xs);
  }
  textarea {
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-sm);
    resize: vertical;
    user-select: text;
  }
  :global(.folio) h2 {
    font-style: italic;
    font-weight: var(--font-normal);
    font-size: 2.25rem;
    font-family: var(--font-editorial);
  }
  :global(.folio) .attribute-value {
    font-weight: var(--font-normal);
    font-family: var(--font-sans);
  }
  :global(.signal) .identity {
    padding-block: 0.875rem;
    border-radius: 1.5rem 0.375rem 2.5rem 0.375rem;
    background-image: radial-gradient(circle at 90% 110%, #ffffff26 0 3rem, transparent 3rem);
  }
  :global(.signal) h2 {
    font-weight: var(--font-normal);
    font-size: 1.75rem;
    font-family: var(--font-sans);
  }
  :global(.signal) .stat {
    padding-block: 0.5rem;
    border-radius: 50% 50% 0.375rem 0.375rem;
    background: var(--identity);
    color: var(--identity-ink);
  }
  :global(.signal) .attribute-value {
    border-color: color-mix(var(--identity-ink) 35%, transparent);
    background: var(--identity);
    color: inherit;
    font-size: 1.625rem;
    font-family: var(--font-sans);
  }
  :global(.signal) .stat-label {
    color: inherit;
  }
  :global(.signal) .condition {
    border: 0;
    background: color-mix(var(--identity) 16%, var(--background));
    &.active {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  :global(.obsidian) .extra-tokens input,
  :global(.folio) .extra-tokens input {
    border-radius: 50%;
  }
  :global(.obsidian) .armor-value,
  :global(.folio) .armor-value {
    border-radius: 0.25rem 0.25rem 50% 50% / 0.25rem 0.25rem 35% 35%;
  }
  :global(.signal) .action {
    background: color-mix(var(--identity) 16%, var(--background));
    &.chosen {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  :global(.signal) .survival-action {
    border: 0;
    background: color-mix(var(--identity) 16%, var(--background));
    &.chosen {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  .blind-banner {
    display: flex;
    z-index: 1;
    position: sticky;
    align-items: center;
    justify-content: center;
    inset-block-start: 2.125rem;
    padding: 0.625rem;
    gap: 0.5rem;
    background: var(--accent-green);
    color: var(--contrast);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .blind-icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
  .chosen small {
    color: inherit;
  }
</style>
