---
name: vitest
description: Add or maintain Guidepost tests and Vitest configuration. Use for new tests, test failures, mocking, coverage, or test infrastructure changes.
license: MIT
---

# Vitest

Use the existing configuration and scripts. Read `package.json` and `vite.config.ts` before changing setup; do not scaffold another test runner or install unrelated framework libraries.

## Choose the test boundary

- Client-facing application tests belong in `test/client/`.
- Build and catalog tests belong in `test/scripts/`; import tooling through `#scripts/*`.
- Browser suites are `.test.mts` files in `test/browser/`, with shared support and fixtures there. See [browser tests](../../../docs/development.md#browser-tests).

Follow nearby tests and exercise observable behavior through public interfaces. Preserve regression coverage when refactoring.
Add coverage for the changed behavior, not assertions that repeat the implementation.

## Effect and persistence

Use the [Effect skill](../effect/SKILL.md), [Effect conventions](../../../docs/effect-conventions.md), and installed package guidance.
Use Vitest 5 and the version-aligned `@effect/vitest` adapter. Prefer `it.effect`, injected services, `Deferred`, and `TestClock`.
Inject HTTP services or `FetchHttpClient.Fetch` instead of replacing global `fetch`.
For persistence changes, exercise deferred execution, failure, interruption, and owner isolation where affected.

## Run

Run a focused suite while developing. Before finishing, follow [required checks](../../../AGENTS.md#required-checks):
`pnpm test:run` runs Vitest once; `pnpm test:scripts` also runs the Node script checks; `pnpm test:catalog` aliases it.
`pnpm test` is watch mode.
