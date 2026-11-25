<script lang="ts">
  import PhaseHeader from "#lib/kdm/ui/PhaseHeader.svelte";
  let {
    life,
    movement,
    toughness,
    knockedDown,
    onwound,
    onrestore,
    ontoggle,
  }: {
    life: number;
    movement: number;
    toughness: number;
    knockedDown: boolean;
    onwound: () => void;
    onrestore: () => void;
    ontoggle: () => void;
  } = $props();
</script>

<header>
  <PhaseHeader phase="Showdown" context="Prologue / Level 1" title="White Lion" subject="monster-white-lion" />
  <div class="ledger">
    <div class="hunt-life">
      <div class="value"><span>Life</span> <output aria-label="White Lion life">{life}</output></div>
      <div class="tally" aria-hidden="true">
        {#each [1, 2, 3, 4, 5, 6, 7, 8] as mark (mark)}
          <i class={[life >= mark && "filled"]}></i>
        {/each}
        {#if life > 8}<small>+{life - 8}</small>{/if}
      </div>
    </div>
    <dl>
      <div>
        <dt>Movement</dt>
        <dd>{movement}</dd>
      </div>
      <div>
        <dt>Toughness</dt>
        <dd>{toughness}</dd>
      </div>
    </dl>
    <div class="commands">
      <button class="wound" onclick={onwound} disabled={life <= 0}>Wound</button>
      <button class="restore" onclick={onrestore}>Restore Life</button>
      <button class="stance" aria-pressed={knockedDown} onclick={ontoggle}>
        <span class="check" aria-hidden="true">{knockedDown ? "✓" : ""}</span> Knocked down
      </button>
    </div>
  </div>
</header>

<style>
  header {
    background: var(--identity-9);
  }
  .ledger {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 0.625rem;
    gap: 0.75rem;
  }
  .hunt-life {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .value {
    display: grid;
    justify-items: center;
    min-inline-size: 2rem;
    color: var(--identity-2);
    font-size: var(--text-sm);
  }
  output {
    color: var(--foreground);
    font:
      normal 2.25rem/1 Georgia,
      serif;
  }
  .tally {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .tally i {
    inline-size: clamp(0.375rem, 1.8cqi, 0.625rem);
    block-size: 1.5rem;
    background: var(--grey-7);
    clip-path: polygon(44% 0, 100% 0, 56% 100%, 0 100%);
  }
  .tally i:nth-child(4) {
    margin-inline-end: 0.25rem;
  }
  .tally .filled {
    background: var(--identity-3);
  }
  dl {
    min-inline-size: 5.5rem;
  }
  dl div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--text-sm);
  }
  dd {
    font-weight: var(--font-bold);
  }
  .commands {
    display: flex;
    grid-column: 1/-1;
    gap: 0.375rem;
  }
  button {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-block-size: max(var(--size-control), 2.75rem);
    gap: 0.5rem;
    border: 1px solid var(--identity-6);
    border-radius: var(--radius-control);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    touch-action: manipulation;
  }
  .wound {
    background: var(--identity-2);
    color: var(--contrast);
  }
  .wound:disabled {
    background: var(--card);
    color: var(--muted-foreground);
  }
  .restore {
    background: var(--panel);
  }
  .stance {
    flex: 1.5;
    padding-inline: 0.25rem;
    background: var(--panel);
    color: var(--identity-1);
  }
  .stance[aria-pressed="true"] {
    border-color: var(--identity-3);
    background: var(--identity-7);
  }
  .check {
    display: grid;
    place-items: center;
    inline-size: 1rem;
    block-size: 1rem;
    border: 1px solid currentColor;
    border-radius: 0.125rem;
    line-height: 1;
  }
</style>
