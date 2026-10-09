<script lang="ts">
  import Counter from "../../ui/Counter.svelte";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import AttributeTokens from "../../ui/status/AttributeTokens.svelte";
  import ActionRow from "../../ui/actions/ActionRow.svelte";
  import AttackProfile from "./AttackProfile.svelte";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import Section from "../../ui/sections/Section.svelte";
  import Gear from "../../survivors/ui/Gear.svelte";
  import EntryList from "../../ui/sections/EntryList.svelte";
  import ProgressTrack from "../../survivors/ui/ProgressTrack.svelte";
  import StatusIcon from "../../ui/status/StatusIcon.svelte";
  import { SectionControls, setSectionControls } from "../../ui/sections/sections";
  import { statuses, statusOrder, statusIcons } from "#lib/constants.ts";
  import {
    attributes,
    abbreviations,
    availableActions,
    canSpendCost,
    isReady,
    spendCost,
    statusItems,
    toggleStatus,
    updateDeath,
    toggleActed,
    useDodge,
    restrictions,
    survivorTypes,
    type Cost,
    type ListEntry,
    type Sheet,
  } from "../sheet";
  import { attackStats } from "../rules";
  import { sampleActions, sampleDecks } from "../fixtures";

  let {
    person,
    number,
    variant,
    survivorTurn,
    monsterDefense,
    settlementSurvivors,
    ontogglesection,
    sheet = $bindable(),
  }: {
    person: { name: string; color: string; gender: string };
    number: number;
    variant: number;
    survivorTurn: boolean;
    monsterDefense: { toughness: number; luck: number; evasion: number };
    settlementSurvivors: Sheet[];
    ontogglesection: (title: string) => boolean;
    sheet: Sheet;
  } = $props();

  const id = $props.id();
  let parentOptions = $derived(
    settlementSurvivors
      .map((survivor, index) => ({
        survivor,
        name: survivor.nameless ? `Nameless ${index + 1}` : survivor.name.trim() || `Nameless ${index + 1}`,
      }))
      .filter(({ survivor }) => survivor !== sheet),
  );
  const foundingStoneRule =
    "Spend [activation] to sling the stone from anywhere on the board! **Archive** this card for 1 automatic hit that only inflicts a critical wound.";
  const attackCost = ["activation"] as const;
  let showMore = $state(false);
  const sections = setSectionControls(new SectionControls((title) => ontogglesection(title)));

  function toggleMore() {
    showMore = !showMore;
  }

  function toggleMoreGroup() {
    const open = ontogglesection("More");
    return `Extra sections ${open ? "shown" : "hidden"} in all dashboards.`;
  }

  export function areSectionsOpen() {
    return showMore && sections.allOpen;
  }

  export function setSectionsOpen(open: boolean) {
    showMore = open;
    sections.setOpen(open);
  }

  export function isSectionOpen(title: string) {
    if (title === "More") return showMore;
    const name = title === "Trinkets & Baubles" ? "Trinkets" : title;
    return sections.isOpen(title) && (showMore || !extras.some((section) => section.name === name && !section.populated));
  }

  export function hasSection(title: string) {
    return title === "More" || sections.hasSection(title);
  }

  export function setSectionOpen(title: string, open: boolean) {
    if (title === "More") {
      showMore = open;
      return;
    }
    const name = title === "Trinkets & Baubles" ? "Trinkets" : title;
    if (open && extras.some((section) => section.name === name && !section.populated)) showMore = true;
    sections.setSectionOpen(title, open);
  }
  let expandedAction = $state<string | null>(null);
  let compactGear = $state(false);
  let gearCount = $derived(compactGear ? 4 : 9);
  let trinketRows = $derived((sheet.gear.length - 10) / 3);
  let lastTrinketRowOccupied = $derived(trinketRows > 1 && sheet.gear.slice(-3).some(Boolean));

  function addTrinketRow() {
    if (trinketRows < 3) sheet.gear.push(null, null, null);
  }
  function removeTrinketRow() {
    if (trinketRows > 1 && !lastTrinketRowOccupied) sheet.gear.splice(-3);
  }
  const listNames = [
    "Fighting Arts",
    "Disorders",
    "Abilities",
    "Impairments & Injuries",
    "Resources",
    "Per Lifetimes",
    "Cursed Gear",
    "Showdown History",
  ];
  let entries = $state<Record<string, ListEntry[]>>(Object.fromEntries(listNames.map((name) => [name, []])));
  function toggleGearSize() {
    compactGear = !compactGear;
    selectedGear = null;
    draggedGear = null;
  }

  let tokens = $derived(sheet.tokens.reduce((sum, token) => sum + token.positive + token.negative, 0));

  let selectedGear = $state<number | null>(null);
  let draggedGear = $state<number | null>(null);
  let foundingStoneSlot = $derived(sheet.gear.findIndex((item, index) => index > 0 && index < 10 && item === "Founding Stone"));
  let hasFoundingStone = $derived(foundingStoneSlot !== -1);
  let foundingStoneAttack = $derived(attackStats(sheet, "Founding Stone", monsterDefense));
  let fistAndToothAttack = $derived(attackStats(sheet, "Fist & Tooth", monsterDefense));

  function formatTarget(value: number) {
    return value === 10 ? "10" : `${value}+`;
  }

  function formatCrit(value: number | null) {
    return value === null ? "\u2212" : formatTarget(value);
  }

  function profileStats(attack: ReturnType<typeof attackStats>) {
    return [
      { label: "Spd", value: attack.speed },
      { label: "Acc", value: formatTarget(attack.acc), divider: true },
      { label: "Perf", value: formatCrit(attack.phit) },
      { label: "Wnd", value: formatTarget(attack.wound), divider: true },
      { label: "Crit", value: formatCrit(attack.crit) },
    ];
  }

  function canUse(cost: readonly Cost[]) {
    return survivorTurn && isReady(sheet) && canSpendCost(sheet, cost);
  }

  function spendAction(cost: readonly Cost[]) {
    return canUse(cost) && spendCost(sheet, cost);
  }

  function act() {
    toggleActed(sheet);
  }

  function dodge() {
    useDodge(sheet);
  }

  function activateFoundingStone() {
    const slot = foundingStoneSlot;
    if (slot === -1 || !spendAction(attackCost)) return;
    sheet.gear[slot] = null;
    if (selectedGear === slot) selectedGear = null;
    expandedAction = null;
  }

  let extras = $derived([
    { name: "Tokens", populated: sheet.tokens.some((token) => token.positive || token.negative) || !!sheet.bleeding || sheet.priority },
    { name: "Trinkets", populated: sheet.gear.slice(10).some(Boolean) },
    ...listNames.map((name) => ({ name, populated: entries[name].length > 0 })),
    {
      name: "Armor & Bonuses",
      populated:
        sheet.armorSet !== "No Armor" || sheet.bonuses.some(Boolean) || sheet.departure.some(Boolean) || sheet.arrival.some(Boolean),
    },
    { name: "Development", populated: sheet.development.some(Boolean) || !!sheet.proficiency },
    { name: "Notes", populated: !!sheet.notes.trim() },
    {
      name: "Miscellaneous",
      populated: false,
    },
  ]);
  let orderedExtras = $derived([
    ...extras.filter((section) => section.populated),
    { name: "divider", populated: true },
    ...extras.filter((section) => !section.populated),
  ]);

  function removeProficiency() {
    sheet.proficiency = "";
    sheet.development[3] = 0;
  }

  function oninputName(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    sheet.name = input.value;
    if (sheet.name.trim()) sheet.nameless = false;
  }

  function onblurName(event: FocusEvent) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const namelessName = `Nameless ${number}`;
    sheet.name = input.value.trim() || namelessName;
    sheet.nameless = sheet.name === namelessName;
  }

  function toggleNameless() {
    sheet.nameless = !sheet.nameless;
    if (sheet.nameless) sheet.name = `Nameless ${number}`;
  }

  function setBleeding(value: number) {
    sheet.bleeding = value;
    updateDeath(sheet);
  }

  function setLife(value: number) {
    sheet.life = value;
    updateDeath(sheet);
  }

  const armor = [
    { name: "Insanity", icon: undefined },
    { name: "Head", icon: "location-head" },
    { name: "Arms", icon: "location-arms" },
    { name: "Body", icon: "location-body" },
    { name: "Waist", icon: "location-waist" },
    { name: "Legs", icon: "location-legs" },
  ] as const;
  const tracks = [
    { name: "Hunt XP", max: 16, marks: [2, 6, 10, 15, 16], milestones: ["Age I", "Age II", "Age III", "Age IV", "Retired"] },
    { name: "Courage", max: 9, marks: [3, 9], milestones: ["Bold", "See the Truth"] },
    { name: "Understanding", max: 9, marks: [3, 9], milestones: ["Insight", "White Secret"] },
    { name: "Weapon Proficiency", max: 8, marks: [3, 8], milestones: ["Specialist", "Master"] },
  ];
</script>

{#snippet statistics()}
  <div class="combat">
    <div class="stats">
      {#each attributes as attribute, index (attribute)}
        <div class="stat">
          <span class="stat-label" aria-label={attribute}>{abbreviations[index]}</span>
          <Counter
            label={`${person.name} ${attribute}`}
            bind:value={sheet.attributes[index]}
            class={"field-" + attribute.toLowerCase()}
            max={99}
            min={-9}
          />
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet protection()}
  <div class="combat">
    <div class="armor">
      {#each armor as location, index (location.name)}
        <div class="armor-cell">
          <Counter label={`${person.name} ${location.name}`} shape="armor" min={0} max={99} bind:value={sheet.armorValues[index]}>
            {#snippet icon()}
              {#if location.icon}
                <KdIcon class="armor-icon" i={location.icon} />
              {:else}
                <span class="brain-icon i-game-icons:brain" aria-hidden="true"></span>
              {/if}
            {/snippet}
          </Counter>
          <div class="injuries">
            {#if index === 1}<span class="injury-gap" aria-hidden="true"></span>{/if}
            {#each index === 0 ? ["Light"] : index === 1 ? ["Heavy"] : ["Light", "Heavy"] as injury (injury)}
              <label class="injury-target" for={`${id}-${location.name}-${injury}`}>
                <input
                  id={`${id}-${location.name}-${injury}`}
                  type="checkbox"
                  data-stacked-control
                  bind:checked={sheet.injuries[location.name + injury]}
                  aria-label={`${person.name} ${location.name} ${injury} injury`}
                />
                <span class={injury === "Light" ? "l" : "h"} aria-hidden="true">{injury === "Light" ? "L" : "H"}</span>
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

{#snippet priorityButton()}
  <button class={["priority", sheet.priority && "active"]} aria-pressed={sheet.priority} onclick={() => (sheet.priority = !sheet.priority)}>
    <StatusIcon icon="priority" active={sheet.priority} />
    Priority Target
  </button>
{/snippet}

{#snippet conditions()}
  <div class="conditions">
    {#each statusOrder as status (status)}
      {@const active = sheet.statuses.includes(status)}
      <button class={["condition", active && "active"]} aria-pressed={active} onclick={() => toggleStatus(sheet, status)}>
        <StatusIcon icon={status} {active} />
        {statuses[status].label}
      </button>
      {#if status === "status:act"}{@render priorityButton()}{/if}
    {/each}
  </div>
{/snippet}

{#snippet tokenControls()}
  <AttributeTokens owner={person.name} names={attributes} labels={abbreviations} bind:counts={sheet.tokens} />
  <div class="extra-tokens">
    <label for={`${id}-bleeding`}>
      Bleeding
      <Counter
        class="field-bleeding"
        id={`${id}-bleeding`}
        min={0}
        max={sheet.life}
        bind:value={() => sheet.bleeding, setBleeding}
        label={`${person.name} Bleeding`}
        shape="circle"
      />
    </label>
    {@render priorityButton()}
  </div>
{/snippet}

{#snippet actions()}
  <div class="attack-list">
    {#if hasFoundingStone}
      <AttackProfile
        title="Founding Stone"
        stats={profileStats(foundingStoneAttack)}
        attack={foundingStoneAttack}
        {variant}
        cost={attackCost}
        disabled={!canUse(attackCost)}
        onspend={() => spendAction(attackCost)}
      />
    {/if}
    <AttackProfile
      title="Fist & Tooth"
      stats={profileStats(fistAndToothAttack)}
      attack={fistAndToothAttack}
      {variant}
      cost={attackCost}
      disabled={!canUse(attackCost)}
      onspend={() => spendAction(attackCost)}
    />
  </div>
  {#if hasFoundingStone || number === 1}
    <ul class="action-list">
      {#if hasFoundingStone}
        <ActionRow
          title="Founding Stone"
          cost={attackCost}
          short="Archive to inflict an automatic critical wound"
          description={foundingStoneRule}
          open={expandedAction === "founding-stone"}
          disabled={!canUse(attackCost)}
          onexpand={() => (expandedAction = expandedAction === "founding-stone" ? null : "founding-stone")}
          onspend={activateFoundingStone}
        />
      {/if}
      {#if number === 1}
        {#each sampleActions as action (action.title)}
          <ActionRow
            title={action.title}
            cost={action.cost}
            short={action.short}
            description={action.description}
            open={expandedAction === action.title}
            disabled={!canUse(action.cost)}
            onexpand={() => (expandedAction = expandedAction === action.title ? null : action.title)}
            onspend={() => spendAction(action.cost)}
          />
        {/each}
      {/if}
    </ul>
  {/if}
{/snippet}

{#snippet survivalActions()}
  {#if !sheet.restrict.survival}<p class="restriction">Cannot use survival actions</p>{/if}
  <div class="survival-actions">
    {#each ["Dodge", "Dash", "Surge", "Encourage", "Endure"] as action, index (action)}
      <button class="survival-action" disabled={index !== 0 || !availableActions(sheet)} onclick={index === 0 ? dodge : undefined}>
        <div>
          {#if action === "Dodge"}
            <span class={statusIcons.dodge} aria-hidden="true"></span>
          {:else if action === "Dash"}
            <KdIcon i="movement" label="movement" />
          {:else if action === "Surge"}
            <KdIcon i="activation" label="activation" />
          {:else if action === "Encourage"}
            <span class="i-material-symbols:record-voice-over" aria-hidden="true"></span>
          {:else if action === "Endure"}
            <span class="i-material-symbols:shield" aria-hidden="true"></span>
          {/if}
        </div>
        <div>
          {action}
        </div>
        {#if index === 0}
          <output class="dodge-count" aria-label="Dodges remaining">{availableActions(sheet)}</output>
        {:else}
          <KdIcon i="require" />
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet extraSection(name: string)}
  {#if name === "Tokens"}
    <Section title="Tokens" meta={[`${tokens} Attribute Token${tokens === 1 ? "" : "s"}`, `${sheet.bleeding ?? 0} Bleeding`]}>
      {@render tokenControls()}
    </Section>
  {:else if name === "Trinkets"}
    <Section title="Trinkets & Baubles" meta={`${sheet.gear.slice(10).filter(Boolean).length || "No"} Gear`}>
      <Gear
        bind:slots={sheet.gear}
        bind:selected={selectedGear}
        bind:dragged={draggedGear}
        start={10}
        count={trinketRows * 3}
        gridCount={gearCount}
        slotLabel="Trinket Slot"
      />
      <div class="rows">
        <button
          class="condition"
          type="button"
          onclick={removeTrinketRow}
          disabled={trinketRows === 1 || lastTrinketRowOccupied}
          aria-describedby={lastTrinketRowOccupied ? `${id}-trinket-rows` : undefined}>Remove row</button
        >
        <span class="row-count">{trinketRows} / 3 rows</span>
        <button class="condition" type="button" onclick={addTrinketRow} disabled={trinketRows === 3}>Add row</button>
      </div>
      {#if lastTrinketRowOccupied}
        <p class="selection" id={`${id}-trinket-rows`}>Move or remove gear from the last row before removing it.</p>
      {/if}
    </Section>
  {:else if name === "Miscellaneous"}
    <Section title="Miscellaneous" meta={["Identity", "Lineage", "Affinities", "Restrictions"]}>
      <div class="fields">
        <label class="field" for={`${id}-name`}>
          Name
          <input
            id={`${id}-name`}
            type="text"
            bind:value={sheet.name}
            name="survivor"
            maxlength="160"
            oninput={oninputName}
            onblur={onblurName}
          />
        </label>
        <button
          class={["condition", sheet.nameless && "active"]}
          aria-pressed={sheet.nameless}
          onpointerdown={(event) => event.preventDefault()}
          onclick={toggleNameless}
        >
          Mark as nameless
        </button>
        <label class="field" for={`${id}-gender`}>
          Gender
          <select id={`${id}-gender`} bind:value={sheet.gender}>
            {#each ["Male", "Female", "Non-binary"] as gender (gender)}<option>{gender}</option>{/each}
          </select>
        </label>
        <label class="field" for={`${id}-type`}>
          Type
          <select id={`${id}-type`} bind:value={sheet.type}>
            {#each survivorTypes as type (type)}<option>{type}</option>{/each}
          </select>
        </label>
        <label class="field" for={`${id}-nickname`}>
          Nickname/Surname
          <input id={`${id}-nickname`} type="text" bind:value={sheet.nickname} maxlength="160" />
        </label>
        {#each ["Parent 1", "Parent 2"] as parent, index (parent)}
          <label class="field" for={`${id}-parent-${index}`}>
            {parent}
            <select id={`${id}-parent-${index}`} bind:value={sheet.parents[index]}>
              <option value=""></option>
              {#each parentOptions as option (option.survivor)}
                <option value={option.name}>{option.name}</option>
              {/each}
            </select>
          </label>
        {/each}
      </div>
      <h3>Affinities</h3>
      <div class="numbers">
        {#each ["Red", "Green", "Blue"] as color, index (color)}
          <div class={["stat", `affinity-${color.toLowerCase()}`]}>
            <label for={`${id}-affinity-${index}`} class="stat-label affinity-label">{color}</label>
            <Counter
              id={`${id}-affinity-${index}`}
              min={-10}
              max={10}
              bind:value={sheet.affinities[index]}
              label={`${person.name} ${color} affinity`}
            />
          </div>
        {/each}
      </div>
      <h3>Limits</h3>
      <div class="numbers">
        <div class="stat">
          <label for={`${id}-survival-limit`} class="stat-label">Survival</label>
          <Counter id={`${id}-survival-limit`} min={0} bind:value={sheet.survivalLimit} label={`${person.name} Survival limit`} />
        </div>
        <div class="stat">
          <label for={`${id}-fa-limit`} class="stat-label">Fighting Arts</label>
          <Counter id={`${id}-fa-limit`} min={0} bind:value={sheet.fightingArtLimit} label={`${person.name} Fighting arts limit`} />
        </div>
        <div class="stat">
          <label for={`${id}-disorder-limit`} class="stat-label">Disorders</label>
          <Counter id={`${id}-disorder-limit`} min={0} bind:value={sheet.disorderLimit} label={`${person.name} Disorder limit`} />
        </div>
      </div>
      <h3>Other</h3>
      <div class="numbers">
        <div class="stat">
          <label for={`${id}-life`} class="stat-label">Life</label>
          <Counter id={`${id}-life`} min={1} bind:value={() => sheet.life, setLife} label={`${person.name} Life`} />
        </div>
        <div class="stat">
          <label for={`${id}-perfect-hit-range`} class="stat-label">Perf Hit Range</label>
          <Counter id={`${id}-perfect-hit-range`} min={0} bind:value={sheet.perfectHitRange} label={`${person.name} Perfect hit range`} />
        </div>
      </div>
      <h3>Restrictions</h3>
      <div class="conditions">
        {#each restrictions as r (r.key)}
          <button
            class={["condition", sheet.restrict[r.key] && "active"]}
            aria-pressed={sheet.restrict[r.key]}
            onclick={() => (sheet.restrict[r.key] = !sheet.restrict[r.key])}
          >
            {sheet.restrict[r.key] ? "Can" : "Cannot"}
            {r.label.toLowerCase()}
          </button>
        {/each}
      </div>
    </Section>
  {:else if name === "Armor & Bonuses"}
    <Section title="Armor & Bonuses" meta={`${sheet.armorSet} Set`}>
      <label class="field" for={`${id}-armor-set`}>
        Armor Set
        <select id={`${id}-armor-set`} bind:value={sheet.armorSet}>
          {#each ["No Armor", "Clothed & Satiated", "Rawhide", "White Lion", "Screaming Antelope", "Leather", "Lantern", "Phoenix"] as set (set)}
            <option>{set}</option>
          {/each}
        </select>
      </label>
      <h3>Attribute Bonuses</h3>
      <div class="stats">
        {#each attributes as attribute, index (attribute)}
          <div class="stat">
            <span class="stat-label" aria-label={attribute}>{abbreviations[index]}</span>
            <Counter
              class={[`field-${attribute.toLowerCase()}`]}
              label={`${person.name} ${attribute} gear bonus`}
              bind:value={sheet.bonuses[index]}
            />
          </div>
        {/each}
      </div>
      <div class="bonuses">
        <div class="bonus-group">
          <h3 class="bonus-title">Depart Bonuses</h3>
          <div class="bonus-fields">
            {#each ["Survival", "Insanity"] as bonus, index (bonus)}
              <label for={`${id}-departure-${index}`}>
                {bonus}
                <Counter
                  id={`${id}-departure-${index}`}
                  label={`${person.name} depart ${bonus} bonus`}
                  bind:value={sheet.departure[index]}
                />
              </label>
            {/each}
          </div>
        </div>
        <div class="bonus-group arrival">
          <h3 class="bonus-title">Arrival Bonuses</h3>
          <div class="bonus-fields">
            {#each ["Survival", "Insanity"] as bonus, index (bonus)}
              <label for={`${id}-arrival-${index}`}>
                {bonus}
                <Counter id={`${id}-arrival-${index}`} label={`${person.name} arrival ${bonus} bonus`} bind:value={sheet.arrival[index]} />
              </label>
            {/each}
          </div>
        </div>
      </div>
    </Section>
  {:else if name === "Development"}
    <Section
      title="Development"
      meta={[
        `XP ${sheet.development[0]}`,
        `Courage ${sheet.development[1]}`,
        `Understand ${sheet.development[2]}`,
        `Prof ${sheet.development[3]}`,
      ]}
    >
      {#each tracks as track, index (track.name)}
        {#if index !== 3}
          <ProgressTrack {...track} {variant} bind:value={sheet.development[index]} />
        {:else if sheet.proficiency}
          <div class="proficiency">
            <strong>{sheet.proficiency}</strong>
            <button class="condition" onclick={removeProficiency}>Remove proficiency</button>
          </div>
          {#if !sheet.restrict.proficiency}<p class="restriction">Cannot use weapon proficiency</p>{/if}
          <ProgressTrack {...track} {variant} bind:value={sheet.development[index]} />
        {:else}
          <label class="field" for={`${id}-proficiency`}>
            Weapon Proficiency
            <select id={`${id}-proficiency`} bind:value={sheet.proficiency}>
              <option value="">Select a weapon proficiency</option>
              {#each ["Fist & Tooth", "Sword", "Shield", "Axe", "Bow", "Club", "Dagger", "Grand Weapon", "Katar", "Spear", "Whip"] as weapon (weapon)}
                <option>{weapon}</option>
              {/each}
            </select>
          </label>
        {/if}
      {/each}
    </Section>
  {:else if name === "Notes"}
    <Section title="Notes" meta={sheet.notes.trim() ? "Notes Added" : "No Notes"}>
      <textarea bind:value={sheet.notes} aria-label={`Notes for ${person.name}`} placeholder="Notes…" rows="3"></textarea>
    </Section>
  {:else}
    <EntryList
      title={name}
      bind:entries={entries[name]}
      deck={sampleDecks[name] ?? []}
      swipeDelete={variant === 1}
      restricted={name === "Fighting Arts" ? !sheet.restrict.fightingArts : name === "Abilities" ? !sheet.restrict.abilities : false}
    />
  {/if}
{/snippet}

<div class="survivor">
  <header
    class="identity"
    data-threat={sheet.statuses.includes("status:threat") ? "" : undefined}
    data-acted={sheet.statuses.includes("status:act") ? "" : undefined}
    data-controller={sheet.statuses.includes("status:monster-controller") ? "" : undefined}
    data-blind={sheet.statuses.includes("status:blind-spot") ? "" : undefined}
    data-knocked={sheet.statuses.includes("status:knocked-down") ? "" : undefined}
    data-dead={sheet.statuses.includes("status:dead") ? "" : undefined}
    data-retired={sheet.statuses.includes("status:retire") ? "" : undefined}
    data-priority={sheet.priority ? "" : undefined}
  >
    <div class="identity-copy">
      <p class="eyebrow">
        {sheet.type}
        {number} <span>{sheet.gender}</span>
      </p>
      <h2>
        <span class="visually-hidden">{sheet.name}</span>
        <input
          class="name-input"
          type="text"
          aria-label={`Survivor ${number} name`}
          bind:value={sheet.name}
          maxlength="15"
          oninput={oninputName}
          onblur={onblurName}
        />
      </h2>
      <p class="nickname">{sheet.nickname || "\u00A0"}</p>
    </div>
    <div class="survival">
      <label for={`survival-${number}`}>Survival</label>
      <Counter
        id={`survival-${number}`}
        min={0}
        max={sheet.survivalLimit ?? 1}
        bind:value={sheet.survival}
        label={`${person.name} Survival`}
      />
      <small>Limit {sheet.survivalLimit ?? 1}</small>
    </div>
  </header>

  {#if variant === 3}
    <Section title="Survivor Attributes" meta={[`Mov ${sheet.attributes[0] ?? 0}`, `Ins ${sheet.armorValues[0] ?? 0}`]}>
      {@render statistics()}
      <h3>Insanity & Armor</h3>
      {@render protection()}
    </Section>
    <Section
      title="Actions"
      restricted={variant === 3 && !sheet.restrict.survival ? "Cannot use survival actions" : ""}
      onaction={dodge}
      showAction={Boolean(availableActions(sheet))}
      actionLabel="Dodge"
    >
      {@render actions()}
      <h3>Survival Actions <small>{sheet.survival ?? 0} survival</small></h3>
      {@render survivalActions()}
    </Section>
    <Section title="Status" meta={statusItems(sheet)} onaction={act} showAction={survivorTurn} actionLabel="Act">
      {@render conditions()}
    </Section>
  {:else}
    {#if variant === 2}
      <Section title="Vital Signs" meta={[`Mov ${sheet.attributes[0] ?? 0}`, `Ins ${sheet.armorValues[0] ?? 0}`]}>
        {@render statistics()}
        {@render protection()}
      </Section>
    {:else}
      <Section title="Attributes" meta={`Mov ${sheet.attributes[0] ?? 0}`}>{@render statistics()}</Section>
      <Section title="Insanity & Armor" meta={`Ins ${sheet.armorValues[0] ?? 0}`}>{@render protection()}</Section>
    {/if}
    <Section title="Status" meta={statusItems(sheet)} onaction={act} showAction={survivorTurn} actionLabel="Act">
      {@render conditions()}
    </Section>
    <Section title="Actions">
      {@render actions()}
    </Section>
    <Section
      title="Survival Actions"
      meta="Dodge"
      restricted={!sheet.restrict.survival ? "Cannot use" : ""}
      onaction={dodge}
      showAction={Boolean(availableActions(sheet))}
      actionLabel="Dodge"
    >
      {@render survivalActions()}
    </Section>
  {/if}

  <Section title="Gear Grid" meta={[`${sheet.gear.slice(1, gearCount + 1).filter(Boolean).length} Gear`]}>
    <Gear bind:slots={sheet.gear} bind:selected={selectedGear} bind:dragged={draggedGear} count={gearCount} />
    <button class={["condition", compactGear && "active"]} aria-pressed={compactGear} onclick={toggleGearSize}>
      Use {compactGear ? "3 x 3" : "2 x 2"} grid
    </button>
    {#if compactGear && sheet.gear.slice(5, 10).some(Boolean)}
      <p class="selection">
        {sheet.gear.slice(5, 10).filter(Boolean).length} gear stored in extra slots. Switch to 3 x 3 to access them.
      </p>
    {/if}
  </Section>

  {#each orderedExtras as section (section.name)}
    {#if section.name === "divider"}
      <HoldRipple
        ontap={toggleMore}
        onhold={toggleMoreGroup}
        holdHint="Hold or press Shift+Enter to show or hide extra sections in all dashboards."
      >
        {#snippet children(events, paint)}
          <button
            class="more"
            type="button"
            aria-expanded={showMore}
            aria-controls={extras
              .filter((section) => !section.populated)
              .map((section) => `${id}-${section.name.replaceAll(" ", "-")}`)
              .join(" ") || undefined}
            {...events}
          >
            <span class="more-label">
              {#if variant === 1}
                {showMore ? "Less" : "More"}
              {:else}
                {showMore ? "Show less" : "Show more"}
              {/if}
              <KdIcon class={["more-icon", showMore && "expanded"]} i="flow-arrow" />
            </span>
            {@render paint()}
          </button>
        {/snippet}
      </HoldRipple>
    {:else}
      <div id={`${id}-${section.name.replaceAll(" ", "-")}`} hidden={!section.populated && !showMore}>
        {@render extraSection(section.name)}
      </div>
    {/if}
  {/each}
</div>

<style>
  .more {
    position: relative;
    user-select: none;
    -webkit-touch-callout: none;
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: var(--size-control);
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
    font-size: 1rem;
  }
  .more-label :global(.more-icon.expanded) {
    rotate: 180deg;
  }
  :global(.obsidian) .more-label {
    border-inline: 2px solid var(--identity);
    font-weight: var(--font-bold);
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
  .nickname {
    margin-block-start: 0.25rem;
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  .survival small {
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .restriction {
    padding-block: 0.375rem;
    color: var(--accent-red);
    font-size: var(--text-sm);
  }
  .proficiency {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    font-size: var(--text-sm);
  }
  .fields,
  .field {
    display: grid;
  }
  .fields {
    --gap-field: 0;
    gap: 0.375rem;
  }
  .field {
    gap: var(--gap-field, 0.375rem);
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .numbers {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.375rem;
  }
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
  .identity .name-input {
    display: block;
    inline-size: 100%;
    min-block-size: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;

    &::placeholder {
      color: color-mix(currentColor 65%, transparent);
      opacity: 1;
    }
  }
  .survival {
    --counter-radius: 50%;
    --field-border: color-mix(var(--identity-ink) 42%, transparent);
    --counter-bg: color-mix(var(--identity-ink) 12%, transparent);
    --counter-fg: var(--identity-ink);
    display: grid;
    justify-items: center;
    padding-inline-start: 0.625rem;
    gap: 0.125rem;
    border-inline-start: 1px solid var(--color-divider);
  }
  .survival label {
    font-size: var(--text-xs);
  }

  :global(.folio) .survival {
    --counter-radius: 0;
    --counter-bg: transparent;
    --counter-weight: var(--font-normal);
    --counter-font: var(--font-editorial);
    padding-inline-start: 0.75rem;
  }
  :global(.folio) .survival label {
    font-family: var(--font-editorial);
  }
  :global(.signal) .survival {
    --counter-radius: 0.75rem 0.25rem 0.75rem 0.25rem;
    --counter-bg: var(--foreground);
    --counter-fg: var(--background);
    padding: 0.25rem;
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    border-inline-start: 0;
    background: color-mix(in srgb, var(--background) 48%, transparent);
  }
  .stats,
  .armor {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.125rem;
    text-align: center;
  }
  .stat {
    display: grid;
    justify-items: center;
  }
  .stat-label {
    display: block;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    text-align: center;
  }
  .affinity-red {
    --affinity-color: var(--accent-red);
  }
  .affinity-green {
    --affinity-color: var(--accent-green);
  }
  .affinity-blue {
    --affinity-color: var(--accent-blue);
  }
  .affinity-label {
    color: var(--affinity-color);
  }
  .stat:is(.affinity-red, .affinity-green, .affinity-blue) {
    --field-fg: var(--affinity-color);
    --field-border: color-mix(var(--affinity-color) 60%, var(--panel));
    --field-bg: color-mix(var(--affinity-color) 18%, var(--panel));
  }
  .armor {
    row-gap: 0.625rem;
    margin-block-start: 0.375rem;
  }
  .armor-cell {
    display: grid;
    align-content: start;
    justify-items: center;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .armor-cell :global(.armor-icon) {
    font-size: calc(2rem * var(--scale-control-content));
  }
  .brain-icon {
    --size-icon: calc(2.25rem * var(--scale-control-content));
    translate: 0 calc(-0.125rem * var(--scale-control-content));
    scale: -1 1;
  }
  .injuries {
    display: grid;
  }
  .injury-gap {
    block-size: var(--size-control);
  }
  .injury-target {
    display: grid;
    cursor: pointer;
  }
  input[type="checkbox"] {
    appearance: none;
    grid-area: 1 / 1;
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

    &.h {
      border-width: 2px;
    }
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
  .extra-tokens label,
  .bonus-fields label {
    display: grid;
    justify-items: center;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .bonuses {
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
  .bonus-title {
    display: block;
  }
  .bonus-fields {
    display: flex;
    gap: 0.5rem;
  }
  .conditions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.125rem;
  }
  .condition {
    display: flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
    padding: 0.25rem;
    gap: 0.25rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-md);
    line-height: 1.125;
    &.active {
      border-color: transparent;
      background: var(--identity);
      color: var(--identity-ink);
    }
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
  .rows {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 0.25rem;
  }
  .row-count {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-align: center;
  }
  @media (hover: hover) {
    .condition:enabled:hover {
      box-shadow: inset 0 0 0 var(--border-width) color-mix(var(--identity) 45%, var(--foreground));
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
  .attack-list {
    display: grid;
    gap: 0.125rem;
  }
  .action-list {
    display: grid;
    margin-block-start: 0.125rem;
    gap: 0.125rem;
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
    align-items: center;
    justify-content: space-between;
    min-block-size: var(--size-control);
    padding: 0.5rem;
    gap: 0.25rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-md);
    &:disabled {
      color: var(--muted-foreground);
      cursor: default;
    }
    :global(span) {
      display: inline-block;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      font-size: 1.5rem;
      vertical-align: middle;
    }
  }
  .dodge-count {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 50%;
    background: var(--identity);
    color: var(--identity-ink);
    font-weight: var(--font-bold);
    font-size: 1rem;
    line-height: 1.5;
  }

  input[type="text"],
  select,
  textarea {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--size-control);
    padding: 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--foreground);
    font-size: var(--text-sm);
    user-select: text;
  }
  :global(.folio) h2 {
    font-weight: var(--font-normal);
    font-size: 2.25rem;
    font-family: var(--font-editorial);
  }
  :global(.signal) .identity {
    --signal-threat: none;
    --signal-acted: none;
    --signal-controller: none;
    --signal-blind: none;
    --signal-knocked: none;
    --signal-dead: none;
    --signal-retired: none;
    --signal-priority: none;
    --signal-orbit-x: 0%;
    --signal-orbit-y: 0%;
    --signal-orbit-scale-x: 1;
    --signal-orbit-scale-y: 1;
    --signal-orbit-rotate: 0deg;
    --signal-orbit-color: #ffffff26;

    position: relative;
    padding-block: 0.875rem;
    overflow: hidden;
    border-radius: 1.5rem 0.375rem 2.5rem 0.375rem;
    background-image:
      var(--signal-dead), var(--signal-retired), var(--signal-knocked), var(--signal-blind), var(--signal-controller),
      var(--signal-priority), var(--signal-acted), var(--signal-threat);
    background-color: color-mix(in srgb, var(--identity) 52%, var(--background));
    color: var(--foreground);

    &::before {
      z-index: 0;
      position: absolute;
      inset: -45%;
      transform: translate(var(--signal-orbit-x), var(--signal-orbit-y)) rotate(var(--signal-orbit-rotate))
        scale(var(--signal-orbit-scale-x), var(--signal-orbit-scale-y));
      background: radial-gradient(ellipse 17% 23% at 75% 75%, var(--signal-orbit-color) 0 74%, transparent 75%);
      content: "";
      pointer-events: none;
    }

    &[data-threat] {
      --signal-threat:
        radial-gradient(ellipse 65% 145% at 107% -10%, color-mix(in srgb, var(--accent-red) 55%, transparent), transparent 72%),
        linear-gradient(105deg, transparent 80%, color-mix(in srgb, var(--accent-red) 30%, transparent) 81% 84%, transparent 85%);
      --signal-orbit-y: -40%;
      --signal-orbit-color: color-mix(in srgb, var(--accent-red) 42%, transparent);
    }

    &[data-acted] {
      --signal-acted:
        radial-gradient(ellipse 85% 110% at 70% 50%, #0000008c, transparent 80%),
        repeating-linear-gradient(135deg, #00000030 0 0.35rem, transparent 0.35rem 0.9rem);
      --signal-orbit-x: -30%;
      --signal-orbit-y: 28%;
      --signal-orbit-scale-x: 0.85;
      --signal-orbit-scale-y: 0.45;
      --signal-orbit-color: #ffffff30;
    }

    &[data-priority] {
      --signal-priority: radial-gradient(
        circle at 91% 48%,
        transparent 0 1.25rem,
        color-mix(in srgb, var(--accent-blue) 78%, transparent) 1.3rem 1.43rem,
        transparent 1.48rem 2.4rem,
        color-mix(in srgb, var(--accent-blue) 52%, transparent) 2.45rem 2.55rem,
        transparent 2.6rem
      );
      --signal-orbit-x: -8%;
      --signal-orbit-y: -22%;
      --signal-orbit-scale-x: 0.8;
      --signal-orbit-scale-y: 0.8;
      --signal-orbit-color: color-mix(in srgb, var(--accent-blue) 52%, transparent);
    }

    &[data-controller] {
      --signal-controller: repeating-radial-gradient(
        circle at 82% 112%,
        transparent 0 1rem,
        color-mix(in srgb, var(--accent-purple) 48%, transparent) 1.05rem 1.14rem,
        transparent 1.2rem 2.05rem
      );
      --signal-orbit-x: -10%;
      --signal-orbit-y: 4%;
      --signal-orbit-scale-x: 1.35;
      --signal-orbit-scale-y: 1.35;
      --signal-orbit-rotate: 20deg;
      --signal-orbit-color: color-mix(in srgb, var(--accent-purple) 48%, transparent);
    }

    &[data-blind] {
      --signal-blind: radial-gradient(
        ellipse 78% 115% at 0% 45%,
        #000000ad 0 18%,
        color-mix(in srgb, var(--accent-green) 46%, transparent) 38%,
        transparent 72%
      );
      --signal-orbit-x: -55%;
      --signal-orbit-y: -12%;
      --signal-orbit-scale-x: 1.7;
      --signal-orbit-scale-y: 1.7;
      --signal-orbit-rotate: -45deg;
      --signal-orbit-color: color-mix(in srgb, var(--accent-green) 42%, transparent);
    }

    &[data-knocked] {
      --signal-knocked:
        linear-gradient(
          155deg,
          transparent 0 40%,
          color-mix(in srgb, var(--accent-red) 55%, transparent) 41% 44%,
          #0000008c 45% 76%,
          transparent 77%
        ),
        radial-gradient(ellipse 80% 45% at 22% 110%, color-mix(in srgb, var(--accent-red) 45%, transparent), transparent 80%);
      --signal-orbit-x: -40%;
      --signal-orbit-y: 26%;
      --signal-orbit-scale-x: 1.9;
      --signal-orbit-scale-y: 0.48;
      --signal-orbit-rotate: -18deg;
      border-radius: 0.375rem 1.5rem 0.375rem 2.5rem;
    }

    &[data-retired] {
      --signal-retired:
        radial-gradient(ellipse 85% 75% at 12% 120%, color-mix(in srgb, var(--secondary) 58%, transparent), transparent 78%),
        linear-gradient(0deg, #00000080, transparent 75%);
      --signal-orbit-x: -45%;
      --signal-orbit-y: 20%;
      --signal-orbit-scale-x: 2;
      --signal-orbit-scale-y: 0.6;
      --signal-orbit-color: color-mix(in srgb, var(--secondary) 48%, transparent);
      border-radius: 2.5rem 2.5rem 0.375rem 0.375rem;
    }

    &[data-dead] {
      --signal-dead: radial-gradient(
        ellipse 70% 115% at 48% 50%,
        #000000d9 0 36%,
        color-mix(in srgb, var(--accent-red) 45%, transparent) 65%,
        transparent 80%
      );
      --signal-orbit-x: -20%;
      --signal-orbit-y: -15%;
      --signal-orbit-scale-x: 1.25;
      --signal-orbit-scale-y: 1.25;
      --signal-orbit-color: color-mix(in srgb, var(--accent-red) 55%, transparent);
      border-radius: 0.375rem;
      background-color: var(--background);
    }
  }
  :global(.signal) .identity-copy,
  :global(.signal) .survival {
    z-index: 1;
    position: relative;
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(.signal) .identity {
      transition:
        background-color 350ms ease,
        border-radius 350ms ease;

      &::before {
        transition: transform 500ms ease;
      }
    }
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
  :global(.signal) .stat-label {
    color: inherit;
  }
  :global(.signal) .stat:is(.affinity-red, .affinity-green, .affinity-blue) {
    background: var(--affinity-color);
    color: var(--contrast);
  }
  :global(.signal) .affinity-label {
    border: 0;
    background: var(--affinity-color);
  }
  :global(.signal) .condition {
    border: 0;
    background: color-mix(var(--identity) 16%, var(--background));
    &.active {
      background: var(--identity);
      color: var(--identity-ink);
    }
  }
  :global(.signal) .survival-action {
    border: 0;
    background: color-mix(var(--identity) 16%, var(--background));
  }
  .priority {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 0.5rem;
    gap: 0.25rem;
    border: var(--border-width) solid var(--priority-border);
    border-radius: 9999px;
    background: var(--color-priority-bg);
    color: var(--foreground);
    font-size: var(--text-md);
    opacity: 0.5;
    &.active {
      opacity: 1;
    }
  }
</style>
