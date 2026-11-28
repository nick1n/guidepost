<script lang="ts">
  import { resolve } from "$app/paths";
  import { getActions } from "#lib/app/actions.ts";
  import KdCheckbox from "#lib/components/KdCheckbox.svelte";
  import Markdown from "#lib/components/Markdown.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import Select from "#lib/components/Select.svelte";
  import { Effect, Fiber } from "effect";
  import { onMount } from "svelte";
  import { useCardAssets } from "./card-assets";
  import { optimizePngUrl } from "./png-export";
  import {
    backgrounds,
    bodySizeSteps,
    bodyTypefaces,
    bodyTypography,
    cardFilename,
    cardSize,
    cardTypes,
    drawCard,
    ribbonOptions,
    type Card,
    type CardType,
  } from "./card";
  import { cardFromTemplate, initialCard, templateOptions, type TemplateId } from "./templates";

  const types = Object.keys(cardTypes) as CardType[];
  const typographyFields = Object.keys(bodyTypography) as (keyof typeof bodyTypography)[];
  let card = $state({ ...initialCard });
  let templateSelection = $state("");
  let confirmedTemplate: TemplateId | "" = "";
  let baseline = initialCard;
  let pendingTemplate: TemplateId | undefined;
  let templateConfirmation: Modal;
  let canvas = $state<HTMLCanvasElement>();
  let artwork = $state<ImageBitmap>();
  let assetError = $state("");
  let fits = $state(true);
  let footerOverflow = $state(false);
  let exportError = $state("");
  let exportUrl: string | undefined;
  const actions = getActions();

  onMount(() => {
    const fiber = actions.run(
      useCardAssets((image) => (artwork = image)).pipe(Effect.tapError((error) => Effect.sync(() => (assetError = error.message)))),
    );
    return () => Effect.runFork(Fiber.interrupt(fiber));
  });

  function setType(type: CardType) {
    if (!card.subtitle.trim() || card.subtitle === card.type.toLowerCase()) {
      card.subtitle = type === "Custom" ? "" : type.toLowerCase();
    }
    Object.assign(card, cardTypes[type], { type });
  }

  function loadTemplate(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const option = templateOptions.find(({ id }) => id === select.value);
    if (!option) {
      confirmedTemplate = "";
      return;
    }

    pendingTemplate = option.id;
    if (!editedFields().length) {
      applyTemplate();
    } else if (!templateConfirmation.show()) {
      closeTemplatePrompt();
    }
  }

  function editedFields() {
    const keys = Object.keys({ ...baseline, ...card }) as (keyof Card)[];
    return keys.filter((key) => card[key] !== baseline[key]);
  }

  function applyTemplate(keepEdits = false) {
    if (!pendingTemplate) return;
    const nextCard = cardFromTemplate(pendingTemplate);
    const edited = keepEdits ? editedFields() : [];
    const carryEdits = (source: Card) => ({ ...nextCard, ...Object.fromEntries(edited.map((key) => [key, source[key]])) });
    // Keep the previous template values as the baseline for edits carried into the new card.
    baseline = carryEdits(baseline);
    card = carryEdits(card);
    confirmedTemplate = pendingTemplate;
    closeTemplatePrompt();
  }

  function closeTemplatePrompt() {
    pendingTemplate = undefined;
    templateSelection = confirmedTemplate;
    templateConfirmation.close();
  }

  function paint(element: HTMLCanvasElement) {
    canvas = element;
    const ctx = element.getContext("2d");
    if (artwork) {
      const result = ctx && drawCard(ctx, card, artwork);
      footerOverflow = result?.footerOverflow ?? false;
      fits = result?.fits === true && !result.footerOverflow;
      if (result && card.bodySizeStep !== result.bodySizeStep) card.bodySizeStep = result.bodySizeStep;
    }
    exportUrl = undefined;
    exportError = "";
  }

  function download() {
    if (!canvas || !artwork || !fits) return;
    if (!exportUrl) {
      const data = canvas.toDataURL("image/png");
      if (data === "data:,") {
        exportError = "The PNG could not be created.";
        return;
      }
      exportUrl = optimizePngUrl(data);
    }
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = cardFilename(card.title);
    link.click();
  }
</script>

<svelte:head>
  <title>Reference card editor | Guidepost</title>
  <meta name="description" content="Make and download gear sized reference cards." />
</svelte:head>

<main class="scrollbar-stable">
  <header>
    <h1>Reference card editor</h1>
    <button type="button" onclick={download} disabled={!canvas || !artwork || !fits}>Save PNG</button>
  </header>

  <div class="workspace">
    <figure>
      <div role="img" aria-label={card.title.trim() ? `Preview of ${card.title}` : "Card preview"}>
        <canvas {@attach paint} width={cardSize} height={cardSize} aria-hidden="true"></canvas>
      </div>
      <div class="visually-hidden">
        {#if card.subtitle}<p>{card.subtitle}</p>{/if}
        <Markdown text={card.content} />
        {#if card.footer.trim()}<p>{card.footer}</p>{/if}
      </div>
      <figcaption>
        <div class="preview-info">
          <span>Live preview</span>
          <span>{cardSize} x {cardSize} px</span>
        </div>
        <p class="status" aria-live="polite">
          {#if assetError}
            {assetError}
          {:else if !artwork}
            Loading card templates…
          {:else if footerOverflow}
            Shorten the footer text to fit it on the card.
          {:else if !fits}
            Shorten the main content to fit it on the card.
          {:else}
            {exportError}
          {/if}
        </p>
      </figcaption>
    </figure>

    <div class="controls">
      <fieldset>
        <legend>Style</legend>
        <label>
          Apply template
          <Select variant="dark" bind:value={templateSelection} onchange={loadTemplate} aria-describedby="template-help">
            <option value="">Choose a template</option>
            {#each templateOptions as { id, label } (id)}
              <option value={id}>{label}</option>
            {/each}
          </Select>
        </label>
        <p id="template-help">You can keep your edits when applying a template.</p>
        <div class="pair">
          <label>
            Card type
            <Select variant="dark" bind:value={() => card.type, setType}>
              {#each types as type (type)}
                <option value={type}>{type}</option>
              {/each}
            </Select>
          </label>
          <label>
            Ribbon banner
            <Select variant="dark" bind:value={card.ribbon}>
              {#each ribbonOptions as { value, label } (value)}
                <option {value}>{label}</option>
              {/each}
            </Select>
          </label>
        </div>
        <div class="pair">
          <label>
            Text alignment
            <Select variant="dark" bind:value={card.alignment}>
              <option value="balanced">Balanced</option>
              <option value="pretty">Pretty</option>
              <option value="center">Centered</option>
              <option value="left">Left</option>
            </Select>
          </label>
          <label>
            Header top
            <input type="color" bind:value={card.headerTop} />
          </label>
        </div>
        <div class="pair">
          <label>
            Main content background
            <Select variant="dark" bind:value={card.background}>
              {#each backgrounds as background (background)}
                <option value={background}>{background}</option>
              {/each}
            </Select>
          </label>
          <label>
            Header bottom
            <input type="color" bind:value={card.headerBottom} />
          </label>
          {#if card.background === "Custom"}
            <label>
              Body color
              <input type="color" bind:value={card.bodyColor} />
            </label>
          {/if}
        </div>
        <details>
          <summary>Body typography</summary>
          <div class="pair">
            <label>
              Body typeface
              <Select variant="dark" bind:value={card.typeface}>
                {#each bodyTypefaces as typeface (typeface)}
                  <option value={typeface}>{typeface}</option>
                {/each}
              </Select>
            </label>
            {#each typographyFields as field (field)}
              {@const { label, min, max, step } = bodyTypography[field]}
              <label>
                {label} (px)
                <input type="number" {min} {max} {step} placeholder="Auto" bind:value={card[field]} />
              </label>
            {/each}
          </div>
        </details>
      </fieldset>

      <fieldset>
        <legend>Text</legend>
        <div class="pair">
          <label>
            Title
            <input type="text" bind:value={card.title} maxlength="90" />
          </label>
          <label>
            Subtitle
            <input type="text" bind:value={card.subtitle} maxlength="90" />
          </label>
        </div>
        <label>
          Main content
          <textarea class="main-content" bind:value={card.content} rows="6" maxlength="2500" aria-describedby="content-format"></textarea>
        </label>
        <p id="content-format">
          Separate paragraphs with a blank line. Put <code>---</code> on its own line for a divider. Use <code>**bold**</code>,
          <code>*italics*</code>, and names like <code>[activation]</code> for <a href={resolve("/test/font")}>KD icons</a>.
        </p>
        <label>
          Main text size
          <Select variant="dark" bind:value={card.bodySizeStep}>
            {#each bodySizeSteps as { label } (label)}
              <option value={label}>{label}</option>
            {/each}
          </Select>
        </label>
        <label class="toggle">
          <KdCheckbox bind:checked={card.edgeRules} />
          Add dividers above and below the content
        </label>
        <label class="toggle">
          <KdCheckbox bind:checked={card.textOutline} />
          Outline main text
        </label>
        <label>
          Footer text
          <textarea bind:value={card.footer} rows="2" maxlength="90"></textarea>
        </label>
      </fieldset>
    </div>
  </div>
</main>

<Modal
  --modal-border-color="var(--grey-4)"
  bind:this={templateConfirmation}
  title="Apply template?"
  description="This card has edits. You can keep those edits and fill only untouched fields, or replace the entire card."
  ondismiss={closeTemplatePrompt}
>
  {#snippet footer()}
    <div class="template-actions">
      <button class="secondary" type="button" onclick={closeTemplatePrompt}>Cancel</button>
      <button class="secondary" type="button" onclick={() => applyTemplate()}>Replace all fields</button>
      <button type="button" onclick={() => applyTemplate(true)}>Keep my edits</button>
    </div>
  {/snippet}
</Modal>

<style>
  main {
    --select-border-color: var(--grey-4);
    max-inline-size: 76rem;
    margin-inline: auto;
    padding: 1.5rem 1rem 4rem;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    margin-block: 1.25rem 1.5rem;
    gap: 0.75rem;
  }

  h1 {
    font-weight: var(--font-bold);
    font-size: clamp(1.75rem, 5vw, 3rem);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  button {
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-control);
    background: var(--accent);
    color: var(--background);
    font-weight: var(--font-bold);
    transition: var(--transition-colors);

    &:not(:disabled):hover {
      background: var(--blue-2);
    }

    &:disabled {
      background: var(--card);
      color: var(--muted-foreground);
      cursor: default;
    }
  }

  .template-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .secondary {
    border: var(--border-width) solid var(--grey-4);
    background: var(--panel);
    color: var(--foreground);

    &:not(:disabled):hover {
      background: var(--card);
    }
  }

  .workspace,
  .controls {
    display: grid;
    align-items: start;
    gap: 1.25rem;
  }

  figure {
    justify-self: center;
    inline-size: min(100%, 42rem);
  }

  canvas {
    display: block;
    aspect-ratio: 1;
    inline-size: 100%;
    block-size: auto;
    background: var(--panel);
  }

  .preview-info {
    display: flex;
    justify-content: space-between;
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }

  .status {
    min-block-size: 1lh;
    margin-block-start: 0.25rem;
    color: var(--red-2);
    font-size: var(--text-md);
  }

  fieldset {
    display: grid;
    min-inline-size: 0;
    padding: 0.875rem 1rem 1rem;
    gap: 0.75rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-card);
    background: var(--panel);
  }

  legend {
    padding-inline: 0.5rem;
    color: var(--foreground);
    font-weight: var(--font-bold);
    font-family: var(--font-display);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
    gap: 0.75rem;
  }

  label {
    display: grid;
    align-content: start;
    gap: 0.375rem;
    font-size: var(--text-md);
  }

  input:not([type="checkbox"]),
  textarea {
    inline-size: 100%;
    min-block-size: var(--size-control);
    padding: 0.5rem 0.625rem;
    border: var(--border-width) solid var(--grey-4);
    border-radius: var(--radius-control);
    background: var(--background);
    font: inherit;
    font-size: 1rem;
    user-select: text;
  }

  .main-content {
    block-size: 9rem;
  }

  input[type="color"] {
    cursor: pointer;
  }

  .toggle {
    grid-template-columns: auto 1fr;
    align-content: center;
    align-items: center;
    min-block-size: var(--size-control);
    gap: 0.5rem;
    cursor: pointer;
  }

  #content-format,
  #template-help {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  #content-format a {
    color: var(--accent);
    text-decoration: underline;
  }

  summary {
    align-content: center;
    min-block-size: var(--size-control);
    margin-block-end: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
    cursor: pointer;
  }

  @media (min-width: 58rem) {
    .workspace {
      grid-template-columns: minmax(23rem, 5fr) minmax(0, 7fr);
      gap: 2rem;
    }

    figure {
      position: sticky;
      grid-row: 1;
      grid-column: 2;
      inset-block-start: 1rem;
    }

    .controls {
      grid-row: 1;
      grid-column: 1;
    }
  }
</style>
