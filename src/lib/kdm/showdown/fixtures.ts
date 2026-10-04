import type { ListEntry } from "./sheet";

export const survivors = [
  { name: "Erza", color: "#B4745A", ink: "var(--contrast)", gender: "Female" },
  { name: "Zachary", color: "#7C562B", ink: "var(--foreground)", gender: "Male" },
  { name: "Allister", color: "#A4B3A6", ink: "var(--contrast)", gender: "Male" },
  { name: "Lucy", color: "#307FA7", ink: "var(--contrast)", gender: "Female" },
];

// Illustrative copy to test a crowded action list; these are not game rules.
export const sampleActions = [
  {
    title: "Hold Ground",
    short: "Stand firm and protect a nearby survivor",
    cost: ["movement", "activation"] as const,
    description: "Plant your feet as the monster closes in. Stay ready to protect the survivor beside you when the next attack begins.",
  },
  {
    title: "Call the Opening",
    short: "Help an ally spot an opening",
    cost: [] as const,
    description: "Draw an ally's attention to a gap in the monster's guard. Give them a moment to choose when to step in.",
  },
  {
    title: "Read the Beast",
    short: "Study the monster for a safer approach",
    cost: ["movement", "activation"] as const,
    description: "Study the monster's posture before committing to an attack. Its next movement may reveal a safer path around it.",
  },
];

// Small example decks for the prototype, not the complete game card catalog.
export const sampleDecks: Record<string, Omit<ListEntry, "id">[]> = {
  "Fighting Arts": [
    { text: "Last Man Standing", description: "Become stronger and harder to hit when you are the only survivor still standing." },
    { text: "Rhythm Chaser", description: "Build momentum as you move and carry that rhythm into your attacks." },
    { text: "Extra Sense", description: "Trust your instincts to avoid danger that other survivors cannot anticipate." },
  ],
  Disorders: [
    { text: "Fear of the Dark", description: "The darkness beyond the lantern's glow makes it difficult to leave the settlement." },
    { text: "Immortal", description: "A conviction that death cannot claim you changes how you face every showdown." },
    { text: "Aichmophobia", description: "Sharp points and bladed weapons provoke an overwhelming fear." },
  ],
  Abilities: [
    { text: "Analyze", description: "Study the monster's behavior to anticipate what it will do next." },
    { text: "Courageous", description: "Standing at the center of danger restores your resolve." },
    { text: "Tough", description: "Your hardened body gives you a better chance of enduring severe injuries." },
  ],
};
