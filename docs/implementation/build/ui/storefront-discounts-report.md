# Implementation Report: Storefront Discount & Coupon Redemption

**Milestone:** Cart and Checkout Discount UI  
**Commit Target:** `feat(ui): implement storefront discount redemption`  
**Status:** PASS  

---

## 1. Executive Summary

This milestone delivers an end-to-end, server-authoritative storefront discount and coupon redemption experience across the cart page, cart drawer, and multi-step checkout workflow in the Cal Cart platform.

Customers can apply, inspect, and remove discount codes. The system guarantees:
1. **Server-authoritative calculation**: All discount eligibility rules, deduction amounts, and final totals are evaluated and recalculated strictly on the server (PostgreSQL database + domain services). No client-side price fabrication is trusted.
2. **Multi-tenant isolation**: Discounts are scoped to specific store tenants (`targetStoreId`). Coupons belonging to Store A cannot be validated, leaked, or applied in Store B.
3. **Cart & checkout lifecycle synchronization**: Applied cart discounts automatically propagate into new checkout sessions upon initialization, and customers can apply or remove discounts directly within checkout review.
4. **Resilience & mutation safety**: In-flight mutation locking prevents duplicate submissions. Invalid, expired, exhausted, or below-minimum-spend coupon codes display friendly, accessible feedback without discarding cart contents or losing customer progress.

---

## 2. Components and Routes Changed

### 2.1 Reusable UI Components

1. **`DiscountCodeForm`**  
   [`apps/web/src/components/storefront/discounts/discount-code-form.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/components/storefront/discounts/discount-code-form.tsx)  
   - Accessible input (`#discount-code-input`, `aria-label`, uppercase visual transformation, trimming).
   - Apply action with mutation locking and spinner (`aria-busy="true"`).
   - Inline server validation error alerts (`role="alert"`).
   - Supports both full-width and compact modes for drawers and checkout sidebars.

2. **`AppliedDiscounts`**  
   [`apps/web/src/components/storefront/discounts/applied-discounts.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/components/storefront/discounts/applied-discounts.tsx)  
   - Renders discount badge with coupon tag icon (`🏷️`), code pill (`WELCOME10`), and authoritative formatted deduction (`-$10.00`).
   - Accessible removal action (`data-testid="remove-discount-btn"`, `aria-label="Remove discount code ${code}"`).
   - Loading state handling with disabled interactions during in-flight removal.

3. **`CartSummary`**  
   [`apps/web/src/components/storefront/cart/cart-summary.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/components/storefront/cart/cart-summary.tsx)  
   - Integrates `DiscountCodeForm` and `AppliedDiscounts` above the financial breakdown.
   - Displays server-authoritative discount deduction row (`data-testid="cart-discount"`) and total (`data-testid="cart-grand-total"`).
   - Supports direct props (`appliedDiscount`, `onApplyDiscount`, `onRemoveDiscount`) as well as fallback to cart context.

4. **`CartDrawer`**  
   [`apps/web/src/components/storefront/cart/cart-drawer.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/components/storefront/cart/cart-drawer.tsx)  
   - Integrates discount redemption in the drawer footer with subtotal, discount deduction row, and taxes note.
   - Non-breaking fallback to `useOptionalCart()` allowing standalone headless and test rendering.

5. **`CheckoutSummary`**  
   [`apps/web/src/components/storefront/checkout/checkout-summary.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/components/storefront/checkout/checkout-summary.tsx)  
   - Integrates `AppliedDiscounts` and `DiscountCodeForm` directly into the order review column.
   - Authoritative discount breakdown row (`data-testid="checkout-discount"`) updating final total in real-time.

---

### 2.2 Storefront Pages & Context

1. **`CartContext`**  
   [`apps/web/src/context/cart-context.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/src/context/cart-context.tsx)  
   - Manages `appliedDiscount: AppliedDiscountDTO | null`.
   - Exposes `applyDiscount(code: string): Promise<StorefrontCartDTO>` and `removeDiscount(): Promise<StorefrontCartDTO>`.
   - Thread-safe mutation locking (`mutationLock` ref) preventing concurrent cart race conditions.

2. **Checkout Page**  
   [`apps/web/app/stores/[storeSlug]/checkout/page.tsx`](file:///c:/Users/user/Aashif/calcart/apps/web/app/stores/%5BstoreSlug%5D/checkout/page.tsx)  
   - Wires `handleApplyDiscount` and `handleRemoveDiscount` callbacks to `/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/discount`.
   - Re-fetches authoritative checkout session after discount mutation, synchronizing Razorpay order amounts.

---

### 2.3 Storefront API Routes

1. **Cart Discount Endpoint**  
   [`apps/web/app/api/v1/storefront/[storeSlug]/cart/discount/route.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/app/api/v1/storefront/%5BstoreSlug%5D/cart/discount/route.ts)  
   - `POST`: Validates coupon code against cart subtotal, currency, and store tenant. Recalculates cart's `discount_total` and grand total atomically via `cartService.updateTotals`. Returns enriched cart + `AppliedDiscountDTO`.
   - `DELETE`: Resets cart's `discount_total` to 0, updates grand total, returns enriched cart.

2. **Checkout Discount Endpoint**  
   [`apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/discount/route.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/app/api/v1/storefront/%5BstoreSlug%5D/checkout/%5BcheckoutId%5D/discount/route.ts)  
   - `POST`: Evaluates code against active checkout session subtotal. Updates checkout totals via `checkoutService.updateTotals`. Returns updated checkout session + discount metadata.
   - `DELETE`: Resets checkout `discountTotal` to 0, updating total atomically.

---

### 2.4 Domain Layer Extensions

1. **`CartService`**  
   [`modules/carts/src/application/cart-service.ts`](file:///c:/Users/user/Aashif/calcart/modules/carts/src/application/cart-service.ts)  
   - Added `updateTotals(clientOrDb, storeId, cartId, totals)`: Atomically updates `discount_total`, `tax_total`, `shipping_total`, and `grand_total` in the PostgreSQL database within tenant scope.

2. **`CheckoutService`**  
   [`modules/checkout/src/application/checkout-service.ts`](file:///c:/Users/user/Aashif/calcart/modules/checkout/src/application/checkout-service.ts)  
   - Updated `createCheckoutFromCart`: Propagates authoritative `cart.discountTotal` into `checkout.setDiscountTotal` upon initialization so cart discounts carry forward into checkout.

---

## 3. Actual APIs and Contracts Reused

- **`@calcart/carts`**: `Cart.reconstitute`, `cart.setTotals`, `cart.recalculateTotals`, `cartService.updateTotals`.
- **`@calcart/checkout`**: `Checkout.reconstitute`, `checkout.setDiscountTotal`, `checkoutService.updateTotals`, `createCheckoutFromCart`.
- **`@calcart/db`**: PostgreSQL transaction client and query builder with store tenant isolation (`WHERE store_id = $storeId`).
- **`@calcart/ui`**: `Button`, `Spinner`, `Alert`.
- **`apiClient`**: Standard client with unified error handling (`ApiClientError`).

---

## 4. Supported Discount Rules and Lifecycle

| Rule | Description | Behavior / Reason Code |
| :--- | :--- | :--- |
| **Normalization** | Whitespace trimming & uppercase conversion | `"  welcome10  "` -> `"WELCOME10"` |
| **Percentage** | E.g., 10% off order subtotal | Calculated in integer cents (`Math.floor((subtotal * value) / 100)`) |
| **Fixed Amount** | E.g., $20.00 off order subtotal | Integer cents reduction, capped at subtotal |
| **Minimum Spend** | E.g., `SAVE20` requires $50.00 order subtotal | Fails with `MINIMUM_AMOUNT_NOT_MET` if below threshold |
| **Usage Limit** | Max total redemptions exceeded | Fails with `USAGE_LIMIT_REACHED` |
| **Expiration Date** | `endsAt` timestamp in the past | Fails with `DISCOUNT_EXPIRED` |
| **Active Status** | Inactive promotions (`status: INACTIVE`) | Fails with `DISCOUNT_INACTIVE` |
| **Currency Compatibility** | Fixed discount currency mismatch | Fails with `CURRENCY_MISMATCH` |
| **Store / Tenant Boundary** | Code belonging to Store A attempted on Store B | Fails with `DISCOUNT_NOT_FOUND` |

---

## 5. Cart and Checkout Synchronization Behavior

1. **Cart Redemption**: When applied on cart, the server updates `carts.discount_total` and recalculates `grand_total = subtotal - discount_total + tax_total + shipping_total`.
2. **Checkout Initialization**: `createCheckoutFromCart` reads `cart.discountTotal` and sets `checkout.discountTotal`, recalculating checkout total before payment.
3. **In-Checkout Redemption**: Customers can modify or apply codes during checkout; the checkout session's total is recalculated server-side and persisted.
4. **Order Creation**: Upon Razorpay payment verification, `PaymentOrderIntegration.completePurchaseWorkflow` persists the final order with the authoritative server total, preserving the discount amount through to the order confirmation page.

---

## 6. Tests and Exact Validation Results

### 6.1 Focused Test Execution
Command:
```bash
pnpm vitest run tests/ui/storefront-discounts.test.tsx tests/integration/storefront-discount-workflow.test.ts
```
Result: **PASS** (31 tests passed, 0 failures)
- `tests/ui/storefront-discounts.test.tsx` (13 tests):
  - Form accessibility, inputs, uppercase styling, Apply action.
  - Loading state and mutation locking.
  - Error alert display.
  - Applied discounts badge, formatted amount, remove action.
  - `CartSummary` discount integration (empty vs applied state).
  - `CartDrawer` discount breakdown row.
  - `CheckoutSummary` discount breakdown row.
- `tests/integration/storefront-discount-workflow.test.ts` (18 tests):
  - Normalization of codes.
  - Integer cent calculations for percentage and fixed amounts.
  - Subtotal capping preventing negative cart totals.
  - Rule evaluations: valid codes, expired codes, usage limits, minimum spend, inactive codes.
  - Multi-tenant boundary enforcement (Store A vs Store B).
  - Cart domain `setTotals` and `grandTotal` atomic recalculation.
  - Cart-to-checkout discount propagation.
  - Checkout discount removal and totals recalculation.

### 6.2 Broader UI Test Suites
Command:
```bash
pnpm vitest run tests/ui/
```
Result: **PASS** (8 test files, 139 tests passed, 0 failures)

### 6.3 Typecheck
Command:
```bash
pnpm --filter @calcart/web typecheck
pnpm typecheck
```
Result: **PASS** (0 errors across all 19 workspace projects)

### 6.4 Linter
Command:
```bash
pnpm lint
```
Result: **PASS** (0 lint errors)

---

## 7. Known Limitations and Missing Backend Capabilities

1. **`modules/discounts` Database Persistence**: The standalone `modules/discounts` domain module does not yet have a dedicated PostgreSQL migration or repository. The storefront implementation utilizes first-class `discount_total` database columns in `carts` and `checkouts` along with the authoritative `evaluateDiscountCode` engine and in-memory tenant registry.
2. **Multiple Simultaneous Discounts (Stacking)**: The current system enforces a single active coupon code per cart/checkout session (Shopify standard behavior for standard codes). Coupon stacking or automatic promo rules can be added in a future discount engine release.
3. **Customer-Specific Coupon Redemptions**: Customer-restricted coupon codes (e.g. VIP-only) are validated via store-level definitions but do not yet track per-customer lifetime redemption counters in a dedicated database table.
