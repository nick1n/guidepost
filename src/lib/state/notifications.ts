import { Clock, Context, Effect, Layer } from "effect";

export type Notice = { kind: "success" | "error" | "info"; message: string; timestamp: number; details?: readonly string[] };

export class Notifications extends Context.Service<
  Notifications,
  {
    success(message: string, details?: readonly string[]): Effect.Effect<void>;
    error(message: string, cause?: unknown): Effect.Effect<void>;
  }
>()("guidepost/Notifications") {
  static readonly layer = Layer.succeed(Notifications, {
    success: Effect.fn("Notifications.success")((message: string, details?: readonly string[]) =>
      Effect.logInfo(message, { action: "success", ...(details?.length ? { details } : {}) }),
    ),
    error: Effect.fn("Notifications.error")((message: string, cause?: unknown) => Effect.logError(message, { action: "failure", cause })),
  });

  static layerWith(record: (notice: Notice) => void) {
    return Layer.succeed(Notifications, {
      success: Effect.fn("Notifications.success")(function* (message: string, details?: readonly string[]) {
        const timestamp = yield* Clock.currentTimeMillis;
        const items = details?.length ? { details: [...details] } : {};
        record({ kind: "success", message, timestamp, ...items });
        yield* Effect.logInfo(message, { action: "success", ...items });
      }),
      error: Effect.fn("Notifications.error")(function* (message: string, cause?: unknown) {
        const timestamp = yield* Clock.currentTimeMillis;
        record({ kind: "error", message, timestamp });
        yield* Effect.logError(message, { action: "failure", cause });
      }),
    });
  }
}
