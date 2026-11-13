# Storefront design-system themes, and the checkout/image fixes shipped with them

Decision record: `docs/decisions/ADR-018-storefront-design-system-themes.md`.
Atelier foundation (the Rustic Heritage baseline): `docs/frontend/storefront-atelier.md`.

## Themes

| Theme | Type | Shape and surfaces | Buttons | Product presentation | Header / motion |
| --- | --- | --- | --- | --- | --- |
| **Rustic Heritage** (default, original look) | Fraunces serif headlines, sentence case | Square corners, 1px rules, no shadows | Square, uppercase, 0.14em tracking | Framed 4:5 images, uniform grid, list-style collections | Centred wordmark, 200 ms |
| **Modern Minimal** | Inter, 500 weight, tight tracking | 20px radii, almost no borders, soft tinted tiles | 12px radius, sentence case, medium | Square 1:1 images in soft tiles, card-style collections | Logo left, blurred translucent header, 260 ms |
| **Luxury Editorial** | Cormorant Garamond italic headlines + Jost body, wide-set caps | Square, hairline, no tiles | Thin outlined, 0.28em tracking, fills on hover | Tall 3:4 portrait images, centred captions, tile collections | Centred, letter-spaced caps wordmark, 420 ms |
| **Bold Contemporary** | Bricolage Grotesque 800, very tight | 2px outlines, 5px offset shadows, 20px radii | Chunky pills, outlined with offset shadow that lifts on hover | Outlined block cards, price chips, **asymmetric grid** (every fifth tile double-wide) | Logo left, heavy 2px header rule, 150 ms |

Each theme supplies about sixty tokens (`--ds-*`) and four layout variants. Tests assert that any two themes differ on at least five independent dimensions, so they cannot drift into recoloured copies.

## Configuration

`theme.designTheme` selects the theme; `theme.appearanceToggle` and `theme.mode` control appearance.

- **Editor:** Landing Page Editor, Theme tab. "Design theme" lists the four options with a miniature rendered from the theme's own tokens and a plain-language list of differences. "Appearance" holds the toggle and the default appearance (light or dark). The old Default / Light / Dark / Disabled selector is gone; the colour palettes remain a separate section.
- **Saving:** theme edits go through the editor's history (undo/redo) and the existing draft and publish routes. The new fields are validated by `LandingPageDraftValidator` and stored inside the config JSON, so no migration is needed.
- **Publishing:** the storefront reads `published_config` only. A draft that has moved on is never served until it is published (covered by `tests/stores/design-theme-persistence.test.ts`).
- **Appearance toggle:** off by default. When on, visitors get an accessible button (`aria-pressed`, label states the action) and their choice is stored in `localStorage` under `cc_<storeSlug>_appearance`; their system preference is used first.

## Fixes

### Images not showing, and the Content-Security-Policy error (Bugs A and B)

**Root cause (one cause, two symptoms).** Merchant uploads are served first-party (`/api/v1/stores/<id>/uploads/...`, covered by `'self'`). Images that are *linked* from another host were only allowed if that host was in a hard-coded list (Unsplash, Pexels, a placeholder `cdn.example.com`). A product pointing at any other host was blocked by `img-src` and the browser rendered only the `alt` text. Reproduced in a browser: the exact reported message appears for an unlisted host.

**Fix.**
- `STOREFRONT_IMAGE_ORIGINS` (comma separated) adds origins to both the CSP `img-src` and `next/image` `remotePatterns`. Only `https:` origins with a real host and an optional single leading `*.` label are accepted; `*`, `http:`, paths, `data:`/`blob:` and credentials are rejected with a warning. Nothing widens `img-src`.
- `StorefrontImage` shows the existing "No image" fallback when an image genuinely fails to load (blocked, 404), inside a container that owns the aspect ratio, so there is no layout shift. Applied to product cards, cart items and the product page main image. It never substitutes a generated or remote placeholder.
- Verified: an unlisted host is blocked (`securitypolicyviolation`), a configured host and its wildcard are not, and the policy is unchanged in development and production apart from the existing dev-only entries.

**Operational note.** Set `STOREFRONT_IMAGE_ORIGINS` to your image CDN or object-store origin(s). Local-disk uploads on ephemeral hosting disappear on redeploy; that needs a persistent storage backend and is outside this change.

### Cash on Delivery: "Cannot transition checkout from status 'OPEN' to 'COMPLETED'" (Bug C)

**Root cause.** The checkout state machine allows only `OPEN → PAYMENT_PENDING → COMPLETED`. The Razorpay path moves the checkout to `PAYMENT_PENDING` in `PaymentCheckoutCoordinator`. The zero-payment and COD workflows in `PaymentOrderIntegration` called `completeCheckout` on a checkout that was still `OPEN`.

**Fix.** Both workflows now call the domain's own `beginPayment()` (via `CheckoutService`) before `completeCheckout`. No transition was added or relaxed; `OPEN → COMPLETED` is still rejected (tested). COD still creates the order `CONFIRMED` with payment `PENDING` and a `COD` payment row with nothing captured, transfers the inventory reservation to the order, and is idempotent (a second submission returns the same order).

### Customer profile 401 (Bug D)

**Root cause.** `GET .../account/profile` is correctly protected. The **checkout page called it for every visitor** to prefill saved addresses, so each guest checkout produced a genuine 401. The session pipeline itself is sound (cookie `sc_<slug>_session`, expiry, revocation, store isolation all verified).

**Fix.** The checkout page now uses the existing guest-safe `GET .../auth/me`, which answers 200 with `customer: null` for guests and includes addresses for signed-in customers. The profile endpoint remains protected; expired, revoked and cross-store sessions are rejected (`tests/storefront/customer-profile-session.test.ts`).

### Invoice 404 (Bug E)

**Finding.** The route exists and supports `?format=json`. The 404 is the designed answer when there is no invoice to give: the order is unpaid (including a COD order not yet collected), or the store has no tax configuration, or the caller does not own the order (deliberately indistinguishable from "not found" so order IDs cannot be probed). Reproduced on a real COD order: `404 INVOICE_NOT_AVAILABLE`. The frontend already requests invoices only for paid orders and hides the link on failure. **No code change was needed**; existing coverage is in `tests/tax/tax.api.test.ts`. A COD order gets an invoice once the merchant records cash collection and the order is PAID, if the store has tax enabled.

### Razorpay payment request returns 400 (Bug F)

**Finding.** With the project's Razorpay test keys, payment initialisation succeeds and creates a real gateway order, with amount, currency, key and order id all server-supplied. The browser checkout consumes those server values only. The gap: a gateway rejection (for example unsupported currency or an amount below the gateway minimum) was not mapped by `handleApiError`, so it surfaced as a generic `500 An unexpected error occurred`, hiding the real reason.

**Fix.** `mapRazorpayError` maps gateway failures to safe responses: a rejected request becomes `400 PAYMENT_PROVIDER_REJECTED` with the gateway's own plain-text description (sanitised and bounded); bad credentials become `502 PAYMENT_GATEWAY_NOT_CONFIGURED` with no detail; rate limit, timeout and outage map to 429, 504 and 502. Secrets, signatures and raw provider payloads are never returned. Signature verification, webhooks and recovery are untouched.

**Not reproducible here.** I could not reproduce the reported 400 itself because it depends on the reporting environment's Razorpay account (for example whether the store currency is enabled on that account) and its checkout state. With this change the response now states the actual reason.

## Remaining limitations

- Hydration may briefly show the merchant default before a visitor's saved appearance applies.
- A non-default theme overrides the merchant's per-section button shape and heading font.
- Linked images need their origin allow-listed; there is no automatic discovery.
- Browser verification covered the storefront products page under three themes, the appearance toggle, and CSP behaviour. The merchant editor page itself was not opened (it requires a merchant login); its selector is covered by render tests only.
