# KDM design notes

Status: working notes and reviewed design context. These notes do not override implemented behavior or explicit proposed status in design documents.

## Norm survivors

- Age Milestones (Hunt XP)
- Max 3 Fighting Arts (Normal and Secret)

## Arc survivors

### Attributes

- Lumi: hexagon icon.
- Systemic Pressure (S. Pressure): subtract from severe injury rolls.
- Torment: subtract from brain trauma rolls.

### Philosophy

Max 1 philosophy (tenet knowledge). Adopt only the next rank once per settlement development step, even if a higher rank is achieved.

- Name: string
- Rank: number
- Neurosis: string
- Tenet Knowledge: (knowledge name)
- Rank milestones (Hunt XP)

### Knowledges

Max 2 knowledges, 1 Secret Fighting Art, and 1 Fighting Art.
Can not use fighting arts also means you can not use knowledges & philosophy.

- Name: string
- Description: string
- Rules: list
- Observation condition: string/hook/action
- Observations: number

### Settlement

- CC: number, brain icon, with rewards and milestones.
- Philosophies: list.
- Knowledges: list or deck.

### Icon candidates

Hexagons: i-material-symbols:hexagon, i-material-symbols:hexagon-rounded.

Brains:

- i-game-icons:brain (currently insanity)
- i-lucide:brain-cog (wordplay)
- i-lucide:brain
- i-game-icons:brain-dump
- i-game-icons:brain-tentacle
- i-game-icons:brain-leak
- i-game-icons:brain-stem
- i-game-icons:brainstorm
- i-game-icons:frontal-lobe
- i-material-symbols:network-intelligence

## Wanderers

Arc survivors with Disposition (heart, i-material-symbols:favorite).

## Tagline candidates

- "board game aids left here for the next player"
- "tools left here for the next player"
- "everything you need between sessions"
- "find your way back to the table"
- "pick up where you left off"

- "a light for the long campaign"
- "made by players, for players"
- "tools left behind by players, for players"
- "companion tools for campaign board games"
- "your campaign, kept safe"
- "trail markers for tabletop campaigns"

## Future work

- [ ] Add an "Update available" prompt when a new app version is ready. Offer a reload after pending collection saves succeed; preserve filters and consider restoring scroll position and expanded cards.
- [ ] Explore automatic refresh when the app returns to the foreground. Defer reloads while saves, active inputs, or dialogs need attention.
- [ ] Consider refreshing the catalog in place without reloading. Fetch and validate fresh data, refresh the service-worker cache, and update the existing Collection while preserving owner state, pending writes, and browsing state. Retain saved ownership for removed items or editions.
- [ ] Show failed hunt preference saves inline with an unsaved state and a Retry action, alongside the notification log.
- [ ] Move the date-format preference from localStorage to Dexie for consistent settings storage. Do not add a migration.
- [ ] Add an optional "Download this deck" action for hunt artwork so every random draw in the selected deck is available offline.
- [ ] Investigate recoverable copy-number drafts for forced browser shutdown. Preserve owner isolation, validate recovered values, and save through the collection queue.
- [ ] Review `HoldRipple.svelte` press-listener setup and cleanup for simplification. Preserve cancellation, keyboard behavior, and performance with many controls.
- [ ] Consider replacing `TagRail.svelte` attachment-managed pointer listeners with declarative event handlers while preserving drag scrolling and click suppression.
