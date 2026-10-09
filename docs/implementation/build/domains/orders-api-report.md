# Orders API Endpoints and Authorization Implementation Report

## 1. Overview and Objectives

This report documents the implementation of the **Orders HTTP API endpoints and authorization gates** for Shopify Clone (Orders Task 3). Built on the foundational database schema (Task 1) and domain/application services (Task 2), this implementation provides public and merchant-facing RESTful API routes under the Next.js App Router (`apps/web/app/api/v1/stores/[storeId]/orders/`), adhering strictly to:
- Multi-tenant boundary isolation and anti-enumeration protections (`@shopify-clone/tenant`).
- Authentication and session resolution (`@shopify-clone/auth`).
- Role-based authorization according to canonical specifications (`specs/orders/order-spec.md` §31).
- Strict separation between public web mutations and trusted internal commerce pathways (zero exposure of payment tampering or trusted flags).
- Standardized API error envelopes and validation conventions.

---

## 2. Files Changed and Route Responsibilities

| File Path | Layer / Responsibility | Description |
| :--- | :--- | :--- |
| `apps/web/app/api/v1/stores/[storeId]/orders/route.ts` | Presentation / Route Handler | `GET /api/v1/stores/[storeId]/orders`. Validates authenticated session and store membership (minimum role: `staff`). Validates query pagination and filter parameters (`status`, `paymentStatus`, `fulfillmentStatus`, `customerId`, `orderNumber`, `limit`, `cursor`). Invokes `OrderService.listOrders` and returns enveloped list response. |
| `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/route.ts` | Presentation / Route Handler | `GET /api/v1/stores/[storeId]/orders/[orderId]`. Validates authenticated session and store membership (minimum role: `staff`). Scopes lookup strictly to `storeId`. Returns fully hydrated `OrderDTO` (including line items, addresses, and status history) or standard 404 `ORDER_NOT_FOUND`. |
| `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/cancel/route.ts` | Presentation / Route Handler | `POST /api/v1/stores/[storeId]/orders/[orderId]/cancel`. Validates authenticated session and role authorization (minimum role: `admin`). Validates request body `{ reason: string }`. Discards client payment fields or internal flags. Invokes `OrderStatusService.cancelOrder` and returns updated order DTO. |
| `apps/web/src/lib/api/validation.ts` | Shared Validation | Added `listOrdersQueryValidator` and `cancelOrderValidator` (`CancelOrderBodyDto`), enforcing string limits, UUID syntax, enum values, and stripping unpermitted client fields. |
| `apps/web/src/lib/api/errors.ts` | Error Handling & Serialization | Added mapping for `OrderDomainError` subclasses (`OrderNotFoundError`, `CrossStoreOrderAccessError`, `OrderCancellationError`, `OrderImmutableError`, `InvalidOrderStatusTransitionError`, `UnauthorizedPaymentStatusChangeError`, etc.) to standard HTTP status codes (`404 NOT_FOUND`, `400 BAD_REQUEST`, `403 FORBIDDEN`). |
| `packages/db/src/repositories/orders.ts` | Data Access | Added `list(db, options)` to `OrderRepository`, providing deterministic cursor-based pagination `(created_at DESC, id DESC)`, multi-tenant store scoping, and query filtering. |
| `modules/orders/src/application/order-service.ts` | Application Service | Added `listOrders(clientOrDb, storeId, query)` to `OrderService`, decoding cursors and mapping repository rows to `OrderDTO` lists. |
| `modules/orders/src/application/order-status-service.ts` | Application Service | Enforced terminal state immutability check before idempotent state transitions, preventing repeated cancellation of terminal orders. |
| `modules/orders/src/domain/order-state.ts` | Domain State Machine | Updated `assertValidOrderStatusTransition` to check `isTerminalOrderStatus` prior to identical-state matching, ensuring terminal orders reject transition attempts. |
| `modules/orders/package.json` & `modules/orders/tsconfig.json` | Package Definition | Registered `@shopify-clone/orders` workspace module and TypeScript build configuration. |
| `vitest.config.ts` | Test Infrastructure | Registered path alias mapping for `@shopify-clone/orders` and `@shopify-clone/payments`. |
| `tests/orders/orders.api.test.ts` | Automated Tests | 19 end-to-end integration tests covering authentication, RBAC, tenant isolation, parameter validation, order detail, cancellation, and payment status tampering guards. |

---

## 3. Endpoint Paths, Methods, and Response Behavior

### 3.1 List Orders
- **Path**: `GET /api/v1/stores/:storeId/orders`
- **Authentication**: Required (`session_token` cookie or Bearer header).
- **Authorization**: Store membership with role `owner`, `admin`, or `staff`. Non-members receive `404 NOT_FOUND`.
- **Query Parameters**:
  - `limit`: Integer between 1 and 100 (default: 20).
  - `cursor`: Opaque base64 cursor string.
  - `status`: Optional filter (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `COMPLETED`).
  - `paymentStatus`: Optional filter (`PENDING`, `AUTHORIZED`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`).
  - `fulfillmentStatus`: Optional filter (`UNFULFILLED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`).
  - `customerId`: Optional UUID filter.
  - `orderNumber`: Optional prefix search filter.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "items": [ /* OrderDTO[] */ ],
      "hasMore": false,
      "nextCursor": null
    }
  }
  ```

### 3.2 Get Order Detail
- **Path**: `GET /api/v1/stores/:storeId/orders/:orderId`
- **Authentication**: Required.
- **Authorization**: Store membership with role `owner`, `admin`, or `staff`.
- **Parameters**: `storeId` (UUID), `orderId` (UUID).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "018f...",
      "storeId": "018f...",
      "orderNumber": "ORD-1000",
      "customerId": null,
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "fulfillmentStatus": "UNFULFILLED",
      "currency": "USD",
      "subtotal": 5000,
      "discountTotal": 0,
      "shippingTotal": 0,
      "taxTotal": 0,
      "total": 5000,
      "grandTotal": 5000,
      "cancelledAt": null,
      "cancelReason": null,
      "completedAt": null,
      "createdAt": "2026-10-09T...",
      "updatedAt": "2026-10-09T...",
      "items": [ ... ],
      "addresses": [ ... ],
      "statusHistory": [ ... ]
    }
  }
  ```
- **Error Responses**:
  - `401 AUTHENTICATION_REQUIRED`: Missing or invalid session.
  - `404 NOT_FOUND`: Caller is not a member of the store (anti-enumeration).
  - `404 ORDER_NOT_FOUND`: Order does not exist or belongs to another store.
  - `400 VALIDATION_ERROR`: Invalid UUID parameters.

### 3.3 Cancel Order
- **Path**: `POST /api/v1/stores/:storeId/orders/:orderId/cancel`
- **Authentication**: Required.
- **Authorization**: Store membership with role `owner` or `admin`. `staff` role is rejected with `403 FORBIDDEN`.
- **Request Body**:
  ```json
  {
    "reason": "Customer requested cancellation prior to fulfillment"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "018f...",
      "status": "CANCELLED",
      "fulfillmentStatus": "CANCELLED",
      "cancelledAt": "2026-10-09T...",
      "cancelReason": "Customer requested cancellation prior to fulfillment",
      ...
    }
  }
  ```
- **Error Responses**:
  - `400 VALIDATION_ERROR`: Missing or invalid reason (empty or > 500 characters).
  - `400 ORDER_CANCELLATION_ERROR`: Order status does not permit cancellation (e.g., `SHIPPED`, `DELIVERED`).
  - `400 ORDER_IMMUTABLE`: Order is already cancelled or completed.
  - `403 FORBIDDEN`: Insufficient role permissions (`staff`).

---

## 4. Authentication, Store Membership, and Role Checks

The API strictly implements the multi-tenant security architecture:
1. **Actor Resolution**:
   - Resolved via `@shopify-clone/auth` session verification.
   - Extracts `actor.userId` from cryptographic session tokens.
2. **Store Membership Resolution**:
   - Enforced via `requireStoreOrNotFound(db, actor.userId, storeId)`.
   - Requires active status (`status = 'ACTIVE'`). Non-active or non-existent memberships immediately abort with HTTP `404 NOT_FOUND`.
   - This deliberate design prevents tenant enumeration (an attacker cannot probe store UUIDs to learn whether a store exists).
3. **Role-Based Authorization (§31 of canonical spec)**:
   - **View Operations (`GET /orders`, `GET /orders/:orderId`)**:
     Permitted for `owner`, `admin`, and `staff` (`hasRoleAtLeast(member.role, "staff")`).
   - **Order Cancellation (`POST /orders/:orderId/cancel`)**:
     Restricted to `owner` and `admin` (`hasRoleAtLeast(member.role, "admin")`). Staff requests are rejected with HTTP `403 FORBIDDEN`.

---

## 5. Tenant-Isolation Guarantees and Supporting Tests

Tenant isolation is verified at multiple architectural layers:
1. **URL Store ID is Never Trusted**:
   The store ID from the route parameter is passed through `requireStoreOrNotFound` to verify authorized membership.
2. **Database Query Scoping**:
   All database queries in `OrderRepository` explicitly filter by `store_id = $1`.
3. **Cross-Tenant Masking**:
   If an authenticated member of Store A requests an order ID belonging to Store B, the endpoint returns `404 ORDER_NOT_FOUND`, identical to a non-existent order. No indication of the order's existence in another tenant is leaked.
4. **Automated Verification in `tests/orders/orders.api.test.ts`**:
   - `rejects non-member user with 404 NOT_FOUND (preventing tenant enumeration)`: Verified.
   - `returns 404 ORDER_NOT_FOUND when accessing an order belonging to another store`: Verified.
   - `returns paginated list of orders scoped to the store`: Verified that Store B's orders never appear in Store A's listing.

---

## 6. Protection Against Public Payment-Status Manipulation

In accordance with strict security requirements:
- **No Public Client Modification**:
  The cancellation route strictly accepts `{ reason: string }` validated through `cancelOrderValidator`. Any unexpected fields (e.g. `paymentStatus`, `status`, `authorizedInternalCall`) are discarded and ignored.
- **Application Boundary Isolation**:
  The route invokes `OrderStatusService.cancelOrder`, which only modifies `status` to `CANCELLED` and `fulfillmentStatus` to `CANCELLED`. It does not touch `paymentStatus`.
- **Guarded Payment Updates**:
  `OrderStatusService.updatePaymentStatus` requires `authorizedInternalCall: true`. Even if an attacker attempted to forge request payloads or headers, the public route handlers do not pass `authorizedInternalCall` and do not expose endpoints for payment updates.
- **Automated Verification**:
  `strictly prevents public client from altering paymentStatus or forging authorizedInternalCall` test verifies that passing `{ reason: "...", paymentStatus: "PAID", authorizedInternalCall: true }` leaves `payment_status` as `PENDING`.

---

## 7. Tests Executed with Exact Results

All tests were executed against an isolated PostgreSQL database container.

### 7.1 Orders API Test Suite (`tests/orders/orders.api.test.ts`)
```text
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects unauthenticated GET /orders with 401 AUTHENTICATION_REQUIRED
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects unauthenticated GET /orders/:orderId with 401 AUTHENTICATION_REQUIRED
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects unauthenticated POST /orders/:orderId/cancel with 401 AUTHENTICATION_REQUIRED
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects non-member user with 404 NOT_FOUND (preventing tenant enumeration)
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects staff member attempting cancellation with 403 FORBIDDEN
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > Authentication & Authorization Gates > rejects invalid non-UUID storeId and orderId with 400 VALIDATION_ERROR
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders (List Orders) > returns paginated list of orders scoped to the store
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders (List Orders) > supports staff members viewing orders
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders (List Orders) > filters orders by status
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders (List Orders) > rejects invalid status filter parameter with 400 VALIDATION_ERROR
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders (List Orders) > rejects invalid limit parameter with 400 VALIDATION_ERROR
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders/[orderId] (Get Order Detail) > returns complete order detail including items and addresses
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders/[orderId] (Get Order Detail) > returns 404 ORDER_NOT_FOUND for non-existent order
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > GET /api/v1/stores/[storeId]/orders/[orderId] (Get Order Detail) > returns 404 ORDER_NOT_FOUND when accessing an order belonging to another store
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order) > successfully cancels an order and records actor identity in status history
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order) > rejects cancellation without reason with 400 VALIDATION_ERROR
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order) > rejects repeated cancellation of already cancelled order with 400 ORDER_IMMUTABLE
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order) > forbids cancellation of orders in SHIPPED status
 ✓ Orders API Endpoints (/api/v1/stores/[storeId]/orders/*) > POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order) > strictly prevents public client from altering paymentStatus or forging authorizedInternalCall

Test Files  1 passed (1)
Tests       19 passed (19)
Duration    29.88s
```

### 7.2 Regression Suites
- `tests/orders/order.domain.test.ts`: **23 passed (23)**
- `tests/orders/order.service.test.ts`: **8 passed (8)**
- `tests/orders/order-status.service.test.ts`: **8 passed (8)**
- `tests/orders/order.schema.test.ts`: **20 passed (20)**
- `tests/tenant.authorization.test.ts`: **7 passed (7)**

**Total Test Count**: 85 tests executed, 85 passed (100% pass rate).

---

## 8. Typecheck, Lint, and Diff-Check Results

1. **Typechecking**:
   - `pnpm --filter @shopify-clone/orders typecheck`: Exited 0 (No TypeScript errors).
   - `pnpm --filter @shopify-clone/db typecheck`: Exited 0 (No TypeScript errors).
   - `pnpm --filter @shopify-clone/web typecheck`: Exited 0 (No TypeScript errors).
2. **Linting**:
   - `npx eslint "apps/web/app/api/v1/stores/**/orders/**/*.ts" "modules/orders/**/*.ts" "packages/db/src/repositories/orders.ts" "tests/orders/orders.api.test.ts"`: Exited 0 (0 errors, 0 warnings).
3. **Diff Check**:
   - `git diff --check`: Exited 0 (Clean, no whitespace/newline errors).

---

## 9. Known Limitations and Integration Debt Status

In accordance with architectural discipline, integration debt register items remain explicit:
- **INT-01 / INT-04 (Checkout & Payment Integration)**: Orders are not yet triggered automatically by Checkout completion or Payment capture webhooks. Checkout and Payment workflows will connect to `OrderService.createOrderFromCheckout` and `OrderStatusService.updatePaymentStatus` in subsequent cross-domain tasks.
- **INT-05 (Inventory Restoration on Cancellation)**: Section 35 of `specs/orders/order-spec.md` specifies that inventory may need to be restored upon order cancellation. In this task, order cancellation transitions the order and fulfillment state; inventory reservation release is deferred to the Cross-Domain Integration task.
- **INT-06 (Refund Trigger on Cancellation)**: Financial refunds on cancellation remain decoupled and will be invoked through the Payments domain refund service in future workflows.

---

## 10. Scope Confirmation

- **No Public Order Creation**: No public route exists to manufacture orders or submit arbitrary pricing. Order creation remains strictly internal.
- **No Checkout Completion / Payment Mutation**: Neither checkout completion, payment capture, inventory deduction/restoration, nor automated refund processing were implemented or altered in this task.
