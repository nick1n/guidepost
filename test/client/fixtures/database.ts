import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach } from "vitest";
import { Database } from "#lib/app/database.ts";

/** Register once per suite; connections close before any of its databases are deleted. */
export function databaseFixture() {
  const connections = new Set<{ close(): void }>();
  const databases = new Set<string>();

  afterEach(async () => {
    for (const connection of connections) connection.close();
    connections.clear();
    for (const name of databases) await Dexie.delete(name);
    databases.clear();
  });

  function track<T extends { close(): void }>(connection: T) {
    connections.add(connection);
    return connection;
  }

  return (name = `guidepost-test-${crypto.randomUUID()}`) => {
    databases.add(name);
    const db = track(new Database(name));
    return { name, db, track };
  };
}
