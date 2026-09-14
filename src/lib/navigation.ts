import { goto } from "$app/navigation";
import { Data, Effect } from "effect";

export class NavigationError extends Data.TaggedError("NavigationError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export function navigate(href: string, message = "The page could not be opened. Please try again.") {
  return Effect.tryPromise({
    try: () => goto(href),
    catch: (cause) => new NavigationError({ message, cause }),
  });
}
