<script lang="ts">
  import { resolve } from "$app/paths";
  import ModelScaleStudy from "./ModelScaleStudy.svelte";

  const combinations = [
    { label: "Tiny + small", scales: ["tiny", "small"] },
    { label: "Small + medium", scales: ["small", "medium"] },
    { label: "Tiny + large", scales: ["tiny", "large"] },
  ] as const;
  const studies = [
    { variant: "spine", label: "Ice blue", mark: "--blue-1", guide: "--blue-4" },
    { variant: "spine", label: "Sage green", mark: "--green-1", guide: "--green-4" },
    { variant: "spine", label: "Dusty rose", mark: "--red-1", guide: "--red-4" },
    { variant: "spine", label: "Slate and blue", mark: "--blue-2", guide: "--grey-4" },
    { variant: "slots", label: "Highlighted ticks", mark: "--blue-1", guide: "--grey-5" },
    { variant: "lucide", label: "Layered Lucide pawns", mark: "--blue-1", guide: "--blue-4" },
    { variant: "game-icons", label: "Layered Game Icons pawns", mark: "--blue-1", guide: "--blue-4" },
  ] as const;
  const tickStudies = [
    { variant: "slots", label: "Green ticks", mark: "--green-1", guide: "--green-4" },
    { variant: "slots", label: "Rose ticks", mark: "--red-1", guide: "--red-4" },
    { variant: "square-ticks", label: "Square / ice blue", mark: "--blue-1", guide: "--blue-4" },
    { variant: "square-ticks", label: "Square / sage green", mark: "--green-1", guide: "--grey-4" },
    { variant: "square-ticks", label: "Square / dusty rose", mark: "--red-1", guide: "--red-4" },
    { variant: "square-dots", label: "Square dots / pale blue", mark: "--blue-1", guide: "--grey-4" },
    { variant: "square-bands", label: "Full-width bands / ice blue", mark: "--blue-1", guide: "--blue-4" },
    { variant: "square-bands", label: "Full-width bands / sage green", mark: "--green-1", guide: "--grey-4" },
    { variant: "square-bands", label: "Full-width bands / dusty rose", mark: "--red-1", guide: "--red-4" },
  ] as const;
  const slateStudies = [
    { variant: "wide-slots", label: "Slate / ice blue", mark: "--blue-0", guide: "--grey-5" },
    { variant: "wide-slots", label: "Slate / pale green", mark: "--green-0", guide: "--grey-5" },
    { variant: "wide-slots", label: "Slate / pale rose", mark: "--red-0", guide: "--grey-5" },
    { variant: "wide-slots", label: "Slate / pearl", mark: "--grey-0", guide: "--grey-5" },
  ] as const;
</script>

<svelte:head>
  <title>Model scales | Guidepost</title>
</svelte:head>

<main>
  <a href={resolve("/")}>Back to Guidepost</a>
  <h1>Model scales</h1>

  <p>Each pair shows the icon at edition size (20 px) and enlarged (48 px).</p>
  <section aria-labelledby="slate-studies">
    <h2 id="slate-studies">Wide slate rulers</h2>
    {@render comparison(slateStudies)}
  </section>
  <section aria-labelledby="tick-studies">
    <h2 id="tick-studies">Highlighted tick studies</h2>
    {@render comparison(tickStudies)}
  </section>
  <section aria-labelledby="single-ruler">
    <h2 id="single-ruler">Multi-scale icons</h2>
    {@render comparison(studies)}
  </section>
</main>

{#snippet comparison(rows: typeof studies | typeof tickStudies | typeof slateStudies)}
  <table class="studies">
    <thead>
      <tr>
        <th scope="col">Style</th>
        {#each combinations as combination (combination.label)}<th scope="col">{combination.label}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as { variant, label, mark, guide } (label)}
        <tr>
          <th scope="row">{label}</th>
          {#each combinations as combination (combination.label)}
            <td>
              <span class="study-preview" style:--scale-mark={`var(${mark})`} style:--scale-guide={`var(${guide})`}>
                <ModelScaleStudy scales={combination.scales} {variant} --size-icon="20px" />
                <ModelScaleStudy scales={combination.scales} {variant} --size-icon="48px" />
              </span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<style>
  main {
    max-inline-size: 48rem;
    margin-inline: auto;
    padding: 2rem 1rem;
  }

  a {
    color: var(--muted-foreground);

    &:is(:hover, :focus-visible) {
      color: var(--accent);
    }
  }

  h1 {
    margin-block: 1.5rem 2rem;
    font-weight: var(--font-bold);
    font-size: var(--text-2xl);
    font-family: var(--font-display);
  }

  section {
    margin-block: 2rem;
  }

  h2 {
    margin-block-end: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
    background: var(--card);
    table-layout: fixed;
  }

  p {
    margin-block-end: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }

  .study-preview {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  th,
  td {
    padding: 0.75rem 0.25rem;
    text-align: center;
  }

  th {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
</style>
