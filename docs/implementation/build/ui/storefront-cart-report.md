# Implementation Report: Storefront Cart & Add-to-Cart Flow

## 1. Overall Result: PASS

The customer storefront cart and add-to-cart experience has been successfully implemented and validated across `apps/web`, `modules/carts`, and shared storefront UI components. Customers can add product variants to their cart from product detail pages, view slide-out cart drawers, navigate to the dedicated cart page (`/stores/[storeSlug]/cart`), update item quantities (1–999), remove line items, clear carts, and view authoritative monetary totals calculated by the domain service. Checkout and payments are intentionally marked as unavailable in this milestone and will be enabled in the upcoming checkout release.

---

## 2. Existing Cart and Store APIs Reused

The implementation directly leverages core domain services, shared packages, and existing contracts:
- **`CartService` (`modules/carts`)**:
  - `getOrCreateCart(db, storeId, { customerId, guestIdentifier, currency })`: Resolves or creates an active cart for guest or authenticated customer.
  - `getCart(db, storeId, cartId)`: Retrieves authoritative cart with items, subtotal, tax, discount, shipping, and grand total.
  - `addItem(db, storeId, cartId, { variantId, quantity })`: Adds item or merges with existing variant line item; applies default max quantity limits (1–999).
  - `updateItemQuantity(db, storeId, cartId, itemId, quantity)`: Modifies line item quantity; if quantity is 0, deletes item.
  - `removeItem(db, storeId, cartId, itemId)`: Removes specific line item and recalculates authoritative cart totals.
  - `clearCart(db, storeId, cartId)`: Clears all items from the cart.
- **`StoreService` (`modules/stores`)**:
  - `getStoreBySlug(db, slug)`: Resolves active store by slug, verifying status is `ACTIVE` before any storefront cart operation.
- **`StorefrontShell` (`apps/web/src/components/storefront/StorefrontShell.tsx`)**:
  - Extended with cart context integration (`useOptionalCart`), reactive cart count badge, and cart drawer triggering.
- **`ApiClient` (`apps/web/src/lib/api-client.ts`)**:
  - Reused for typed API communication, error parsing (`ApiClientError`), and in-flight request handling.
- **`@shopify-clone/ui` Design System**:
  - Reused tokens, `Card`, `Badge`, `Spinner`, `Button`, `Alert`, and accessible dialog overlay conventions.

---

## 3. Routes and Components Implemented

### 1. Storefront Public API Routes
- **`GET /api/v1/storefront/[storeSlug]/cart`**:
  - Resolves active store by slug.
  - Resolves cart by `cartId` or `guestIdentifier`.
  - Enriches cart items with authoritative variant and product metadata (`enrichCart`).
  - Returns `{ cart, store }`.
- **`POST /api/v1/storefront/[storeSlug]/cart/items`**:
  - Adds a variant to the active cart, auto-creating a guest or customer cart if none exists.
  - Validates `variantId` (UUID) and `quantity` (integer 1–999).
  - Enriches updated cart and returns `{ cart, store }`.
- **`PATCH /api/v1/storefront/[storeSlug]/cart/items/[itemId]`**:
  - Updates item quantity (integer 0–999).
  - Decrementing to 0 automatically deletes the item.
  - Enriches updated cart and returns `{ cart, store }`.
- **`DELETE /api/v1/storefront/[storeSlug]/cart/items/[itemId]`**:
  - Removes line item by ID.
  - Returns enriched updated cart.
- **`DELETE /api/v1/storefront/[storeSlug]/cart`**:
  - Clears all items in the cart.

### 2. Frontend State & Providers
- **`CartProvider` / `useCart` / `useOptionalCart` (`apps/web/src/context/cart-context.tsx`)**:
  - Scopes cart state strictly to `storeSlug`.
  - Manages localStorage keys `sc_${storeSlug}_cart_id` and `sc_${storeSlug}_guest_id`.
  - Provides in-flight mutation mutex (`mutationLock`) preventing duplicate concurrent submissions.
  - Auto-synchronizes cart after mutations, store switching, and initial load.
  - Exposes `cart`, `itemCount`, `isLoading`, `isMutating`, `error`, `isDrawerOpen`, `openDrawer()`, `closeDrawer()`, `addItem()`, `updateQuantity()`, `removeItem()`, `clearCart()`, `refreshCart()`.

### 3. Presentation Pages & Components
- **`CartItems` (`apps/web/src/components/storefront/cart/cart-items.tsx`)**:
  - Displays product title, variant details, SKU, unit price, quantity stepper controls (`-`, value, `+`), line total, and remove button.
  - Supports compact mode for slide-out cart drawer.
  - Safe against missing images (shows accessible placeholder SVG).
  - Uses `useOptionalCart()` for defensive rendering.
- **`CartSummary` (`apps/web/src/components/storefront/cart/cart-summary.tsx`)**:
  - Renders server-authoritative subtotal, discounts (if present), shipping, taxes, and grand total.
  - Features clear "Checkout Unavailable" button with informative caption explaining payments are scheduled for the next release.
  - Includes store-scoped "Continue Shopping" link and "Clear Cart" button.
- **`CartDrawer` (`apps/web/src/components/storefront/cart/cart-drawer.tsx`)**:
  - Accessible slide-out modal panel on the right with dark backdrop.
  - Closes on Escape key press, backdrop click, or close button (✕).
  - Shows item count in header, empty cart state, loading spinner, mutation banner, and "View Full Cart" link.
- **`Dedicated Cart Page` (`apps/web/app/stores/[storeSlug]/cart/page.tsx`)**:
  - Full shopping cart page with breadcrumb navigation, two-column layout (items on left, summary on right), clear empty state, and error recovery.
- **`ProductDetailView` (`apps/web/src/components/storefront/products/product-detail-view.tsx`)**:
  - Extended with quantity selector (1–999) and "Add to Cart" button.
  - Respects in-flight mutex, shows spinner while adding, and provides clear success feedback ("✓ Added {qty} items to cart!") with a quick "View in Cart" action.
  - Disables button when product has 0 active variants ("Out of Stock").
- **`StorefrontShell` (`apps/web/src/components/storefront/StorefrontShell.tsx`)**:
  - Integrated with `useOptionalCart` to display real-time synchronized cart item count badge and toggle cart drawer on button click.

---

## 4. Cart Identity and Store-Scoping Behavior

- **Tenant Isolation**:
  - Every cart query and mutation is strictly resolved against the active store ID looked up via `storeSlug`.
  - Cross-store variants cannot be added (prevented by `modules/carts` domain validation).
- **Client Storage Scoping**:
  - LocalStorage keys are strictly prefixed with the store slug: `sc_${storeSlug}_cart_id` and `sc_${storeSlug}_guest_id`.
  - Switching stores automatically clears previous store state in memory and loads the new store's cart, preventing cross-tenant data leakage.
- **Guest vs Authenticated Identity**:
  - Guests receive a persistent random UUID string (`guest_${crypto.randomUUID()}`).
  - Authenticated customers use `ctx.auth?.user?.id`.
  - Active carts are scoped to `customerId` or `guestIdentifier`.

---

## 5. Price, Quantity, and Total-Handling Decisions

- **Minor Units**: All monetary values are processed and stored as integer minor units (cents). Formatting uses `formatStorePrice(cents, currency)`. Minor units are never divided twice.
- **Server Authoritative**: Subtotals, discounts, taxes, shipping, and grand totals are calculated exclusively by `CartService` in PostgreSQL transactions. The client never calculates authoritative totals.
- **Quantity Limits**:
  - Minimum quantity for item addition is 1.
  - Maximum quantity is 999 (`DEFAULT_MAX_CART_ITEM_QUANTITY` from `@shopify-clone/carts`).
  - Quantity update to 0 triggers item removal.
  - Quantities must be integers.

---

## 6. Exact Test, Typecheck, and Lint Results

### Test Execution
```bash
pnpm vitest run tests/ui tests/integration/storefront-cart-workflow.test.ts
```
**Result**: PASS
- `tests/ui/storefront-cart.test.tsx`: 23 passed
- `tests/ui/storefront-product-discovery.test.tsx`: 23 passed
- `tests/ui/ui-foundation.test.tsx`: 31 passed
- `tests/ui/merchant-product-details.test.tsx`: 15 passed
- `tests/ui/merchant-products-dashboard.test.tsx`: 12 passed
- `tests/integration/storefront-cart-workflow.test.ts`: 7 passed
- **Total: 111 passed (6 test files)**

### Monorepo Typecheck
```bash
pnpm typecheck
```
**Result**: PASS
- All 18 workspace projects typechecked cleanly (`tsc --noEmit` exited with code 0).

### Web App Typecheck
```bash
pnpm --filter @shopify-clone/web typecheck
```
**Result**: PASS (code 0)

### Linter Execution
```bash
pnpm lint
```
**Result**: PASS (0 errors, 0 warnings across all files)

### Checks that could not be run or had external blockers:
- Full monorepo `pnpm build`: Pre-existing issues in `apps/web/app/api/v1/webhooks/payments/razorpay/route.ts` and `modules/orders/src/index.ts` where `.js` relative imports fail under Webpack bundling. Storefront cart routes, components, and pages have zero compiler or type errors.
- Live database integration tests on port 5433 (`tests/carts/cart.service.test.ts`): Postgres Docker container on port 5433 was not running in this local environment (`ECONNREFUSED ::1:5433`).

---

## 7. Files Changed and Their Responsibilities

1. `apps/web/src/lib/storefront-cart-helpers.ts`: Defines `StorefrontCartDTO`, `StorefrontCartItemDTO`, and `enrichCart` query joining variant details, product slugs, and primary images.
2. `apps/web/app/api/v1/storefront/[storeSlug]/cart/route.ts`: Public storefront cart lookup (`GET`) and cart clear (`DELETE`).
3. `apps/web/app/api/v1/storefront/[storeSlug]/cart/items/route.ts`: Public storefront add-item endpoint (`POST`).
4. `apps/web/app/api/v1/storefront/[storeSlug]/cart/items/[itemId]/route.ts`: Public storefront quantity update (`PATCH`) and item remove (`DELETE`).
5. `apps/web/src/context/cart-context.tsx`: Store-scoped cart provider, state synchronization, in-flight mutation locking, and drawer state.
6. `apps/web/src/components/storefront/cart/cart-items.tsx`: Reusable cart line items list with stepper, thumbnail, price, and remove action.
7. `apps/web/src/components/storefront/cart/cart-summary.tsx`: Reusable order summary card displaying authoritative totals and unavailable checkout notice.
8. `apps/web/src/components/storefront/cart/cart-drawer.tsx`: Slide-out cart drawer overlay with keyboard accessibility and empty state.
9. `apps/web/app/stores/[storeSlug]/cart/page.tsx`: Dedicated full cart page route.
10. `apps/web/src/components/storefront/products/product-detail-view.tsx`: Added quantity selector and Add to Cart action with loading and success feedback.
11. `apps/web/src/components/storefront/StorefrontShell.tsx`: Connected cart indicator count badge and drawer trigger to `useOptionalCart`.
12. `apps/web/app/stores/[storeSlug]/products/page.tsx`: Wrapped in `CartProvider` for storefront shell indicator synchronization.
13. `apps/web/app/stores/[storeSlug]/products/[productSlug]/page.tsx`: Wrapped in `CartProvider` for product detail add-to-cart integration.
14. `apps/web/app/globals.css`: Added styles for quantity steppers, cart drawers, cart items, and order summary cards.
15. `tests/ui/storefront-cart.test.tsx`: 23 targeted unit tests for cart components, price formatting, stepper, empty states, and store isolation.
16. `tests/integration/storefront-cart-workflow.test.ts`: 7 targeted integration tests for cart enrichment, quantity limits, and storage key scoping.
17. `docs/implementation/build/ui/storefront-cart-report.md`: Implementation verification report.

---

## 8. Known Limitations and Missing Backend Capabilities

1. **Guest Cart Merging**: When a guest signs in as a customer, their guest cart is currently not automatically merged into an existing customer cart.
2. **Promotions & Coupon Codes**: The storefront cart does not yet include a coupon code submission input (backend discount calculations are supported via domain rules).
3. **Live Inventory Stock Badges**: Inventory availability is checked server-side upon adding to cart, but live remaining stock counts are not displayed in the cart drawer.
4. **Checkout Route**: Checkout and payment flows are deliberately not implemented in this milestone.

---

## 9. Recommended Next Milestone

Implement **Customer Checkout Flow (Checkout Session, Address Collection, and Order Placement)**:
1. Create storefront checkout initialization from active cart (`modules/checkout`).
2. Create step-based checkout UI (Customer Email/Contact, Shipping Address, Shipping Method selection).
3. Integrate with payment domain for hosted or inline test payments.
4. Convert cart to confirmed order and display order confirmation page.
