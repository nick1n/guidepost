# Effect conventions

Use Effect v4. Before changing Effect code, read all of `node_modules/effect/AGENTS.md` and relevant linked references. Inspect installed source and types for uncovered behavior. If guidance is unavailable, report it and consult version-matched official documentation; do not upgrade Effect to obtain guidance.

Use Effect `HttpClient` for new application HTTP requests and asset downloads, including small browser loaders. Use the installed
`effect/http` exports with `FetchHttpClient.layer`, validate JSON with Schema, and map transport, status, and decoding failures to
feature-owned errors. Inject HTTP services or `FetchHttpClient.Fetch` in tests instead of replacing global `fetch`. In SvelteKit load
functions, inject the provided `event.fetch` through `FetchHttpClient.Fetch` to preserve framework behavior.

Use feature-owned `Schema.TaggedError` classes and unions at action boundaries. Use named `Effect.fn` for significant effectful operations, preserving deferred execution and instance binding. Keep pure helpers and UI callbacks ordinary functions. Library guidance does not override the [collection architecture](kdm-architecture.md) and [UI conventions](ui-conventions.md).

Implement asynchronous application storage and lifecycle workflows in Effect, including settings resets, database deletion,
session shutdown, and reload sequencing. Keep Promise and callback APIs inside adapters using `Effect.tryPromise` or
`Effect.callback`, with feature-owned typed errors and callback cleanup. UI handlers compose and run Effects through the
existing action boundary; do not orchestrate these workflows with `async`/`await`, `Promise.all`, or local `try`/`catch`.
Before finishing, review new asynchronous paths for this boundary and test deferred execution, failure, and interruption
where they affect persistence or resource cleanup.

At action boundaries, inspect the full cause before extracting typed errors. Any interruption remains interrupted and produces no failure notification, including mixed causes. Log the full cause for defects. Keep simple operations direct; generators should express sequencing.
