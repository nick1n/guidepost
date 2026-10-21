import { createContext } from "svelte";
import type { Notice } from "./notifications.ts";

const historyLimit = 100;

export class NotificationLog {
  notices = $state.raw<(Notice & { id: number })[]>([]);
  #nextId = 0;

  record = (notice: Notice) => {
    this.notices = [{ ...notice, id: this.#nextId++ }, ...this.notices].slice(0, historyLimit);
  };
}

export const [getNotificationLog, setNotificationLog] = createContext<NotificationLog>();
