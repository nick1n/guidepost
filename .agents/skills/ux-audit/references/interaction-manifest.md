# Interaction manifest

The manifest records what was actually exercised. Keep it under `temp/browser-verification/<audit>/` and update it during the walkthrough.
The [completion gates](../SKILL.md#completion-gates) determine the verdict.

## Coverage

Start with an inventory of in-scope workflows and controls. For each, record the route, viewport, starting state, action, expected
result, observed result, and evidence paths. Mark untested controls explicitly. A page without a form does not need an invented submit
action; completeness means testing its actual controls, not reaching a fixed number of entries or spending a minimum time.

Exercise real typing, selection, clicking, opening, dismissal, and keyboard navigation wherever those controls exist. Capture before
and after states for primary actions, inspect console and network results, and verify the resulting state. Include loading, feedback,
error recovery, persistence, reduced motion, and narrow/wide layouts where applicable. Screenshots and DOM reads alone do not prove
an interaction worked. Never submit messages, payments, or other external mutations without authorization.

## Entry format

| Field            | Record                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Workflow/control | Stable label from the inventory                                     |
| Context          | Route, viewport, relevant test data and starting state              |
| Action           | Actual input, click, key, navigation, or reload                     |
| Outcome          | Expected and observed state, including pending or error feedback    |
| Diagnostics      | Console and network results, with evidence for permitted exclusions |
| Evidence         | Screenshot, trace, assertion, or log paths                          |
| Status           | Passed, failed, untested, or not applicable with reason             |

Use timestamps to correlate evidence, not to fabricate a minimum duration. Record raw diagnostics and exclusions separately.
For collection changes, verify recorded ownership or coverage as appropriate, then navigate away and back or reload when persistence
is part of the workflow. Use isolated test data for destructive cases.

## Failure and completion

Capture a failure before changing the state. Repeat safely when possible, vary one relevant input if needed, and record reproducibility.
Inspect source only to help locate the cause; source inspection does not replace the browser evidence. Continue other in-scope checks.

Summarize covered and untested workflows against the original inventory. Do not treat a fixed entry count, fast tool calls, or a long
session as proof of completeness. Missing required interactions or diagnostics make the audit incomplete even if observed checks passed.
