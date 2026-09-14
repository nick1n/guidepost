import { Context, Data, Effect, Layer } from "effect";

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: "get" | "set" | "remove";
  readonly cause: unknown;
}> {
  get message() {
    return `Browser storage ${this.operation} failed.`;
  }
}

export interface StorageApi {
  get(key: string): Effect.Effect<string | null, StorageError>;
  set(key: string, value: string): Effect.Effect<void, StorageError>;
  remove(key: string): Effect.Effect<void, StorageError>;
}

export class BrowserStorage extends Context.Service<BrowserStorage, StorageApi>()("guidepost/BrowserStorage") {
  static readonly layer = Layer.succeed(BrowserStorage, {
    get: (key) =>
      Effect.try({
        try: () => localStorage.getItem(key),
        catch: (cause) => new StorageError({ operation: "get", cause }),
      }),
    set: (key, value) =>
      Effect.try({
        try: () => localStorage.setItem(key, value),
        catch: (cause) => new StorageError({ operation: "set", cause }),
      }),
    remove: (key) =>
      Effect.try({
        try: () => localStorage.removeItem(key),
        catch: (cause) => new StorageError({ operation: "remove", cause }),
      }),
  });
}
