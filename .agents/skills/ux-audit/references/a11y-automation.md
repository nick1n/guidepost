# Accessibility checks

Run axe on every audited page, alongside manual keyboard and focus checks. Neither replaces the other, and neither proves complete
accessibility compliance. The [completion gates](../SKILL.md#completion-gates) define required results.

## Procedure

1. Use the available browser integration or existing test tooling to run axe in the page. Prefer an available local installation;
   follow runtime network rules if loading the library is necessary. Do not require a particular provider or a CDN script injection.
2. Record the axe version, route, viewport, and tested state. Include opened dialogs and other materially different states.
3. Save violations with rule IDs, impact, affected elements, and help text. Report incomplete or manual-review results separately.
4. Test keyboard reachability, meaningful focus order, visible focus, activation, dismissal, focus trapping and restoration where relevant.
5. Recheck affected states after fixes. Preserve the original findings and verification evidence.

If the browser cannot execute axe, record that check as unavailable and the audit as incomplete. Do not skip keyboard testing to save time.
Do not exclude a user-facing page or violation simply because its design is intentional. Follow [documented exception rules](audit-config.md).

For a finding, include reproduction steps, affected element and state, impact, evidence path, and suspected source location if known.
Choose changes using the project's UI conventions and verify the result against its actual background and interaction states.
