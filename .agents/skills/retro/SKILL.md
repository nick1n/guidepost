---
name: retro
description: Review a coding session and propose evidence-backed improvements to project guidance, tools, checks, or review practices.
disable-model-invocation: true
---

# Retrospective

Review the session the user names, or the current session by default. Read its decisions, changes, failures, and verification results,
alongside the repository's `AGENTS.md`. Distinguish observed problems from assumptions about what happened.

## What to look for

- Navigation: missing entry points, misleading names, or guidance that was difficult to find.
- Instructions: contradictions, repeated rules, stale examples, or rules that did not affect decisions.
- Checks: failures an existing check should have caught, or recurring mistakes that justify a targeted automated check.
- Tools and access: avoidable tool overhead or missing capabilities that materially blocked the work.
- Review: defects that survived verification and whether independent review would have helped.

Propose improvements in priority order. For each, give the session evidence, the smallest useful change, where it belongs, and how it
would prevent recurrence. Do not add rules, dependencies, hooks, or CI jobs simply because they are available. A retrospective proposes
changes unless the user also asks to apply them.

## Responsibility and independent review

The implementing agent follows project standards and verifies its changes. When an independent reviewer is used, it checks those
standards too and reads enough surrounding code and contracts to assess the diff. A diff alone may omit important context.

Recommend independent review when risk, complexity, or observed failures justify it. Do not assume every task has separate agents,
and do not delegate without authorization. Independent review supplements the implementer's responsibility; it does not replace it.

## Where improvements belong

Use the repository's existing guidance: `AGENTS.md` for essential rules and navigation, topic docs for contracts and decisions, and
skills for reusable workflows. Follow any applicable `CLAUDE.md` when present. Do not assume a separate coding-standards file exists
or create one by default. Prefer updating the existing home over adding another source of instructions.
