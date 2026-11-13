# Storefront "Atelier" design language

Applies to every route under `apps/web/app/stores/[storeSlug]/`. It is a **composition, type and motion language**, not a palette: colour always comes from the merchant theme.

## Principles

- **Editorial, type-led.** Hierarchy comes from scale, weight and whitespace, not from boxes. Prefer hairline rules and negative space to cards; use a card only when elevation carries meaning.
- **Merchant branding wins.** Never hard-code colour in storefront components. Use the semantic tokens `resolveThemeSemanticTokens` writes on `.storefront-layout` (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, ...). The heading font follows `theme.typography.headingFont`; with no choice (or `serif`) the display face is the Atelier serif (Fraunces).
- **Calm motion.** 150-300 ms, `cubic-bezier(0.23, 1, 0.32, 1)` ease-out, `transform` and `opacity` only. Nothing loops except skeleton shimmer. Everything honours `prefers-reduced-motion`. Success states appear only after the server confirms.
- **Honest content.** No invented guarantees, ratings or promotions. Footer and shell state only true platform facts (payments are processed by Razorpay).

## Foundation (Phase 2)

| Piece | Location |
| --- | --- |
| Tokens, type scale, utilities (`at-*`) | `apps/web/app/globals.css`, "Atelier" block |
| Display serif font (scoped to the storefront) | `app/stores/[storeSlug]/layout.tsx` (`--font-atelier-serif`) |
| Merchant identity for every route | `StorefrontProviders` -> `useOptionalStorefrontIdentity()` |
| Shell: wordmark header, announcement, footer | `StorefrontShell.tsx`, `shell/` |
| Index menu (mobile/tablet nav) | `shell/index-menu.tsx` (Base UI Dialog, portalled into the shell root) |
| Loading, error, not-found | `loading.tsx`, `error.tsx`, `not-found.tsx` in `[storeSlug]` |

Utilities: `at-container`, `at-rule`, `at-display-xl|lg|md`, `at-title`, `at-lede`, `at-eyebrow`, `at-num`, `at-link` (animated underline), `at-press` (tactile `:active`), `at-pop`, `at-rise` (stagger via `--i`, 40 ms steps), `at-skeleton`.

## Rules that bit us (read before adding storefront CSS)

1. **Unlayered CSS beats Tailwind utilities.** Tailwind v4 utilities live in a cascade layer, so any unlayered rule (including bare `a {}` or a legacy `.foo {}` class) overrides them regardless of specificity. The global anchor colour is therefore scoped away from `.storefront-layout`. Do not reintroduce unlayered element or `.storefront-*` rules that set `color`, `display`, `position` or `z-index`.
2. **Keep display utilities out of shared class strings.** `inline-flex` beats `hidden` in the generated CSS order. Put `inline-flex` next to the element, and pair `hidden` with the responsive `sm:inline-flex`.
3. **Test contracts.** Tests assert `data-testid="storefront-cart-button"`, `class="storefront-cart-count" aria-hidden="true"`, `class="storefront-brand-name"` (exact), `role="banner" | "main" | "contentinfo"`, and `role="region" aria-label="Announcement"`. The new `tests/ui/storefront-shell-atelier.test.tsx` covers the rest.
4. **Portals lose theme variables.** Anything portalled to `<body>` does not inherit the shell root's merchant tokens. Pass the shell root as the portal `container` (see `IndexMenu`).
5. **Layering.** The sticky header is `z-40`, overlays are `z-60`. Do not add arbitrary z-indexes.

## Phase 3: shopping and discovery

| Surface | Treatment |
| --- | --- |
| Product card | 4:5 frame, no card chrome; serif title with animated underline, tabular price, status as a dot + label; quick-add bar slides up on hover/focus (always visible on touch) |
| Product grid | Hairline-free grid, skeleton frames in the same ratio, typographic empty/error states |
| Catalogue | Oversized "All products" masthead, text-tab quick filters (underline = active), square hairline filter controls |
| Collections | Numbered index list (no media in data), title slides on hover |
| Product detail | Gallery left, plain (card-less) purchase column right; square primary CTA |
| Home fallback | Store name as cover headline + lead product; numbered sections; no invented copy or testimonials |

Pages in this phase pass `fullBleed` to the shell and own their container with `at-container` (the legacy `.storefront-main` padding would double the gutter).

## Known follow-ups

- `StorefrontShell` is still mounted per page, so the header re-mounts on navigation. Moving it into the layout needs the per-page `storeName`/`theme`/`announcement` props lifted first.
- `CartDrawer` still uses the old visual language (Phase 4).
- Pages that pass a loading fallback store name ("Online Store") should read `useOptionalStorefrontIdentity()` instead (Phase 3).
