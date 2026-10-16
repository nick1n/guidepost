<script lang="ts">
  import { browser } from "$app/env";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { blueReferences, defaultBlueHue, exportCss, lightnessLevels, makePalette, matchReferences, type Shade } from "./palette.ts";

  const hueRange = { min: 225, max: 300 };
  // Static prerendering has no query string; the browser reads the current URL.
  let blueHue = $derived(browser ? normalizeHue((page.shallow?.url ?? page.url).searchParams.get("hue")) : defaultBlueHue);
  let surface = $state("dark");
  let selected = $state({ family: "blue", level: 3 });
  const surfaces = [
    { id: "dark", name: "Dark grid" },
    { id: "light", name: "Light grid" },
  ];
  const faces = [
    { id: "light", name: "On light" },
    { id: "dark", name: "On dark" },
  ];
  let palette = $derived(makePalette(blueHue));
  let blue = $derived(palette.rows[0].shades[3]);
  let green = $derived(palette.rows[1].shades[3]);
  let red = $derived(palette.rows[2].shades[4]);
  let chosen = $derived(palette.rows.find((row) => row.family === selected.family)?.shades[selected.level] ?? blue);
  let matches = $derived(matchReferences(palette.rows[0].shades));

  function normalizeHue(value: string | number | null | undefined) {
    if (value == null || (typeof value === "string" && !value.trim())) return defaultBlueHue;
    const hue = Number(value);
    return Number.isFinite(hue) ? Math.min(hueRange.max, Math.max(hueRange.min, Math.round(hue))) : defaultBlueHue;
  }

  function setBlueHue(value: number | undefined) {
    const hue = normalizeHue(value);
    const url = new URL((page.shallow?.url ?? page.url).href);
    if (hue === defaultBlueHue) url.searchParams.delete("hue");
    else url.searchParams.set("hue", String(hue));
    void goto(url, { shallow: true, replace: true, reset: false, state: page.state });
  }

  function selectShade(shade: Shade) {
    selected = { family: shade.family, level: shade.level };
  }
</script>

<svelte:head>
  <title>Palette lab | Guidepost</title>
  <meta name="description" content="Explore a blue-anchored triadic palette, reference colors, and light and dark contrast." />
</svelte:head>

<main>
  <header>
    <a class="back" href={resolve("/")}><span class="small-icon i-material-symbols:arrow-back" aria-hidden="true"></span>Guidepost</a>
    <h1>Palette lab</h1>
  </header>

  <div class="controls">
    <label class="hue-control" for="blue-hue">
      <span>Blue hue <output for="blue-hue">{blueHue}°</output></span>
      <input id="blue-hue" type="range" min={hueRange.min} max={hueRange.max} step="1" bind:value={() => blueHue, setBlueHue} />
      <span class="range-labels"><span>More cyan / {hueRange.min}°</span><span>More violet / {hueRange.max}°</span></span>
    </label>
    <div class="options">
      <fieldset>
        <legend>Swatch background</legend>
        <div class="button-group">
          {#each surfaces as option (option.id)}
            <button
              class={["option", surface === option.id && "active"]}
              aria-pressed={surface === option.id}
              onclick={() => (surface = option.id)}
            >
              {option.name}
            </button>
          {/each}
          <button class="option" onclick={() => setBlueHue(defaultBlueHue)}>Reset hue</button>
        </div>
      </fieldset>
    </div>
  </div>

  <section class="study" aria-labelledby={palette.id + "-title"}>
    <div class="section-heading">
      <h2 id={palette.id + "-title"}>{palette.name}</h2>
      <span
        >{palette.rows
          .filter((row) => row.family !== "grey")
          .map((row) => row.hue + "°")
          .join(" / ")}</span
      >
    </div>

    <div class={["matrix", surface === "light" && "paper"]}>
      <table>
        <caption class="visually-hidden">{palette.name} and grey palette from light to dark. All scales have levels 0 through 10.</caption>
        <thead>
          <tr>
            <th scope="col">Color</th>
            {#each lightnessLevels as lightness, index (lightness)}
              <th scope="col">{index}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each palette.rows as row (row.family)}
            <tr>
              <th scope="row"
                >{row.name}{#if row.family !== "grey"}<small>{row.hue}°</small>{/if}</th
              >
              {#each row.shades as shade (shade.level)}
                <td>
                  <button
                    class={["swatch", selected.family === row.family && selected.level === shade.level && "selected"]}
                    style:background={shade.css}
                    style:color={shade.text}
                    aria-label={palette.name + " " + row.family + "-" + shade.level + ", " + shade.hex + ", select shade"}
                    aria-pressed={selected.family === row.family && selected.level === shade.level}
                    onclick={() => selectShade(shade)}
                  >
                    <span aria-hidden="true">{selected.family === row.family && selected.level === shade.level ? "✓" : ""}</span>
                  </button>
                  <code>{shade.hex}</code>
                  <small class="lightness">{Math.round(shade.lightness * 100)}%</small>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="inspection">
      <div class="selected-details">
        <h3>{chosen.family}-{chosen.level}</h3>
        <code>{chosen.css}</code>
        <span>{chosen.hex}</span>
      </div>
      <div class="face-pair">
        {#each faces as face (face.id)}
          <div class={["face", face.id]}>
            <strong>{face.name}</strong>
            <div class="type-sample">
              <span class="colored-type" style:color={chosen.css}>Aa</span>
              <span
                class="filled-type"
                style:background={chosen.css}
                style:color={face.id === "light" ? "var(--lab-light)" : "var(--lab-dark)"}>Aa</span
              >
            </div>
            <span>{(face.id === "light" ? chosen.lightContrast : chosen.darkContrast).toFixed(1)}:1 in both directions</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="contrast-guide">
      <h3>WCAG text contrast</h3>
      <p>Swapping text and background colors keeps the same contrast ratio.</p>
      <table>
        <caption class="visually-hidden">WCAG 2.2 text contrast thresholds</caption>
        <thead><tr><th scope="col">Level</th><th scope="col">Normal text</th><th scope="col">Large text</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row"><a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">AA (minimum)</a></th><td>4.5:1</td>
            <td>3:1</td>
          </tr>
          <tr>
            <th scope="row"><a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">AAA (enhanced)</a></th><td>7:1</td>
            <td>4.5:1</td>
          </tr>
        </tbody>
      </table>
      <p>Large text: at least 24px, or 18.67px bold.</p>
    </div>

    <div class="balance">
      <h3>60-30-10 in use</h3>
      <div class="ratio" aria-label="Blue 60 percent, green 30 percent, red 10 percent">
        <div style:background={blue.css} style:color={blue.text}><span>Blue</span><strong>60%</strong></div>
        <div style:background={green.css} style:color={green.text}><span>Green</span><strong>30%</strong></div>
        <div style:background={red.css} style:color={red.text}><span>Red</span><strong>10%</strong></div>
      </div>
      <div class="mockups">
        {#each faces as face (face.id)}
          <article class={["mockup", face.id]}>
            <div class="mockup-heading"><strong>Settlement overview</strong><span>{face.name}</span></div>
            <div class="mockup-content">
              <div class="demo-main" style:background={blue.css} style:color={blue.text}>
                <span>Lantern year 8</span><strong>Ready for the hunt</strong>
                <p>Your settlement is growing.</p>
              </div>
              <div class="demo-support" style:background={green.css} style:color={green.text}>
                <span>Resources</span><strong>12</strong><span>Available endeavors</span>
              </div>
              <div class="demo-accent" style:background={red.css} style:color={red.text}><strong>1</strong><span>Injury</span></div>
            </div>
          </article>
        {/each}
      </div>
    </div>

    <details>
      <summary>View {palette.name.toLowerCase()} palette CSS</summary>
      <pre>{exportCss(palette)}</pre>
    </details>
  </section>

  <section aria-labelledby="references-title">
    <div class="section-heading">
      <h2 id="references-title">Your blue references</h2>
      <span>Exact role colors</span>
    </div>
    <ul class="references">
      {#each blueReferences as reference (reference.name)}
        <li>
          <div class="reference-chip" style:background={reference.hex} aria-hidden="true"></div>
          <strong>{reference.name}</strong>
          <code>{reference.hex}</code>
          <span>{(reference.lightness * 100).toFixed(1)}% lightness</span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="matching-title">
    <h2 id="matching-title">How close are the blues?</h2>
    <p class="metric-note" id="match-metrics">ΔE OK (x100): lower is closer, 0 is exact. ΔL: lightness change in percentage points.</p>
    <div class="match-scroll">
      <table class="matches" aria-describedby="match-metrics">
        <caption class="visually-hidden">Two closest blue shades for each original reference, ranked by OKLab color distance</caption>
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Original</th>
            <th scope="col" class="closest">Closest</th>
            <th scope="col">Second closest</th>
          </tr>
        </thead>
        <tbody>
          {#each matches as match (match.reference.name)}
            <tr>
              <th scope="row">{match.reference.name}</th>
              <td>
                <span class="match-chip" style:background={match.reference.hex} aria-hidden="true"></span><code>{match.reference.hex}</code>
              </td>
              {#each match.nearest as candidate (candidate.shade.level)}
                <td>
                  <div class="match-color">
                    <span class="match-chip" style:background={candidate.shade.css} aria-hidden="true"></span>
                    <div><strong>blue-{candidate.shade.level}</strong><code>{candidate.shade.hex}</code></div>
                  </div>
                  <span class="match-distance">
                    ΔE OK {candidate.difference.toFixed(2)} / ΔL {candidate.lightnessDifference > 0 ? "+" : ""}
                    {candidate.lightnessDifference.toFixed(1)}
                  </span>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</main>

<style>
  main {
    --lab-light: var(--grey-0);
    --lab-dark: var(--grey-10);
    max-inline-size: 82rem;
    margin-inline: auto;
    padding: clamp(1rem, 4vw, 3rem);
    padding-top: 0;
  }
  header {
    margin-block-end: 2rem;
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

  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 8vw, 4.5rem);
    font-weight: var(--font-bold);
    line-height: var(--line-height-none);
    letter-spacing: var(--letter-spacing-tight);
  }
  h2 {
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: var(--font-bold);
  }
  h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
  }
  section {
    margin-block-start: 2.5rem;
  }
  .section-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-block-end: 0.75rem;
  }
  .section-heading > span {
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }
  .references {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.75rem;
  }
  .references li {
    display: grid;
    gap: 0.25rem;
    font-size: var(--text-sm);
  }
  .references li > span {
    color: var(--muted-foreground);
  }
  .reference-chip {
    block-size: 3.5rem;
    margin-block-end: 0.25rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
  }
  .controls {
    display: grid;
    gap: 1.5rem;
    margin-block-start: 2.5rem;
    padding-block: 1.5rem;
    border-block: 1px solid var(--color-divider);
  }
  .hue-control {
    display: grid;
    gap: 0.75rem;
  }
  .hue-control > span:first-child {
    display: flex;
    justify-content: space-between;
    font-weight: var(--font-bold);
  }
  output {
    font-variant-numeric: tabular-nums;
  }
  input {
    inline-size: 100%;
    accent-color: var(--accent-blue);
  }
  .range-labels {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .options {
    display: grid;
    gap: 1rem;
  }
  legend {
    margin-block-end: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .option {
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-md);
    transition: var(--transition-colors);
    &:hover {
      background: var(--card);
    }
    &.active {
      border-color: var(--foreground);
      background: var(--card);
    }
  }
  .study {
    padding-block-end: 2rem;
    border-block-end: 1px solid var(--color-divider);
  }
  .matrix {
    --canvas: var(--panel);
    --canvas-text: var(--foreground);
    margin-block-start: 1rem;
    padding: 0.75rem;
    overflow-x: auto;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-card);
    background: var(--canvas);
    color: var(--canvas-text);
    &.paper {
      --canvas: var(--lab-light);
      --canvas-text: var(--lab-dark);
    }
  }
  table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0.5rem 0.75rem;
    font-size: var(--text-sm);
  }
  .matrix table {
    min-inline-size: 48rem;
    table-layout: fixed;
  }
  th {
    text-align: start;
    font-weight: var(--font-bold);
  }
  .matrix th:not(:first-child) {
    text-align: center;
  }
  small {
    display: block;
    margin-block-start: 0.25rem;
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
  }
  td {
    vertical-align: middle;
  }
  .matrix td > code {
    display: block;
    margin-block-start: 0.5rem;
    text-align: center;
    font-size: 0.6rem;
  }
  .lightness {
    text-align: center;
  }
  .swatch {
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: clamp(2.75rem, 5vw, 4rem);
    border: 2px solid transparent;
    border-radius: var(--radius-control);
    font-size: 1.5rem;
    &:hover {
      border-color: var(--canvas-text);
    }
    &:focus-visible {
      outline-color: var(--canvas-text);
    }
    &.selected {
      box-shadow:
        0 0 0 2px var(--canvas),
        0 0 0 3px var(--canvas-text);
    }
  }
  .inspection {
    display: grid;
    gap: 1rem;
    margin-block-start: 1rem;
  }
  .selected-details {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .selected-details > span {
    color: var(--muted-foreground);
    font-family: monospace;
  }
  .selected-details > code {
    overflow-wrap: anywhere;
    font-size: var(--text-sm);
  }
  .face-pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .face {
    padding: 1rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
  }
  .light {
    background: var(--lab-light);
    color: var(--lab-dark);
  }
  .dark {
    background: var(--lab-dark);
    color: var(--lab-light);
  }
  .type-sample {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-around;
    gap: 0.5rem;
    margin-block: 0.75rem;
  }
  .colored-type {
    font-size: clamp(2rem, 6vw, 3.5rem);
    font-weight: var(--font-bold);
  }
  .filled-type {
    display: grid;
    place-items: center;
    inline-size: 3rem;
    block-size: 3rem;
    border-radius: var(--radius-control);
    font-size: 1.75rem;
    font-weight: var(--font-bold);
  }
  .face > span {
    font-size: var(--text-xs);
  }
  .contrast-guide {
    margin-block-start: 1rem;
  }
  .contrast-guide p {
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .balance {
    margin-block-start: 1.75rem;
  }
  .ratio {
    display: grid;
    grid-template-columns: 6fr 3fr 1fr;
    margin-block-start: 0.75rem;
    border-radius: var(--radius-control);
    overflow: hidden;
  }
  .ratio > div {
    display: grid;
    align-content: center;
    gap: 0.25rem;
    padding: 0.75rem 0.25rem;
    text-align: center;
    font-size: var(--text-sm);
  }
  .mockups {
    display: grid;
    gap: 1rem;
    margin-block-start: 1rem;
  }
  .mockup {
    padding: 1rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
  }
  .mockup-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
    margin-block-end: 1rem;
    font-size: var(--text-sm);
  }
  .mockup-content {
    display: grid;
    grid-template-columns: 6fr 3fr 1fr;
    gap: 0.35rem;
  }
  .mockup-content > div {
    display: grid;
    align-content: center;
    gap: 0.5rem;
    min-inline-size: 0;
    padding: 0.75rem 0.35rem;
    border-radius: var(--radius-control);
    font-size: var(--text-xs);
  }
  .demo-main > strong {
    font-size: var(--text-md);
  }
  .demo-support {
    text-align: center;
  }
  .demo-support > strong {
    font-size: 1.75rem;
  }
  .demo-accent {
    text-align: center;
  }
  .demo-accent > span {
    writing-mode: vertical-rl;
    justify-self: center;
  }
  details {
    margin-block-start: 1.5rem;
  }
  summary {
    cursor: pointer;
    font-size: var(--text-md);
  }
  pre {
    user-select: text;
    max-block-size: 24rem;
    margin-block-start: 0.75rem;
    padding: 1rem;
    overflow: auto;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
    font-size: var(--text-sm);
  }
  .metric-note {
    margin-block: 0.5rem 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .closest {
    background: var(--blue-9);
  }
  .match-color {
    display: flex;
    align-items: center;
  }
  .match-color > div {
    display: grid;
    gap: 0.25rem;
  }
  .match-distance {
    display: block;
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .match-scroll {
    overflow-x: auto;
  }
  .matches {
    min-inline-size: 42rem;
    border-spacing: 0;
  }
  .matches :is(th, td) {
    padding: 0.75rem 0.5rem;
    border-block-end: 1px solid var(--color-divider);
  }
  .match-chip {
    display: inline-block;
    inline-size: 2rem;
    block-size: 1.5rem;
    margin-inline-end: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: 0.25rem;
    vertical-align: middle;
  }
  @media (min-width: 48rem) {
    .controls {
      grid-template-columns: minmax(15rem, 1fr) 1.5fr;
    }
    .inspection {
      grid-template-columns: 1fr 2fr;
    }
    .mockups {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .demo-accent > span {
      writing-mode: horizontal-tb;
    }
    .mockup-content > div {
      padding: 1rem 0.5rem;
    }
  }
</style>
