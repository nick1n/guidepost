---
name: ux-audit
description: Audit a live Guidepost UI through real interaction, with reproducible usability, accessibility, and performance findings. Use for a UX audit, walkthrough, QA sweep, or dogfooding; not a documentation or static code review.
---

# UX audit

An audit needs actual interaction. Static code or DOM inspection alone cannot establish that a workflow works.
Preserve Guidepost's thematic copy, visual character, and interaction metaphors; follow [UI conventions](../../../docs/ui-conventions.md).

## Scope and evidence

Use the user's requested pages and scenarios. Otherwise, cover the available tools as a collector or player, including a first visit.
Use the [browser capability guide](references/browser-tools.md) and follow the current runtime instructions. Claude-specific integrations are optional; no particular provider or extension is required.
Use a local build for unpublished changes. Reuse the [browser suites](../../../docs/development.md#browser-tests) where they exercise the requested behavior.

Record each tested workflow, viewport, actions, observed result, console/network diagnostics, and evidence path under `temp/browser-verification/`.
Keep personal collection data intact. Use isolated test data for destructive flows; never send messages, publish, or modify unrelated records as part of an audit.
If required access is missing, report what could and could not be tested.

## Walkthrough

1. Inventory the in-scope routes, controls, and complete user workflows.
2. Exercise the controls, including typing, clicking, keyboard navigation, dismissal, and recovery from errors. Verify outcomes after navigation or reload where persistence matters.
3. Compare narrow and wide layouts, loading and feedback states, focus, reduced motion, and combinations of active controls.
4. Capture console and network diagnostics on every audited page. Run axe on every audited page, alongside manual keyboard and focus checks.
5. Measure LCP, CLS, and interaction latency on a representative route after real interactions. Record the build, viewport, throttling, tool, and measurement limits. Expand to other primary routes if a budget fails.

Read the workflow, interaction manifest, accessibility, and performance references before the audit. Read scenario and stress references
for applicable workflows; record why a scenario does not apply rather than silently skipping it.

- [Workflow checklist](references/walkthrough-checklist.md) and [round trips](references/round-trip-workflows.md).
- [Interaction manifest](references/interaction-manifest.md) for recording coverage.
- [Accessibility](references/a11y-automation.md) and [performance](references/performance-budget.md) for measurement techniques.
- [Scenario tests](references/scenario-tests.md), [stress recipes](references/stress-test-recipes.md), and [multiple panes](references/multi-pane-stress.md) when those scenarios exist.

These references contain cross-project examples. Adapt paths and tools to this repository; do not introduce authentication, servers, fixtures,
or product features solely to satisfy an example. Project instructions and explicit task scope take precedence over generic checklists.

## Report and verify

Use the [report template](references/report-template.md). For each finding, include impact, reproduction steps, expected and actual behavior, evidence, and suspected source location when known.
Separate measured failures from untested risks. Keep an interaction manifest covering every in-scope workflow and control, with actual actions,
observed outcomes, diagnostics, and screenshots at narrow and wide widths. Check loading, feedback, keyboard, reduced-motion, recovery,
and persistence states where applicable. A screenshot-only sweep is incomplete.

### Completion gates

| Check                      | Required result                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| Interaction manifest       | Every in-scope workflow and control exercised, with evidence       |
| Console                    | No unexplained errors or warnings                                  |
| Network                    | No unexpected 5xx or broken required requests                      |
| Layout                     | No collapse or unusable controls at tested widths and combinations |
| Accessibility              | Zero axe Critical or Serious violations on every audited page      |
| Representative performance | LCP below 4 seconds, CLS below 0.25, INP below 500 milliseconds    |

Only documented project exceptions and deliberately exercised error responses may be excluded. Record each exclusion, its reason,
and raw versus excluded counts. Do not invent an allowlist to obtain a passing verdict.
Use a measurement tool that supports the reported metric. Missing samples or unsupported APIs are unmeasured, not zero;
an event-duration proxy alone does not establish INP compliance.

Use **Pass** only with complete evidence, every gate green, and no remaining findings. Use **Conditional pass** only with all gates green
and non-blocking findings. Any failed gate or blocking finding means **Fail**. Missing required checks or evidence means **Incomplete**;
still report any observed failures. Unavailable axe, browser access, or performance measurements cannot produce a passing audit.
State the tested scope with the verdict. A user-requested limited check must be labeled as such and cannot establish a full audit pass.

If fixes are requested, re-run affected workflows and required project checks. Keep unverified findings open.
