# UI conventions

Preserve Guidepost's voice, atmosphere, domain language, visuals, and playful interactions. Thematic copy and interaction metaphors are intentional. Broader changes require an explicit redesign request.

## Landing page

[+page.svelte](../src/routes/+page.svelte) is the tool directory. Keep it lightweight, dark, and mobile-first. On mobile, the header sits above the navigation and aligns right. At the wide breakpoint, it stays fixed in the bottom-left and aligns left, with navigation on the right.

The window owns scrolling as the link list grows; do not add a navigation scrolling container. Preserve the full-bleed warm glow, pointer or device-orientation movement, flicker, slow pulse, and reduced-motion behavior unless a redesign changes them. This page may override the global stable scrollbar gutter for edge-to-edge backgrounds.

## Svelte

Use Svelte 5 runes and callback props.

For UI refactors, use the [UI refactor skill](../.agents/skills/ui-refactor/SKILL.md) to capture and compare working-tree behavior.

Use event shorthand when a local handler matches the attribute, including on `<svelte:window>` and `<svelte:document>`. Name handlers used by only one binding after that event. Keep explicit attributes for argument passing, event transformations, propagation control, or shared/imported handlers with meaningful names. Do not rename domain handlers to force shorthand. Move multiline inline handlers into `<script>`.

Use `$effect` only when external synchronization must rerun as reactive values change and cannot be expressed through declarative markup, derived values, or event handlers. Explain why reactive reruns are necessary in a preceding comment.

Use class arrays for conditional classes, such as `class={["item", active && "is-active"]}`. Avoid template strings and do not add `class:` directives.

## Browser support

Prefer native HTML, CSS, and Web APIs when they simplify code and preserve behavior. Before adopting a feature, verify support in current stable Chrome, Edge, Firefox, and Safari. Keep the existing implementation until all four support it; Chrome-only verification is insufficient. Recheck compatibility before adopting features such as dialog `closedby` or `scrollsnapchange`.

## Accessibility

Use semantic HTML; add ARIA only for names, descriptions, states, or relationships HTML cannot express. Prefer visible labels; use `aria-label` only without a suitable visible label and `aria-describedby` for supplemental information. Referenced IDs must be unique and present. Do not substitute `title` for an accessible name or description.

Hide non-focusable decorative icons and effects with `aria-hidden="true"`. Never hide focusable elements or their ancestors. Informative icons need a text equivalent.

## Styling

Keep interface copy useful and consistent with the site's character. Avoid decorative eyebrow labels and filler;
thematic language that supports the experience is not filler.

Keep surrounding content stable during loading and feedback. Reserve space or use overlays; label changes must not resize controls.
Verify idle, pending, and completed states at narrow and wide widths.

Never use all-uppercase text in interface designs. Use sentence case for headings, labels, buttons, and navigation; do not apply `text-transform: uppercase` or manually capitalize entire words for visual emphasis.

Use component-scoped `<style>` blocks for layout, spacing, typography, and interaction. Keep UnoCSS for icons; do not add Tailwind-style layout utilities, Tailwind, `clsx`, `tailwind-merge`, or `cn`. Migrate existing utility-heavy components incrementally when touched.

### Selectors and markup

- Use top-level, unqualified tag selectors when an element is unique or all instances share styling. Svelte provides scope; avoid root wrappers or qualified tags solely for scoping.
- Use short purpose-based classes when instances differ, styles span tags, or a stable hook is clearer. Use at most two classes per element where possible: a role plus a state, variant, or icon. Do not replace useful classes with positional selectors.
- Keep selectors shallow and low-specificity, usually with at most two classes; avoid mirroring markup or nesting type selectors.
- Use native nesting for the same subject's pseudo-elements, states, and variants, such as `&:hover` or `&.accent-primary`. Prefer one nesting level; a second is acceptable for a closely related variant state. Do not flatten or nest mechanically.
- Use modern pseudo-classes such as `:is()` and `:where()` and logical properties such as `inline-size`, `block-size`, and `margin-inline`.

### Declarations and responsive layout

Prefer modern CSS and native features. Add workarounds or optimizations only for verified support or profiling needs.

Use multiples of `0.125rem` for all `rem` values, including tokens, inline styles, and CSS math functions. Gradient stops and shadow values are exempt. When adjusting values, preserve dependent sizing and visible gradient bands.

Every declaration must affect a supported layout or state. Avoid repeating inherited fonts/colors, preflight resets, or sizing/alignment supplied by normal block/grid layout. Do not add `position`, `z-index`, `overflow`, `isolation`, `contain`, `will-change`, or `pointer-events` defensively; each needs a specific purpose. Preserve companion declarations required for that behavior.

Remove obsolete declarations and tokens when touching a rule. Verify base and wide layouts, interaction, and reduced motion before removing apparently redundant styles.

Write mobile-first styles with shared mobile/tablet defaults and occasional `min-width` overrides. Prefer normal flow and fluid values (`clamp()`, `min()`, `max()`) to spacing/type breakpoints. Avoid `max-width` and viewport-height queries unless needed for usability. Group a small component's overrides for one breakpoint in a top-level media query; keep capability queries, including reduced motion, separate.

### Tokens and theme

[src/app.css](../src/app.css) owns shared colors, type sizes, weights, line heights, borders, radii, and motion values; [uno.config.ts](../uno.config.ts) exposes the theme to UnoCSS. Declare each custom property once. Put component-specific layout values and complex effects on that component's root selector.

Use `var(--token)` for theme colors and semantic color utilities in existing utility markup. Prefer role aliases (`--accent`, `--primary`, `--destructive`) when appropriate, otherwise named palette tokens (`--background`, `--panel`, `--card`, `--foreground`, `--muted-foreground`, and `--accent-blue/green/red/purple`). Add missing tokens to the theme before using them. Read palette values from the source files.

Name tokens by purpose, with broad-to-specific grouping such as `--layer-content`, `--size-icon`, or `--duration-pulse`. Use variables for reused/tunable values. A one-use token needs a meaningful concept, local override, or clearer representation of a complex value. Remove unused/duplicate tokens without merging unrelated concepts. Structural values (`0`, `100%`, `auto`, grid ratios, media thresholds) may stay literal.

Use alpha hex (`#RRGGBBAA`) for fixed translucent colors. Reserve `color-mix()` for token-derived colors or blends; specify an interpolation space such as `in oklch` only when blending distinct colors benefits. Omit it for one-color/transparent mixes and gradients. Open Props may guide naming/scales; add the dependency only if a substantial portion is needed.

For UI color choices and simplification:

- Prefer existing palette shades for solid fills, borders, and text over ad hoc mixes with black, white, or neutral surfaces. Match the color roles and interaction colors of equivalent controls.
- Shared palettes run from `0` (lightest) to `10` (darkest), with a 20% OKLCH lightness floor. Read each family's values from [app.css](../src/app.css); matching shade numbers do not guarantee matching lightness. When inserting or renumbering shades, update every consumer and the palette lab while preserving existing colors.
- Keep entity colors identity-based. Use the existing `--identity-*` scale, where `--identity-5` is the original color. Generate shades `in oklch` with achromatic endpoints whose hue is `none`, and define the scale on the element owning `--identity` so inherited shades resolve correctly.
- Compare an alpha mix with the color rendered over its actual background, including any parent tint. Opacity percentages are not lightness percentages or shade numbers. Choose the closest usable shade by OKLab distance, checking text contrast and preserving visible hover, focus, selected, and disabled states.
- Retain transparency for gradients, shadows, glows, artwork overlays, and adaptive borders whose appearance depends on their backdrop. A shade replacement may approximate a flat surface; it cannot generally replace alpha over varying backgrounds.
- Share repeated fills, tints, and complex effects through purpose-based local tokens when they serve the same role. Keep unrelated roles and independently active status colors separate. Remove obsolete declarations rather than preserving unused styling.
- Verify that tokens resolve on every owner and variant, check combined status effects, and keep palette previews in sync with scale changes.

The reduced-motion query in [app.css](../src/app.css) disables shared durations; do not repeat these resets in components. Keep component reduced-motion rules for transforms, custom animations, gesture feedback, and other behavior the shared durations do not cover.

### Icons

Use Material Symbols through UnoCSS, for example `class="search-icon i-material-symbols:search"`. The icon preset in [uno.config.ts](../uno.config.ts) supplies `display: inline-block` and square dimensions from `--size-icon`, falling back to `1em`. Set `--size-icon` on the icon for a custom size instead of repeating display and dimension declarations. Use the shared `control-icon` and `external-icon` classes when their sizes fit. Keep local display overrides required by layout or visibility, and give icons an explicit text color on contrasting backgrounds. Follow the accessibility rules above.

Keep `--size-icon` overrides on icon elements so the value does not unintentionally reach nested icons. This convention applies to UnoCSS icons; `KdIcon` uses font sizing, and icon containers still need their own layout dimensions.

UnoCSS icons use CSS masks. Filters run before clipping and masking, so shadows and outer glows on the masked icon itself are clipped away. If an icon needs a shadow or outer glow, apply the filter to an unmasked, unclipped wrapper. Before retaining a decorative filter, toggle it on the rendered element against its actual background and verify the intended visible effect.

Safelist icon classes in [uno.config.ts](../uno.config.ts) when extraction is unreliable. Verify production CSS if an icon works only in development.

Edition model scales use [ModelScaleIcon](../src/lib/kdm/ui/ModelScaleIcon.svelte), with pale blue in collection rows.
`editionModelScales` in `kdm-data.ts` uses only `scale-tiny`, `scale-small`, `scale-medium`, `scale-large`, and `scale-painters` tags.
Millimeter sizes never establish scale. Multiple scales appear as adjacent rulers in ascending order, with a shared tooltip and
accessible description. Where an item separates `Painters` editions, its painter's tag applies only to those editions; other
scale tags apply to the remaining physical editions. Otherwise its painter's tag uses XL for physical releases. Missing tags,
mini, digital, and simulator releases have no icon. Compare colors and sizes at `/test/model-scale/`.
