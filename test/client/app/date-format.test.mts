import { expect, it, vi } from "vitest";
import { DatePreferences } from "#lib/app/date-preferences.svelte.ts";
import { NotificationLog } from "#lib/app/notification-log.svelte.ts";

it("formats catalog dates without shifting the calendar day and uses the same format for log dates", () => {
  const dates = new DatePreferences();
  const timestamp = new Date(2026, 9, 20, 3, 11, 16).getTime();
  for (const [format, expected] of [
    ["iso", "2026-10-20"],
    ["day-first", "20/10/2026"],
    ["month-first", "10/20/2026"],
    ["written", "20 Oct 2026"],
  ] as const) {
    dates.dateFormat = format;
    expect(dates.formatDate("2026-10-20")).toBe(expected);
    expect(dates.formatTimestamp(timestamp)).toBe(`${expected}, ${new Date(timestamp).toLocaleTimeString()}`);
  }
});

it("keeps catalog calendar dates in UTC while rendering timestamps in the local time zone", () => {
  vi.stubEnv("TZ", "America/Los_Angeles");
  try {
    const dates = new DatePreferences();
    expect(dates.formatDate("2026-10-20")).toBe("2026-10-20");
    expect(dates.formatDate(Date.UTC(2026, 9, 20, 2))).toBe("2026-10-19");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("reuses date and clock formatters across dates and numeric display orders", () => {
  const formatter = vi.spyOn(Intl, "DateTimeFormat");
  try {
    const dates = new DatePreferences();
    for (let index = 0; index < 2; index++) {
      dates.formatDate("2026-10-20");
      dates.formatTimestamp(Date.UTC(2026, 9, 20, index));
      dates.formatTime(Date.UTC(2026, 9, 20, index));
      dates.dateFormat = "day-first";
    }
    expect(formatter).toHaveBeenCalledTimes(4);
    dates.dateFormat = "written";
    dates.formatDate("2026-10-20");
    dates.formatTimestamp(Date.UTC(2026, 9, 20));
    expect(formatter).toHaveBeenCalledTimes(6);
  } finally {
    formatter.mockRestore();
  }
});

it("restores a saved date format and ignores invalid saved values", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  try {
    new DatePreferences().setDateFormat("day-first");
    const restored = new DatePreferences();
    restored.loadDateFormat();
    expect(restored.dateFormat).toBe("day-first");
    storage.set("guidepost.date-format", "invalid");
    const fresh = new DatePreferences();
    fresh.loadDateFormat();
    expect(fresh.dateFormat).toBe("iso");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("keeps the selected format and reports a storage write failure to the app notification log", () => {
  const log = new NotificationLog();
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  });
  try {
    const dates = new DatePreferences(log.record);
    dates.loadDateFormat();
    expect(dates.dateFormat).toBe("iso");
    expect(log.notices).toEqual([]);
    dates.setDateFormat("written");
    expect(dates.dateFormat).toBe("written");
    expect(log.notices).toMatchObject([{ kind: "error", message: "Date format changed, but could not be saved on this device." }]);
    dates.setDateFormat("invalid");
    expect(dates.dateFormat).toBe("written");
    expect(log.notices).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
