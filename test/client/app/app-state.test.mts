import { expect, it, vi } from "vitest";
import type { Snippet } from "svelte";
import { NotificationLog } from "#lib/app/notifications/notification-log.svelte.ts";
import { SiteMenu } from "#lib/app/menu/site-menu.svelte.ts";
import { ShowdownDisplay } from "#lib/kdm/showdown/display.svelte.ts";

it("retains only the newest 100 notices with stable distinct IDs and an app-scoped history", () => {
  const log = new NotificationLog();
  const record = log.record;
  for (let index = 0; index < 105; index++) record({ kind: index === 0 ? "error" : "info", message: `Notice ${index}`, timestamp: index });
  expect(log.notices).toHaveLength(100);
  expect(log.notices[0]).toMatchObject({ id: 104, message: "Notice 104" });
  expect(log.notices.at(-1)).toMatchObject({ id: 5, message: "Notice 5" });
  expect(new Set(log.notices.map(({ id }) => id)).size).toBe(100);
  expect(log.unread?.id).toBe(104);
  expect(log.unreadKind).toBe("error");
  expect(new NotificationLog().notices).toEqual([]);
});

it("signals each new notice in its own color while unread errors retain priority", () => {
  const log = new NotificationLog();
  expect(log.unread).toBeUndefined();
  expect(log.unreadKind).toBeUndefined();
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  try {
    log.record({ kind: "success", message: "Saved", timestamp: 0 });
    expect(log.unread).toEqual({ id: 0, recordedAt: 1000, kind: "success" });
    expect(log.unreadKind).toBe("success");
    log.record({ kind: "error", message: "First error", timestamp: 0 });
    expect(log.unread).toEqual({ id: 1, recordedAt: 1000, kind: "error" });
    expect(log.unreadKind).toBe("error");
    log.record({ kind: "info", message: "Information", timestamp: 0 });
    expect(log.unread).toEqual({ id: 2, recordedAt: 1000, kind: "info" });
    expect(log.unreadKind).toBe("error");
    now.mockReturnValue(2000);
    log.record({ kind: "success", message: "Saved again", timestamp: 0 });
    expect(log.unread).toEqual({ id: 3, recordedAt: 2000, kind: "success" });
    expect(log.unreadKind).toBe("error");
    log.record({ kind: "error", message: "Second error", timestamp: 0 });
    expect(log.unread).toEqual({ id: 4, recordedAt: 2000, kind: "error" });
    expect(log.unreadKind).toBe("error");
  } finally {
    now.mockRestore();
  }
});

it("releases only the active menu action registration", () => {
  const menu = new SiteMenu();
  const first = vi.fn();
  const second = vi.fn();
  const close = vi.fn();
  const releaseFirst = menu.register({ open: first, close: vi.fn() });
  const releaseSecond = menu.register({ open: second, close });
  releaseFirst();
  menu.onopen();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  menu.onclose();
  expect(close).toHaveBeenCalledOnce();
  releaseSecond();
  menu.onopen();
  menu.onclose();
  expect(second).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledOnce();
});

it("acknowledges drawer activity without deleting history or replaying the menu pulse", () => {
  const log = new NotificationLog();
  log.record({ kind: "success", message: "Saved", timestamp: 0 });
  log.record({ kind: "error", message: "Failed", timestamp: 0 });
  const history = log.notices;

  log.acknowledge();

  expect(log.unread).toBeUndefined();
  expect(log.unreadKind).toBeUndefined();
  expect(log.notices).toBe(history);
  expect(log.notices).toHaveLength(2);
  log.record({ kind: "info", message: "New message", timestamp: 0 });
  expect(log.unread).toMatchObject({ id: 2, kind: "info" });
  expect(log.unreadKind).toBe("info");
  log.acknowledge();
  log.acknowledge();
  log.record({ kind: "error", message: "Another failure", timestamp: 0 });
  expect(log.unread).toMatchObject({ id: 3, kind: "error" });
  expect(log.unreadKind).toBe("error");
  expect(new NotificationLog().unread).toBeUndefined();
  expect(new NotificationLog().unreadKind).toBeUndefined();
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
