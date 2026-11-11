# UX audit report

Write incrementally to `temp/browser-verification/<audit>/report.md`, keeping evidence in the same audit directory.
Use the [completion gates](../SKILL.md#completion-gates) as the sole verdict criteria. The template adds no time, entry-count,
provider, reviewer, or performance requirements of its own.

```markdown
# UX audit: [scope]

Verdict: [Pass / Conditional pass / Fail / Incomplete]

[Main finding and limits of the tested scope.]

## Environment and coverage

- Build and URL:
- Browser and automation tool:
- Viewports and measurement conditions:
- User perspective and test data:
- Workflows and controls tested:
- Untested or inapplicable scenarios, with reasons:
- Interaction manifest:

## Completion checks

| Gate from SKILL.md | Result                         | Evidence or limitation |
| ------------------ | ------------------------------ | ---------------------- |
| [Gate]             | [Passed / Failed / Unmeasured] | [Path and explanation] |

Include console/network raw and excluded counts, reasons for exclusions, axe results for every audited page,
and representative LCP, CLS, and INP values with units and measurement conditions.

## Findings

### [Finding title]

- Impact and priority:
- Reproduction steps:
- Expected and observed behavior:
- Evidence:
- Suspected source location, if established:
- Suggested correction:

## Reverification

[Fixes rechecked, their evidence, and findings still open or unverified.]
```

Rank findings by impact and explain priorities. Merge duplicate root causes while listing affected surfaces. Do not pad the report
to a fixed number of findings or invent a source location. Independent review may help, but is not a condition of audit completion.
