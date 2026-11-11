# Access changes during an audit

Apply this only to authenticated workflows that actually exist. Guidepost's current tools support guest use.
A 401, 403, redirect, or empty view is evidence to investigate, not proof by itself that a session expired.

1. Pause the affected workflow and capture its action, response, screenshot, and any unsaved state.
2. Establish whether access changed, a permission check failed, or the response was expected for the test scenario.
3. Record any observed user impact, such as lost work or unclear recovery. Do not hide it by silently signing in again.
4. Restore access through an available, authorized sign-in or test-session workflow. Do not require Chrome, add a test-auth endpoint,
   or acquire another account merely to continue the audit.
5. Recheck the affected workflow after recovery, verifying account, permissions, and starting state. Retain and distinguish earlier evidence.

Continue independent checks when possible. If access cannot be restored, report the untested coverage and an incomplete verdict.
Use the main skill's completion gates and assess findings by demonstrated impact; do not assume every access failure means data loss.
