# Implementation Report: Storefront Product Discovery

## 1. Overall Result: PASS

Customer-facing storefront product discovery has been successfully implemented and validated across `apps/web`, `modules/products`, and shared UI styling. Customers can now browse published products for an active store via a responsive catalog grid and open store-scoped product detail views with variant selection and image galleries. Cart, checkout, and payment UI are intentionally omitted in this milestone.

---

## 2. Existing Storefront and Product APIs Reused

The implementation leverages the authoritative core domain services and existing infrastructure:
- **`StoreService` (`modules/stores`)**:
  - `getStoreBySlug(db, slug)`: Resolves store by normalized slug, asserting status is `ACTIVE`. Suspended or archived stores return 404 `STOREFRONT_NOT_FOUND`.
- **`ProductService` (`modules/products`)**:
  - `listProducts(db, storeId, { status: "ACTIVE", limit, cursor })`: Retrieves paginated published products strictly scoped to the store ID.
  - `getProductBySlug(db, storeId, productSlug)`: Fetches product details, variants, and media scoped strictly to the resolved store ID.
- **`StorefrontShell` (`apps/web/src/components/storefront/StorefrontShell.tsx`)**:
  - Reused for top-level brand header, store-scoped navigation (`/stores/${storeSlug}/products`), and layout framing.
- **`ApiClient` (`apps/web/src/lib/api-client.ts`)**:
  - Reused for client-side queries, error mapping (`ApiClientError`), and retry execution.
- **`@shopify-clone/ui` Design System**:
  - Reused design tokens, `Badge`, `Card`, `CardContent`, `Alert`, `Button`, `Spinner`, and `EmptyState`.

---

## 3. Routes and Components Implemented

### 1. Public API Routes
- **`GET /api/v1/storefront/[storeSlug]`**:
  - Resolves store by slug; verifies `store.status === "ACTIVE"`.
  - Returns public store metadata (`id`, `name`, `slug`, `currency`, `locale`, `timezone`, `settings`).
- **`GET /api/v1/storefront/[storeSlug]/products`**:
  - Resolves store by slug; verifies store is `ACTIVE`.
  - Supports bounded pagination via `limit` (max 100) and cursor.
  - Strictly enforces publication rules: queries only `status: "ACTIVE"` products.
  - Returns `{ items, hasMore, nextCursor, store }`.
- **`GET /api/v1/storefront/[storeSlug]/products/[productSlug]`**:
  - Resolves store by slug; verifies store is `ACTIVE`.
  - Resolves product strictly within `store.id` using `productSlug`.
  - Enforces publication rule: rejects non-active products (`DRAFT`, `ARCHIVED`) with 404 `PRODUCT_NOT_FOUND`.
  - Filters variants to expose only active variants (`status: "ACTIVE"`).
  - Returns `{ product, store }`.

### 2. Presentation Routes
- **`apps/web/app/stores/[storeSlug]/products/page.tsx`**:
  - Customer product catalog page wrapped in `StorefrontShell`.
  - Fetches published products from public storefront API.
  - Manages loading, empty catalog, store not-found (404), network error with retry, and pagination ("Load More").
- **`apps/web/app/stores/[storeSlug]/products/[productSlug]/page.tsx`**:
  - Customer product detail page wrapped in `StorefrontShell`.
  - Resolves store and product by slugs.
  - Manages loading, product/store not-found (404), network failure, and back-to-catalog breadcrumb navigation.

### 3. Reusable UI Components
- **`ProductCard` (`apps/web/src/components/storefront/products/product-card.tsx`)**:
  - Displays product title, formatted minor-unit price, compare-at price (if discounted), stock badge, and primary image.
  - Accessible SVG fallback icon with descriptive aria-label when no image exists.
  - Semantic link preserved within store scope (`/stores/${storeSlug}/products/${product.slug}`).
  - Prevents leaking internal database UUIDs.
- **`ProductGrid` (`apps/web/src/components/storefront/products/product-grid.tsx`)**:
  - Responsive CSS grid (`repeat(auto-fill, minmax(260px, 1fr))`).
  - Loading state with spinner and accessible live region.
  - Accessible error alert banner with retry action.
  - Empty state with informative message.
  - Bounded pagination button when `hasMore` is true.
- **`ProductDetailView` (`apps/web/src/components/storefront/products/product-detail-view.tsx`)**:
  - Media gallery with main image, thumbnails selector, and accessible fallback.
  - Distinguishes single default variant vs multiple selectable variants.
  - Accessible variant selector buttons updating active variant, price, compare-at price, and SKU in real time.
  - In-stock availability badge based on active variants.
  - Formatted multi-paragraph description.
  - Semantic breadcrumb trail back to store and catalog.
  - Clear catalog preview notice explaining that cart/checkout will follow in a future milestone.

---

## 4. Store and Product Isolation & Publication Behavior

1. **Strict Store Scoping**:
   - Every catalog query resolves the store context from `storeSlug` on the server before querying products.
   - Products are queried strictly by `p.store_id = store.id`.
   - Cross-store slug resolution is impossible: a product belonging to Store A will return 404 if accessed under Store B's slug.
2. **Strict Publication Invariant**:
   - Customers can only discover products where `status = 'ACTIVE'`.
   - `DRAFT` and `ARCHIVED` products are excluded from catalog listings and return 404 `PRODUCT_NOT_FOUND` on detail pages.
   - Inactive or archived variants are filtered out from customer view and selection.
3. **Store Status Invariant**:
   - If a store is `SUSPENDED` or `ARCHIVED`, storefront endpoints return 404 `STOREFRONT_NOT_FOUND`, preventing public access.
4. **No Privilege Leakage**:
   - Public storefront routes require no authentication and expose no merchant credentials, tokens, or administrative metadata.

---

## 5. Backend Changes and Justification

- **`modules/products/src/application/dtos.ts`**:
  - Added optional fields `price`, `compareAtPrice`, `currency`, `primaryMediaUrl`, and `primaryMediaAlt` to `ProductSummaryDTO`.
  - *Justification:* Necessary to support displaying primary variant price and primary product image in storefront product catalog cards without N+1 client-side queries.
- **`modules/products/src/infrastructure/product-repository.ts`**:
  - Updated `listProducts` SQL query with PostgreSQL `LEFT JOIN LATERAL` to fetch the first active variant (`price`, `compare_at_price`, `currency`) and first media (`url`, `alt_text`) by position.
  - *Justification:* Provides clean, performant, server-side data for catalog card presentation with zero breaking changes to existing merchant table queries.
- **`modules/products/src/application/product-service.ts`**:
  - Updated `toProductSummaryDTO` mapper to pass through `price`, `compareAtPrice`, `currency`, `primaryMediaUrl`, and `primaryMediaAlt`.

---

## 6. Files Changed and Responsibilities

| File | Change | Responsibility |
|------|--------|----------------|
| `modules/products/src/application/dtos.ts` | Modified | Added optional price and primary media fields to `ProductSummaryDTO`. |
| `modules/products/src/application/product-service.ts` | Modified | Updated `toProductSummaryDTO` to map price and media. |
| `modules/products/src/infrastructure/product-repository.ts` | Modified | Added `LATERAL JOIN` queries for primary variant price and media in `listProducts`. |
| `apps/web/app/api/v1/storefront/[storeSlug]/route.ts` | Created | Public storefront store resolution endpoint. |
| `apps/web/app/api/v1/storefront/[storeSlug]/products/route.ts` | Created | Public storefront published products catalog endpoint. |
| `apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/route.ts` | Created | Public storefront product detail endpoint. |
| `apps/web/src/components/storefront/products/product-card.tsx` | Created | Reusable product card with image fallback, price formatting, and store links. |
| `apps/web/src/components/storefront/products/product-grid.tsx` | Created | Responsive grid layout with loading, empty, error, and pagination states. |
| `apps/web/src/components/storefront/products/product-detail-view.tsx` | Created | Product detail layout with variant selector, gallery, SKU, and breadcrumbs. |
| `apps/web/app/stores/[storeSlug]/products/page.tsx` | Created | Customer product catalog page controller. |
| `apps/web/app/stores/[storeSlug]/products/[productSlug]/page.tsx` | Created | Customer product detail page controller. |
| `apps/web/app/globals.css` | Modified | Added responsive CSS styles and design tokens for storefront catalog and detail views. |
| `tests/ui/storefront-product-discovery.test.tsx` | Created | 23 targeted unit, isolation, and integration tests for storefront product discovery. |
| `docs/implementation/build/ui/storefront-product-discovery-report.md` | Created | Implementation audit and documentation report. |

---

## 7. Exact Validation Results

### 1. Targeted Unit & Storefront Tests
```bash
pnpm test tests/ui/storefront-product-discovery.test.tsx
```
**Result:** PASS (23 passed / 23 tests, 85ms).
- Verified minor-unit price formatting across multiple currencies and fallback handling.
- Verified `ProductCard` data rendering, store-scoped links, in-stock/unavailable badges, and image fallback.
- Verified `ProductGrid` loading, empty, error with retry, and pagination states.
- Verified `ProductDetailView` title, price, description, variant selection, and gallery.
- Verified filtering out archived/inactive variants from customer selection.
- Verified tenant isolation in URLs and store-scoped lookups.
- Verified 404 error handling for nonexistent/suspended stores and draft/archived products.

### 2. Complete UI Test Suite
```bash
pnpm test tests/ui/
```
**Result:** PASS (81 passed / 81 tests across all 4 UI test files).
- `tests/ui/storefront-product-discovery.test.tsx` (23 passed)
- `tests/ui/merchant-products-dashboard.test.tsx` (12 passed)
- `tests/ui/merchant-product-details.test.tsx` (15 passed)
- `tests/ui/ui-foundation.test.tsx` (31 passed)

### 3. Monorepo Typecheck
```bash
pnpm typecheck
```
**Result:** PASS (0 errors across all 18 workspace projects).

### 4. Monorepo Lint
```bash
pnpm lint
```
**Result:** PASS (0 errors, 0 warnings across all files).

---

## 8. Known Limitations

- **Search and Filtering**: Basic pagination is supported, but advanced multi-faceted search (e.g. tag filtering, full-text search) is not yet implemented.
- **Cart & Checkout**: Cart addition, checkout flows, and inventory reservations are not included in this task and will be integrated in subsequent milestones.
- **Collections**: Category/collection-based product grouping is not yet connected to the storefront UI.

---

## 9. Recommended Next Milestone

- **Milestone: Customer Storefront Cart Experience**:
  - Implement customer cart slide-out / drawer and `/stores/[storeSlug]/cart` view.
  - Connect "Add to Cart" button on `ProductDetailView` to `modules/carts` public API.
  - Display item count in `StorefrontShell` cart button with live badge updates.
