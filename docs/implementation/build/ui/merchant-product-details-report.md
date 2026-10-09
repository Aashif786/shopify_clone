# Merchant Product Details, Editing, and Lifecycle Actions Implementation Report

**Status:** PASS  
**Date:** 2026-10-09  
**Branch:** main  
**Commit Target:** `feat(ui): add merchant product details and lifecycle actions`

---

## 1. Overall Result

**PASS**

The merchant product details, editing, and lifecycle management workflows have been implemented in `apps/web`. Authorized merchants can now view comprehensive product details, edit product and default variant attributes with client/server validation, and trigger valid product lifecycle transitions (`publish`, `unpublish`, `archive`) with confirmation prompts and permission safeguards. All targeted UI tests, monorepo typechecks, and linter runs pass with zero errors.

---

## 2. Existing Product APIs and Contracts Reused

The implementation leverages existing backend endpoints without creating redundant contracts:

1. **Product Detail Retrieval**:
   - `GET /api/v1/stores/:storeId/products/:productId`
   - Authorization: Requires authenticated session with at least `staff` role in the active store.
   - Response: `ApiSuccessResponse<ProductDetailDTO>` containing:
     - Core fields: `id`, `storeId`, `title`, `description`, `slug`, `status`, `publishedAt`, `createdAt`, `updatedAt`.
     - Nested collections: `variants: ProductVariantDTO[]`, `media: ProductMediaDTO[]`.

2. **Product Core Updating**:
   - `PATCH /api/v1/stores/:storeId/products/:productId`
   - Authorization: Requires `admin` or `owner` role.
   - Request Body: `UpdateProductInput` (`title?: string`, `description?: string | null`, `slug?: string`).
   - Response: `ApiSuccessResponse<ProductDetailDTO>`.

3. **Variant Updating (Pricing & SKU)**:
   - `PATCH /api/v1/stores/:storeId/products/:productId/variants/:variantId`
   - Authorization: Requires `admin` or `owner` role.
   - Request Body: `UpdateVariantRequestDto` (`title?: string`, `price?: number`, `compareAtPrice?: number | null`, `sku?: string | null`, `position?: number`, `status?: VariantStatus`).
   - Response: `ApiSuccessResponse<ProductVariantDTO>`.

4. **Lifecycle Transition Endpoints**:
   - `POST /api/v1/stores/:storeId/products/:productId/publish` (transitions `DRAFT` $\to$ `ACTIVE`).
   - `POST /api/v1/stores/:storeId/products/:productId/unpublish` (transitions `ACTIVE` or `ARCHIVED` $\to$ `DRAFT`).
   - `POST /api/v1/stores/:storeId/products/:productId/archive` (transitions `DRAFT` or `ACTIVE` $\to$ `ARCHIVED`).
   - Authorization: All three transition endpoints require `admin` or `owner` role.
   - Response: `ApiSuccessResponse<ProductDetailDTO>`.

---

## 3. Detail, Edit, and Lifecycle Features Implemented

### 1. Product Details Page (`apps/web/app/merchant/products/[productId]/page.tsx`)
- Wrapped in [MerchantShell](file:///c:/Users/user/Aashif/shopify_clone/apps/web/src/components/merchant/MerchantShell.tsx) with active path `/merchant/products`.
- Implements breadcrumb navigation (`← Back to Products`).
- Dynamic route parameter resolution via Next.js 15 `params` Promise.
- Handles all states:
  - Global auth/store loading spinner.
  - Store unselected empty state.
  - Product loading spinner.
  - HTTP 404 Not Found state with call-to-action to return to the product listing.
  - HTTP 403 Forbidden state with permission error messaging.
  - Recoverable network/fetch errors with manual `Retry` button.
- Smooth toggle between read-only detail view and editing mode.

### 2. Product Details Presentation (`apps/web/src/components/merchant/products/product-details.tsx`)
- Header bar: Title, URL handle (`/:slug`), status badge ([formatProductStatusBadge](file:///c:/Users/user/Aashif/shopify_clone/apps/web/src/components/merchant/products/product-table.tsx)), and edit/status action buttons.
- Overview card: Customer-facing description or placeholder if blank.
- Pricing & Inventory card: Formatted selling price (`formatPriceMinor`), compare-at discount price, SKU, and immutable currency code.
- Variants table: Summary of all configured variants with titles, SKUs, formatted prices, and status.
- Metadata card: System product ID, publication date/status, creation date, and last-updated timestamp.

### 3. Product Editing Form (`apps/web/src/components/merchant/products/product-edit-form.tsx`)
- Pre-populated form fields from canonical product data:
  - Product Information: `title`, `slug`, `description`.
  - Pricing & Inventory: `price` (decimal converted to minor units), `compareAtPrice`, `sku`.
- Dual-contract submission pipeline:
  - Calls `PATCH /products/:productId` for product core fields.
  - Calls `PATCH /products/:productId/variants/:variantId` for pricing/SKU on the default variant.
  - Re-fetches the authoritative canonical product detail state from the server upon completion.
- Client-side validation: Required title and slug, non-negative monetary numbers, length constraints.
- In-flight duplicate submission locking (`isSubmitting=true`, submit button `loading={true}`).
- Value preservation: Form inputs persist across server validation failures without wiping user modifications.

### 4. Product Status Actions (`apps/web/src/components/merchant/products/product-status-actions.tsx`)
- Strictly enforces backend state machine:
  - `DRAFT`: Offers **Publish Product** and **Archive Product**.
  - `ACTIVE`: Offers **Unpublish (Draft)** and **Archive Product**.
  - `ARCHIVED`: Offers **Restore to Draft**.
- Consequential action safety: Launches accessible [ConfirmationDialog](file:///c:/Users/user/Aashif/shopify_clone/packages/ui/src/components/Dialog.tsx) before unpublishing or archiving to prevent accidental store disruption.
- Client permission awareness: When viewed by a user with `staff` role, hides mutation buttons and displays informational guidance indicating admin privileges are required.

---

## 4. Verified Transition Rules and Permissions

- **State Machine Matrix**:
  | Current State | Allowed Transitions | Endpoint | Consequential Prompt |
  |---------------|---------------------|----------|----------------------|
  | `DRAFT` | `ACTIVE` | `.../publish` | Direct action |
  | `DRAFT` | `ARCHIVED` | `.../archive` | ConfirmationDialog (Destructive) |
  | `ACTIVE` | `DRAFT` | `.../unpublish` | ConfirmationDialog |
  | `ACTIVE` | `ARCHIVED` | `.../archive` | ConfirmationDialog (Destructive) |
  | `ARCHIVED` | `DRAFT` | `.../unpublish` | Direct action |
- **Authorization Barrier**:
  - `GET` requires at least `staff` role.
  - All mutations (`PATCH`, `publish`, `unpublish`, `archive`) require at least `admin` role.

---

## 5. Files Changed and Responsibilities

| File | Change | Responsibility |
|------|--------|----------------|
| `apps/web/app/merchant/products/[productId]/page.tsx` | Created | Product detail screen controller with state management, view/edit toggle, and error states. |
| `apps/web/src/components/merchant/products/product-details.tsx` | Created | Read-only presentation component for product fields, pricing, variants, and timestamps. |
| `apps/web/src/components/merchant/products/product-edit-form.tsx` | Created | Pre-populated editing form with dual-update orchestration and client/server validation. |
| `apps/web/src/components/merchant/products/product-status-actions.tsx` | Created | Lifecycle status transition action buttons and confirmation dialogs. |
| `apps/web/src/lib/api-client.ts` | Modified | Added `.catch(() => {})` on in-flight deduplication cleanup promise to eliminate Node unhandled rejection edge case. |
| `tests/ui/merchant-product-details.test.tsx` | Created | 15 targeted unit and contract tests for detail rendering, editing, and lifecycle transitions. |
| `docs/implementation/build/ui/merchant-product-details-report.md` | Created | Implementation audit and documentation report. |

---

## 6. Validation Results

### 1. Targeted Unit & Contract Tests
```bash
pnpm test tests/ui/merchant-product-details.test.tsx
```
**Result:** PASS (15 passed / 15 tests, 106ms).
- Verified minor-unit price formatting (`$499.00`).
- Verified product details presentation (title, status, slug, description, variants).
- Verified role-aware action rendering (admin vs staff).
- Verified status action availability across `DRAFT`, `ACTIVE`, `ARCHIVED`.
- Verified pre-population in edit form.
- Verified single-product retrieval and lifecycle transition endpoints (`publish`, `archive`).
- Verified 404 Not Found and 400 Invalid Transition error handling.

### 2. Complete UI Test Suite
```bash
pnpm test tests/ui/
```
**Result:** PASS (58 passed / 58 tests across all 3 UI test files).

### 3. Monorepo Typecheck
```bash
pnpm typecheck
```
**Result:** PASS (0 errors across all 18 workspace projects).

### 4. Monorepo Lint
```bash
pnpm lint
```
**Result:** PASS (0 errors, 0 warnings).

---

## 7. Backend Changes

- **None required**: All necessary product endpoints (`GET /products/:id`, `PATCH /products/:id`, `PATCH /variants/:id`, `publish`, `unpublish`, `archive`) were already properly implemented with tenant isolation and role checks in `apps/web/app/api/v1/stores/[storeId]/products/[productId]`.

---

## 8. Remaining Limitations and Deferred Features

1. **Option Matrix Generation**: Editing updates the default variant's price, compare-at price, and SKU. Visual variant matrix generation (e.g. Size/Color option grid) is deferred to advanced inventory/catalog milestones.
2. **Media File Uploads**: Product media displays metadata when present; file upload infrastructure is not part of this stage.

---

## 9. Recommended Next Milestone

- **Storefront Product Discovery & Catalog Integration**: Implement customer-facing product grid and product detail screens in `apps/web/app/stores/[storeSlug]` utilizing `StorefrontShell` and public product catalog APIs.
