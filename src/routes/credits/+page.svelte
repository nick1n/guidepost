<script lang="ts">
  import { resolve } from "$app/paths";

  const credits = [
    {
      id: "kingdom-death",
      title: "Kingdom Death: Monster",
      list: [
        { name: "Adam Poots Games", href: "https://kingdomdeath.com/" },
        { name: "Fen", href: "https://www.patreon.com/cw/FenPaints" },
        { name: "Bra Mithra", href: "https://www.youtube.com/@BraMithra" },
        { name: "BigDeno", href: "https://www.youtube.com/@bigdenopaints" },
        { name: "Quackalope", href: "https://www.youtube.com/@Quackalope" },
        { name: "BoardGameGeek", href: "https://boardgamegeek.com/" },
        { name: "CCG Team", href: "https://www.patreon.com/ccgteam" },
        { name: "Scribe for KD:M @taboobat", href: "https://gitlab.com/taboobat/kdm-app" },
      ],
    },
    {
      id: "heat",
      title: "Heat: Pedal to the Metal",
      list: [
        { name: "Days of Wonder", href: "https://www.daysofwonder.com/" },
        {
          name: "Andras Madarasz @valiante",
          href: "https://boardgamegeek.com/filepage/254401/funmade-legends-cards-for-10-ai-cars",
        },
      ],
    },
    {
      id: "kings-dilemma",
      title: "The King's Dilemma",
      list: [{ name: "Horrible Guild", href: "https://horribleguild.com/" }],
    },
    {
      id: "imperial-assault",
      title: "Star Wars: Imperial Assault",
      list: [
        { name: "Fantasy Flight Games", href: "https://www.fantasyflightgames.com/en/index/" },
        { name: "Dave Zokvic @zokvicds", href: "https://boardgamegeek.com/user/zokvicds" },
        { name: "Lazaro Borges @Prequarius", href: "https://boardgamegeek.com/user/Prequarius" },
        { name: "Riccardo Simoni @sabbione", href: "https://boardgamegeek.com/user/sabbione" },
        { name: "Jeff Wain @hightouch", href: "https://boardgamegeek.com/user/hightouch" },
        { name: "Kush Gulati @Bunnystyle", href: "https://boardgamegeek.com/user/Bunnystyle" },
        { name: "Josh Vidro @CCRunner524", href: "https://boardgamegeek.com/user/CCRunner524" },
        { name: "Peter Baker @Digimortal", href: "https://boardgamegeek.com/user/Digimortal" },
        { name: "Billy Chan @bhchan", href: "https://boardgamegeek.com/user/bhchan" },
      ],
    },
    {
      id: "icons",
      title: "Art & icons",
      list: [
        { name: "Guidepost logo by my mom 😊" },
        { name: "Adam Poots Games", href: "https://kingdomdeath.com/" },
        { name: "Game-icons.net", href: "https://game-icons.net/" },
        { name: "Material Design icons by Google", href: "https://github.com/google/material-design-icons" },
        { name: "Material Design Icons from the Community", href: "https://github.com/Templarian/MaterialDesign" },
      ],
    },
    {
      id: "ai-tools",
      title: "AI tools",
      list: [
        { name: "T3 Code", href: "https://t3.codes/" },
        { name: "ChatGPT", href: "https://chatgpt.com/" },
        { name: "Gemini", href: "https://gemini.google.com/" },
        { name: "Claude", href: "https://claude.com/" },
      ],
    },
  ] as const;
</script>

<svelte:head>
  <title>Credits | Guidepost</title>
  <meta name="description" content="The creators, artists, groups, and tools that helped make Guidepost possible." />
</svelte:head>

<main>
  <span id="new-tab-description" hidden>Opens in a new tab</span>

  <a class="home-link" href={resolve("/")}>
    <span class="back-icon i-material-symbols:arrow-back" aria-hidden="true"></span>back
  </a>

  <header>
    <h1>Credits</h1>
    <p class="intro">Creators, artists, groups, and tools that helped shape this site</p>
  </header>

  {#each credits as { id, title, list } (id)}
    <section aria-labelledby={id}>
      <h2 {id}>{title}</h2>
      <ul>
        {#each list as { name, href } (name)}
          <li>
            {#if href}
              <a class="credit" {href} target="_blank" aria-describedby="new-tab-description">
                {name}<span class="external-icon i-material-symbols:arrow-outward" aria-hidden="true"></span>
              </a>
            {:else}
              <span class="credit">{name}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <footer>
    <span class="heart-icon i-material-symbols:favorite" aria-hidden="true"></span>
    thank you.
  </footer>
</main>

<style>
  main {
    max-inline-size: 52rem;
    margin-inline: auto;
    padding: 1rem;
  }

  .home-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }

  :is(.home-link, .credit):is(:hover, :focus-visible) {
    color: var(--accent);
  }

  :is(.back-icon, .heart-icon) {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }

  header {
    margin-block: clamp(2rem, 6vw, 3.5rem);
  }

  :is(h1, h2) {
    font-weight: var(--font-bold);
    font-family: var(--font-display);
  }

  h1 {
    font-size: clamp(3.5rem, 12vw, 6rem);
    line-height: var(--line-height-none);
    letter-spacing: var(--letter-spacing-tight);
  }

  .intro {
    max-inline-size: 36rem;
    margin-block-start: 1rem;
    color: var(--muted-foreground);
    text-wrap: pretty;
  }

  section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 2fr));
    padding-block: 1.5rem;
    gap: 1rem clamp(1.5rem, 5vw, 3rem);
    border-block-start: var(--border-size) solid var(--muted-foreground);
  }

  h2 {
    font-size: var(--text-lg);
    line-height: 2rem;
    text-align: right;
    text-wrap: balance;
    align-self: self-end;
  }

  .credit {
    padding-inline: 1rem;
    line-height: 2;
  }

  .external-icon {
    display: inline-block;
    inline-size: 0.85rem;
    block-size: 0.85rem;
    margin-inline-start: 0.2rem;
    color: var(--muted-foreground);
    vertical-align: -0.08em;
  }

  footer {
    margin-block-start: 2rem;
    color: var(--muted-foreground);
    /* font-size: var(--text-sm); */
    text-align: center;
  }

  .heart-icon {
    margin-inline-end: 0.25rem;
    color: var(--accent-red);
    vertical-align: -0.2em;
  }
</style>
