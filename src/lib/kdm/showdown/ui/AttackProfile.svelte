<script lang="ts">
  import ActionCost from "../../ui/actions/ActionCost.svelte";
  import { attackOdds } from "../attack-odds";
  import { describeCost, type Cost } from "../sheet";
  import { type attackStats } from "../rules";
  import type { Snippet } from "svelte";

  type RollSpread = ReturnType<typeof attackOdds>["hits"];

  let {
    title,
    stats,
    attack,
    variant = 1,
    cost,
    disabled = false,
    onspend,
    children,
  }: {
    title: string;
    stats: readonly { label: string; value: string | number; divider?: boolean }[];
    attack?: ReturnType<typeof attackStats>;
    variant?: number;
    cost?: readonly Cost[];
    disabled?: boolean;
    onspend?: () => void;
    children?: Snippet;
  } = $props();

  const oddsId = $props.id();
  const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const gaugeNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const diePercent = new Intl.NumberFormat("en", { style: "percent" });
  const average = new Intl.NumberFormat("en", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  let open = $state(false);
  let odds = $derived(attack ? attackOdds(attack) : null);
  let marked = $derived(variant === 3 && (title === "Founding Stone" || title === "Fist & Tooth"));

  function onclick() {
    open = !open;
  }
</script>

{#snippet distribution(title: string, singular: string, results: RollSpread)}
  <figure class="distribution">
    <figcaption class="folio-caption">{title}</figcaption>
    <div class="segments" aria-hidden="true">
      <span class="segment none" style:width={`${results.none * 100}%`}></span>
      <span class="segment one" style:width={`${results.one * 100}%`}></span>
      <span class="segment many" style:width={`${results.many * 100}%`}></span>
    </div>
    <dl class="outcomes">
      <div class="outcome">
        <dt class="outcome-label"><span class="key none" aria-hidden="true"></span>0 {title.toLowerCase()}</dt>
        <dd class="outcome-value">{percent.format(results.none)}</dd>
      </div>
      <div class="outcome center">
        <dt class="outcome-label"><span class="key one" aria-hidden="true"></span>1 {singular}</dt>
        <dd class="outcome-value">{percent.format(results.one)}</dd>
      </div>
      <div class="outcome end">
        <dt class="outcome-label"><span class="key many" aria-hidden="true"></span>2+ {title.toLowerCase()}</dt>
        <dd class="outcome-value">{percent.format(results.many)}</dd>
      </div>
    </dl>
  </figure>
{/snippet}

{#snippet compactResult(title: string, kind: "hit" | "wound" | "crit", chance: number, expected: number, results: RollSpread)}
  <figure class={["obsidian-result", kind]}>
    <figcaption class="obsidian-caption"><span>{title}</span><b>Avg {average.format(expected)}</b></figcaption>
    <div class="mini-gauge" style:--chance={`${chance * 100}%`}>
      <span class="mini-core">
        <span class="percent-icon i-material-symbols:percent" aria-hidden="true"></span>
        <b class="mini-value" aria-hidden="true">{gaugeNumber.format(chance * 100)}</b>
        <span class="visually-hidden">{percent.format(chance)}</span>
      </span>
    </div>
    <div class="segments compact" aria-hidden="true">
      <span class="segment none" style:width={`${results.none * 100}%`}></span>
      <span class="segment one" style:width={`${results.one * 100}%`}></span>
      <span class="segment many" style:width={`${results.many * 100}%`}></span>
    </div>
    <div class="obsidian-values">
      <span>0 <b class="outcome-percent">{percent.format(results.none)}</b></span>
      <span class="middle-value">1 <b class="outcome-percent">{percent.format(results.one)}</b></span>
      <span class="last-value">2+ <b class="outcome-percent">{percent.format(results.many)}</b></span>
    </div>
  </figure>
{/snippet}

{#snippet weaponKeywords(keywords: readonly string[])}
  <div class="keyword-line">
    <span class="keyword-label">Keywords</span>
    <ul class="keywords">
      {#each keywords as keyword (keyword)}
        <li class="keyword">{keyword}</li>
      {/each}
    </ul>
  </div>
{/snippet}

<div class="profile">
  {#if attack}
    <button class={["read", marked && "marked"]} type="button" aria-expanded={open} aria-controls={oddsId} {onclick}>
      {#if marked && title === "Founding Stone"}
        <span class="weapon-mark i-game-icons:rock" aria-hidden="true"></span>
      {:else if marked && title === "Fist & Tooth"}
        <span class="weapon-mark i-game-icons:fist" aria-hidden="true"></span>
      {/if}
      <span class={["heading", marked && "mark-foreground"]}>
        <strong class={variant === 2 ? "with-icon" : undefined}>
          {#if variant === 2 && title === "Founding Stone"}
            <span class="title-icon i-game-icons:rock" aria-hidden="true"></span>
          {:else if variant === 2 && title === "Fist & Tooth"}
            <span class="title-icon i-game-icons:fist" aria-hidden="true"></span>
          {/if}
          <span>{title}</span>
        </strong>
        <span class="chevron i-material-symbols:expand-more" aria-hidden="true"></span>
      </span>
      <span class={["stats", marked && "mark-foreground"]}>
        {#each stats as stat (stat.label)}
          <span class={["stat", stat.divider && "divided"]} data-stat={stat.label}>
            <span class="stat-label">{stat.label}</span>
            <span class="stat-value">{stat.value}</span>
          </span>
        {/each}
      </span>
    </button>
  {:else}
    <div class={["static-heading", onspend && "with-spend"]}>
      <strong>{title}</strong>
      {#if cost && !onspend}<ActionCost {cost} />{/if}
    </div>
    <dl class={["static-stats", onspend && "with-spend"]}>
      {#each stats as stat (stat.label)}
        <div class={["stat", stat.divider && "divided"]}>
          <dt class="stat-label">{stat.label}</dt>
          <dd class="stat-value">{stat.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}
  {#if cost && onspend}
    <button
      class={["spend", attack && "with-attack"]}
      type="button"
      aria-label={cost.length ? `Spend ${describeCost(cost)} to attack with ${title}` : `Attack with ${title} for free`}
      {disabled}
      onclick={onspend}
    >
      <ActionCost {cost} />
    </button>
  {/if}
  {#if attack && odds}
    <div class="odds" id={oddsId} hidden={!open}>
      {#if variant === 2}
        <div class="folio-board">
          <p class="folio-heading"><span>Attack ledger</span><b class="folio-dice">{attack.speed}d10</b></p>
          <p class="roll">
            Hit {attack.acc === 10 ? "10" : `${attack.acc}+`} ({percent.format(odds.hitPerDie)} per die). Wound
            {attack.wound === 10 ? "10" : `${attack.wound}+`} ({percent.format(odds.woundGivenHit)} per hit).
          </p>
          {@render distribution("Hits", "hit", odds.hits)}
          {@render distribution("Wounds", "wound", odds.wounds)}
          {@render weaponKeywords(attack.keywords)}
        </div>
      {:else if variant === 3}
        <div class="signal-board">
          <p class="signal-heading"><span>Combat forecast</span><b class="signal-dice">{attack.speed}d10</b></p>
          <div class="gauges">
            <div class="gauge-unit">
              <span class="gauge-label">At least one hit</span>
              <div class="gauge hit" style:--chance={`${odds.anyHit * 100}%`}>
                <span class="gauge-core"><b class="gauge-value">{percent.format(odds.anyHit)}</b></span>
              </div>
            </div>
            <div class="gauge-unit">
              <span class="gauge-label">At least one wound</span>
              <div class="gauge wound" style:--chance={`${odds.anyWound * 100}%`}>
                <span class="gauge-core"><b class="gauge-value">{percent.format(odds.anyWound)}</b></span>
              </div>
            </div>
          </div>
          <dl class="telemetry">
            <div class="reading">
              <dt class="reading-label">2+ hits</dt>
              <dd class="reading-value">{percent.format(odds.hits.many)}</dd>
            </div>
            <div class="reading">
              <dt class="reading-label">Avg hits</dt>
              <dd class="reading-value">{average.format(odds.expectedHits)}</dd>
            </div>
            <div class="reading">
              <dt class="reading-label">Avg wounds</dt>
              <dd class="reading-value">{average.format(odds.expectedWounds)}</dd>
            </div>
          </dl>
          <p class="roll">
            Hit {attack.acc === 10 ? "10" : `${attack.acc}+`} ({percent.format(odds.hitPerDie)} per die). Wound
            {attack.wound === 10 ? "10" : `${attack.wound}+`} ({percent.format(odds.woundGivenHit)} per hit).
          </p>
          {@render weaponKeywords(attack.keywords)}
        </div>
      {:else}
        <dl class="obsidian-targets">
          <div class="target">
            <dt class="target-label">Hit {attack.acc === 10 ? "10" : `${attack.acc}+`}</dt>
            <dd class="target-value">{diePercent.format(odds.hitPerDie)} / die</dd>
          </div>
          <div class="target">
            <dt class="target-label">Wound {attack.wound === 10 ? "10" : `${attack.wound}+`}</dt>
            <dd class="target-value">{diePercent.format(odds.woundGivenHit)} / hit</dd>
          </div>
          <div class="target">
            <dt class="target-label">Crit {attack.crit === 10 ? "10" : `${attack.crit}+`}</dt>
            <dd class="target-value">{diePercent.format(odds.critGivenHit)} / crit</dd>
          </div>
        </dl>
        {@render compactResult("Hits", "hit", odds.anyHit, odds.expectedHits, odds.hits)}
        {@render compactResult("Wounds", "wound", odds.anyWound, odds.expectedWounds, odds.wounds)}
        {@render compactResult("Crits", "crit", odds.anyCrit, odds.expectedCrits, odds.crits)}
        {@render weaponKeywords(attack.keywords)}
      {/if}
      <p class="note">
        {variant === 1
          ? "Wound odds use Toughness; crit odds need an eligible hit location. Gear effects are excluded."
          : "Assumes one normal wound roll per hit; excludes location and critical effects."}
      </p>
    </div>
  {/if}
  {#if children}<div class="footer">{@render children()}</div>{/if}
</div>

<style>
  .heading,
  .static-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem 0;
    gap: 0.25rem;
  }
  .static-heading {
    grid-column: 1 / -1;

    &.with-spend {
      grid-column: 1;
    }
  }
  .read {
    display: grid;
    grid-column: 1;
    min-inline-size: 0;
    text-align: start;

    &.marked {
      position: relative;
      overflow: hidden;
    }

    &:hover {
      background: color-mix(var(--identity) 10%, transparent);
    }

    &:focus-visible {
      outline-offset: -2px;
    }
  }
  .weapon-mark {
    display: inline-block;
    position: absolute;
    inline-size: 5.5rem;
    block-size: 5.5rem;
    inset-block-start: -1rem;
    inset-inline-end: 1.25rem;
    color: var(--identity);
    opacity: 0.1;
    pointer-events: none;
  }
  .mark-foreground {
    position: relative;
    z-index: 1;
  }
  .chevron {
    flex-shrink: 0;
    inline-size: 1rem;
    block-size: 1rem;
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast);
  }
  .read[aria-expanded="true"] .chevron {
    rotate: 180deg;
  }
  .profile {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    overflow: hidden;
    /* border: 2px solid var(--color-divider); */
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  strong {
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    line-height: var(--line-height-snug);
  }
  .with-icon {
    display: inline-flex;
    align-items: center;
  }
  .title-icon {
    display: inline-block;
    flex-shrink: 0;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    translate: -0.25rem 0;
    color: color-mix(var(--identity) 65%, var(--foreground));
  }
  .spend {
    display: grid;
    grid-row: 1 / 3;
    grid-column: 2;
    place-items: center;
    min-block-size: var(--size-control);
    padding-inline: 0.5rem;
    background: color-mix(var(--identity) 14%, var(--panel));

    &.with-attack {
      grid-row: 1;
    }

    &:hover:not(:disabled) {
      background: color-mix(var(--identity) 25%, var(--panel));
    }

    &:focus-visible {
      outline-offset: -2px;
    }

    &:disabled {
      --color-action-cost: var(--muted-foreground);

      background: var(--panel);
      cursor: default;
    }
  }
  .stats,
  .static-stats {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    padding-block: 0.125rem;
    gap: 0.125rem;
  }
  .static-stats {
    grid-column: 1 / -1;

    &.with-spend {
      grid-column: 1;
    }
  }
  .stat {
    display: grid;
    align-content: start;
    justify-items: center;
    min-inline-size: 0;

    &[data-stat="Spd"] {
      --stat-color: color-mix(in oklch, var(--speed-background) 85%, white);
    }

    &[data-stat="Acc"] {
      --stat-color: color-mix(in oklch, var(--accuracy-background) 85%, white);
    }

    &[data-stat="Wnd"] {
      --stat-color: color-mix(in oklch, var(--strength-background) 85%, white);
    }

    &[data-stat="Perf"],
    &[data-stat="Crit"] {
      --stat-color: color-mix(in oklch, var(--luck-background) 85%, white);
    }

    &.divided {
      padding-inline-start: 0.125rem;
      border-radius: 99px;
      border-inline-start: 2px solid var(--color-divider);
      corner-shape: squircle;
      box-shadow: -0.25rem 0 0.375rem -0.25rem var(--color-divider);
    }
  }
  .stat-label {
    color: var(--stat-color, var(--muted-foreground));
    font-size: var(--text-xs);
    line-height: var(--line-height-none);
    white-space: nowrap;
  }
  .stat-value {
    color: var(--foreground);
    font-weight: var(--font-bold);
    line-height: var(--line-height-none);
  }
  .odds {
    display: grid;
    grid-column: 1 / -1;
    padding: 0.5rem;
    gap: 0.375rem;
    border-block-start: 1px solid var(--color-divider);
    font-size: var(--text-sm);

    &[hidden] {
      display: none;
    }
  }
  .keyword-line {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: baseline;
    padding-block-start: 0.375rem;
    gap: 0.375rem;
    border-block-start: 1px solid var(--color-divider);
  }
  .keyword-label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
  }
  .keyword {
    color: var(--foreground);
    font-size: var(--text-xs);
    line-height: var(--line-height-snug);
    white-space: nowrap;
  }
  .roll,
  .note {
    color: var(--muted-foreground);
    line-height: var(--line-height-snug);
  }
  .note {
    display: none;
    font-size: var(--text-xs);
  }
  .obsidian-targets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-block-end: 0.375rem;
    gap: 0.25rem;
    border-block-end: 1px solid var(--color-divider);
  }
  .target {
    display: grid;
    gap: 0.125rem;
    text-align: center;
  }
  .target-label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .target-value {
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .obsidian-result {
    --result-color: var(--accent-green);

    display: grid;
    grid-template-rows: auto 0.375rem auto;
    grid-template-columns: 2.75rem minmax(0, 1fr);
    align-items: center;
    gap: 0.125rem 0.5rem;

    &.wound {
      --result-color: var(--accent-red);
    }

    &.crit {
      --result-color: var(--accent-blue);
    }
  }
  .obsidian-caption {
    display: flex;
    grid-row: 1;
    grid-column: 2;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem;
    font-size: var(--text-xs);
  }
  .mini-gauge {
    display: grid;
    grid-row: 1 / 4;
    grid-column: 1;
    place-items: center;
    aspect-ratio: 1;
    inline-size: 2.75rem;
    padding: 0.1875rem;
    border-radius: 50%;
    background: conic-gradient(from -90deg, var(--result-color) var(--chance), var(--color-divider) 0);
  }
  .mini-core {
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
    background: var(--panel);
  }
  .percent-icon {
    display: inline-block;
    grid-area: 1 / 1;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    color: var(--result-color);
    opacity: 0.18;
  }
  .mini-value {
    grid-area: 1 / 1;
    color: var(--foreground);
    font-size: var(--text-sm);
  }
  .obsidian-values {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-row: 3;
    grid-column: 2;
    gap: 0.125rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .middle-value {
    text-align: center;
  }
  .last-value {
    text-align: end;
  }
  .outcome-percent {
    color: var(--foreground);
  }
  .folio-board {
    display: grid;
    padding-block: 0.25rem;
    gap: 0.375rem;
    border-block: 3px double color-mix(var(--identity) 35%, transparent);
    font-family: var(--font-editorial);
  }
  .folio-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-size: var(--text-md);
    letter-spacing: 0.04em;
  }
  .folio-dice {
    color: var(--foreground);
    font-size: var(--text-sm);
    font-family: var(--font-sans);
  }
  .distribution {
    display: grid;
    gap: 0.125rem;
  }
  .folio-caption {
    padding-block-end: 0.125rem;
    border-block-end: 1px solid var(--color-divider);
    color: var(--foreground);
    font-size: var(--text-md);
  }
  .segments {
    display: flex;
    block-size: 0.375rem;
    overflow: hidden;
    background: var(--card);

    &.compact {
      grid-row: 2;
      grid-column: 2;
    }
  }
  .segment {
    block-size: 100%;
  }
  .none {
    background: color-mix(var(--muted-foreground) 40%, var(--panel));
  }
  .one {
    background: color-mix(var(--result-color, var(--identity)) 45%, var(--foreground));
  }
  .many {
    background: var(--result-color, var(--identity));
  }
  .outcomes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .outcome {
    display: grid;
    align-content: start;

    &.center {
      justify-items: center;
    }

    &.end {
      justify-items: end;
    }
  }
  .outcome-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .key {
    flex-shrink: 0;
    inline-size: 0.375rem;
    block-size: 0.375rem;
  }
  .outcome-value {
    font-weight: var(--font-bold);
    font-size: var(--text-md);
  }
  .signal-board {
    display: grid;
    padding: 0.5rem;
    gap: 0.5rem;
    border: 1px solid color-mix(var(--identity) 55%, transparent);
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: radial-gradient(circle at 50% 0, color-mix(var(--identity) 18%, transparent), transparent 70%), var(--background);
  }
  .signal-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .signal-dice {
    color: var(--foreground);
    font-size: var(--text-md);
    font-family: var(--font-display);
  }
  .gauges {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .gauge-unit {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
  }
  .gauge-label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    text-align: center;
  }
  .gauge {
    --gauge-color: var(--accent-green);

    display: grid;
    place-items: center;
    aspect-ratio: 1;
    inline-size: min(100%, 5.5rem);
    padding: 0.25rem;
    border-radius: 50%;
    background: conic-gradient(from -90deg, var(--gauge-color) var(--chance), var(--color-divider) 0);
    box-shadow: 0 0 1rem color-mix(var(--gauge-color) 22%, transparent);

    &.wound {
      --gauge-color: var(--accent-red);
    }
  }
  .gauge-core {
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
    background: var(--background);
  }
  .gauge-value {
    color: var(--foreground);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }
  .telemetry {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-block: 0.375rem;
    gap: 0.125rem;
    border-block: 1px solid var(--color-divider);
  }
  .reading {
    display: grid;
    justify-items: center;
    gap: 0.125rem;
    text-align: center;
  }
  .reading-label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .reading-value {
    color: var(--foreground);
    font-size: var(--text-md);
    font-family: var(--font-display);
  }
  .footer {
    grid-column: 1 / -1;
    border-block-start: 2px solid var(--color-divider);
  }
  :global(.obsidian) .profile {
    background: color-mix(var(--identity) 4%, var(--panel));
  }
  :global(.obsidian) .keyword-label {
    color: color-mix(var(--identity) 45%, var(--foreground));
  }
  :global(.obsidian) .keyword {
    padding-inline-start: 0.25rem;
    border-inline-start: 2px solid color-mix(var(--identity) 55%, var(--foreground));
  }
  :global(.folio) .profile {
    border-radius: 0.25rem;
  }
  :global(.folio) strong {
    font-weight: var(--font-normal);
    font-size: var(--text-md);
    font-family: var(--font-editorial);
  }
  :global(.folio) .keyword-line {
    padding-block-start: 0.25rem;
    border-block-start: 3px double color-mix(var(--identity) 35%, transparent);
  }
  :global(.folio) .keyword-label,
  :global(.folio) .keyword {
    font-size: var(--text-sm);
    font-family: var(--font-editorial);
  }
  :global(.folio) .keyword {
    color: color-mix(var(--identity) 45%, var(--foreground));
  }
  :global(.signal) .profile {
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: color-mix(var(--identity) 16%, var(--background));
  }
  :global(.signal) .keyword-line {
    align-items: start;
    padding: 0.375rem;
    border: 1px solid color-mix(var(--identity) 45%, transparent);
    border-radius: 0.75rem 0.125rem 0.75rem 0.125rem;
    background: color-mix(var(--identity) 10%, var(--background));
  }
  :global(.signal) .keyword-label {
    color: color-mix(var(--identity) 65%, var(--foreground));
  }
  :global(.signal) .keyword {
    padding-block-end: 0.125rem;
    border-block-end: 1px solid color-mix(var(--identity) 50%, transparent);
  }
  :global(.signal) .spend:not(:disabled) {
    --color-action-cost: var(--foreground);

    background: color-mix(var(--identity) 30%, var(--background));

    &:hover {
      background: color-mix(var(--identity) 40%, var(--background));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
