<script lang="ts">
  import AttributeTokens from "./AttributeTokens.svelte";
  import ActionRow from "./ActionRow.svelte";
  import AttackProfile from "./AttackProfile.svelte";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import Section from "./Section.svelte";
  import Gear from "./Gear.svelte";
  import EntryList from "./EntryList.svelte";
  import ProgressTrack from "./ProgressTrack.svelte";
  import {
    attributes,
    abbreviations,
    attackStats,
    availableActions,
    canSpendCost,
    isReady,
    spendCost,
    statusItems,
    toggleActed,
    permissions,
    sampleActions,
    sampleDecks,
    type Cost,
    type ListEntry,
    type Sheet,
  } from "./data";

  let {
    person,
    number,
    variant,
    survivorTurn,
    monsterDefense,
    sheet = $bindable(),
  }: {
    person: { name: string; color: string; gender: string };
    number: number;
    variant: number;
    survivorTurn: boolean;
    monsterDefense: { toughness: number; luck: number; evasion: number };
    sheet: Sheet;
  } = $props();

  const id = $props.id();
  const foundingStoneRule =
    "Spend [activation] to sling the stone from anywhere on the board! **Archive** this card for 1 automatic hit that only inflicts a critical wound.";
  const foundingStoneRuleText = foundingStoneRule.replace("[activation]", "an activation").replaceAll("**", "");
  const attackCost = ["activation"] as const;
  let showMore = $state(false);
  let expandedAction = $state<string | null>(null);
  let compactGear = $state(false);
  const listNames = [
    "Fighting Arts",
    "Disorders",
    "Abilities",
    "Impairments",
    "Severe Injuries",
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
      { label: "Speed", value: attack.speed },
      { label: "Acc", value: formatTarget(attack.acc), divider: true },
      { label: "Perf Hit", value: formatCrit(attack.phit) },
      { label: "Wound", value: formatTarget(attack.wound), divider: true },
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

  function toggleStatus(status: string) {
    sheet.statuses = sheet.statuses.includes(status) ? sheet.statuses.filter((value) => value !== status) : [...sheet.statuses, status];
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

  function oninputBleeding(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(input.valueAsNumber)) return;
    sheet.bleeding = input.valueAsNumber;
    if (sheet.bleeding >= sheet.life) sheet.dead = true;
  }

  function oninputLife(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(input.valueAsNumber)) return;
    sheet.life = input.valueAsNumber;
    if (sheet.bleeding >= sheet.life) sheet.dead = true;
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
          <input
            aria-label={`${person.name} ${attribute}`}
            bind:value={sheet.attributes[index]}
            class="attribute-value"
            max="99"
            min="-9"
            type="number"
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
          <span class="armor-input">
            {#if location.icon}
              <KdIcon class="armor-icon" i={location.icon} />
            {:else}
              <span class="brain-icon i-game-icons:brain" aria-hidden="true"></span>
            {/if}
            <input
              class="armor-value"
              aria-label={`${person.name} ${location.name}`}
              type="number"
              min="0"
              max="99"
              bind:value={sheet.armorValues[index]}
            />
          </span>
          <div class="injuries">
            {#if index === 1}<span class="injury-gap" aria-hidden="true"></span>{/if}
            {#each index === 0 ? ["Light"] : index === 1 ? ["Heavy"] : ["Light", "Heavy"] as injury (injury)}
              <label class="injury-target" for={`${id}-${location.name}-${injury}`}>
                <input
                  id={`${id}-${location.name}-${injury}`}
                  type="checkbox"
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

{#snippet conditions()}
  <div class="conditions">
    <button class={["condition", sheet.threat && "active"]} aria-pressed={sheet.threat} onclick={() => (sheet.threat = !sheet.threat)}>
      Threat
    </button>
    <button class={["condition", sheet.acted && "active"]} aria-pressed={sheet.acted} onclick={act}>
      {sheet.acted ? "Acted" : "Act"}
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
    <label for={`${id}-bleeding`}>
      Bleeding <input id={`${id}-bleeding`} type="number" min="0" max={sheet.life} value={sheet.bleeding} oninput={oninputBleeding} />
    </label>
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
          description={foundingStoneRule}
          accessibleDescription={foundingStoneRuleText}
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
  {#if !sheet.permissions.survival}<p class="restriction">Cannot use survival actions</p>{/if}
  <div class="survival-actions">
    {#each ["Dodge", "Dash", "Surge", "Encourage", "Endure"] as action, index (action)}
      <button class="survival-action" disabled={index !== 0 || !availableActions(sheet)}>
        <span>{action}</span><small>{index === 0 ? (availableActions(sheet) ? "1 survival" : "Unavailable") : "Locked"}</small>
      </button>
    {/each}
  </div>
{/snippet}

{#snippet extraSection(name: string)}
  {#if name === "Tokens"}
    <Section
      title="Tokens"
      meta={[
        `${sheet.tokens.reduce((sum, token) => sum + token.positive + token.negative, 0)} Attribute Tokens`,
        `Bleeding: ${sheet.bleeding ?? 0}`,
      ]}
    >
      {@render tokenControls()}
    </Section>
  {:else if name === "Trinkets"}
    <Section title="Trinkets and Baubles" meta={`${sheet.gear.slice(10).filter(Boolean).length || "No"} Gear`}>
      <Gear bind:slots={sheet.gear} bind:selected={selectedGear} bind:dragged={draggedGear} start={10} count={3} slotLabel="Trinket Slot" />
    </Section>
  {:else if name === "Miscellaneous"}
    <Section title="Miscellaneous" meta={["Identity", "Lineage", "Affinities", "Restrictions"]}>
      <div class="fields">
        <label class="field" for={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          type="text"
          bind:value={sheet.name}
          name="survivor"
          maxlength="160"
          oninput={oninputName}
          onblur={onblurName}
        />
        <button
          class={["condition", sheet.nameless && "active"]}
          aria-pressed={sheet.nameless}
          onpointerdown={(event) => event.preventDefault()}
          onclick={toggleNameless}
        >
          Nameless
        </button>
        <label class="field" for={`${id}-gender`}>
          Gender
          <select id={`${id}-gender`} bind:value={sheet.gender}>
            {#each ["Male", "Female", "Non-binary"] as gender (gender)}<option>{gender}</option>{/each}
          </select>
        </label>
        <label class="field" for={`${id}-nickname`}>Nickname/Surname</label>
        <input id={`${id}-nickname`} type="text" bind:value={sheet.nickname} maxlength="160" />
        {#each ["Parent 1", "Parent 2"] as parent, index (parent)}
          <label class="field" for={`${id}-parent-${index}`}>{parent}</label>
          <input id={`${id}-parent-${index}`} type="text" bind:value={sheet.parents[index]} maxlength="160" />
        {/each}
      </div>
      <h3>Affinities</h3>
      <div class="numbers">
        {#each ["Red", "Green", "Blue"] as color, index (color)}
          <div class={["stat", `affinity-${color.toLowerCase()}`]}>
            <label for={`${id}-affinity-${index}`} class="stat-label affinity-label">{color}</label>
            <input
              id={`${id}-affinity-${index}`}
              class="attribute-value affinity-value"
              type="number"
              min="-10"
              max="10"
              step="1"
              bind:value={sheet.affinities[index]}
            />
          </div>
        {/each}
      </div>
      <h3>Limits</h3>
      <div class="numbers">
        <div class="stat">
          <label for={`${id}-survival-limit`} class="stat-label">Survival</label>
          <input id={`${id}-survival-limit`} class="attribute-value" type="number" min="0" step="1" bind:value={sheet.survivalLimit} />
        </div>
        <div class="stat">
          <label for={`${id}-fa-limit`} class="stat-label">Fighting Arts</label>
          <input id={`${id}-fa-limit`} class="attribute-value" type="number" min="0" step="1" bind:value={sheet.fightingArtLimit} />
        </div>
        <div class="stat">
          <label for={`${id}-disorder-limit`} class="stat-label">Disorders</label>
          <input id={`${id}-disorder-limit`} class="attribute-value" type="number" min="0" step="1" bind:value={sheet.disorderLimit} />
        </div>
      </div>
      <h3>Other</h3>
      <div class="numbers">
        <div class="stat">
          <label for={`${id}-life`} class="stat-label">Life</label>
          <input id={`${id}-life`} class="attribute-value" type="number" min="1" step="1" value={sheet.life} oninput={oninputLife} />
        </div>
        <div class="stat">
          <label for={`${id}-perfect-hit-range`} class="stat-label">Perfect Hit Range</label>
          <input id={`${id}-perfect-hit-range`} class="attribute-value" type="number" min="0" step="1" bind:value={sheet.perfectHitRange} />
        </div>
      </div>
      <h3>Restrictions</h3>
      <div class="conditions">
        {#each permissions as permission (permission.key)}
          <button
            class={["condition", sheet.permissions[permission.key] && "active"]}
            aria-pressed={sheet.permissions[permission.key]}
            onclick={() => (sheet.permissions[permission.key] = !sheet.permissions[permission.key])}
          >
            {sheet.permissions[permission.key] ? "Can" : "Cannot"}
            {permission.label.toLowerCase()}
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
            <input
              class="attribute-value"
              type="number"
              aria-label={`${person.name} ${attribute} gear bonus`}
              bind:value={sheet.bonuses[index]}
            />
          </div>
        {/each}
      </div>
      <h3>Depart Bonuses</h3>
      <div class="extra-tokens">
        {#each ["Survival", "Insanity"] as bonus, index (bonus)}
          <label for={`${id}-departure-${index}`}
            >{bonus}<input
              id={`${id}-departure-${index}`}
              type="number"
              aria-label={`${person.name} depart ${bonus} bonus`}
              bind:value={sheet.departure[index]}
            /></label
          >
        {/each}
      </div>
      <h3>Arrival Bonuses</h3>
      <div class="extra-tokens">
        {#each ["Survival", "Insanity"] as bonus, index (bonus)}
          <label for={`${id}-arrival-${index}`}
            >{bonus}<input
              id={`${id}-arrival-${index}`}
              type="number"
              aria-label={`${person.name} arrival ${bonus} bonus`}
              bind:value={sheet.arrival[index]}
            /></label
          >
        {/each}
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
          {#if !sheet.permissions.proficiency}<p class="restriction">Cannot use weapon proficiency</p>{/if}
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
      restricted={name === "Fighting Arts" ? !sheet.permissions.fightingArts : name === "Abilities" ? !sheet.permissions.abilities : false}
    />
  {/if}
{/snippet}

<div class="survivor">
  {#if sheet.statuses.includes("Blind Spot")}
    <div class="blind-banner">
      <span class="blind-icon i-material-symbols:visibility" aria-hidden="true"></span>Blind Spot Active
    </div>
  {/if}

  <header
    class="identity"
    data-threat={sheet.threat ? "" : undefined}
    data-acted={sheet.acted ? "" : undefined}
    data-controller={sheet.statuses.includes("Monster Controller") ? "" : undefined}
    data-blind={sheet.statuses.includes("Blind Spot") ? "" : undefined}
    data-knocked={sheet.statuses.includes("Knocked Down") ? "" : undefined}
    data-dead={sheet.dead ? "" : undefined}
    data-retired={sheet.statuses.includes("Retired") ? "" : undefined}
    data-priority={sheet.priority ? "" : undefined}
  >
    <div class="identity-copy">
      <p class="eyebrow">Survivor {number} <span>{sheet.gender}</span></p>
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
      <input id={`survival-${number}`} type="number" min="0" max={sheet.survivalLimit ?? 1} step="1" bind:value={sheet.survival} />
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
      restricted={variant === 3 && !sheet.permissions.survival ? "Cannot use survival actions" : ""}
      onaction={() => sheet.survival--}
      actionLabel="Dodge"
    >
      {@render actions()}
      <h3>Survival Actions <small>{sheet.survival ?? 0} survival</small></h3>
      {@render survivalActions()}
    </Section>
    <Section title="Status" meta={statusItems(sheet)} onaction={survivorTurn ? act : undefined} actionLabel={sheet.acted ? "Acted" : "Act"}>
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
    <Section title="Status" meta={statusItems(sheet)} onaction={survivorTurn ? act : undefined} actionLabel={sheet.acted ? "Acted" : "Act"}>
      {@render conditions()}
    </Section>
    <Section title="Actions">
      {@render actions()}
    </Section>
    <Section
      title="Survival Actions"
      meta="Dodge"
      restricted={!sheet.permissions.survival ? "Cannot use" : ""}
      onaction={() => sheet.survival--}
      actionLabel="Dodge"
    >
      {@render survivalActions()}
    </Section>
  {/if}

  <Section title="Gear Grid" meta={[`${sheet.gear.slice(0, compactGear ? 4 : 9).filter(Boolean).length} Gear`]}>
    <Gear bind:slots={sheet.gear} bind:selected={selectedGear} bind:dragged={draggedGear} count={compactGear ? 4 : 9} />
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
      <button
        class="more"
        aria-expanded={showMore}
        aria-controls={extras
          .filter((section) => !section.populated)
          .map((section) => `${id}-${section.name.replaceAll(" ", "-")}`)
          .join(" ") || undefined}
        onclick={() => (showMore = !showMore)}
      >
        <span class="more-label">
          {#if variant === 1}
            {showMore ? "Less" : "More"}
          {:else}
            {showMore ? "Show less" : "Show more"}
          {/if}
          <KdIcon class={["more-icon", showMore && "expanded"]} i="flow-arrow" />
        </span>
      </button>
    {:else}
      <div id={`${id}-${section.name.replaceAll(" ", "-")}`} hidden={!section.populated && !showMore}>
        {@render extraSection(section.name)}
      </div>
    {/if}
  {/each}
</div>

<style>
  .more {
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
    gap: 0.375rem;
  }
  .field {
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
    inline-size: var(--size-control);
    block-size: var(--size-control);
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
    background: color-mix(in srgb, var(--background) 48%, transparent);
  }
  :global(.signal) .survival input {
    border: 0;
    border-radius: 0.75rem 0.25rem 0.75rem 0.25rem;
    background: var(--foreground);
    color: var(--background);
  }
  .stats,
  .armor {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.125rem;
    text-align: center;
  }
  .stat-label {
    display: block;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    text-align: center;
  }
  .attribute-value {
    display: block;
    margin-inline: auto;
    color: color-mix(var(--identity) 55%, var(--foreground));
    font-size: 1.625rem;
    line-height: 1.3;
    font-variant-numeric: lining-nums tabular-nums;
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
  .affinity-label,
  .affinity-value {
    color: var(--affinity-color);
  }
  .affinity-value {
    border-color: color-mix(var(--affinity-color) 60%, var(--panel));
    background: color-mix(var(--affinity-color) 18%, var(--panel));
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
  .armor-value {
    position: relative;
    color: var(--foreground);
    font-size: 1.625rem;
  }
  .armor-input {
    display: grid;
    place-items: center;
    inline-size: var(--size-control);
    block-size: var(--size-control);
    border: 1px solid color-mix(var(--identity) 60%, var(--panel));
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 18%, var(--panel));
  }
  .armor-input :global(.armor-icon),
  .armor-input .brain-icon {
    grid-area: 1 / 1;
    color: color-mix(var(--identity) 42%, var(--foreground));
    font-size: 2rem;
    opacity: 0.15;
    pointer-events: none;
  }
  .brain-icon {
    inline-size: 2.25rem;
    block-size: 2.25rem;
    translate: 0 -0.125rem;
  }
  .armor-input .armor-value {
    grid-area: 1 / 1;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
    border: 0;
    border-radius: inherit;
    background: transparent;
  }
  .injuries {
    display: grid;
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
    inline-size: var(--size-control);
    block-size: var(--size-control);
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
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    min-block-size: var(--size-control);
    padding: 0.375rem;
    gap: 0.25rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-sm);
    &:disabled {
      color: var(--muted-foreground);
      cursor: default;
    }
  }
  .survival-action small {
    font-size: var(--text-xs);
  }
  input[type="text"],
  select,
  textarea {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--size-control);
    padding: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--foreground);
    font-size: var(--text-sm);
    user-select: text;
  }
  textarea {
    resize: vertical;
  }
  :global(.folio) h2 {
    font-weight: var(--font-normal);
    font-size: 2.25rem;
    font-family: var(--font-editorial);
  }
  :global(.folio) .attribute-value {
    font-weight: var(--font-normal);
    font-family: var(--font-sans);
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
    overflow: hidden;
    padding-block: 0.875rem;
    border-radius: 1.5rem 0.375rem 2.5rem 0.375rem;
    background-color: color-mix(in srgb, var(--identity) 52%, var(--background));
    background-image:
      var(--signal-dead), var(--signal-retired), var(--signal-knocked), var(--signal-blind), var(--signal-controller),
      var(--signal-priority), var(--signal-acted), var(--signal-threat);
    color: var(--foreground);

    &::before {
      position: absolute;
      z-index: 0;
      inset: -45%;
      background: radial-gradient(ellipse 17% 23% at 75% 75%, var(--signal-orbit-color) 0 74%, transparent 75%);
      content: "";
      pointer-events: none;
      transform: translate(var(--signal-orbit-x), var(--signal-orbit-y)) rotate(var(--signal-orbit-rotate))
        scale(var(--signal-orbit-scale-x), var(--signal-orbit-scale-y));
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
    position: relative;
    z-index: 1;
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
  :global(.signal) .attribute-value {
    border: 0;
    background: var(--identity);
    color: inherit;
    font-family: var(--font-sans);
  }
  :global(.signal) .stat-label {
    color: inherit;
  }
  :global(.signal) .stat:is(.affinity-red, .affinity-green, .affinity-blue) {
    background: var(--affinity-color);
    color: var(--contrast);
  }
  :global(.signal) .affinity-label,
  :global(.signal) .affinity-value {
    color: inherit;
  }
  :global(.signal) .affinity-value {
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
  :global(.obsidian) .extra-tokens input,
  :global(.folio) .extra-tokens input {
    border-radius: 50%;
  }
  :global(.folio) .armor-input {
    border-radius: 0.25rem 0.25rem 50% 50% / 0.25rem 0.25rem 35% 35%;
  }
  :global(.obsidian) .armor-input {
    border-radius: 1rem 1rem 50% 50% / 0.5rem 0.5rem 70% 70%;
  }
  :global(.signal) .survival-action {
    border: 0;
    background: color-mix(var(--identity) 16%, var(--background));
  }
  .blind-banner {
    display: flex;
    z-index: 1;
    position: sticky;
    align-items: center;
    justify-content: center;
    inset-block-start: 0;
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
</style>
