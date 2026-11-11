# Documented exceptions

The [completion gates](../SKILL.md#completion-gates) define permitted exclusions. Read the repository's documented warnings and any
explicit user-provided audit configuration before excluding a result. Do not require a particular config filename or create a new
allowlist merely to obtain a passing verdict.

For every exclusion, retain the original diagnostic, its count, the documented reason, and the source of that exception. Deliberately
exercised error responses must be tied to their test scenario. Show raw and excluded counts separately in the report.

An unfamiliar warning, long-standing error, flaky request, or uninvestigated third-party message is not automatically harmless.
Do not permit an arbitrary number of unidentified warnings per surface. An unrelated documented build warning does not excuse a
browser runtime error. If an existing exception no longer matches the observed behavior, report it for review.

Use an existing project configuration when one is documented, interpreting only supported fields. Do not invent config inheritance,
page-skipping rules, or relaxed thresholds. Any user-requested limited audit must state its scope and cannot establish a full audit pass.
