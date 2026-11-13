# ADR-018: Storefront Design-System Themes and Merchant-Controlled Appearance

## Status

**Accepted**

## Date

2026-11-13

## Context

The Landing Page Editor exposed a "Theme Controls" block with four options (Default, Light, Dark, Disabled) plus five colour palettes. These were all *colour* controls: no merchant could change the storefront's type, shapes, surfaces, buttons or layout. The storefront also showed the platform's light/dark toggle to every visitor regardless of merchant intent.

The storefront's current look (serif, square corners, hairline rules, framed 4:5 imagery) is distinctive and must remain available. Merchants need a choice of complete design systems, and appearance (light/dark) must be a separate decision.

## Decision

### 1. Two new fields on the existing `theme` object

`LandingPageTheme` gains:

- `designTheme?: "rustic-heritage" | "modern-minimal" | "luxury-editorial" | "bold-contemporary"`
- `appearanceToggle?: boolean`

They live inside the landing-page config JSON that is already persisted by the draft/publish lifecycle (`storefront_landing_pages.draft_config` / `published_config`). **No migration is required.** `presetId` stays the colour palette; `mode` becomes the merchant's *default appearance*.

A configuration without `designTheme` normalises to `rustic-heritage`, so every existing store keeps its current look. `appearanceToggle` defaults to `false`.

### 2. One registry, one resolver

`modules/stores/src/domain/design-themes.ts` is the single source of truth. Each theme defines display metadata, fonts, layout variants (header, product card, grid, collections) and about sixty `--ds-*` tokens (type, radii, borders, shadows, button treatment, imagery ratio, spacing, motion). `resolveDesignThemeTokens` turns a theme into inline CSS custom properties plus `data-design-theme` / `data-ds-*` attributes.

The storefront shell, the landing renderer and the editor's theme previews all call the same resolver, so a theme cannot look different in the editor than when published.

### 3. Rustic Heritage is the baseline, not a re-skin

Rustic Heritage is the existing Atelier rendering. The non-default themes are applied through rules scoped to `[data-ds-custom]`, which is set on every theme *except* Rustic Heritage, so the original rendering path is unchanged by construction. Shared primitives (`.ds-btn`, `.ds-media`, `.ds-badge`) read tokens whose fallbacks equal the original values.

### 4. Appearance is independent of the theme

- With the toggle **off** the merchant's `mode` decides appearance and no switch is rendered. The platform-wide toggle that used to appear for everyone is no longer shown on storefronts.
- With the toggle **on** the order is visitor choice (localStorage, per store), then the visitor's system preference, then the merchant default.
- Switching appearance re-expresses the palette (`applyAppearanceToTheme`); curated palettes swap to their other variant, a merchant's own brand colours (primary, secondary, button text) are kept. The design theme never changes.
- The editor preview always shows the merchant's configured default, never a visitor's choice.

### 5. Switching themes never touches content

`applyDesignThemeToTheme` only edits `theme`. Sections, elements, products, text and images live outside it. The palette moves to the new theme's recommendation only while it is still an untouched curated palette.

### 6. Fonts

All theme fonts are declared in `apps/web/src/lib/design-theme-fonts.ts`. Only Fraunces (the original storefront face) preloads; the others set `preload: false`, so a Rustic Heritage store does not download them.

## Consequences

- A non-default theme owns heading font, weight, button shape and radius for the landing sections. The editor's old per-element heading-font and button-shape controls keep working for Rustic Heritage and are overridden by the other themes.
- A visitor on a store with the toggle enabled may briefly see the merchant default before their saved choice applies (server render cannot read localStorage).
- Adding a theme means adding one registry entry (and a font if needed); the editor picks it up automatically.

## Related fixes made in the same change

See `docs/frontend/storefront-design-themes.md` for the root-cause notes on the image/CSP, Cash on Delivery, profile 401, invoice 404 and Razorpay 400 reports.
