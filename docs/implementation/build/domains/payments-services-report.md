# Payments Domain and Application Services Report

## 1. Implemented Components

The Payments domain and application services have been implemented following the approved specifications and modular monolith architectural rules:

1. **Domain Models & Invariants:**
   - `modules/payments/src/domain/payment.ts`: The central `Payment` aggregate enforcing monetary integrity (minor units, safe limits), currency formatting, positive amounts, captured amount boundaries (`captured_amount <= amount`), and cumulative refund limits (`refunded_amount <= captured_amount`).
   - `modules/payments/src/domain/payment-attempt.ts`: The `PaymentAttempt` entity managing individual gateway interactions with frozen, immutable amount/currency snapshots and attempt sequence numbering.
   - `modules/payments/src/domain/payment-state.ts`: Canonical state definitions (`CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REQUIRES_RECONCILIATION`, `PARTIALLY_REFUNDED`, `REFUNDED`), transition matrix rules, and transition assertion functions.
   - `modules/payments/src/domain/payment-errors.ts`: Typed, structured domain errors distinguishing not found, cross-store access, illegal state transitions, non-refundable states, monetary/currency errors, idempotency conflicts, and concurrency collisions.

2. **Application Services:**
   - `modules/payments/src/application/payment-service.ts`: Orchestrates payment creation from validated checkout totals, ensures store ownership isolation, prevents duplicate active payments, manages lifecycle transitions, and integrates with PostgreSQL-backed durable idempotency.
   - `modules/payments/src/application/payment-attempt-service.ts`: Manages provider attempt creation with auto-incremented attempt numbers, snapshot immutability, and safe status transitions without fabricating provider credentials.
   - `modules/payments/src/application/refund-service.ts`: Coordinates refund requests, verifies remaining refundable balance, serializes concurrent refund requests with `SELECT ... FOR UPDATE` row locking, and supports two-step confirmation/failure outcomes.

3. **Data Transfer Objects (DTOs):**
   - `modules/payments/src/dto/payment-dto.ts`: Public DTO interfaces (`PaymentDTO`, `PaymentAttemptDTO`, `RefundDTO`).
   - `modules/payments/src/application/dtos.ts`: Input definitions and mapping utilities (`toPaymentDTO`, `toPaymentAttemptDTO`, `toRefundDTO`).

---

## 2. Domain Invariants

- **Exact Minor Units Accounting:** All monetary amounts are validated as positive safe integers (e.g., cents, paise). Floating-point values are rejected. Amounts cannot exceed `1_000_000_000_000`.
- **Currency ISO Format:** Currencies must be 3-character uppercase ISO strings (e.g., `USD`, `INR`).
- **Captured Amount Invariant:** `0 <= captured_amount <= amount`.
- **Refund Balance Invariant:** `0 <= refunded_amount <= captured_amount`.
- **Attempt Snapshot Immutability:** An attempt snapshots `amount` and `currency` at creation; they cannot be mutated or regressed.
- **State Machine Integrity:**
  - Standard forward lifecycle: `CREATED -> PENDING -> AUTHORIZED -> CAPTURED`. Direct capture is also supported from `PENDING` and `PROCESSING`.
  - Terminal state immutability: `FAILED`, `CANCELLED`, and `REFUNDED` are irrevocable.
  - Forward movement protection: `CAPTURED` payments cannot regress to `CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, `FAILED`, or `CANCELLED`.
  - Non-refundable rejection: Payments in `CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, `FAILED`, or `CANCELLED` reject refund attempts immediately with `PaymentNotRefundableError`.
  - Ambiguous outcome isolation: Network timeouts or ambiguous states transition to `REQUIRES_RECONCILIATION` instead of blind failures.

---

## 3. Transaction and Idempotency Approach

- **Durable PostgreSQL Idempotency:** Managed via `idempotency_records` table using the `IdempotencyRepository`.
  - Scope: Scoped per operation (`payments:create`, `payments:refund`).
  - Hashing: Canonical JSON serialization hashed via SHA-256 (`computeRequestHash`).
  - Conflict semantics: Reusing an idempotency key with different parameters immediately raises `PaymentIdempotencyConflictError` (HTTP 409).
  - Replay semantics: Repeated requests with identical keys and parameters return the stored completed DTO without re-executing business mutations.
  - In-flight concurrency: Concurrent requests with identical in-progress keys raise `ConcurrentOperationError` (HTTP 409).
- **Atomic Local Transactions:**
  - Payment and initial attempt creation occur within a single database transaction via `runInTransaction(clientOrDb, ...)`.
  - Partial failure causes immediate rollback, releasing idempotency locks.
  - Database transactions are never held open across external gateway calls.

---

## 4. Refund Concurrency Approach

- **Row-Level Serialization:**
  - `RefundService.requestRefund` executes `SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE` using `PaymentRepository.findByIdForUpdate`.
  - This row lock completely serializes concurrent refund requests targeting the same parent payment aggregate.
- **Verification Under Lock:**
  - Under the row-level lock, the application service verifies `payment.getRemainingRefundableAmount() >= amount`.
  - If two concurrent requests each ask for 60% of a captured amount, the first acquires the lock and succeeds, while the second reads the updated remaining balance under the lock and is cleanly rejected with `RefundExceedsCapturedAmountError`.
- **Two-Step Outcome Support:**
  - Local reservation creates a `PENDING` refund record without prematurely marking provider success.
  - `recordRefundSuccess` applies the refund to the parent payment's `refunded_amount` and transitions payment to `PARTIALLY_REFUNDED` or `REFUNDED`.
  - `recordRefundFailure` updates the refund status to `FAILED` without reducing the parent payment's refundable balance.

---

## 5. Checkout Integration Boundary

- **Trusted Totals Authority:** Payments derives `amount` and `currency` strictly from server-side `checkouts.total` and `checkouts.currency`. Client-supplied amounts are never accepted.
- **Eligibility Preconditions:** Checkouts in `COMPLETED`, `CANCELLED`, `EXPIRED`, or `FAILED` reject payment creation with `InvalidCheckoutStateForPaymentError`. Checkouts with zero total are rejected.
- **Lifecycle Transition:** Checkouts in `OPEN` are automatically transitioned to `PAYMENT_PENDING` upon payment initialization.
- **Active Conflict Protection:** The service checks `PaymentRepository.findActiveByCheckoutId`, rejecting duplicate active payments while permitting customer retries after terminal `FAILED` or `CANCELLED` payments.

---

## 6. Tests and Commands Run

1. **Payments Domain Unit Tests:**
   - Command: `pnpm test tests/payments/payment.domain.test.ts`
   - Result: **22/22 passed** (16ms).
2. **Payments Service Integration Tests:**
   - Command: `pnpm test tests/payments/payment.service.test.ts`
   - Result: **13/13 passed** (17.7s).
3. **Refunds Service Integration Tests:**
   - Command: `pnpm test tests/payments/refund.service.test.ts`
   - Result: **9/9 passed** (12.0s).
4. **Checkout Service Integration Tests (Regression Suite):**
   - Command: `pnpm test tests/checkout/checkout.service.test.ts`
   - Result: **32/32 passed** (43.0s).
5. **Combined Task 3 Test Suite:**
   - Command: `pnpm test tests/payments/payment.domain.test.ts tests/payments/payment.service.test.ts tests/payments/refund.service.test.ts`
   - Result: **44/44 passed** (19.6s).
6. **Lint:**
   - Command: `pnpm eslint modules/payments tests/payments`
   - Result: Exited with code 0 (clean).
7. **Typecheck:**
   - Command: `pnpm typecheck`
   - Result: Exited with code 0 (clean across all 16 workspace projects).
8. **Git Diff Check:**
   - Command: `git diff --check`
   - Result: Exited with code 0 (clean, no whitespace errors).

---

## 7. Blockers and Deferred Functionality

- No external Razorpay API integration was implemented in this task (deferred to Task 4: Provider Integration).
- No webhook API routes or raw-body signature verification were implemented (deferred to Task 5: Webhook Processing).
- No order completion or checkout finalization worker was implemented (deferred to Task 6: Checkout and Order Finalization).

---

## 8. Verdict

**PASS** — All domain entities, invariants, state transitions, application services, idempotency handling, refund concurrency protection, and integration tests have been implemented and verified against PostgreSQL.
