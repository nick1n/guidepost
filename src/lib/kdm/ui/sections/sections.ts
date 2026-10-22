import { createContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";

export function sectionName(title: string) {
  if (title === "Monster Attributes" || title === "Vital Signs") return "Attributes";
  return title === "Attribute Tokens" ? "Tokens" : title;
}

export class SectionControls {
  private sections = new SvelteSet<{ getTitle: () => string; getOpen: () => boolean; setOpen: (open: boolean) => void }>();

  constructor(readonly toggleRelated?: (title: string) => boolean) {}

  get allOpen() {
    return this.sections.size > 0 && Array.from(this.sections).every((section) => section.getOpen());
  }

  register(getTitle: () => string, getOpen: () => boolean, setOpen: (open: boolean) => void) {
    const section = { getTitle: () => sectionName(getTitle()), getOpen, setOpen };
    this.sections.add(section);
    return () => {
      this.sections.delete(section);
    };
  }

  setOpen(open: boolean) {
    for (const section of this.sections) section.setOpen(open);
  }

  isOpen(title: string) {
    const name = sectionName(title);
    const matches = Array.from(this.sections).filter((section) => section.getTitle() === name);
    return matches.length > 0 && matches.every((section) => section.getOpen());
  }

  hasSection(title: string) {
    const name = sectionName(title);
    return Array.from(this.sections).some((section) => section.getTitle() === name);
  }

  setSectionOpen(title: string, open: boolean) {
    const name = sectionName(title);
    for (const section of this.sections) {
      if (section.getTitle() === name) section.setOpen(open);
    }
  }
}

export const [getSectionControls, setSectionControls] = createContext<SectionControls>();

export const sectionIcons: Record<string, string> = {
  "Survivor Attributes": "i-material-symbols:bar-chart",
  "Monster Attributes": "i-material-symbols:bar-chart",
  Actions: "i-material-symbols:swords",
  "Basic Action": "i-material-symbols:swords",
  "Common Actions": "i-material-symbols:menu-book",
  "Instinct: **Sniff**": "i-material-symbols:air",
  Status: "i-material-symbols:flag",
  "Gear Grid": "i-material-symbols:grid-view",
  Tokens: "i-material-symbols:token",
  "Attribute Tokens": "i-material-symbols:token",
  "Trinkets & Baubles": "i-material-symbols:diamond",
  "Fighting Arts": "i-material-symbols:sports-martial-arts",
  Disorders: "i-material-symbols:psychology",
  Abilities: "i-material-symbols:auto-awesome",
  "Impairments & Injuries": "i-material-symbols:healing",
  Resources: "i-material-symbols:inventory-2",
  "Resource Deck": "i-material-symbols:layers",
  "Per Lifetimes": "i-material-symbols:hourglass-top",
  "Cursed Gear": "i-material-symbols:skull",
  "Showdown History": "i-material-symbols:history",
  "Showdown Setup": "i-material-symbols:landscape",
  "Armor & Bonuses": "i-material-symbols:shield",
  Development: "i-material-symbols:trending-up",
  Notes: "i-material-symbols:edit-note",
  Miscellaneous: "i-material-symbols:person",
};
