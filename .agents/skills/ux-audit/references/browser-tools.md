# Browser tools

Select tools by capability and follow the current runtime's tool instructions and the user's browser preference. Claude, Codex,
and other runtimes may expose different names for the same capabilities. Discover available tools rather than copying a tool name
from another provider. Missing one extension is not a blocker when an available tool can perform the required work.

## Capability check

Before the walkthrough, verify navigation, element inspection, real typing and clicking, screenshots, viewport control, and access
to console and network diagnostics. Confirm how to run the required accessibility and performance checks. Use snapshot or semantic
locators when available. Record unavailable capabilities; missing required evidence prevents a passing verdict.

For authenticated workflows, verify that the selected session has the intended account and permissions. A fresh browser may not share
the user's login. Use normal sign-in or an existing, authorized test session; do not add test-auth endpoints, mint accounts, or copy
credentials merely to make the audit runnable. Guidepost's current tools support guest use; do not invent an authentication requirement.
See [auth recovery](auth-expired-handling.md) if access changes during a workflow.

## Evidence and viewports

Use `temp/browser-verification/<audit>/` for reports, screenshots, traces, and diagnostics. Test narrow and wide layouts and record
the actual viewport. Honor a requested viewport rather than imposing a provider-specific limit.
Keep original screenshots as evidence. If a model's image limits require resizing, make a separate viewing copy or focused crop
without losing the original. Do not assume a fixed device-pixel ratio or an OS-specific image command.

## Optional provider guidance

- Claude: when a connected Chrome integration is available, inspect its current documentation and tab/session state. It may provide
  access to an already signed-in session, but verify that access. Use its supported screenshot and console operations.
- Playwright: when available and permitted by the runtime, use its browser or existing test session and semantic locators. Persistent
  profiles and saved authentication state require the same access and data handling care as any other browser session.
- Other browser integrations: use equivalent supported capabilities. Do not switch away from a working tool solely to match this reference.

Installation or sign-in is needed only when required capabilities or access are actually missing. Report the specific limitation and
continue independent checks when possible. Follow runtime rules for session cleanup and leaving user-owned tabs open.
