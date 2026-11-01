import { Clock, Effect, Schedule } from "effect";

type Output = { isTTY?: boolean; columns?: number; write: (text: string) => unknown };
const frames = ["|", "/", "-", "\\"];
const clear = "\r\x1b[2K";

/** Animate interactive terminals while leaving redirected progress as ordinary log lines. */
export const withProgress = Effect.fn("CatalogCLI.progress")(function* <A, E, R>(
  label: string,
  work: Effect.Effect<A, E, R>,
  options: { wait?: number; output?: Output } = {},
) {
  const output = options.output ?? process.stderr;
  if (!output.isTTY) return yield* work;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis;
      let frame = 0;
      const render = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const remaining = Math.max(0, Math.ceil(((options.wait ?? 0) - (now - startedAt)) / 1000));
        const message = options.wait === undefined ? label : `Waiting ${remaining}s: ${label}`;
        const line = `${frames[frame++ % frames.length]} ${message}`.slice(0, Math.max(1, (output.columns ?? 80) - 1));
        yield* Effect.sync(() => output.write(clear + line));
      });
      yield* Effect.addFinalizer(() => Effect.sync(() => output.write(clear)));
      yield* render;
      yield* render.pipe(Effect.repeat(Schedule.spaced("100 millis")), Effect.delay("100 millis"), Effect.forkScoped);
      return yield* work;
    }),
  );
});
