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
