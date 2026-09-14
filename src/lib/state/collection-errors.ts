import { Data } from "effect";

export class CollectionError extends Data.TaggedError("CollectionError")<{
  readonly message: string;
  readonly operation: "load" | "save" | "clear";
  readonly itemIds: readonly string[];
  readonly cause: unknown;
}> {}
