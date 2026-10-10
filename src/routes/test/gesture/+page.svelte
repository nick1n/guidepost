<script lang="ts">
  import { resolve } from "$app/paths";
  import GestureControl from "#lib/components/gestures/GestureControl.svelte";
  import type { ControlSize, GestureMode, GestureStyle } from "#lib/components/gestures/gesture.ts";

  type Study = {
    id: string;
    title: string;
    category: "Tap" | "Hold" | "Swipe" | "Numbers" | "Paths";
    mode: GestureMode;
    variant: GestureStyle;
    description: string;
    recipe: string;
    takeaway: string;
  };

  const studies: Study[] = [
    {
      id: "01",
      title: "Just a button",
      category: "Tap",
      mode: "tap",
      variant: "plain",
      description: "A familiar shape with no extra marks. A useful baseline for everything that follows.",
      recipe: "Tap to toggle one dashboard",
      takeaway: "The quietest option. Nothing suggests a hidden gesture.",
    },
    {
      id: "02",
      title: "The hold halo",
      category: "Hold",
      mode: "hold",
      variant: "halo",
      description: "A dashed ring stays inside each button. Hold until it fills to toggle all six dashboards in the row.",
      recipe: "Tap for one, hold and release for all",
      takeaway: "A shared ring could become our consistent cue for long press.",
    },
    {
      id: "03",
      title: "The corner marker",
      category: "Hold",
      mode: "hold",
      variant: "corner",
      description: "A small corner badge says there is more here, while keeping the main icon uncomplicated.",
      recipe: "Tap for one, hold and release for all",
      takeaway: "Fits small toolbar buttons. The dots hint at more options, but need learning.",
    },
    {
      id: "04",
      title: "Vertical rails",
      category: "Numbers",
      mode: "vertical",
      variant: "rails",
      description: "Chevrons sit above and below each field, keeping horizontal space free for its neighbors.",
      recipe: "Tap −1, swipe ↑ +1 or ↓ −1, hold for options",
      takeaway: "A strong starting point for frequently adjusted numbers.",
    },
    {
      id: "05",
      title: "The compass",
      category: "Swipe",
      mode: "swipe",
      variant: "compass",
      description: "Small values tuck above and below each button. All four swipe directions stay visible in a crowded row.",
      recipe: "Tap −1, swipe ↑ +1, ↓ −1, ← −5, → +5",
      takeaway: "The most explicit swipe design. It spends more space to explain itself.",
    },
    {
      id: "06",
      title: "The orbit menu",
      category: "Numbers",
      mode: "number",
      variant: "orbit",
      description: "A ring fits inside the number button. Quick actions open in a shared tray above the six fields.",
      recipe: "Tap −1, swipe to adjust, hold then slide or tap a menu option",
      takeaway: "The tray keeps full-size action targets without covering neighboring numbers.",
    },
    {
      id: "07",
      title: "The grip",
      category: "Numbers",
      mode: "number",
      variant: "grip",
      description: "A tiny handle gives the number a draggable feel. The same hold ring appears when you press.",
      recipe: "Tap −1, swipe to adjust, hold for options",
      takeaway: "Compact enough for a dense dashboard. A grip can also suggest dragging the whole field.",
    },
    {
      id: "08",
      title: "Reveal on touch",
      category: "Numbers",
      mode: "number",
      variant: "reveal",
      description: "Almost no marks at rest. Directional values appear on contact, with a quick menu after a hold.",
      recipe: "Tap −1, swipe to adjust, hold for options",
      takeaway: "The cleanest resting state. Discovery happens after the first touch.",
    },
    {
      id: "09",
      title: "Counter orbits",
      category: "Paths",
      mode: "hold",
      variant: "perimeter",
      description: "Two small comets run opposite ways around the pressed button. One full lap readies all six dashboards.",
      recipe: "Tap for one, hold and release for all",
      takeaway: "Both paths hug the button border, so the hold cue needs no extra space between fields.",
    },
    {
      id: "10",
      title: "Slingshot",
      category: "Paths",
      mode: "vertical",
      variant: "track",
      description: "A marker bends toward the top or bottom on a curved loop as you swipe. Release and it returns to the side.",
      recipe: "Tap −1, swipe ↑ +1 or ↓ −1, hold for options",
      takeaway: "The loop uses the vertical space around each field. Your finger controls its offset-distance directly.",
    },
    {
      id: "11",
      title: "Ribbon lift",
      category: "Paths",
      mode: "number",
      variant: "fan",
      description: "Hold any number and four actions lift from that exact button, following different curves into the shared tray.",
      recipe: "Tap −1, swipe to adjust, hold then slide or tap an option",
      takeaway: "Paths adapt to the selected column and the row width. The other five buttons stay in place.",
    },
    {
      id: "12",
      title: "Passing spark",
      category: "Paths",
      mode: "number",
      variant: "courier",
      description: "A small spark hops between fields along an arched path. It settles above the number you last touched.",
      recipe: "Tap different fields, swipe to adjust, hold for quick actions",
      takeaway: "A cue shared by the whole row makes the selected field easy to follow with very little decoration.",
    },
  ];
  const filters = ["All", "Tap", "Hold", "Swipe", "Numbers", "Paths"] as const;
  let filter = $state<(typeof filters)[number]>("All");
  let notes = $state(true);
  let holdDuration = $state(550);
  let revision = $state(0);
  let size = $state<ControlSize>("default");

  function reset() {
    revision += 1;
  }
</script>

<svelte:head>
  <title>Gesture Lab | Guidepost</title>
  <meta
    name="description"
    content="Try mobile gesture designs for tapping, holding, swiping, and adjusting numbers, including CSS motion paths."
  />
</svelte:head>

<main>
  <header>
    <a class="back" href={resolve("/")}><span class="small-icon i-material-symbols:arrow-back" aria-hidden="true"></span>Guidepost</a>
  </header>
  <div class="intro">
    <div>
      <h1>Gesture lab</h1>
      <p class="intro-note">Six controls per row, capped at 320px. Try the {studies.length} designs with their neighbors in reach.</p>
    </div>
    <div class="legend" aria-label="Gesture types">
      <span class="legend-item"><span class="legend-icon i-material-symbols:touch-app-outline" aria-hidden="true"></span>Tap</span>
      <span class="legend-item"><span class="legend-icon i-material-symbols:timelapse" aria-hidden="true"></span>Hold</span>
      <span class="legend-item"><span class="legend-icon i-material-symbols:open-with" aria-hidden="true"></span>Swipe</span>
    </div>
  </div>
  <div class="workbench">
    <div class="filters" aria-label="Filter gesture studies">
      {#each filters as item (item)}
        <button class="filter" aria-pressed={filter === item} onclick={() => (filter = item)}>{item}</button>
      {/each}
    </div>
    <div class="settings">
      <fieldset>
        <legend>Control size</legend>
        <div class="sizes">
          <button class="size" aria-pressed={size === "compact"} onclick={() => (size = "compact")}>Compact</button>
          <button class="size" aria-pressed={size === "default"} onclick={() => (size = "default")}>Default</button>
          <button class="size" aria-pressed={size === "comfy"} onclick={() => (size = "comfy")}>Comfy</button>
        </div>
      </fieldset>
      <label class="timing" for="hold-duration"
        >Hold <output for="hold-duration">{holdDuration}ms</output>
        <input id="hold-duration" type="range" min="300" max="900" step="50" bind:value={holdDuration} />
      </label>
      <button class="setting" aria-pressed={!notes} onclick={() => (notes = !notes)}>
        <span
          class={["small-icon", notes ? "i-material-symbols:visibility-outline" : "i-material-symbols:visibility-off-outline"]}
          aria-hidden="true"
        ></span>
        {notes ? "Hide notes" : "Show notes"}
      </button>
      <button class="reset" aria-label="Reset all gesture examples" onclick={reset}
        ><span class="small-icon i-material-symbols:restart-alt" aria-hidden="true"></span></button
      >
    </div>
  </div>
  <div class="studies">
    {#each studies as study (study.id)}
      <article hidden={filter !== "All" && study.category !== filter}>
        <div class="card-heading">
          <span class="study-id">{study.id}</span>
          <h2>{study.title}</h2>
          <span class="category">{study.category}</span>
        </div>
        {#if notes}<p class="description">{study.description}</p>{/if}
        {#key revision}
          <GestureControl name={study.title} mode={study.mode} variant={study.variant} {holdDuration} {size} />
        {/key}
        {#if notes}
          <p class="recipe">{study.recipe}</p>
          <p class="takeaway">{study.takeaway}</p>
        {/if}
      </article>
    {/each}
  </div>
  <aside>
    <div class="aside-heading">
      <span class="small-icon i-material-symbols:keyboard-outline" aria-hidden="true"></span>
      <h2>Try it at your desk, too</h2>
    </div>
    <p>
      Click or drag with your mouse. Arrow keys adjust the focused number. F2 opens exact entry. Hold Space for the second action, or
      Shift-click to skip the wait. Right-click a number to open its quick actions.
    </p>
    <p>
      After holding, slide up for +5, down for −5, right to edit, or left to reset. You can also release and tap a tray action. Escape
      cancels.
    </p>
  </aside>
  <footer>
    <span>Guidepost / Gesture studies</span><a class="showdown-link" href={resolve("/kdm/showdown1")}
      >Back to showdown<span class="small-icon i-material-symbols:arrow-forward" aria-hidden="true"></span></a
    >
  </footer>
</main>

<style>
  main {
    --size-page: 76rem;
    --space-page: clamp(0.5rem, 2vw, 2rem);

    max-inline-size: var(--size-page);
    margin-inline: auto;
    padding: 1.5rem var(--space-page) 2rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 3rem;
  }
  .small-icon {
    --size-icon: 1.125rem;
    flex: none;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }
  .back {
    min-block-size: 2.75rem;
    &:hover {
      color: var(--foreground);
    }
  }
  .intro {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-block-end: 2rem;
  }
  h1 {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    font-family: var(--font-display);
    font-size: clamp(2.75rem, 6vw, 4.75rem);
    font-weight: var(--font-bold);
    line-height: 1.05;
    letter-spacing: var(--letter-spacing-tight);
  }
  .intro-note {
    max-inline-size: 34rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
    line-height: 1.7;
  }
  .legend {
    display: flex;
    gap: 1rem;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }
  .legend-icon {
    --size-icon: 1.5rem;
    color: var(--foreground);
  }
  .workbench {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 1rem;
    border-block: 1px solid var(--color-divider);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .filter {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    &[aria-pressed="true"] {
      color: var(--foreground);
      background: var(--card);
    }
  }
  .settings {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  fieldset {
    min-inline-size: 0;
  }
  legend {
    margin-block-end: 0.25rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }
  .sizes {
    display: flex;
    padding: 0.125rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
  }
  .size {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
    border-radius: calc(var(--radius-control) - 0.125rem);
    font-size: var(--text-sm);
    color: var(--muted-foreground);
    &[aria-pressed="true"] {
      background: var(--card);
      color: var(--foreground);
    }
  }
  .timing {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.25rem 0.625rem;
    inline-size: 7.5rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }
  output {
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }
  input[type="range"] {
    grid-column: 1 / -1;
    inline-size: 7.5rem;
    min-block-size: 1.25rem;
    accent-color: var(--accent);
  }
  .setting {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.75rem;
    padding-inline: 0.5rem;
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    color: var(--muted-foreground);
    &[aria-pressed="true"] {
      color: var(--accent);
    }
  }
  .reset {
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    &:hover {
      color: var(--foreground);
      background: var(--card);
    }
  }
  .studies {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
    gap: 1rem;
  }
  article {
    padding-block: 0.875rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-card);
    background: var(--panel);
  }
  .card-heading {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-block-end: 0.875rem;
    padding-inline: 0.75rem;
  }
  .study-id {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  h2 {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
  }
  .category {
    margin-inline-start: auto;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .description {
    min-block-size: 3lh;
    padding-inline: 0.75rem;
    margin-block-end: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: 1.7;
  }
  .recipe {
    margin-block: 1rem 0.625rem;
    padding-inline: 0.75rem;
    font-size: var(--text-sm);
    line-height: 1.6;
  }
  .takeaway {
    padding-inline: 0.75rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    line-height: 1.7;
  }
  aside {
    margin-block-start: 2rem;
    padding: 1.25rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-card);
  }
  .aside-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-block-end: 0.625rem;
    color: var(--accent);
  }
  aside p {
    max-inline-size: 54rem;
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: 1.7;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block-start: 2rem;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
  }
  .showdown-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.75rem;
    font-size: var(--text-sm);
    &:hover {
      color: var(--foreground);
    }
  }
</style>
