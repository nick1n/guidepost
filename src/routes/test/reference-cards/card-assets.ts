import { asset } from "$app/paths";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";

const fonts = {
  "Card Amplitude": "kdm/reference-cards/amplitude-wide.woff2",
  "Card Nimbus": "kdm/reference-cards/nimbus-san.woff2",
  "Card Silverado Medium": "kdm/reference-cards/silverado-medium-condensed.woff2",
  "KD Icons": "kdm/fonts/kd-icons-v1.woff2",
} as const;

class CardAssetsError extends Schema.TaggedError<CardAssetsError>()("CardAssetsError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const assetError = (cause: unknown) => new CardAssetsError({ message: "Could not load the reference card templates.", cause });

type CardAssetPath = (typeof fonts)[keyof typeof fonts] | "kdm/reference-cards/template-layers.png";
const readAsset = Effect.fn("ReferenceCards.readAsset")((path: CardAssetPath) =>
  HttpClient.get(asset(path)).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.arrayBuffer),
    Effect.provideService(HttpClient.TracerPropagationEnabled, false),
    Effect.mapError(assetError),
  ),
);

const loadArtwork = Effect.fn("ReferenceCards.loadArtwork")(function* () {
  const bytes = yield* readAsset("kdm/reference-cards/template-layers.png");
  return yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: async (signal) => {
        const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        if (signal.aborted) image.close();
        return image;
      },
      catch: assetError,
    }),
    (image) => Effect.sync(() => image.close()),
    { interruptible: true },
  );
});

const loadFonts = Effect.fn("ReferenceCards.loadFonts")(function* () {
  const faces = yield* Effect.forEach(
    Object.entries(fonts),
    ([name, path]) =>
      readAsset(path).pipe(
        Effect.flatMap((bytes) => Effect.tryPromise({ try: () => new FontFace(name, bytes).load(), catch: assetError })),
      ),
    { concurrency: "unbounded" },
  );
  yield* Effect.acquireRelease(
    Effect.sync(() => faces.forEach((face) => document.fonts.add(face))),
    () => Effect.sync(() => faces.forEach((face) => document.fonts.delete(face))),
  );
});

export const useCardAssets = Effect.fn("ReferenceCards.useAssets")(
  function* (ready: (artwork: ImageBitmap) => void) {
    const [artwork] = yield* Effect.all([loadArtwork(), loadFonts()], { concurrency: "unbounded" });
    yield* Effect.sync(() => ready(artwork));
    yield* Effect.never;
  },
  Effect.scoped,
  Effect.provide(FetchHttpClient.layer),
);
