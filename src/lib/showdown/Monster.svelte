<script lang="ts">
  import AttributeTokens from "./AttributeTokens.svelte";
  import Section from "./Section.svelte";
  import { survivors, type TokenCount } from "./data";

  type Stats = { life: number; movement: number; toughness: number; damage: number; speed: number };

  let {
    variant,
    round,
    monsterTurn,
    onturn,
    values = $bindable(),
    stats = $bindable(),
  }: {
    variant: number;
    round: number;
    monsterTurn: boolean;
    onturn: Noop;
    values: TokenCount[];
    stats: Stats;
  } = $props();

  let knockedDown = $state(false);
  function toggleKnockedDown() {
    knockedDown = !knockedDown;
  }

  let selectedAction = $state("");
  function selectAction(action: string) {
    selectedAction = selectedAction === action ? "" : action;
  }

  const tokens = ["Movement", "Toughness", "Speed", "Accuracy", "Damage", "Luck", "Evasion"];
  const statNames = [
    { name: "Movement", key: "movement" },
    { name: "Toughness", key: "toughness" },
    { name: "Speed", key: "speed" },
    { name: "Damage", key: "damage" },
  ] as const;

  const board = { columns: 22, rows: 16, tile: 10 };
  const monsterTiles = [
    { column: 10, row: 7 },
    { column: 11, row: 7 },
    { column: 10, row: 8 },
    { column: 11, row: 8 },
  ];
  const setupDistance = 6;
  const setupTiles = tilesAtDistance(setupDistance);
  const survivorPositions = [
    { column: 9, row: 13 },
    { column: 10, row: 14 },
    { column: 11, row: 14 },
    { column: 12, row: 13 },
  ];

  function tilesAtDistance(distance: number) {
    return Array.from({ length: board.columns * board.rows }, (_, index) => ({
      column: index % board.columns,
      row: Math.floor(index / board.columns),
    })).filter(
      ({ column, row }) =>
        Math.min(...monsterTiles.map((monsterTile) => Math.abs(column - monsterTile.column) + Math.abs(row - monsterTile.row))) ===
        distance,
    );
  }
</script>

{#snippet threat()}
  <header>
    <div class="encounter">
      <p class="level">Prologue / Level 1</p>
      <span class="round" aria-live="polite">Round {round}</span>
    </div>
    <div class="crest" aria-hidden="true"><span class="lion i-game-icons:lion"></span></div>
    <h2>White Lion</h2>
  </header>
{/snippet}

{#snippet statistics()}
  <div class="vitals">
    <label class="life">
      <span>Life</span><input class="life-value" type="number" aria-label="Monster Life" bind:value={stats.life} />
    </label>
    <div class="attributes">
      {#each statNames as stat (stat.name)}
        <div>
          <input class="attribute-value" type="number" aria-label={`Monster ${stat.name}`} bind:value={stats[stat.key]} />
          <span>{stat.name}</span>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{@render threat()}
<Section
  title={variant === 2 ? "Attributes" : "Monster Attributes"}
  meta={`Life: ${stats.life} | Mov: ${stats.movement ?? 0} | Tgh: ${stats.toughness ?? 0} | Spd: ${stats.speed || "-"} | Dmg: ${stats.damage || "-"}`}
>
  {@render statistics()}
</Section>

<Section title="State" meta={monsterTurn ? "Monster's Turn" : "Survivors' Turn"}>
  <div class="state">
    <button class={["toggle", monsterTurn && "active"]} aria-pressed={monsterTurn} onclick={onturn}>
      <span aria-hidden="true">{monsterTurn ? "●" : "○"}</span> Monster's Turn
    </button>
    <button class={["toggle", knockedDown && "active"]} aria-pressed={knockedDown} onclick={toggleKnockedDown}>Knocked Down</button>
  </div>
</Section>

<Section title="Attribute Tokens" meta={`${values.reduce((sum, count) => sum + count.positive + count.negative, 0)} Tokens`}>
  <AttributeTokens owner="Monster" names={tokens} labels={["Spd", "Acc", "Dmg", "Lck", "Mov", "Tgh", "Eva"]} bind:counts={values} />
</Section>

<Section title="Showdown Setup" meta="No Terrain">
  <svg
    class="board"
    viewBox="0 0 220 160"
    role="img"
    aria-label={`Illustrative 22 by 16 showdown board. Blue tiles are exactly ${setupDistance} spaces from the White Lion.`}
  >
    <rect width="220" height="160" fill="var(--card)" />
    <g class="setup-tiles">
      {#each setupTiles as tile (`${tile.column}-${tile.row}`)}
        <rect x={tile.column * board.tile} y={tile.row * board.tile} width={board.tile} height={board.tile} />
      {/each}
    </g>
    <g class="grid-lines" shape-rendering="crispEdges">
      {#each Array.from({ length: 23 }, (_, i) => i * 10) as x (x)}<line x1={x} x2={x} y1="0" y2="160" />{/each}
      {#each Array.from({ length: 17 }, (_, i) => i * 10) as y (y)}<line x1="0" x2="220" y1={y} y2={y} />{/each}
    </g>
    <circle class="monster-marker" cx="110" cy="80" r="10" />
    {#each survivors as person, index (person.name)}
      <circle
        cx={(survivorPositions[index].column + 0.5) * board.tile}
        cy={(survivorPositions[index].row + 0.5) * board.tile}
        r="4"
        fill={person.color}
      />
    {/each}
  </svg>
  <div class="board-legend">
    <span><i class="monster-dot"></i> White Lion</span>
    <span><i class="range-dot"></i> {setupDistance} Spaces</span>
    <span><i class="survivor-dot"></i> Survivors</span>
  </div>
</Section>

<Section title="Common Actions" meta={selectedAction || "None Selected"}>
  <div class="actions">
    {#each ["Draw Behavior Card", "Resolve Attack", "Resolve Reaction"] as action (action)}
      <button
        class={["action", selectedAction === action && "chosen"]}
        aria-pressed={selectedAction === action}
        onclick={() => selectAction(action)}
      >
        {action}<span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
  {#if selectedAction && selectedAction !== "Basic Action" && selectedAction !== "Sniff"}
    <p class="selection" role="status">
      Selected: {selectedAction}
    </p>
  {/if}
</Section>

<Section
  title="Basic Action"
  meta="Spd 2 | Acc 2+ | Dmg 1"
  onaction={() => selectAction("Basic Action")}
  actionLabel="Perform"
  actionName="Select Basic Action"
  pressed={selectedAction === "Basic Action"}
>
  <div class="step">
    <span class="step-number">01</span>
    <h3>Pick Target</h3>
  </div>
  <ol class="targets">
    <li>Closest threat, facing, in range</li>
    <li>Closest threat, in range</li>
    <li>No target: perform Instinct</li>
  </ol>
  <div class="step">
    <span class="step-number">02</span>
    <h3>Move & Attack Target</h3>
  </div>
  <div class="attack-profile">
    {#each [{ name: "Speed", value: "2" }, { name: "Accuracy", value: "2+" }, { name: "Damage", value: "1" }] as stat (stat.name)}
      <div>
        <span>{stat.name}</span><strong>{stat.value}</strong>
      </div>
    {/each}
  </div>
  <p class="trigger"><strong>Special Trigger</strong> On a hit, resolve the attack's additional effects.</p>
  {#if variant !== 3}
    <button
      class={["action", selectedAction === "Basic Action" && "chosen"]}
      aria-pressed={selectedAction === "Basic Action"}
      onclick={() => selectAction("Basic Action")}
    >
      Select Basic Action
    </button>{/if}
</Section>

<Section
  title="Instinct: **Sniff**"
  onaction={() => selectAction("Sniff")}
  actionLabel="Trigger"
  actionName="Select Sniff"
  pressed={selectedAction === "Sniff"}
>
  {#if variant !== 3}
    <button
      class={["action", selectedAction === "Sniff" && "chosen"]}
      aria-pressed={selectedAction === "Sniff"}
      onclick={() => selectAction("Sniff")}
    >
      Sniff<span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
    </button>
  {/if}
  <p>
    The White Lion sniffs the air and ends its turn. Until the end of the next round, all survivors are now threats, despite any effects
    that say otherwise.
  </p>
  <p>When a level 3+ White Lion performs <strong>Sniff</strong>, it gains +1 accuracy token.</p>
</Section>

<style>
  header {
    padding: 0.75rem 0.625rem;
    border-radius: var(--radius-card);
    background: radial-gradient(ellipse at 50% 42%, color-mix(var(--identity) 28%, transparent), transparent 70%), var(--panel);
    text-align: center;
  }
  .encounter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .round {
    color: var(--identity);
    font-size: var(--text-sm);
  }
  .level {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  h2 {
    margin-block: 0.5rem 0.375rem;
    font-size: 2.625rem;
    line-height: 1.2;
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }
  .vitals {
    display: flex;
    gap: 1rem;
  }
  .life {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 0.375rem;
  }
  .life > span:first-child {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .life-value {
    font-size: 3.125rem;
    line-height: 1;
    font-family: var(--font-sans);
  }
  .attributes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    flex: 2;
    gap: 0.625rem;
  }
  .attributes div {
    display: flex;
    flex-direction: column;
    padding-inline-start: 0.625rem;
    gap: 0.125rem;
    border-inline-start: 1px solid var(--color-divider);
  }
  .attribute-value {
    font-size: 1.25rem;
  }
  .attributes span {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .state {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.375rem;
  }
  .toggle {
    min-block-size: 2.75rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    &.active {
      border-color: var(--color-divider);
      background: color-mix(var(--identity) 14%, var(--panel));
      color: var(--foreground);
    }
  }
  .board {
    display: block;
    aspect-ratio: 22 / 16;
    inline-size: 100%;
    overflow: visible;
  }
  .grid-lines {
    stroke: var(--contrast);
    stroke-width: 1;
  }
  .grid-lines line {
    vector-effect: non-scaling-stroke;
  }
  .setup-tiles {
    fill: var(--accent-blue);
    opacity: 0.55;
  }
  .monster-marker {
    vector-effect: non-scaling-stroke;
    fill: var(--identity);
    stroke: var(--contrast);
    stroke-width: 1;
  }
  .board-legend {
    display: flex;
    justify-content: space-between;
    margin-block-start: 0.625rem;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .board-legend span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .monster-dot,
  .range-dot,
  .survivor-dot {
    inline-size: 0.375rem;
    block-size: 0.375rem;
    background: var(--identity);
  }
  .survivor-dot {
    background: var(--foreground);
  }
  .range-dot {
    background: var(--accent-blue);
  }
  .actions {
    display: grid;
    gap: 0.25rem;
  }
  .action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    gap: 0.375rem;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 20%, var(--panel));
    font-size: var(--text-sm);
    text-align: start;
    &.chosen {
      background: color-mix(var(--identity) 20%, var(--panel));
    }
  }
  .action-arrow {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .selection {
    margin-block-start: 0.375rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .step {
    display: flex;
    align-items: center;
    margin-block-end: 0.625rem;
    gap: 0.5rem;
  }
  .step-number {
    padding: 0.25rem;
    border: 1px solid var(--color-divider);
    color: var(--identity);
    font-size: var(--text-xs);
  }
  h3 {
    font-weight: var(--font-bold);
    font-size: 0.75rem;
  }
  .targets {
    margin-block-end: 1.125rem;
    padding-inline-start: 1.375rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: 1.9;
    list-style: decimal;
  }
  .attack-profile {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .attack-profile div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
  }
  .attack-profile span {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .attack-profile strong {
    font-size: 1.625rem;
  }
  .trigger {
    margin-block-start: 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: 1.6;
  }
  .trigger strong {
    display: block;
    color: var(--foreground);
    font-weight: var(--font-normal);
  }
  :global(.folio) header {
    padding-block-start: 0.75rem;
    border: 0;
  }
  :global(.folio) h2 {
    font-style: italic;
    font-weight: var(--font-normal);
    font-size: 2.375rem;
    font-family: var(--font-editorial);
  }
  :global(.signal) header {
    border-radius: var(--radius-control);
  }
  :global(.signal) h2 {
    font-size: 2.25rem;
  }
  :global(.signal) .life-value {
    font-family: var(--font-sans);
  }
  :global(.signal) .action {
    background: var(--background);
    &.chosen {
      background: color-mix(var(--identity) 20%, var(--background));
    }
  }
  :global(.signal) .attack-profile {
    border: 0;
    background: var(--background);
  }
  .crest {
    display: grid;
    place-items: center;
    inline-size: 7rem;
    block-size: 7rem;
    margin: 0.75rem auto 0.5rem;
    rotate: -6deg;
    border: 1px solid var(--identity);
    border-radius: 50% 50% 40% 40%;
    outline: 1px solid color-mix(var(--identity) 30%, transparent);
    outline-offset: 0.375rem;
  }
  .lion {
    inline-size: 5.75rem;
    block-size: 5.75rem;
    rotate: 6deg;
    color: var(--identity);
  }
  :global(.folio) .crest {
    rotate: 0deg;
    border-radius: 50% 50% 0 0;
  }
  :global(.folio) .lion {
    rotate: 0deg;
  }
  :global(.signal) .crest {
    rotate: 8deg;
    border-radius: 35%;
    background: var(--identity);
    box-shadow: 0.375rem 0.375rem 0 var(--contrast);
  }
  :global(.signal) .lion {
    rotate: -8deg;
    color: var(--contrast);
  }
  input {
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
  .life-value {
    inline-size: 4.5rem;
    block-size: 4.5rem;
  }
</style>
