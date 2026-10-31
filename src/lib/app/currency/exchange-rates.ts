import { DateTime, Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";
import { ExchangeError, rateCacheName } from "./model.ts";

export const rateUrl = "https://api.frankfurter.dev/v2/rates?base=EUR&providers=ecb";
export const rateMaxAge = 24 * 60 * 60 * 1000;

const Rate = Schema.Struct({
  base: Schema.Literal("EUR"),
  quote: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
  date: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
    Schema.makeFilter((value) => Option.exists(DateTime.make(value), (date) => DateTime.formatIsoDateUtc(date) === value), {
      expected: "a valid calendar date",
    }),
  ),
  rate: Schema.Finite.check(Schema.isGreaterThan(0)),
});
const Rates = Schema.Array(Rate).check(Schema.isMinLength(1));
const Snapshot = Schema.Struct({
  fetchedAt: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  rates: Rates,
});
export interface RateSnapshot extends Schema.Schema.Type<typeof Snapshot> {}

type RateCache = Pick<Cache, "match" | "put">;
export type RateStorage = { open: (name: string) => Promise<RateCache> };

const cacheOperation = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new ExchangeError({ operation: "cache", cause }) });

const fetchRates = Effect.fn("ExchangeRates.fetch")(function* () {
  const response = yield* HttpClient.get(rateUrl).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Rates)),
    Effect.timeout("10 seconds"),
    // Public browser requests must not require a preflight for tracing headers.
    Effect.provideService(HttpClient.TracerPropagationEnabled, false),
    Effect.mapError((cause) => new ExchangeError({ operation: "fetch", cause })),
  );
  return { rates: response, fetchedAt: DateTime.toEpochMillis(yield* DateTime.now) };
});

/** Cache Storage is shared with the worker and works before the first worker takes control. */
export const loadRates = Effect.fn("ExchangeRates.load")(function* (
  storage: RateStorage | undefined,
  previous?: RateSnapshot,
  oncached: (snapshot: RateSnapshot | undefined) => void = () => {},
) {
  const cache = storage
    ? yield* cacheOperation(() => storage.open(rateCacheName)).pipe(Effect.catchTag("ExchangeError", () => Effect.succeed(undefined)))
    : undefined;
  const saved = cache
    ? yield* cacheOperation(() => cache.match(rateUrl)).pipe(
        Effect.flatMap((response) =>
          response
            ? cacheOperation(() => response.json()).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Snapshot)))
            : Effect.succeed(undefined),
        ),
        Effect.catch(() => Effect.succeed(undefined)),
      )
    : undefined;
  const snapshot = saved && (!previous || saved.fetchedAt > previous.fetchedAt) ? saved : previous;
  oncached(snapshot);
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  if (snapshot && now >= snapshot.fetchedAt && now - snapshot.fetchedAt <= rateMaxAge) return snapshot;
  const fresh = yield* fetchRates();
  if (cache) {
    yield* cacheOperation(() => cache.put(rateUrl, Response.json(fresh))).pipe(Effect.catchTag("ExchangeError", () => Effect.void));
  }
  return fresh;
}, Effect.provide(FetchHttpClient.layer));
