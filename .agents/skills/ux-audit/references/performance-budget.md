# Performance budget

A full UX audit requires representative performance measurements. The [completion gates](../SKILL.md#completion-gates) define
thresholds and verdict rules; use those as the single source of truth.

## Measurement procedure

1. Choose a representative in-scope route and record the app build, browser, viewport, device or CPU conditions, and network throttling.
2. Use browser performance tooling or an available metrics library that supports LCP, CLS, and INP. Set up collection before the workflow.
3. Load the route and perform real interactions. Capture the reported metrics and supporting trace or report under `temp/browser-verification/`.
4. Compare each measurement with the completion gates. Expand to other primary routes when a budget fails.
5. Record unsupported APIs, missing samples, and tool limits. An unavailable measurement leaves the audit incomplete.

Do not label the maximum raw Event Timing duration as INP or a simple sum of every layout shift as CLS. Use metric-aware tooling;
raw entries can help diagnose a failure but do not establish compliance. A zero default before any sample is not a measurement.
Record interaction coverage so a quiet initial page cannot stand in for a tested workflow.

## Report

For each metric, include its value and unit, route, measurement conditions, evidence path, and pass/fail/unmeasured status.
Unthrottled results must be labeled; do not infer field performance from a local sample. These checks describe the tested session,
not real-user percentile performance across devices.

If a metric fails, inspect the trace for the affected loading, layout, or interaction work. Re-measure after fixes under the same conditions.
