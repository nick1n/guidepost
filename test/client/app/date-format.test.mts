import { expect, it, vi } from "vitest";
import { DatePreferences } from "#lib/app/preferences/date-preferences.svelte.ts";
import { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";

it("formats catalog dates without shifting the calendar day and uses the same format for log dates", () => {
  const dates = new DatePreferences(new AppPreferences());
  const timestamp = new Date(2026, 9, 20, 3, 11, 16).getTime();
  for (const [format, expected] of [
    ["iso", "2026-10-20"],
    ["day-first", "20/10/2026"],
    ["month-first", "10/20/2026"],
    ["written", "20 Oct 2026"],
  ] as const) {
    dates.setDateFormat(format);
    expect(dates.formatDate("2026-10-20")).toBe(expected);
    expect(dates.formatTimestamp(timestamp)).toBe(`${expected}, ${new Date(timestamp).toLocaleTimeString()}`);
  }
});

it("keeps catalog calendar dates in UTC while rendering timestamps in the local time zone", () => {
  vi.stubEnv("TZ", "America/Los_Angeles");
  try {
    const dates = new DatePreferences(new AppPreferences());
    expect(dates.formatDate("2026-10-20")).toBe("2026-10-20");
    expect(dates.formatDate(Date.UTC(2026, 9, 20, 2))).toBe("2026-10-19");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("reuses date and clock formatters across dates and numeric display orders", () => {
  const formatter = vi.spyOn(Intl, "DateTimeFormat");
  try {
    const dates = new DatePreferences(new AppPreferences());
    for (let index = 0; index < 2; index++) {
      dates.formatDate("2026-10-20");
      dates.formatTimestamp(Date.UTC(2026, 9, 20, index));
      dates.formatTime(Date.UTC(2026, 9, 20, index));
      dates.setDateFormat("day-first");
    }
    expect(formatter).toHaveBeenCalledTimes(4);
    dates.setDateFormat("written");
    dates.formatDate("2026-10-20");
    dates.formatTimestamp(Date.UTC(2026, 9, 20));
    expect(formatter).toHaveBeenCalledTimes(6);
  } finally {
    formatter.mockRestore();
  }
});
