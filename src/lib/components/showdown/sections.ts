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
    const matches = Array.from(this.sections).filter((section) => section.getTitle() === sectionName(title));
    return matches.length > 0 && matches.every((section) => section.getOpen());
  }

  hasSection(title: string) {
    return Array.from(this.sections).some((section) => section.getTitle() === sectionName(title));
  }

  setSectionOpen(title: string, open: boolean) {
    for (const section of this.sections) {
      if (section.getTitle() === sectionName(title)) section.setOpen(open);
    }
  }
}

export const [getSectionControls, setSectionControls] = createContext<SectionControls>();
