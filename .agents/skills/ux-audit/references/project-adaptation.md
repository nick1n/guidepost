# Project adaptation

Guidepost's runtime and directory conventions apply regardless of which assistant performs the audit.

- Read [development](../../../../docs/development.md) for local URLs, production preview, browser suites, and evidence conventions.
- Honor the requested URL. Use a local build for unpublished changes and verify the actual server address and configured base path.
- Keep evidence and reports in `temp/browser-verification/<audit>/`; do not create provider-specific artifact directories.
- Default to a collector or player's perspective, including a first visit. Record the perspective in the report rather than requiring persona files.
- Use [available browser capabilities](browser-tools.md). A provider's optional integration is not a requirement for another provider.
- Current collection state is local and supports guest use. Use isolated test data and preserve personal collection records.
- Follow [documented exceptions](audit-config.md) and the main skill's completion gates. Do not introduce test-auth services,
  new product features, or alternative test infrastructure to satisfy cross-project examples.

Supporting scenario references contain examples from other apps. Apply the behavior being tested only where it exists in Guidepost;
mark irrelevant roles, authentication, chat, or multi-pane flows as not applicable with a reason. Do not silently skip applicable controls.
