import { Context, Effect, Layer, Schema } from "effect";

export class StorageError extends Schema.TaggedError<StorageError>()("StorageError", {
  operation: Schema.Literals(["get", "set", "remove"]),
  cause: Schema.Defect(),
}) {
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
    get: Effect.fn("BrowserStorage.get")((key: string) =>
      Effect.try({
        try: () => localStorage.getItem(key),
        catch: (cause) => new StorageError({ operation: "get", cause }),
      }),
    ),
    set: Effect.fn("BrowserStorage.set")((key: string, value: string) =>
      Effect.try({
        try: () => localStorage.setItem(key, value),
        catch: (cause) => new StorageError({ operation: "set", cause }),
      }),
    ),
    remove: Effect.fn("BrowserStorage.remove")((key: string) =>
      Effect.try({
        try: () => localStorage.removeItem(key),
        catch: (cause) => new StorageError({ operation: "remove", cause }),
      }),
    ),
  });
}
