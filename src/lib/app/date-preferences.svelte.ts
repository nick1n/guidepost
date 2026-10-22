import { createContext } from "svelte";
import type { Notice } from "./notifications.ts";

const dateFormats = [{ value: "iso" }, { value: "day-first" }, { value: "month-first" }, { value: "written" }] as const;
type DateFormat = (typeof dateFormats)[number]["value"];
const dateFormatKey = "guidepost.date-format";

export class DatePreferences {
  dateFormat = $state<DateFormat>("iso");
  #record: (notice: Notice) => void;
  #formatters = new Map<string, Intl.DateTimeFormat>();

  constructor(record: (notice: Notice) => void = () => {}) {
    this.#record = record;
  }

  get formats() {
    const today = Date.now();
    return dateFormats.map(({ value }) => ({ value, label: this.formatDate(today, value) }));
  }

  loadDateFormat() {
    try {
      const saved = localStorage.getItem(dateFormatKey);
      const format = dateFormats.find(({ value }) => value === saved);
      if (format) this.dateFormat = format.value;
    } catch {
      // Keep the default when browser storage is unavailable.
    }
  }

  setDateFormat(value: string) {
    const format = dateFormats.find((format) => format.value === value);
    if (!format) return;
    this.dateFormat = format.value;
    try {
      localStorage.setItem(dateFormatKey, format.value);
    } catch {
      this.#record({ kind: "error", message: "Date format changed, but could not be saved on this device.", timestamp: Date.now() });
    }
  }

  #formatter(key: string, locale: string | undefined, options: Intl.DateTimeFormatOptions) {
    let formatter = this.#formatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, options);
      this.#formatters.set(key, formatter);
    }
    return formatter;
  }

  formatDate(value: string | number, format = this.dateFormat) {
    // Catalog dates are calendar dates, not UTC instants. Never shift them into the previous day.
    const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const written = format === "written";
    const parts = this.#formatter(`${written ? "written" : "numeric"}-${dateOnly ? "calendar" : "local"}`, "en-GB", {
      year: "numeric",
      month: written ? "short" : "2-digit",
      day: written ? "numeric" : "2-digit",
      ...(dateOnly ? { timeZone: "UTC" } : {}),
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    const year = part("year"),
      month = part("month"),
      day = part("day");
    if (written) return `${day} ${month} ${year}`;
    if (format === "day-first") return `${day}/${month}/${year}`;
    if (format === "month-first") return `${month}/${day}/${year}`;
    return `${year}-${month}-${day}`;
  }

  formatTime(timestamp: number) {
    return this.#formatter("short-time", undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
  }

  formatTimestamp(timestamp: number) {
    const time = this.#formatter("time", undefined, { hour: "numeric", minute: "numeric", second: "numeric" }).format(timestamp);
    return `${this.formatDate(timestamp)}, ${time}`;
  }
}

export const [getDatePreferences, setDatePreferences] = createContext<DatePreferences>();
