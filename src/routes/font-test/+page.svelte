<script module lang="ts">
  import { KD_ICONS, type KdIconName } from "#lib/constants.ts";

  type Group = {
    id: string;
    label: string;
    icons: KdIconName[];
  };

  const groupLabels: Record<string, string> = {
    other: "Other",
  };
  const groupOverrides: Partial<Record<KdIconName, string>> = {
    armor: "armor",
    deck: "deck",
  };
  const otherIcons = new Set<KdIconName>(["lantern-small", "milestone-filled", "persistent-injury"]);
  const groupedIcons = new Map<string, KdIconName[]>();

  for (const icon of Object.keys(KD_ICONS).sort((a, b) => a.localeCompare(b)) as KdIconName[]) {
    const group = groupOverrides[icon] ?? (otherIcons.has(icon) ? "other" : icon.includes("-") ? icon.split("-", 1)[0] : "other");
    const entries = groupedIcons.get(group) ?? [];
    entries.push(icon);
    groupedIcons.set(group, entries);
  }

  const iconGroups: Group[] = Array.from(groupedIcons, ([id, icons]) => ({
    id,
    label: groupLabels[id] ?? `${id[0].toUpperCase()}${id.slice(1)}`,
    icons,
  })).sort((a, b) => a.label.localeCompare(b.label));
  const iconCount = Object.keys(KD_ICONS).length;
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import KdIcon from "#lib/components/KdIcon.svelte";

  let query = $state("");
  let copiedIcon = $state<string | null>(null);
  let visibleGroups = $derived.by(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return iconGroups;

    return iconGroups
      .map((group) => ({ ...group, icons: group.icons.filter((icon) => icon.includes(normalizedQuery)) }))
      .filter((group) => group.icons.length);
  });

  async function copyIcon(icon: string) {
    await navigator.clipboard.writeText(icon);
    copiedIcon = icon;
    window.setTimeout(() => (copiedIcon = null), 2_000);
  }
</script>

<svelte:head>
  <title>Guidepost | KD Icons font test</title>
  <meta name="description" content="A reference for the named KD Icons font glyphs." />
</svelte:head>

<main>
  <a href={resolve("/")}>Back to Guidepost</a>

  <header>
    <h1>KD Icons</h1>
    <p>{iconCount} named icons, grouped and listed alphabetically.</p>
    <label class="filter">
      <span>Filter icons</span>
      <input bind:value={query} type="search" placeholder="Search by name" />
    </label>
  </header>

  {#each visibleGroups as { id, label, icons } (id)}
    <section class={id} aria-labelledby={id}>
      <h2 {id}>{label}</h2>
      <ul>
        {#each icons as i (i)}
          <li>
            <KdIcon {i} label={i} />
            <code>{i}</code>
            <span>{KD_ICONS[i]}</span>
            <button type="button" onclick={() => copyIcon(i)}>{copiedIcon === i ? "Copied" : "Copy"}</button>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="empty">No icons match “{query}”.</p>
  {/each}
</main>

<style>
  main {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding: 1rem;
  }

  a {
    display: inline-block;
    margin-block-end: 2rem;
    color: var(--muted-foreground);

    &:is(:hover, :focus-visible) {
      color: var(--accent);
    }
  }

  header {
    margin-block-end: 2rem;
  }

  section {
    margin-block: 2rem;
  }

  h2 {
    margin-block-end: 0.75rem;
    color: var(--muted-foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }

  .filter {
    display: grid;
    max-inline-size: 22rem;
    margin-block-start: 1rem;
    gap: 0.25rem;
    color: var(--muted-foreground);
    font-weight: var(--font-bold);
  }

  input {
    padding: 0.5rem;
    border: var(--border-size) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--foreground);
    font: inherit;
  }

  .empty {
    margin-block: 2rem;
  }

  h1 {
    font-weight: var(--font-bold);
    font-size: clamp(2rem, 8vw, 4rem);
    line-height: var(--line-height-none);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  p,
  li > span {
    color: var(--muted-foreground);
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.5rem;
  }

  li {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 0.75rem;
    border: var(--border-size) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
  }

  li :global(.kd-icon) {
    grid-column: 1 / -1;
    justify-self: center;
    min-block-size: 3rem;
    color: var(--foreground);
    font-size: 3rem;
  }

  .monster li :global(.kd-icon) {
    min-block-size: 11rem;
    font-size: 11rem;
  }

  code {
    grid-column: 1 / -1;
    overflow-wrap: anywhere;
  }

  li button {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--card);
    color: var(--foreground);
    font-weight: var(--font-bold);
  }
</style>
