# Merchant Products Dashboard MVP Implementation Report

**Status:** PASS  
**Date:** 2026-10-09  
**Branch:** main  
**Commit Target:** `feat(ui): implement merchant products dashboard`

---

## 1. Overall Result

**PASS**

The Merchant Products Dashboard MVP has been implemented in `apps/web`. The merchant product listing and product creation workflows have been integrated with the existing backend product APIs, tenant isolation controls, and UI foundation components. All unit, integration, typecheck, and linting checks pass without error.

---

## 2. Existing Product APIs and Contracts Reused

The implementation directly integrates with the established backend endpoints and contracts:

1. **Product Listing Endpoint**:
   - `GET /api/v1/stores/:storeId/products`
   - Authorization: Requires authenticated session with at least `staff` role in the target store (`requireStoreOrNotFound(ctx, storeId, "staff")`).
   - Query Parameters: `limit?: number`, `cursor?: string`, `status?: "DRAFT" | "ACTIVE" | "ARCHIVED"`.
   - Response Contract: `ApiSuccessResponse<PaginatedResult<ProductSummaryDTO>>`:
     - Items contain: `id`, `storeId`, `title`, `slug`, `status`, `publishedAt`, `variantsCount`, `mediaCount`, `createdAt`, `updatedAt`.
     - Pagination contains: `items`, `hasMore`, `nextCursor`.

2. **Product Creation Endpoint**:
   - `POST /api/v1/stores/:storeId/products`
   - Authorization: Requires authenticated session with at least `admin` role in the target store (`hasRoleAtLeast(member.role, "admin")`).
   - Request Body (`CreateProductRequestDto` / `CreateProductInput`):
     - `title` (required string, 1–255 characters).
     - `description` (optional string or null).
     - `slug` (optional string, normalized).
     - `status` (optional `DRAFT`, `ACTIVE`, `ARCHIVED`; default `DRAFT`).
     - `price` (optional integer in minor units / cents).
     - `compareAtPrice` (optional integer in minor units / cents).
     - `sku` (optional string $\le 100$ characters).
     - `currency` (optional 3-letter currency code, default `USD`).
   - Response Contract: `ApiSuccessResponse<ProductDetailDTO>` (HTTP 201).

---

## 3. Pages and Components Implemented

### 1. `apps/web/app/merchant/layout.tsx`
- Layout wrapper for merchant subroutes ensuring both `AuthProvider` and `StoreProvider` are active, maintaining user session and active store state across page navigation.

### 2. `apps/web/app/merchant/products/page.tsx`
- Merchant product listing page wrapped in `MerchantShell`.
- Displays page title, subtitle, and primary `Add Product` action.
- Manages active store context resolution:
  - If store is loading, displays `Spinner`.
  - If no active store is selected, displays an `EmptyState` guiding the user to the dashboard.
  - Automatically loads products for the active store on mount and store change.
  - Supports cursor-based pagination with a "Load More Products" action.
  - Integrates retry functionality upon recoverable fetch failure.

### 3. `apps/web/src/components/merchant/products/product-table.tsx`
- Accessible table rendering products with `ProductTable`:
  - Columns: Product (Title & Slug), Status, Variants count, Media count, and Created date.
  - Status badges: `ACTIVE` (`badge--success`), `DRAFT` (`badge--neutral`), and `ARCHIVED` (`badge--warning`).
  - Loading state with `Spinner`.
  - Empty state with `EmptyState` component and direct call to action to create a product.
  - Error state with `Alert variant="danger"` and retry button.

### 4. `apps/web/app/merchant/products/new/page.tsx`
- Product creation page wrapped in `MerchantShell`.
- Includes back breadcrumb link to `/merchant/products`.
- Displays contextual permission warning when a user with `staff` role visits the page, noting that product creation requires admin or owner privileges.
- Displays `Alert variant="success"` upon creation with actions to "Add Another" or "View All Products".

### 5. `apps/web/src/components/merchant/products/product-form.tsx`
- Form container with Card-grouped sections:
  - **Basic Information**: Title (required), URL handle/slug, description, and status dropdown.
  - **Pricing**: Price, Compare-at price, and Currency. Price inputs convert standard decimal values (e.g. `19.99`) into integer minor units (e.g. `1999`) for the API.
  - **Inventory**: Stock Keeping Unit (SKU).
- In-flight submission prevention: Disables inputs and sets `loading={true}` on the submit button with `aria-busy="true"` to prevent duplicate submissions.
- Value preservation: Retains all user inputs in component state when validation or network errors occur.

---

## 4. Validation and Error-Handling Behavior

1. **Client-Side Validation**:
   - `title`: Must be non-empty and $\le 255$ characters.
   - `price` & `compareAtPrice`: Must be non-negative numbers.
   - `sku`: Must not exceed 100 characters.
   - `currency`: Must be a valid 3-letter currency code.
   - Validation errors display beneath respective inputs using `FormField` with `role="alert"` and `aria-invalid="true"`.
2. **Server-Side Validation Integration**:
   - Normalizes backend `ApiClientError` responses.
   - Maps backend `error.fields` (e.g. duplicate slug or invalid input) directly to form input fields.
   - Displays top-level errors (such as 403 Forbidden or network errors) in an `Alert variant="danger"`.

---

## 5. Tenant and Authorization Safeguards

1. **Active Store Context**:
   - Requests are strictly scoped using `/api/v1/stores/:storeId/products` and the `x-store-id` request header.
   - Switching stores through `StoreProvider` resets cached products and re-fetches for the new store identifier.
2. **Server-Authoritative Role Enforcement**:
   - Client role checks serve purely as UI helpers (e.g., displaying permission warnings for staff users).
   - The backend server strictly enforces `requireStoreOrNotFound(ctx, storeId, "staff")` for listing and `hasRoleAtLeast(member.role, "admin")` for creation, returning HTTP 403 Forbidden for unauthorized requests.

---

## 6. Files Changed and Responsibilities

| File | Change | Responsibility |
|------|--------|----------------|
| `apps/web/app/merchant/layout.tsx` | Created | Wraps merchant routes with Auth and Store context providers. |
| `apps/web/app/merchant/products/page.tsx` | Created | Product listing screen with store scoping and pagination. |
| `apps/web/app/merchant/products/new/page.tsx` | Created | Product creation screen with breadcrumbs and confirmation feedback. |
| `apps/web/src/components/merchant/products/product-table.tsx` | Created | Reusable product list table with loading, empty, and error states. |
| `apps/web/src/components/merchant/products/product-form.tsx` | Created | Product creation form with validation, price conversion, and error handling. |
| `tests/ui/merchant-products-dashboard.test.tsx` | Created | Unit and contract tests for table, form, validation, and API error states. |
| `docs/implementation/build/ui/merchant-products-dashboard-report.md` | Created | Implementation audit and verification documentation. |

---

## 7. Validation Results

### 1. Unit & Contract Tests
```bash
pnpm test tests/ui/merchant-products-dashboard.test.tsx
```
**Result:** PASS (12 passed / 12 tests, 80ms)
- Loading, empty, and error states of `ProductTable`.
- Table rendering with product metadata, slugs, and status badge formatting.
- Pagination / load more control rendering.
- `ProductForm` fields, cards, and required attributes.
- API listing with pagination parameters and tenant scoping headers.
- Price minor-unit (cents) conversion and payload structure.
- 403 Forbidden role error normalization.
- 400 Validation error mapping to field errors.

### 2. Full UI Test Suite
```bash
pnpm test tests/ui/
```
**Result:** PASS (43 passed / 43 tests, 197ms across 2 test files).

### 3. Monorepo Typecheck
```bash
pnpm typecheck
```
**Result:** PASS (0 errors across all 18 workspace packages and applications).

### 4. Linter
```bash
pnpm lint
```
**Result:** PASS (0 errors, 0 warnings).

---

## 8. Known Limitations & Backend Capabilities

1. **Variant Management**: The creation form implements the single default variant structure (`price`, `compareAtPrice`, `sku`) supported on initial product creation. Multi-variant creation and option matrices are domain features for a later milestone.
2. **Media Uploads**: The product API supports existing media URLs; media file upload infrastructure is not part of this MVP and was deliberately not invented.
3. **Product Editing / Archiving**: Dedicated product editing and status transition pages (`/merchant/products/[productId]`) will be implemented in subsequent dashboard tasks.

---

## 9. Recommended Next Milestone

- **Merchant Product Details & Edit Workflow**: Implement product detail view, inline editing, and lifecycle status transitions (`ACTIVE`, `DRAFT`, `ARCHIVED`) using the existing backend transition APIs (`/publish`, `/unpublish`, `/archive`).
