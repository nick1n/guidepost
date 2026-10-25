import { afterEach, beforeEach, vi } from "vitest";
import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { NavigationError } from "#lib/navigation.ts";
import { HashNavigation, createHashRoute, setHashNavigation } from "#lib/app/navigation/hash-route.svelte.ts";
import { formatHash, readHash } from "#lib/app/navigation/hash.ts";

vi.mock("svelte", async (original) => ({
  ...(await original<typeof import("svelte")>()),
  createContext: () => {
    let value: unknown;
    return [() => value, (next: unknown) => (value = next)];
  },
}));
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));
vi.mock("$app/state", () => ({ page: {} }));

let url: URL;
let navigation: HashNavigation;
const replace = vi.fn();
const fibers: Array<Fiber.Fiber<Exit.Exit<void, NavigationError>, never>> = [];
beforeEach(() => {
  url = new URL("https://example.test/tools/hunt/?ref=friend#/7");
  replace.mockReset().mockImplementation((next: URL) => {
    return Effect.sync(() => {
      url = next;
    });
  });
  navigation = setHashNavigation(
    new HashNavigation({
      current: () => url,
      replace,
      run: (operation) => {
        fibers.push(Effect.runFork(Effect.exit(operation)));
      },
    }),
  );
  navigation.restore(url, false);
});
afterEach(() => Effect.runPromise(Effect.all(fibers.splice(0).map(Fiber.interrupt), { discard: true })));
function route() {
  return createHashRoute({ read: (hash) => Number(readHash(hash)?.[0] ?? 1), format: (event) => formatHash([event]) });
}

it("reads native hash changes without writing them back", () => {
  const view = route();
  expect(view.value).toBe(7);
  url.hash = "#/12";
  navigation.hashChanged();
  expect(view.value).toBe(12);
  expect(replace).not.toHaveBeenCalled();
});

it("distinguishes an unread browser hash from an empty hash", () => {
  const cold = setHashNavigation(new HashNavigation({ current: () => url, replace, run: () => {} }));
  const view = route();
  expect(view.ready).toBe(false);
  expect(view.value).toBe(1);
  cold.restore(url, false);
  expect(view.ready).toBe(true);
  expect(view.value).toBe(7);
});

it("replaces only the hash immediately, retaining the path and search", () => {
  const view = route();
  view.replace(42);
  expect(view.value).toBe(42);
  expect(url.href).toBe("https://example.test/tools/hunt/?ref=friend#/42");
  view.replace(42);
  expect(replace).toHaveBeenCalledOnce();
});

it.effect("shares changes immediately and ignores older navigation settlement", () =>
  Effect.gen(function* () {
    const older = yield* Deferred.make<void>();
    const newer = yield* Deferred.make<void>();
    replace
      .mockImplementationOnce((next: URL) =>
        Effect.sync(() => {
          url = next;
        }).pipe(Effect.andThen(Deferred.await(older))),
      )
      .mockImplementationOnce((next: URL) =>
        Effect.sync(() => {
          url = next;
        }).pipe(Effect.andThen(Deferred.await(newer))),
      );
    const first = route();
    const second = route();
    first.replace(23);
    second.replace(42);
    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    navigation.restore(new URL("https://example.test/tools/hunt/?ref=friend#/23"), false);
    expect(first.value).toBe(42);
    yield* Deferred.succeed(older, undefined);
    yield* Fiber.join(fibers[0]);
    expect(first.value).toBe(42);
    yield* Deferred.succeed(newer, undefined);
    yield* Fiber.join(fibers[1]);
    expect(first.value).toBe(42);
    expect(url.hash).toBe("#/42");
  }),
);

it.effect("reconciles a resolved cancellation with the actual URL without a failure", () =>
  Effect.gen(function* () {
    replace.mockReturnValue(Effect.void);
    const view = route();
    view.replace(42);
    expect(Exit.isSuccess(yield* Fiber.join(fibers[0]))).toBe(true);
    expect(view.value).toBe(7);
    expect(url.hash).toBe("#/7");
  }),
);

it.effect("a newer request for the current URL supersedes an unfinished request", () =>
  Effect.gen(function* () {
    const older = yield* Deferred.make<void>();
    replace.mockReturnValueOnce(Deferred.await(older));
    const view = route();
    view.replace(42);
    view.replace(7);
    expect(replace).toHaveBeenCalledTimes(2);
    yield* Fiber.join(fibers[1]);
    yield* Deferred.succeed(older, undefined);
    yield* Fiber.join(fibers[0]);
    expect(view.value).toBe(7);
    expect(url.hash).toBe("#/7");
  }),
);

it.effect("reconciles a rejected navigation and preserves the typed error for the action boundary", () =>
  Effect.gen(function* () {
    const error = new NavigationError({ message: "Link failed", cause: "unavailable" });
    replace.mockReturnValue(Effect.fail(error));
    const view = route();
    view.replace(42);
    const result = yield* Fiber.join(fibers[0]);
    expect(Exit.isFailure(result) && Cause.hasFails(result.cause)).toBe(true);
    expect(view.value).toBe(7);
    expect(url.hash).toBe("#/7");
  }),
);

it.effect("suppresses a late failure after the newer navigation has settled", () =>
  Effect.gen(function* () {
    const older = yield* Deferred.make<void, NavigationError>();
    replace.mockReturnValueOnce(Deferred.await(older));
    const view = route();
    view.replace(23);
    view.replace(42);
    yield* Fiber.join(fibers[1]);
    yield* Deferred.fail(older, new NavigationError({ message: "Old link failed", cause: "unavailable" }));
    expect(Exit.isSuccess(yield* Fiber.join(fibers[0]))).toBe(true);
    expect(view.value).toBe(42);
    expect(url.hash).toBe("#/42");
  }),
);

it.effect("reconciles interruption and does not apply a subsequently released result", () =>
  Effect.gen(function* () {
    const release = yield* Deferred.make<void>();
    replace.mockReturnValue(Deferred.await(release));
    const view = route();
    view.replace(42);
    expect(view.value).toBe(42);
    yield* Fiber.interrupt(fibers[0]);
    expect(view.value).toBe(7);
    yield* Deferred.succeed(release, undefined);
    yield* Effect.yieldNow;
    expect(view.value).toBe(7);
  }),
);

it.effect("keeps an older defect visible to the action boundary without changing newer state", () =>
  Effect.gen(function* () {
    const release = yield* Deferred.make<void>();
    replace.mockReturnValueOnce(Deferred.await(release).pipe(Effect.andThen(Effect.die("unexpected"))));
    const view = route();
    view.replace(23);
    view.replace(42);
    yield* Deferred.succeed(release, undefined);
    const result = yield* Fiber.join(fibers[0]);
    expect(Exit.isFailure(result) && Cause.hasDies(result.cause)).toBe(true);
    expect(view.value).toBe(42);
  }),
);

it.effect("preserves interruption even when combined with a typed failure", () =>
  Effect.gen(function* () {
    const error = new NavigationError({ message: "Link failed", cause: "unavailable" });
    replace.mockReturnValue(Effect.failCause(Cause.combine(Cause.fail(error), Cause.interrupt(123))));
    const view = route();
    view.replace(42);
    const result = yield* Fiber.await(fibers[0]);
    const interrupted = Exit.isFailure(result)
      ? Cause.hasInterrupts(result.cause)
      : Exit.isFailure(result.value) && Cause.hasInterrupts(result.value.cause);
    expect(interrupted).toBe(true);
    expect(view.value).toBe(7);
  }),
);

it.effect("does not reconcile a pending request over native history or another page", () =>
  Effect.gen(function* () {
    const release = yield* Deferred.make<void, NavigationError>();
    replace.mockReturnValue(Deferred.await(release));
    navigation.replace("#/42");
    url = new URL("https://example.test/tools/other/#/overview");
    navigation.restore(url, false);
    yield* Deferred.fail(release, new NavigationError({ message: "Old page failed", cause: "unavailable" }));
    expect(Exit.isSuccess(yield* Fiber.join(fibers[0]))).toBe(true);
    expect(navigation.hash).toBe("#/overview");
  }),
);

it("restores shallow history without navigation hooks or another write", () => {
  const view = route();
  view.replace(42);
  url = new URL("https://example.test/tools/hunt/?ref=friend#/7");
  navigation.restore(url, false);
  expect(view.value).toBe(7);
  expect(replace).toHaveBeenCalledOnce();
});

it("does not restore an earlier framework hash over a newer native hash", () => {
  const view = route();
  view.replace(23);
  const earlier = new URL(url);
  url.hash = "#/42";
  navigation.hashChanged();
  navigation.restore(earlier, true);
  expect(view.value).toBe(42);
  expect(url.hash).toBe("#/42");
});

it("keeps menu edits when its separate history entry is dismissed", () => {
  const view = route();
  navigation.restore(url, true);
  view.replace(42);
  url = new URL("https://example.test/tools/hunt/?ref=friend#/7");
  navigation.hashChanged();
  navigation.restore(url, false);
  expect(view.value).toBe(42);
  expect(url.hash).toBe("#/42");
});

it("does not carry a menu hash onto a different page", () => {
  navigation.restore(url, true);
  navigation.replace("#/42");
  url = new URL("https://example.test/tools/other/#/overview");
  navigation.restore(url, false);
  expect(navigation.hash).toBe("#/overview");
  expect(url.pathname).toBe("/tools/other/");
});

it("accepts another page's codec", () => {
  const view = createHashRoute({ read: (hash) => readHash(hash)?.[0] ?? "overview", format: (tab) => formatHash([tab]) });
  view.replace("survivors and gear");
  expect(url.hash).toBe("#/survivors%20and%20gear");
  expect(view.value).toBe("survivors and gear");
});
