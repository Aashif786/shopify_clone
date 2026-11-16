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

## Theme scope and phone layout (shared rules)

All of this lives in the "Theme scope" and "Phone layout" blocks of `apps/web/app/globals.css`. Use it instead of solving the same thing per page.

**One palette per storefront.**
- A store's appearance is always concrete. `useStorefrontAppearance` resolves a legacy `mode: "default"` (or a missing mode) to the design theme's default appearance; it never inherits the platform's `html.dark` / `html.light`, which a shopper does not control.
- `.storefront-layout.light` / `.dark` re-declare the full platform palette for that appearance, then the inline merchant tokens override the base colours. Aliases such as `--color-surface` and `--color-text` are re-declared in that scope on purpose: an alias declared only on `:root` keeps the platform value.
- Tailwind `dark:` follows the storefront scope, so it is safe inside storefront components.
- Status colours: `text-tone-success`, `bg-tone-warning/10`, `border-tone-info/30`, `text-tone-danger`. Do not use `emerald-*`, `amber-*` or other fixed palette classes.
- Corners: `rounded-[var(--ds-radius-card,0)]`, `--ds-radius-btn`, `--ds-radius-input`. Do not use `rounded-xl` and friends.
- The layout resolves the published name and theme on the server (`loadPublishedIdentity`), so the first paint already has the merchant palette. Read the name from `useStorefrontIdentity` rather than a "Online Store" placeholder.

**Surfaces.**
- `.card` is transparent on the storefront (outlined, not filled). A floating panel (drawer, modal, dropdown) must not use `.card`; give it `bg-background text-foreground`.
- Card padding comes from utilities (`p-6 sm:p-8`, `p-0`); the kit's own `.card__content` padding is handed back to the utilities layer with `revert-layer`. Auth cards (`.at-auth`) keep the kit padding.
- Every overlay uses the same scrim, `bg-black/60 backdrop-blur-sm`, at `z-[60]`. Size dialogs with `dvh`, not `vh`.

**Phones.**
- Gutter is `--at-gutter` everywhere (`at-container`, or `.storefront-main` for non-full-bleed pages). Do not add page-level horizontal padding on top.
- Inputs are 16px below 768px (anything smaller makes iOS zoom the page on focus) and controls are at least 44px tall.
- A leading icon inside a kit `Input` needs inline `style={{ paddingLeft }}`: the kit's unlayered `.input` padding beats `pl-*`.
- `.ds-btn` and `.btn` share the theme's button type; small `.btn-sm` stays compact. Labels wrap on phones, so never rely on `whitespace-nowrap` to fit a row.
- `.checkout-actions-row` stacks (primary first, full width). Product grids are two columns on phones. Utility page titles use `at-display-lg`; only catalogue and editorial mastheads use `at-display-xl`.

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
