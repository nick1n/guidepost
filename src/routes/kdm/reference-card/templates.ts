import { cardDefaults, cardTypes, type Card } from "./card";

type CardTemplate = Partial<Card> & Pick<Card, "type" | "title" | "content"> & { label?: string };

const knockedDown = {
  type: "Custom",
  title: "Knocked Down",
  content:
    "Turn your miniature on its side.\nYou may only spend survival to dodge (remaining knocked down), and cannot spend [activation] activation or [movement] movement.",
  background: "Injury (Light)",
  textOutline: true,
} satisfies CardTemplate;

const cardTemplates = {
  "glass-mask": {
    type: "Fighting art",
    title: "Glass Mask",
    content:
      "When you **depart**, you lightly cut your ears, rub blood all over your face, and wait for it to dry.\n\nGain +3 insanity.\n\nIf you have **Face Painting**, you create a seal between your glass mask and armor.\nGain an additional +3 insanity.",
    footer: "- When You Depart -",
  },
  "devils-melody": {
    type: "Secret fighting art",
    title: "Devil's Melody",
    content:
      "**Ballad of the Devil's Melody [4]:**\nGain +10 survival, +10 insanity, +1 movement token, and +1 speed token.\n---\nAt the start of each round, the monster suffers an automatic wound and each survivor suffers a random severe injury.",
    footer: "- At the start of each round -",
    ribbon: "Smog Singers",
  },
  analyze: {
    type: "Ability",
    title: "Analyze",
    subtitle: "understanding epiphany",
    content:
      "At the start of the survivors' turn, if you are standing and adjacent to the monster, reveal the top [deck-ai] card, then place it back on top of the deck.",
    footer: "- Start of the Survivors' Turn -",
    bodySizeStep: "Large",
    edgeRules: true,
  },
  guardless: {
    type: "Impairment",
    title: "Guardless",
    content: "You may not dodge, block, deflect, or ignore hits.\nAttack rolls can still miss you.",
    typeface: "Nimbus",
    edgeRules: true,
  },
  "armored-fist": {
    type: "Strain",
    title: "Armored Fist",
    subtitle: "fighting art, strain",
    content:
      "Requires Fist & Tooth Proficiency\n---\nYour Fist & Tooth attacks gain strength equal to the current armor value of your arms hit location.",
    footer: "- When You Attack -",
    edgeRules: true,
  },
  martyr: {
    type: "Disorder",
    title: "Martyr",
    content:
      "You are **guardless**.\nWhen you die during the showdown, nominate another survivor on the showdown board to gain this disorder.",
    footer: "- When you die -",
  },
  "broken-rib": {
    type: "Severe injury",
    title: "Broken Rib",
    subtitle: "severe body injury",
    content: "It even hurts to breathe.\n\nSuffer -1 permanent speed.\n\nThis injury is permanent, and can be recorded multiple times.",
    ribbon: "Injury Body",
    bodySizeStep: "Large",
  },
  "knocked-down-survivors": {
    ...knockedDown,
    label: "Knocked Down (Survivors' Turn)",
    subtitle: "(During Survivors' Turn)",
    headerTop: "#ffb200",
    headerBottom: "#ffb200",
    content: `If you were in the middle of your attack, the remainder of that attack is canceled.\n${knockedDown.content}`,
    footer: "Discard and stand your miniature up at the end of the monster's turn.",
  },
  "knocked-down-monster": {
    ...knockedDown,
    label: "Knocked Down (Monster's Turn)",
    subtitle: "(During Monster's Turn)",
    headerTop: "#ff4800",
    headerBottom: "#ff4800",
    footer: "Flip over at the end of the monster's turn.",
  },
} satisfies Record<string, CardTemplate>;

export type TemplateId = keyof typeof cardTemplates;
export const templateOptions = (Object.keys(cardTemplates) as TemplateId[]).map((id) => {
  const { type, title, label }: CardTemplate = cardTemplates[id];
  return { id, label: label ?? `${type} (${title})` };
});

export function cardFromTemplate(id: TemplateId): Card {
  const { type, label: _label, footer = "", ...fields }: CardTemplate = cardTemplates[id];
  return {
    ...cardDefaults,
    ...cardTypes[type],
    type,
    subtitle: type.toLowerCase(),
    footer,
    ...fields,
  };
}

export const initialCard = cardFromTemplate("analyze");
