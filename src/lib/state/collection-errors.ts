import { Schema } from "effect";

export class CollectionError extends Schema.TaggedError<CollectionError>()("CollectionError", {
  message: Schema.String,
  operation: Schema.Literals(["load", "save", "clear"]),
  itemIds: Schema.Array(Schema.String),
  cause: Schema.Defect(),
}) {}
