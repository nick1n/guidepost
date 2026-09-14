import { Console, Context, Effect, Layer } from "effect";

export class Notifications extends Context.Service<
  Notifications,
  {
    success(message: string): Effect.Effect<void>;
    error(message: string, cause?: unknown): Effect.Effect<void>;
  }
>()("guidepost/Notifications") {
  static readonly layer = Layer.succeed(Notifications, {
    success: Effect.fn("Notifications.success")((message: string) => Console.info(message)),
    error: Effect.fn("Notifications.error")((message: string, cause?: unknown) => Console.error(message, cause)),
  });
}
