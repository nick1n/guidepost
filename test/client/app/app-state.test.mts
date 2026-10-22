import { expect, it, vi } from "vitest";
import type { Snippet } from "svelte";
import { NotificationLog } from "#lib/app/notification-log.svelte.ts";
import { SiteMenu } from "#lib/app/site-menu.svelte.ts";
import { ShowdownDisplay } from "#lib/kdm/showdown/display.svelte.ts";

it("retains only the newest 100 notices with stable distinct IDs and an app-scoped history", () => {
  const log = new NotificationLog();
  const record = log.record;
  for (let index = 0; index < 105; index++) record({ kind: "info", message: `Notice ${index}`, timestamp: index });
  expect(log.notices).toHaveLength(100);
  expect(log.notices[0]).toMatchObject({ id: 104, message: "Notice 104" });
  expect(log.notices.at(-1)).toMatchObject({ id: 5, message: "Notice 5" });
  expect(new Set(log.notices.map(({ id }) => id)).size).toBe(100);
  expect(new NotificationLog().notices).toEqual([]);
});

it("releases only the active menu opener registration", () => {
  const menu = new SiteMenu();
  const first = vi.fn();
  const second = vi.fn();
  const releaseFirst = menu.registerOpen(first);
  const releaseSecond = menu.registerOpen(second);
  releaseFirst();
  menu.onopen();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  releaseSecond();
  menu.onopen();
  expect(second).toHaveBeenCalledTimes(1);
});

it("keeps showdown settings for the app session while cleaning up route-owned summary and alignment", () => {
  const display = new ShowdownDisplay();
  const firstSummary = (() => {}) as Snippet;
  const secondSummary = (() => {}) as Snippet;
  const firstAlign = vi.fn();
  const secondAlign = vi.fn();
  const releaseFirst = display.register(firstSummary, firstAlign);
  display.settings.density = "comfortable";
  display.settings.snap = "right";
  const releaseSecond = display.register(secondSummary, secondAlign);
  releaseFirst();
  expect(display.summary).toBe(secondSummary);
  display.alignDashboard();
  expect(firstAlign).not.toHaveBeenCalled();
  expect(secondAlign).toHaveBeenCalledTimes(1);
  releaseSecond();
  expect(display.summary).toBeUndefined();
  display.alignDashboard();
  expect(secondAlign).toHaveBeenCalledTimes(1);
  expect(display.settings).toMatchObject({ density: "comfortable", snap: "right" });
  expect(new ShowdownDisplay().settings).toMatchObject({ density: "default", snap: "free" });
});

it("sets dashboard snap immediately and aligns on the next animation frame", () => {
  const display = new ShowdownDisplay();
  const align = vi.fn();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  try {
    display.register((() => {}) as Snippet, align);
    display.setSnap("right");
    expect(display.settings.snap).toBe("right");
    expect(align).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(align).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
