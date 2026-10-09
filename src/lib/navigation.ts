import { goto } from "$app/navigation";
import { Effect, Schema } from "effect";

export class NavigationError extends Schema.TaggedError<NavigationError>()("NavigationError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

export const navigate = Effect.fn("Navigation.navigate")((href: string, message = "The page could not be opened. Please try again.") => {
  return Effect.tryPromise({
    try: () => goto(href),
    catch: (cause) => new NavigationError({ message, cause }),
  });
});
