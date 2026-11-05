import { createContext } from "svelte";
import type { Notice } from "./notifications.ts";

const historyLimit = 100;
type Entry = Readonly<Notice & { id: number }>;

export class NotificationLog {
  #notices = $state.raw<readonly Entry[]>([]);
  #nextId = 0;
  #unread = $state.raw<Readonly<{ id: number; recordedAt: number; kind: Notice["kind"] }>>();
  #hasUnreadError = $state(false);

  get notices() {
    return this.#notices;
  }

  get unread() {
    return this.#unread;
  }

  get unreadKind() {
    return this.#hasUnreadError ? "error" : this.#unread?.kind;
  }

  acknowledge() {
    this.#unread = undefined;
    this.#hasUnreadError = false;
  }

  record = (notice: Notice) => {
    const id = this.#nextId++;
    this.#notices = [{ ...notice, id }, ...this.#notices].slice(0, historyLimit);
    this.#unread = { id, recordedAt: Date.now(), kind: notice.kind };
    if (notice.kind === "error") this.#hasUnreadError = true;
  };
}

export const [getNotificationLog, setNotificationLog] = createContext<NotificationLog>();
