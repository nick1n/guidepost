import { createContext } from "svelte";
import type { Notice } from "./notifications.ts";

const historyLimit = 100;

export class NotificationLog {
  notices = $state.raw<(Notice & { id: number })[]>([]);
  #nextId = 0;
  #unreadError = $state<{ id: number; recordedAt: number }>();

  get unreadError() {
    return this.#unreadError;
  }

  acknowledgeErrors() {
    this.#unreadError = undefined;
  }

  record = (notice: Notice) => {
    const id = this.#nextId++;
    this.notices = [{ ...notice, id }, ...this.notices].slice(0, historyLimit);
    if (notice.kind === "error") this.#unreadError = { id, recordedAt: Date.now() };
  };
}

export const [getNotificationLog, setNotificationLog] = createContext<NotificationLog>();
