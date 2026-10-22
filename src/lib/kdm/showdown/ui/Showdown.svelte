<script lang="ts">
  import "../../ui/stats.css";
  import MenuButton from "#lib/app/MenuButton.svelte";
  import { getSiteMenu } from "#lib/app/site-menu.svelte.ts";
  import { getShowdownDisplay } from "../display.svelte.ts";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import { sectionName } from "../../ui/sections/sections";
  import { dragScroll } from "./drag-scroll";
  import Monster from "./Monster.svelte";
  import Survivor from "./Survivor.svelte";
  import { setGearDrag } from "../../survivors/ui/gear-drag";
  import QuickStatus from "./status/QuickStatus.svelte";
  import StatusIcon from "../../ui/status/StatusIcon.svelte";
  import { makeSheet, statusText, tokenTotal, availableActions, makeTokens, tokenNet, toggleActed, useDodge } from "../sheet";
  import { survivors } from "../fixtures";

  const designs = [
    { name: "Obsidian", subtitle: "The Command Table", className: "obsidian", href: "/kdm/showdown1" },
    { name: "Folio", subtitle: "The Survivor Chronicles", className: "folio", href: "/kdm/showdown2" },
    { name: "Signal", subtitle: "The Combat Console", className: "signal", href: "/kdm/showdown3" },
  ] as const;

  let { variant = 1 }: { variant?: number } = $props();
  setGearDrag({ current: null, selection: null });
  let design = $derived(designs[variant - 1]);
  let active = $state(0);
  let round = $state(1);
  let monsterTurn = $state(true);
  let monsterKnockedDown = $state(false);
  let awakening = $state(0);
  let sheets = $state(survivors.map((_, index) => makeSheet(index)));
  const menu = getSiteMenu();
  const display = getShowdownDisplay();
  let dashboards = $state<
    {
      areSectionsOpen: () => boolean;
      setSectionsOpen: (open: boolean) => void;
      hasSection: (title: string) => boolean;
      isSectionOpen: (title: string) => boolean;
      setSectionOpen: (title: string, open: boolean) => void;
    }[]
  >([]);
  let currentExpanded = $derived(dashboards[active]?.areSectionsOpen() ?? false);
  let allExpanded = $derived(dashboards.length > 0 && dashboards.every((dashboard) => dashboard.areSectionsOpen()));
  let { density, snap, borderLightness, foregroundLightness, backgroundLightness, brightenZachary } = $derived(display.settings);
  let monsterStats = $state({ life: 8, movement: 6, toughness: 6, damage: 0, speed: 0 });
  let monsterTokens = $state(makeTokens(7));
  const monsterTokenIndex = { movement: 0, evasion: 4, toughness: 5, luck: 6 };
  let monsterMovement = $derived((monsterStats.movement || 0) + tokenNet(monsterTokens[monsterTokenIndex.movement]));
  let monsterDefense = $derived({
    toughness: (monsterStats.toughness ?? 0) + tokenNet(monsterTokens[monsterTokenIndex.toughness]),
    luck: tokenNet(monsterTokens[monsterTokenIndex.luck]),
    evasion: tokenNet(monsterTokens[monsterTokenIndex.evasion]),
  });

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
        ? { ...person, color: `color-mix(in oklch, ${person.color} 80%, oklch(from var(--foreground) l 0 none))`, ink: "var(--contrast)" }
        : person,
    ),
  ]);

  function dashboardName(index: number) {
    if (index === 0) return roster[0].name;
    const sheet = sheets[index - 1];
    return sheet.nameless ? `Nameless ${index}` : sheet.name.trim() || `Nameless ${index}`;
  }

  // Overlay scrollbars need a small inset; classic scrollbars supply their own balanced gutters.
  function dashboardSpacing(element: HTMLElement) {
    let frame = 0;
    function measure() {
      frame = 0;
      const style = getComputedStyle(element);
      const gutter =
        element.offsetWidth - element.clientWidth - parseFloat(style.borderInlineStartWidth) - parseFloat(style.borderInlineEndWidth);
      const inset = gutter > 1 ? "0" : ".5rem";
      if (element.style.getPropertyValue("--panel-inset") !== inset) element.style.setProperty("--panel-inset", inset);
    }
    // Changing the inset can resize this dashboard, so write outside the observer's delivery cycle.
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
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
  function jump(index: number) {
    active = index;
    const panel = rail.children[index] as HTMLElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.getAnimations().forEach((animation) => animation.cancel());
    panel.animate(
      [
        { backgroundColor: getComputedStyle(panel).getPropertyValue("--identity-7") },
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
      sheet.statuses = sheet.statuses.filter((status) => status !== "status:act");
      sheet.remainingBeforeAct = null;
    }
    jump(0);
  }

  function onkeydown(event: KeyboardEvent) {
    if (menu.open || event.defaultPrevented) return;
    const len = roster.length;
    const numberShortcut = RegExp(`^[1-${Math.min(len, 9)}]$`).test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (!numberShortcut && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    event.preventDefault();
    if (numberShortcut) {
      jump(Number(event.key) - 1);
      return;
    }
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    jump((active + direction + len) % len);
  }

  function resourceText(index: number) {
    const { movement, activation } = sheets[index - 1].remaining;
    return `${movement} movement and ${activation} activation remaining`;
  }

  function setSectionsOpen(open: boolean, all = false) {
    for (const dashboard of all ? dashboards : [dashboards[active]]) dashboard.setSectionsOpen(open);
  }

  function toggleCurrentSections() {
    setSectionsOpen(!currentExpanded);
  }

  function toggleAllSections() {
    const open = !allExpanded;
    setSectionsOpen(open, true);
    return `Sections ${open ? "expanded" : "collapsed"} in all dashboards.`;
  }

  function toggleRelatedSections(title: string) {
    const name = sectionName(title);
    const matching = dashboards.filter((dashboard) => dashboard.hasSection(name));
    const open = !matching.every((dashboard) => dashboard.isSectionOpen(name));
    for (const dashboard of matching) dashboard.setSectionOpen(name, open);
    return open;
  }

  function registerMenu() {
    return display.register(dashboardSummary, () => alignDashboard(active));
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{design.name} Showdown | Guidepost</title></svelte:head>

{#snippet dashboardSummary()}
  <strong>{dashboardName(active)}</strong>
  {#if active > 0}
    <p class="menu-status">{statusText(sheets[active - 1])}</p>
    <div class="menu-counts">
      <span>{tokenTotal(sheets[active - 1])} Tokens</span>
      <span>{availableActions(sheets[active - 1])} Survival Actions Available</span>
    </div>
  {/if}
{/snippet}

<main
  class={["showdown", design.className]}
  {@attach registerMenu}
  data-density={density}
  data-snap={snap}
  style:--stat-border-lightness={`${borderLightness}%`}
  style:--stat-foreground-lightness={`${foregroundLightness}%`}
  style:--stat-background-lightness={`${backgroundLightness}%`}
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
        aria-label={`${dashboardName(index)} dashboard`}
        tabindex="0"
        {@attach dashboardSpacing}
      >
        {#if index === 0}
          <Monster
            bind:this={dashboards[index]}
            {variant}
            {round}
            {monsterTurn}
            {awakening}
            bind:knockedDown={monsterKnockedDown}
            bind:values={monsterTokens}
            bind:stats={monsterStats}
            onturn={toggleTurn}
            ontogglesection={toggleRelatedSections}
          />
        {:else}
          <Survivor
            bind:this={dashboards[index]}
            person={survivors[index - 1]}
            number={index}
            {variant}
            survivorTurn={!monsterTurn}
            settlementSurvivors={sheets}
            ontogglesection={toggleRelatedSections}
            {monsterDefense}
            bind:sheet={sheets[index - 1]}
          />
        {/if}
      </div>
    {/each}
  </div>
  <footer>
    <nav class="roster" aria-label="Jump to dashboard">
      {#each roster as person, index (person.name)}
        <button
          class="roster-button"
          aria-keyshortcuts={`${index + 1}`}
          style:--identity={person.color}
          style:--identity-ink={person.ink}
          aria-current={active === index ? "true" : undefined}
          aria-label={index === 0
            ? `White Lion, ${monsterTurn ? "current turn" : "waiting"}${monsterKnockedDown ? ", knocked down" : ""}, movement ${monsterMovement}, toughness ${monsterDefense.toughness}, round ${round}`
            : `${dashboardName(index)}, ${statusText(sheets[index - 1])}, ${tokenTotal(sheets[index - 1])} tokens, ${availableActions(sheets[index - 1]) ? "Dodge available" : "Dodge unavailable"}${monsterTurn ? (availableActions(sheets[index - 1]) ? ", press again when selected to Dodge" : "") : `, ${resourceText(index)}, press again when selected to toggle Acted`}`}
          onclick={() => selectSurvivor(index)}
        >
          <strong>{dashboardName(index)}</strong>
          {#if index === 0}
            <span>
              Mov <b>{monsterMovement}</b>
              Tgh <b>{monsterDefense.toughness}</b>
            </span>
            <span class="monster-flags" aria-hidden="true">
              {#if monsterTurn}<StatusIcon icon="turn" active context="legend" />{/if}
              {#if monsterKnockedDown}<StatusIcon icon="status:knocked-down" active context="legend" />{/if}
            </span>
          {:else}
            <QuickStatus sheet={sheets[index - 1]} showResources={!monsterTurn} />
          {/if}
        </button>
      {/each}
    </nav>

    <HoldRipple
      ontap={toggleCurrentSections}
      onhold={toggleAllSections}
      holdHint="Hold or press Shift+Enter to expand or collapse sections in all dashboards."
    >
      {#snippet children(events, paint, holding)}
        <button
          class="sections-button icon-button"
          type="button"
          aria-label={`${currentExpanded ? "Collapse" : "Expand"} sections in ${dashboardName(active)} dashboard`}
          title={currentExpanded ? "Collapse current dashboard sections" : "Expand current dashboard sections"}
          {...events}
        >
          <span
            class={["menu-icon", "control-icon", currentExpanded ? "i-material-symbols:unfold-less" : "i-material-symbols:unfold-more"]}
            style:opacity={holding ? 0 : 1}
            aria-hidden="true"
          ></span>
          <span
            class={[
              "menu-icon",
              "control-icon",
              allExpanded ? "i-material-symbols:unfold-less-double" : "i-material-symbols:unfold-more-double",
            ]}
            style:opacity={holding ? 1 : 0}
            aria-hidden="true"
          ></span>
          {@render paint()}
        </button>
      {/snippet}
    </HoldRipple>

    <button class="advance" onclick={advance}>
      <span class="turn-label" aria-live="polite">{`Round ${round}: ` + (monsterTurn ? "Monster's Turn" : "Survivors' Turn")}</span>
      <span class="next-label">
        {monsterTurn ? "Survivors Next" : "Next Round"}
        <span class="menu-icon control-icon i-material-symbols:arrow-forward" aria-hidden="true"></span>
      </span>
    </button>

    <button class="icon-button" aria-label="Undo">
      <span class="menu-icon control-icon i-material-symbols:undo" aria-hidden="true"></span>
    </button>

    <MenuButton />
  </footer>
</main>

<style>
  /* Each identity owns its scale: 0 is lightest, 5 is the original color, and 10 is darkest.
   * Define it on both owners so inherited shades resolve against their own --identity. */
  .dashboard,
  .roster-button {
    --identity-light: oklch(from var(--foreground) l 0 none);
    --identity-dark: oklch(from var(--background) l 0 none);
    --identity-0: color-mix(in oklch, var(--identity) 10%, var(--identity-light));
    --identity-1: color-mix(in oklch, var(--identity) 20%, var(--identity-light));
    --identity-2: color-mix(in oklch, var(--identity) 40%, var(--identity-light));
    --identity-3: color-mix(in oklch, var(--identity) 60%, var(--identity-light));
    --identity-4: color-mix(in oklch, var(--identity) 80%, var(--identity-light));
    --identity-5: var(--identity);
    --identity-6: color-mix(in oklch, var(--identity) 75%, var(--identity-dark));
    --identity-7: color-mix(in oklch, var(--identity) 52%, var(--identity-dark));
    --identity-8: color-mix(in oklch, var(--identity) 34%, var(--identity-dark));
    --identity-9: color-mix(in oklch, var(--identity) 20%, var(--identity-dark));
    --identity-10: color-mix(in oklch, var(--identity) 10%, var(--identity-dark));
  }
  .showdown {
    --color-monster: #bda17b;
    --feedback-brightness: 1.12;
    --scale-control-compact: calc(32 / 44);
    --scale-control-content: 1;
    --size-control-compact: calc(var(--size-control-default) * var(--scale-control-compact));
    --size-control-default: 44px;
    --size-control-comfortable: 56px;
    --size-control: var(--size-control-default);
    --size-number-max: 48px;
    --size-column: 20rem;

    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    block-size: calc(100dvh - var(--border-width));
    background: var(--background);
    font-variant-numeric: lining-nums tabular-nums;
  }
  .showdown[data-density="compact"] {
    --size-control: var(--size-control-compact);
    --scale-control-content: var(--scale-control-compact);
  }
  .showdown[data-density="comfortable"] {
    --size-control: var(--size-control-comfortable);
  }
  .showdown :global(:where(a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"])) {
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
  }
  .showdown :global([data-stacked-control]) {
    inline-size: min(var(--size-control), var(--size-number-max));
    block-size: var(--size-control);
    min-inline-size: 0;
    min-block-size: 0;
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
    border-inline-end: var(--border-width) solid var(--color-divider);
    background: var(--identity-10);
    scrollbar-color: var(--identity) transparent;
    scrollbar-gutter: stable both-edges;
    scrollbar-width: thin;
    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  }
  footer {
    display: grid;
    grid-template-columns: var(--size-control) minmax(0, 1fr) var(--size-control) var(--size-floating-control);
    align-items: center;
    padding: 0.125rem max(0.125rem, env(safe-area-inset-right)) max(0.125rem, env(safe-area-inset-bottom))
      max(0.125rem, env(safe-area-inset-left));
    gap: var(--border-width);
    border-block-start: var(--border-width) solid var(--color-divider);
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
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-control);
    background: var(--identity-10);
    font-size: var(--text-xs);
    line-height: 0.875rem;
    white-space: nowrap;
    touch-action: manipulation;

    &[aria-current="true"] {
      border-color: var(--foreground);
    }
    & strong {
      align-self: stretch;
      padding: 0.125rem;
      overflow: hidden;
      background: var(--identity);
      color: var(--identity-ink);
      font-weight: var(--font-bold);
      text-overflow: ellipsis;
    }
    & b {
      color: var(--color-monster);
    }
  }
  .monster-flags {
    --size-status-icon: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 0.875rem;
    gap: 0.125rem;
  }
  .advance {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    min-block-size: var(--size-control);
    padding-inline: 0.25rem;
    gap: 0 0.625rem;
    border-radius: var(--radius-control);
    background: var(--foreground);
    color: var(--contrast);
    font-size: var(--text-xs);
  }
  .turn-label {
    font-size: var(--text-md);
  }
  .next-label {
    display: flex;
    align-content: center;
    align-items: center;
    gap: 0.25rem;

    .menu-icon {
      --size-icon: 1.25rem;
    }
  }
  .icon-button {
    display: grid;
    place-items: center;
    inline-size: var(--size-control);
    min-block-size: var(--size-control);
    border-radius: var(--radius-control);
    background: var(--card);
  }
  .sections-button {
    position: relative;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .sections-button .menu-icon {
    grid-area: 1 / 1;
  }
  .menu-status {
    margin-block: 0.375rem;
    font-size: var(--text-sm);
  }
  .menu-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .folio .workspace {
    --size-panel: max(var(--size-column), calc((100% - 1.5rem) / 5));

    padding-block: 0.375rem;
    gap: 0.375rem;
  }
  .showdown[data-snap="center"] .workspace {
    padding-inline: max(0px, calc((100% - var(--size-panel)) / 2));
  }
  .showdown[data-snap="right"] .workspace {
    padding-inline-start: max(0px, calc(100% - var(--size-panel)));
    padding-inline-end: 0;
  }
  .showdown[data-snap="free"] .workspace {
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
  .folio {
    --feedback-brightness: 0.94;
  }
  .signal {
    --feedback-brightness: 1.18;
  }
  @media (prefers-reduced-motion: no-preference) {
    .sections-button .menu-icon {
      transition: opacity var(--duration-fast);
    }
    .showdown :global(button) {
      transition: filter 100ms ease-out;
      &:active:not(:disabled) {
        filter: brightness(var(--feedback-brightness));
      }
    }
  }
  .folio .dashboard {
    border: 0;
    border-radius: 0;
  }
  .folio .advance {
    background: var(--color-monster);
  }
  .signal .advance {
    background: var(--accent);
  }

  @media (min-width: 1100px) {
    footer {
      grid-template-columns: minmax(22rem, 1fr) 3.5rem 13rem repeat(2, 3.5rem);
      gap: 0.5rem;
    }
    .roster {
      grid-column: auto;
    }
    .advance {
      flex-direction: column;
    }
    .advance,
    .icon-button {
      block-size: 3.5rem;
    }
    .icon-button {
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
    .roster-button,
    .advance,
    .icon-button {
      &:hover:not(:disabled) {
        filter: brightness(var(--feedback-brightness));
      }
    }
    .workspace,
    .dashboard {
      cursor: grab;
    }
  }
</style>
