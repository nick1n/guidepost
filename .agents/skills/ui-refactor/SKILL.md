---
name: ui-refactor
description: Capture and compare Guidepost UI behavior before and after UI-affecting refactors. Use for component, styling, or interaction refactors; not documentation-only changes.
---

# UI refactor

Read [UI conventions](../../../docs/ui-conventions.md) and the two required Svelte skills before editing components.

1. Inspect the working tree. Capture current screenshots and behavior, including uncommitted changes, at narrow and wide widths.
2. Identify the affected controls and states. Include idle, pending, completed, keyboard focus, and reduced motion where relevant.
3. Make the requested change, preserving other copy, controls, styling, and interactions.
4. Repeat the same scenarios and compare against the captured baseline. Restore regressions from that baseline, not an older commit or memory.
5. Run the required checks in [AGENTS.md](../../../AGENTS.md). For icon or integration changes, inspect production CSS and assets.

Keep captures under `temp/browser-verification/`. If browser access is unavailable, report that limitation and do not claim visual verification.
