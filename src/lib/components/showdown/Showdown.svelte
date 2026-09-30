<script lang="ts">
  import { resolve } from "$app/paths";
  import { dragScroll } from "./drag-scroll";
  import Monster from "./Monster.svelte";
  import Survivor from "./Survivor.svelte";
  import QuickStatus from "./QuickStatus.svelte";
  import { statusIcons } from "#lib/constants.ts";
  import {
    designs,
    survivors,
    makeSheet,
    statusText,
    tokenTotal,
    availableActions,
    makeTokens,
    tokenNet,
    toggleActed,
    useDodge,
  } from "./data";

  let { variant = 1 }: { variant?: number } = $props();
  let design = $derived(designs[variant - 1]);
  let active = $state(0);
  let round = $state(1);
  let monsterTurn = $state(true);
  let monsterKnockedDown = $state(false);
  let awakening = $state(0);
  let sheets = $state(survivors.map((_, index) => makeSheet(index)));
  let menuOpen = $state(false);
  const initialMix = { foreground: 70, background: 50 } as const;
  let foregroundMix = $state(initialMix.foreground);
  let backgroundMix = $state(initialMix.background);
  let brightenZachary = $state(true);
  const colorId = $props.id();
  let density = $state<Density>("default");
  let snap = $state<Snap>("free");
  let monsterStats = $state({ life: 8, movement: 6, toughness: 6, damage: 0, speed: 0 });
  let monsterTokens = $state(makeTokens(7));
  const monsterTokenIndex = { movement: 0, evasion: 4, toughness: 5, luck: 6 };

  type Density = "compact" | "default" | "comfortable";
  type Snap = "left" | "center" | "right" | "free";
  const densityOptions: { value: Density; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "default", label: "Default" },
    { value: "comfortable", label: "Comfortable" },
  ];
  const snapOptions: { value: Snap; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
    { value: "free", label: "Free" },
  ];

  function beginSurvivorTurn() {
    for (const sheet of sheets) {
      sheet.remaining.movement = 1;
      sheet.remaining.activation = 1;
      sheet.dodgesRemaining = 1;
    }
    monsterTurn = false;
  }

  function toggleTurn() {
    if (monsterTurn) beginSurvivorTurn();
    else monsterTurn = true;
  }
  let rail: HTMLDivElement;
  let roster = $derived([
    { name: "White Lion", color: "var(--color-monster)", ink: "var(--contrast)" },
    ...survivors.map((person) =>
      person.name === "Zachary" && brightenZachary
        ? { ...person, color: `color-mix(in oklch, ${person.color} 75%, var(--foreground))`, ink: "var(--contrast)" }
        : person,
    ),
  ]);

  function survivorName(index: number) {
    const sheet = sheets[index - 1];
    return sheet.nameless ? `Nameless ${index}` : sheet.name.trim() || `Nameless ${index}`;
  }

  // Overlay scrollbars need a small inset; classic scrollbars supply their own balanced gutters.
  function dashboardSpacing(element: HTMLElement) {
    function measure() {
      const style = getComputedStyle(element);
      const gutter =
        element.offsetWidth - element.clientWidth - parseFloat(style.borderInlineStartWidth) - parseFloat(style.borderInlineEndWidth);
      const inset = gutter > 1 ? "0" : ".5rem";
      if (element.style.getPropertyValue("--panel-inset") !== inset) element.style.setProperty("--panel-inset", inset);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }
  function alignDashboard(index: number) {
    const dashboard = rail.children[index] as HTMLElement;
    if (snap === "free") {
      const railBounds = rail.getBoundingClientRect();
      const dashboardBounds = dashboard.getBoundingClientRect();
      let left = rail.scrollLeft;
      if (dashboardBounds.left < railBounds.left) left -= railBounds.left - dashboardBounds.left;
      if (dashboardBounds.right > railBounds.right) left += dashboardBounds.right - railBounds.right;
      rail.scrollTo({ left, behavior: "instant" });
      return;
    }
    const inset = parseFloat(getComputedStyle(rail).paddingInlineStart);
    const left = dashboard.offsetLeft - rail.offsetLeft - inset;
    rail.scrollTo({ left, behavior: "instant" });
  }
  function selectSnap(value: Snap) {
    snap = value;
    requestAnimationFrame(() => alignDashboard(active));
  }
  function jump(index: number) {
    active = index;
    const panel = rail.children[index] as HTMLElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.getAnimations().forEach((animation) => animation.cancel());
    panel.animate(
      [
        { backgroundColor: `color-mix(in srgb, ${roster[index].color} 48%, var(--background))` },
        { backgroundColor: getComputedStyle(panel).backgroundColor },
      ],
      { duration: reduced ? 0 : 800, easing: "ease-out" },
    );
    alignDashboard(index);
  }
  function selectSurvivor(index: number) {
    const wasSelected = active === index;
    jump(index);
    if (index === 0 || !wasSelected) return;
    if (monsterTurn) useDodge(sheets[index - 1]);
    else toggleActed(sheets[index - 1]);
  }

  function onscroll() {
    const panels = Array.from(rail.children) as HTMLElement[];
    if (rail.clientWidth >= panels[0].clientWidth * 2) return;
    const inset = parseFloat(getComputedStyle(rail).paddingInlineStart);
    active = panels.reduce(
      (closest, panel, index) =>
        Math.abs(panel.offsetLeft - rail.offsetLeft - inset - rail.scrollLeft) <
        Math.abs(panels[closest].offsetLeft - rail.offsetLeft - inset - rail.scrollLeft)
          ? index
          : closest,
      0,
    );
  }
  function advance() {
    if (monsterTurn) {
      beginSurvivorTurn();
      return;
    }
    round += 1;
    monsterTurn = true;
    awakening += 1;
    for (const sheet of sheets) {
      sheet.statuses = sheet.statuses.filter((status) => status !== "Acted");
      sheet.remainingBeforeAct = null;
    }
    jump(0);
  }
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") menuOpen = false;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    jump((active + direction + roster.length) % roster.length);
  }

  function resourceText(index: number) {
    const { movement, activation } = sheets[index - 1].remaining;
    return `${movement} movement and ${activation} activation remaining`;
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{design.name} Showdown | Guidepost</title></svelte:head>

<main
  class={["showdown", design.className]}
  data-density={density}
  data-snap={snap}
  style:--mix-attr-fg={`${foregroundMix}%`}
  style:--mix-attr-bg={`${backgroundMix}%`}
>
  <h1 class="visually-hidden">{design.name} Showdown</h1>
  <div class="workspace" bind:this={rail} {onscroll} {@attach dragScroll}>
    {#each roster as person, index (person.name)}
      <!-- Each independent scroll region must be keyboard scrollable. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class={["dashboard", index === 0 && "monster-panel"]}
        data-selected={active === index}
        style:--identity={person.color}
        style:--identity-ink={person.ink}
        role="region"
        aria-label={`${index === 0 ? person.name : survivorName(index)} dashboard`}
        tabindex="0"
        {@attach dashboardSpacing}
      >
        {#if index === 0}
          <Monster
            {variant}
            {round}
            {monsterTurn}
            {awakening}
            bind:knockedDown={monsterKnockedDown}
            bind:values={monsterTokens}
            bind:stats={monsterStats}
            onturn={toggleTurn}
          />
        {:else}
          <Survivor
            person={survivors[index - 1]}
            number={index}
            {variant}
            survivorTurn={!monsterTurn}
            monsterDefense={{
              toughness: (monsterStats.toughness ?? 0) + tokenNet(monsterTokens[monsterTokenIndex.toughness]),
              luck: tokenNet(monsterTokens[monsterTokenIndex.luck]),
              evasion: tokenNet(monsterTokens[monsterTokenIndex.evasion]),
            }}
            bind:sheet={sheets[index - 1]}
          />
        {/if}
      </div>
    {/each}
  </div>
  <footer class="toolbar">
    <nav class="roster" aria-label="Jump to dashboard">
      {#each roster as person, index (person.name)}
        <button
          class={["roster-button", active === index && "selected"]}
          style:--identity={person.color}
          style:--identity-ink={person.ink}
          aria-current={active === index ? "true" : undefined}
          aria-label={index === 0
            ? `White Lion, ${monsterTurn ? "current turn" : "waiting"}${monsterKnockedDown ? ", knocked down" : ""}, movement ${(monsterStats.movement || 0) + tokenNet(monsterTokens[monsterTokenIndex.movement])}, toughness ${(monsterStats.toughness || 0) + tokenNet(monsterTokens[monsterTokenIndex.toughness])}, round ${round}`
            : `${survivorName(index)}, ${statusText(sheets[index - 1])}, ${tokenTotal(sheets[index - 1])} tokens, ${availableActions(sheets[index - 1]) ? "Dodge available" : "Dodge unavailable"}${monsterTurn ? (availableActions(sheets[index - 1]) ? ", press again when selected to Dodge" : "") : `, ${resourceText(index)}, press again when selected to toggle Acted`}`}
          onclick={() => selectSurvivor(index)}
        >
          <strong>{index === 0 ? "White Lion" : survivorName(index)}</strong>
          {#if index === 0}
            <span class="monster-flags" aria-hidden="true">
              {#if monsterTurn}<span class={statusIcons.turn}></span>{/if}
              {#if monsterKnockedDown}<span class={statusIcons.knockedDown}></span>{/if}
            </span>
            <span
              >Mov <b>{(monsterStats.movement || 0) + tokenNet(monsterTokens[monsterTokenIndex.movement])}</b> Tgh
              <b>{(monsterStats.toughness || 0) + tokenNet(monsterTokens[monsterTokenIndex.toughness])}</b></span
            >
          {:else}
            <QuickStatus sheet={sheets[index - 1]} showResources={!monsterTurn} />
          {/if}
        </button>
      {/each}
    </nav>

    <button class="advance" onclick={advance}>
      <span class="turn-label" aria-live="polite">{`Round ${round}: ` + (monsterTurn ? "Monster's Turn" : "Survivors' Turn")}</span>
      <span class="next-label">
        {monsterTurn ? "Survivors Next" : "Next Round"}
        <span class="arrow i-material-symbols:arrow-forward" aria-hidden="true"></span>
      </span>
    </button>

    <button class="undo" aria-label="Undo">
      <span class="menu-icon i-material-symbols:undo" aria-hidden="true"></span>
    </button>

    <button
      class="menu-button"
      aria-label="Showdown Menu"
      aria-expanded={menuOpen}
      aria-controls={menuOpen ? "showdown-menu" : undefined}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <span class="menu-icon i-material-symbols:menu" aria-hidden="true"></span>
    </button>
    {#if menuOpen}
      <div class="menu" id="showdown-menu">
        <strong>{active === 0 ? roster[active].name : survivorName(active)}</strong>
        {#if active > 0}
          <p class="menu-status">{statusText(sheets[active - 1])}</p>
          <div class="menu-counts">
            <span>{tokenTotal(sheets[active - 1])} Tokens</span><span
              >{availableActions(sheets[active - 1])} Survival Actions Available</span
            >
          </div>
        {/if}
        <fieldset class="setting">
          <legend class="setting-label">Dashboard snap</legend>
          <div class="options snap-options">
            {#each snapOptions as option (option.value)}
              <button class="menu-option" aria-pressed={snap === option.value} onclick={() => selectSnap(option.value)}>
                {option.label}
              </button>
            {/each}
          </div>
        </fieldset>
        <fieldset class="setting">
          <legend class="setting-label">Interface density</legend>
          <div class="options">
            {#each densityOptions as option (option.value)}
              <button
                class="menu-option density-option"
                style:--size-preview={`var(--size-control-${option.value})`}
                aria-pressed={density === option.value}
                onclick={() => (density = option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </fieldset>
        <fieldset class="setting">
          <legend class="setting-label">Survivor colors</legend>
          <button class="menu-option" aria-pressed={brightenZachary} onclick={() => (brightenZachary = !brightenZachary)}>
            Brighten Zachary
          </button>
        </fieldset>
        <fieldset class="setting">
          <legend class="setting-label">Attribute and token colors</legend>
          <label class="color-setting hidden" for={`${colorId}-foreground`}>
            Foreground lightening <output for={`${colorId}-foreground`}>{foregroundMix}%</output>
            <input id={`${colorId}-foreground`} type="range" min="0" max="100" step="1" bind:value={foregroundMix} />
          </label>
          <label class="color-setting" for={`${colorId}-background`}>
            Background darkening <output for={`${colorId}-background`}>{backgroundMix}%</output>
            <input id={`${colorId}-background`} type="range" min="0" max="100" step="1" bind:value={backgroundMix} />
          </label>
        </fieldset>
        <div class="hidden">
          <strong>Quick View Key</strong>
          <dl>
            <div>
              <dt>M / T</dt>
              <dd>Monster movement and toughness</dd>
            </div>
            <div>
              <dt>Ready</dt>
              <dd>Alive and ready to act</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:my-location" aria-hidden="true"></span>Threat</dt>
              <dd>Marked as a threat</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:check" aria-hidden="true"></span>Acted</dt>
              <dd>Has acted this round</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:airline-seat-flat" aria-hidden="true"></span>Down</dt>
              <dd>Knocked down</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:target" aria-hidden="true"></span>Priority</dt>
              <dd>Priority target</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:visibility" aria-hidden="true"></span>Blind Spot</dt>
              <dd>In the monster's blind spot</dd>
            </div>
            <div>
              <dt><span class={["key-icon", statusIcons.deaf]} aria-hidden="true"></span>Deaf</dt>
              <dd>Survivor is deaf</dd>
            </div>
            <div>
              <dt><span class={["key-icon", statusIcons.blind]} aria-hidden="true"></span>Blind</dt>
              <dd>Survivor is blind</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:filter-none" aria-hidden="true"></span>Tokens</dt>
              <dd>Total tokens, including bleeding</dd>
            </div>
            <div>
              <dt><span class="key-icon i-material-symbols:bolt" aria-hidden="true"></span>Actions</dt>
              <dd>Available survival actions</dd>
            </div>
          </dl>
        </div>
        <fieldset class="setting">
          <legend class="setting-label">Theme</legend>
          <nav class="options" aria-label="Showdown themes">
            {#each designs as item (item.name)}
              <a class="menu-option" href={resolve(item.href)} aria-current={item.name === design.name ? "page" : undefined}>{item.name}</a>
            {/each}
          </nav>
        </fieldset>
        <a class="menu-option back-option" href={resolve("/")}>
          <span class="back-icon i-material-symbols:arrow-back" aria-hidden="true"></span>
          Back to Guidepost
        </a>
        <p>Design preview. Rules and setup are illustrative.</p>
      </div>
    {/if}
  </footer>
</main>

<style>
  .showdown {
    --color-monster: #bda17b;
    --feedback-brightness: 1.12;
    --size-control-compact: 40px;
    --size-control-default: 44px;
    --size-control-comfortable: 48px;
    --size-control: var(--size-control-default);
    --size-column: 20rem;

    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    block-size: calc(100dvh - var(--border-width));
    background: var(--background);
    font-variant-numeric: lining-nums tabular-nums;
  }
  .showdown :global(input[type="number"]) {
    border: var(--border-width) solid var(--field-border);
    font-size: var(--text-num-input);
  }
  .showdown[data-density="compact"] {
    --size-control: var(--size-control-compact);
  }
  .showdown[data-density="comfortable"] {
    --size-control: var(--size-control-comfortable);
  }
  .showdown :global(:where(a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"])) {
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
  }
  .workspace {
    --size-panel: max(var(--size-column), 20%);

    display: grid;
    position: relative;
    grid-auto-columns: var(--size-panel);
    grid-auto-flow: column;
    min-block-size: 0;
    overflow: scroll hidden;
    scroll-snap-type: x mandatory;
    scrollbar-color: var(--card) var(--background);
    scrollbar-width: thin;
  }
  .dashboard {
    position: relative;
    min-inline-size: 0;
    padding-inline: var(--panel-inset, 0.5rem);
    padding-block: 0.375rem;
    overflow: hidden scroll;
    border-inline-end: 1px solid var(--color-divider);
    background: color-mix(var(--identity) 9%, var(--background));
    scrollbar-color: var(--identity) transparent;
    scrollbar-gutter: stable both-edges;
    scrollbar-width: thin;
    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  }
  .monster-panel {
    background: linear-gradient(color-mix(var(--color-monster) 5%, var(--background)), var(--background));
  }
  .toolbar {
    display: grid;
    position: relative;
    grid-template-columns: minmax(0, 1fr) repeat(2, var(--size-control));
    padding: 0.375rem 0.375rem max(0.375rem, env(safe-area-inset-bottom));
    gap: 0.125rem;
    border-block-start: 1px solid var(--color-divider);
    background: var(--panel);
  }
  .roster {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    grid-column: 1 / -1;
  }
  .roster-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    min-inline-size: var(--size-control);
    min-block-size: 3.5rem;
    padding: 0 0 0.25rem;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 10%, var(--background));
    font-size: var(--text-xs);
    line-height: 0.875rem;
    white-space: nowrap;
    touch-action: manipulation;

    &.selected {
      border-color: var(--foreground);
    }
    & strong {
      align-self: stretch;
      padding: 0.125rem;
      overflow: hidden;
      background: var(--identity);
      color: var(--identity-ink);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      line-height: 0.875rem;
      text-overflow: ellipsis;
    }
    & b {
      color: var(--color-monster);
    }
  }
  .monster-flags {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 0.875rem;
    gap: 0.125rem;

    & > span {
      display: inline-block;
      inline-size: 0.875rem;
      block-size: 0.875rem;
    }
  }
  .advance {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    min-block-size: var(--size-control);
    padding: 0.25rem 0.375rem;
    gap: 0.125rem 0.625rem;
    border-radius: var(--radius-control);
    background: var(--foreground);
    color: var(--contrast);
    font-size: var(--text-xs);
  }
  .turn-label {
    font-size: var(--text-sm);
  }
  .next-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--text-xs);
  }
  .arrow {
    inline-size: 0.875rem;
    block-size: 0.875rem;
  }
  .undo,
  .menu-button {
    display: grid;
    place-items: center;
    inline-size: var(--size-control);
    min-block-size: var(--size-control);
    border-radius: var(--radius-control);
    background: var(--card);
  }
  .menu-icon {
    inline-size: 1.125rem;
    block-size: 1.125rem;
  }
  .menu-status {
    margin-block: 0.375rem;
    font-size: var(--text-sm);
  }
  .menu-counts {
    display: flex;
    flex-wrap: wrap;
    margin-block-end: 1rem;
    gap: 0.375rem 1rem;
    font-size: var(--text-sm);
  }
  .menu {
    z-index: 1;
    position: absolute;
    inline-size: min(22rem, calc(100vw - 0.75rem));
    max-block-size: calc(100dvh - 10rem);
    inset-block-end: calc(100% + 0.375rem);
    inset-inline-end: 0.375rem;
    padding: 0.75rem;
    overflow-y: auto;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    box-shadow: 0 1rem 3rem #00000066;
  }
  .menu strong {
    font-size: var(--text-sm);
  }
  .setting {
    margin-block: 0.75rem;
    padding: 0;
    border: 0;
  }
  .setting-label {
    margin-block-end: 0.375rem;
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .color-setting {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    font-size: var(--text-sm);
  }
  input[type="range"] {
    grid-column: 1 / -1;
    inline-size: 100%;
    accent-color: var(--accent);
  }
  .options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 0.25rem;
  }
  .snap-options {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .menu-option {
    display: flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
    padding-inline: 0.25rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
    font-size: var(--text-xs);
    text-align: center;

    &[aria-pressed="true"],
    &[aria-current="page"] {
      border-color: var(--accent);
      background: color-mix(var(--accent) 24%, var(--card));
      color: var(--foreground);
    }
  }
  .density-option {
    block-size: var(--size-preview);
    min-block-size: var(--size-preview) !important;
  }
  dl {
    display: grid;
    margin-block: 0.75rem;
    gap: 0.5rem;
    font-size: var(--text-xs);
  }
  dl > div {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    gap: 0.5rem;
  }
  dt {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  dd,
  .menu p {
    color: var(--muted-foreground);
  }
  .key-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .back-option {
    justify-content: flex-start;
    gap: 0.375rem;
  }
  .back-icon {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
  }
  .menu p {
    font-size: var(--text-xs);
  }
  .folio .workspace {
    --size-panel: max(var(--size-column), calc((100% - 1.5rem) / 5));

    padding-block: 0.375rem;
    gap: 0.375rem;
  }
  .showdown[data-snap="left"] .workspace {
    padding-inline: 0;
  }
  .showdown[data-snap="center"] .workspace {
    padding-inline: max(0px, calc((100% - var(--size-panel)) / 2));
  }
  .showdown[data-snap="right"] .workspace {
    padding-inline-start: max(0px, calc(100% - var(--size-panel)));
    padding-inline-end: 0;
  }
  .showdown[data-snap="free"] .workspace {
    padding-inline: 0;
    scroll-snap-type: none;
  }
  .showdown[data-snap="left"] .dashboard {
    scroll-snap-align: start;
  }
  .showdown[data-snap="center"] .dashboard {
    scroll-snap-align: center;
  }
  .showdown[data-snap="right"] .dashboard {
    scroll-snap-align: end;
  }
  .showdown[data-snap="free"] .dashboard {
    scroll-snap-align: none;
  }
  .folio {
    --feedback-brightness: 0.94;
  }
  .signal {
    --feedback-brightness: 1.18;
  }
  @media (prefers-reduced-motion: no-preference) {
    .showdown :global(button) {
      transition: filter 100ms ease-out;
      &:active:not(:disabled) {
        filter: brightness(var(--feedback-brightness));
      }
    }
  }
  .folio .dashboard {
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 16%, var(--background));
  }
  .folio .advance {
    background: var(--color-monster);
  }
  .signal .dashboard {
    background: color-mix(var(--identity) 28%, var(--background));
  }
  .signal .advance {
    background: var(--accent);
  }

  @media (min-width: 1100px) {
    .toolbar {
      grid-template-columns: minmax(22rem, 42rem) 13rem 3.5rem 3.5rem;
      align-items: stretch;
      justify-content: center;
      gap: 0.5rem;
    }
    .roster {
      grid-column: auto;
    }
    .advance {
      flex-direction: column;
    }
    .advance,
    .undo,
    .menu-button {
      block-size: 3.5rem;
    }
    .undo,
    .menu-button {
      inline-size: 3.5rem;
    }
  }
  .showdown .workspace:global([data-dragging="true"]) {
    cursor: grabbing;
    scroll-snap-type: none;
  }
  .workspace:global([data-dragging="true"]) .dashboard {
    cursor: grabbing;
  }
  @media (hover: hover) and (pointer: fine) {
    .workspace,
    .dashboard {
      cursor: grab;
    }
  }
</style>
