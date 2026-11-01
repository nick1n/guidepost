import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Flag } from "effect/cli";
import { optionalString, offline, fetch, offlineMode, runCommand, workflow } from "../cli.mts";
import { prepareUpdate, summarizeReview } from "../review/prepare.mts";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make(
      "catalog:update",
      {
        catalog: optionalString("catalog"),
        news: optionalString("news"),
        cache: optionalString("cache"),
        "news-cache": optionalString("news-cache"),
        "refresh-posts": Flag.Boolean("refresh-posts").pipe(Flag.withDefault(false)),
        offline,
        fetch,
      },
      (values) =>
        workflow(async (signal) => {
          const result = await prepareUpdate({
            ...values,
            newsCache: values["news-cache"],
            refreshPosts: values["refresh-posts"],
            fetch: !offlineMode(values),
            signal,
          });
          console.log(`${result.announcements} unimported announcements. ${summarizeReview(result.review)}`);
          console.log(`Review: ${result.path}`);
          console.log(
            result.review.unresolved.length
              ? "Resolve mappings and tags, then rerun catalog:update using saved evidence."
              : "Review the changes, then run pnpm catalog:apply.",
          );
        }),
    ).pipe(Command.withDescription("Monthly news and product update. Stages a review; --fetch refreshes news and the shop snapshot.")),
  );
}
