import { beforeEach, vi } from "vitest";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { navigate, NavigationError } from "#lib/navigation.ts";

const goto = vi.hoisted(() => vi.fn());
vi.mock("$app/navigation", () => ({ goto }));
beforeEach(() => goto.mockReset().mockResolvedValue(undefined));

it.effect("defers navigation and forwards SvelteKit options", () =>
  Effect.gen(function* () {
    const options = { shallow: true, replace: true, state: { siteMenu: true } };
    const operation = navigate("/kdm/hunt/#/42", "Link failed", options);
    expect(goto).not.toHaveBeenCalled();
    yield* operation;
    expect(goto).toHaveBeenCalledWith("/kdm/hunt/#/42", options);
  }),
);

it.effect("maps a rejected navigation to a typed error", () =>
  Effect.gen(function* () {
    const cause = new Error("unavailable");
    goto.mockRejectedValueOnce(cause);
    const error = yield* Effect.flip(navigate("/kdm/hunt/#/42", "Link failed"));
    expect(error).toBeInstanceOf(NavigationError);
    expect(error.message).toBe("Link failed");
    expect(error.cause).toBe(cause);
  }),
);

it.effect("also maps synchronous adapter failures", () =>
  Effect.gen(function* () {
    const cause = new Error("unavailable");
    goto.mockImplementationOnce(() => {
      throw cause;
    });
    const error = yield* Effect.flip(navigate("/kdm/hunt/#/42"));
    expect(error.cause).toBe(cause);
  }),
);
