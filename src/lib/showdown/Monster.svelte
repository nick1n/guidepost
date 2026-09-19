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

  let showMore = $state(false);
  const id = $props.id();
  let tokenCount = $derived(values.reduce((sum, token) => sum + token.positive + token.negative, 0));
  let resources = $state([
    { name: "Lion Claw", quantity: 1, drawn: false },
    { name: "Lion Tail", quantity: 1, drawn: false },
    { name: "Lion Testes", quantity: 1, drawn: false },
    { name: "White Fur", quantity: 1, drawn: false },
    { name: "Lion Bone", quantity: 1, drawn: false },
    { name: "Lion Skin", quantity: 1, drawn: false },
  ]);
  let resourceCount = $derived(resources.filter((resource) => resource.drawn).length);
  let extras = $derived([
    ...(tokenCount ? ["Tokens"] : []),
    ...(resourceCount ? ["Resource Deck"] : []),
    "divider",
    "Setup",
    ...(!tokenCount ? ["Tokens"] : []),
    ...(!resourceCount ? ["Resource Deck"] : []),
  ]);
  let knockedDown = $state(false);
  function toggleKnockedDown() {
    knockedDown = !knockedDown;
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
  // const survivorPositions = [
  //   { column: 9, row: 13 },
  //   { column: 10, row: 14 },
  //   { column: 11, row: 14 },
  //   { column: 12, row: 13 },
  // ];

  const actions = [
    "Mood - Enraged",
    "Persistent Injury - Beast's Temple",
    "Persistent Injury - Broken Foot",
    "Persistent Injury - Lost Ding Dong",
    "Persistent Injury - Lost Hand",
    "Persistent Injury - No Jaw",
    "Persistent Injury - Organ Trail",
    "Persistent Injury - Ruptured Tendon",
  ] as const;

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

{#snippet statistics()}
  <div class="vitals">
    <div class="life">
      <label for={`${id}-life`}>Life</label>
      <input id={`${id}-life`} class="life-value" type="number" aria-label="Monster Life" bind:value={stats.life} />
      <div class="ai-cards" aria-label="Monster's AI cards">
        <span class="ai-card"><span class="ai-badge">B</span><span>5</span></span>
        <span class="ai-card"><span class="ai-badge">A</span><span>3</span></span>
        <span class="ai-card"><span class="ai-badge">L</span><span>-</span></span>
      </div>
    </div>
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

<header>
  <div class="encounter">
    <p class="level">Prologue / Level 1</p>
    <span class="round" aria-live="polite">Round {round}</span>
  </div>
  <div class="crest" aria-hidden="true"><span class="lion i-game-icons:lion"></span></div>
  <h2>White Lion</h2>
</header>

<Section
  title={variant === 2 ? "Attributes" : "Monster Attributes"}
  meta={[`Life ${stats.life}`, `Spd ${stats.speed || "-"}`, `Dmg ${stats.damage || "-"}`]}
  onaction={() => stats.life--}
  actionLabel="Wound"
>
  {@render statistics()}
</Section>

<Section title="State" meta={[monsterTurn ? "Monster's Turn" : "Survivors' Turn", knockedDown ? "Knocked Down" : ""]}>
  <div class="state">
    <button class={["toggle", monsterTurn && "active"]} aria-pressed={monsterTurn} onclick={onturn}>
      <span aria-hidden="true">{monsterTurn ? "●" : "○"}</span> Monster's Turn
    </button>
    <button class={["toggle", knockedDown && "active"]} aria-pressed={knockedDown} onclick={toggleKnockedDown}>Knocked Down</button>
  </div>
</Section>

<Section
  title="Basic Action"
  meta={["Spd 2", "Acc 2+", "Dmg 1"]}
  onaction={() => true}
  actionLabel="Perform"
  actionName="Select Basic Action"
>
  <h3><strong>Pick</strong> Target</h3>
  <ol class="targets">
    <li>closest survivor, in field of view</li>
    <li>no target: <strong>sniff</strong></li>
  </ol>
  <p>-v-</p>
  <h3><strong>Move & Attack</strong> Target</h3>
  <div class="attack-profile">
    {#each [{ name: "Speed", value: "2" }, { name: "Accuracy", value: "2+" }, { name: "Damage", value: "1" }] as stat (stat.name)}
      <div>
        <span>{stat.name}</span><strong>{stat.value}</strong>
      </div>
    {/each}
  </div>
  <p class="trigger hidden"><strong>Special Trigger</strong> On a hit, resolve the attack's additional effects.</p>
</Section>

<Section title="Instinct: **Sniff**" onaction={() => true} actionLabel="Perform" actionName="Select Sniff">
  <p>
    The White Lion sniffs the air and ends its turn. Until the end of the next round, all survivors are now threats, despite any effects
    that say otherwise.
  </p>
  <p>When a level 3+ White Lion performs <strong>Sniff</strong>, it gains +1 accuracy token.</p>
</Section>

<Section title="Common Actions">
  <div class="actions">
    {#each actions as action (action)}
      <button class="action">
        {action}<span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
</Section>

{#each extras as section (section)}
  {#if section === "divider"}
    <button
      class="more"
      aria-expanded={showMore}
      aria-controls={`${id}-Setup${tokenCount ? "" : ` ${id}-Tokens`}${resourceCount ? "" : ` ${id}-Resource-Deck`}`}
      onclick={() => (showMore = !showMore)}
    >
      <span class="more-label">
        {showMore ? "Show less" : "Show more"}
        <span class="more-icon i-material-symbols:expand-more" aria-hidden="true" style:rotate={showMore ? "180deg" : "0deg"}></span>
      </span>
    </button>
  {:else}
    <div id={`${id}-${section}`} hidden={!showMore && !(section === "Tokens" && tokenCount)}>
      {#if section === "Tokens"}
        <Section title="Attribute Tokens" meta={`${tokenCount} Tokens`}>
          <AttributeTokens owner="Monster" names={tokens} labels={["Spd", "Acc", "Dmg", "Lck", "Mov", "Tgh", "Eva"]} bind:counts={values} />
        </Section>
      {:else if section === "Resource Deck"}
        <Section title="Resource Deck" meta={`${resourceCount || "None"} Drawn`} onaction={() => true} actionLabel="Draw">
          <div class="resource-actions">
            {#each resources as resource (resource.name)}
              <button
                class={["action", resource.drawn && "drawn"]}
                aria-pressed={resource.drawn}
                onclick={() => (resource.drawn = !resource.drawn)}
              >
                {resource.name}<span class="action-arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
              </button>
              <label class="visually-hidden" for={`${id}-${resource.name.toLowerCase().replaceAll(" ", "-")}-quantity`}>
                {resource.name} quantity
              </label>
              {#if variant === 3}
                <div class="resource-stepper">
                  <button
                    aria-label={`Decrease ${resource.name} quantity`}
                    disabled={resource.quantity <= 0}
                    onclick={() => (resource.quantity = Math.max(0, resource.quantity - 1))}
                  >
                    <span class="step-icon i-material-symbols:remove" aria-hidden="true"></span>
                  </button>
                  <input
                    id={`${id}-${resource.name.toLowerCase().replaceAll(" ", "-")}-quantity`}
                    class="resource-quantity"
                    type="number"
                    min="0"
                    bind:value={resource.quantity}
                  />
                  <button aria-label={`Increase ${resource.name} quantity`} onclick={() => (resource.quantity += 1)}>
                    <span class="step-icon i-material-symbols:add" aria-hidden="true"></span>
                  </button>
                </div>
              {:else}
                <input
                  id={`${id}-${resource.name.toLowerCase().replaceAll(" ", "-")}-quantity`}
                  class="resource-quantity"
                  type="number"
                  min="0"
                  bind:value={resource.quantity}
                />
              {/if}
            {/each}
          </div>
        </Section>
      {:else}
        <Section title="Showdown Setup" meta="No Terrain">
          <svg
            class="board"
            viewBox="0 0 220 160"
            role="img"
            aria-label={`Illustrative 22 by 16 showdown board. Blue tiles are exactly ${setupDistance} spaces from the White Lion.`}
          >
            <rect width="220" height="160" fill="var(--card)" opacity=".25" />
            <image href="/showdown.webp" width="220" height="160" preserveAspectRatio="none" opacity=".2" />
            <g class="setup-tiles">
              {#each setupTiles as tile (`${tile.column}-${tile.row}`)}
                <rect x={tile.column * board.tile} y={tile.row * board.tile} width={board.tile} height={board.tile} />
              {/each}
            </g>
            <g class="grid-lines" shape-rendering="crispEdges" opacity=".25">
              {#each Array.from({ length: 23 }, (_, i) => i * 10) as x (x)}<line x1={x} x2={x} y1="0" y2="160" />{/each}
              {#each Array.from({ length: 17 }, (_, i) => i * 10) as y (y)}<line x1="0" x2="220" y1={y} y2={y} />{/each}
            </g>
            <circle class="monster-marker" cx="110" cy="80" r="10" />
          </svg>
          <div class="board-legend">
            <span><i class="monster-dot"></i> White Lion</span>
            <span><i class="range-dot"></i> Survivors {setupDistance} spaces away</span>
          </div>
        </Section>
      {/if}
    </div>
  {/if}
{/each}

<style>
  .more {
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: 2.75rem;
    gap: 0.625rem;
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-size: var(--text-sm);

    &::before,
    &::after {
      flex: 1;
      border-block-start: 1px solid color-mix(var(--identity) 45%, transparent);
      content: "";
    }

    &:hover .more-label {
      color: var(--foreground);
    }
  }
  .more-label {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.625rem;
    gap: 0.375rem;
  }
  :global(.obsidian) .more-label {
    border-inline: 2px solid var(--identity);
    font-weight: var(--font-bold);
    text-transform: uppercase;
  }
  :global(.folio) .more {
    font-size: 1rem;
    font-family: var(--font-editorial);

    &::before,
    &::after {
      border-block-start: 3px double color-mix(var(--identity) 45%, transparent);
    }
  }
  :global(.folio) .more-label {
    padding-inline: 0;
  }
  :global(.signal) .more {
    &::before,
    &::after {
      border-block-start: 3px dotted color-mix(var(--identity) 65%, transparent);
    }

    &:hover .more-label {
      background: var(--foreground);
      color: var(--background);
    }
  }
  :global(.signal) .more-label {
    border-radius: 2rem;
    background: var(--identity);
    color: var(--identity-ink);
    font-weight: var(--font-bold);
  }
  .more-icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

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
    max-inline-size: 16.25rem;
    margin-inline: auto;
    gap: 1rem;
  }
  .life {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 0.375rem;
  }
  .life > label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .life-value {
    font-size: 3.125rem;
    line-height: 1;
    font-family: var(--font-sans);
  }
  .ai-cards,
  .ai-card {
    display: flex;
    align-items: center;
  }
  .ai-cards {
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: var(--text-sm);
  }
  .ai-card {
    gap: 0.25rem;
  }
  .ai-badge {
    display: grid;
    place-items: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: 50%;
    background: #000;
    color: #fff;
    font-weight: var(--font-weight-bold);
    font-size: var(--text-xs);
  }
  .attributes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    flex: 2;
    align-content: center;
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
    stroke: var(--background);
    stroke-width: 1;
  }
  .grid-lines line {
    vector-effect: non-scaling-stroke;
  }
  .setup-tiles {
    fill: var(--accent-blue);
    opacity: 0.25;
  }
  .monster-marker {
    vector-effect: non-scaling-stroke;
    fill: var(--accent-red);
  }
  .board-legend {
    display: flex;
    justify-content: space-around;
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
  .range-dot {
    inline-size: 0.375rem;
    block-size: 0.375rem;
    background: var(--accent-red);
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
  }
  .action-arrow {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .resource-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.25rem 0.5rem;
  }
  .resource-actions .action.drawn {
    background: color-mix(var(--identity) 38%, var(--panel));
  }
  .resource-quantity {
    inline-size: 3rem;
    min-block-size: 2.75rem;
    text-align: center;
  }
  .resource-stepper {
    display: flex;
    align-items: center;
  }
  .resource-stepper button {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2.75rem;
    border: 1px solid var(--color-divider);
    background: var(--panel);
    color: var(--foreground);
  }
  .resource-stepper .resource-quantity {
    border-radius: 0;
    border-inline: 0;
  }
  .step-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .targets {
    padding-inline-start: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
    line-height: 2;
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
