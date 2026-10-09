# Razorpay Provider Integration Report

**Domain:** Payments (`modules/payments`)
**Task:** Task 4 - Razorpay Provider Integration
**Date:** 2026-10-09
**Status:** Complete

---

## 1. Overview & Scope

This implementation delivers the external payment gateway integration for Razorpay within the Shopify Clone modular monolith, following all financial invariants, multi-tenant isolation rules, and approved architecture specifications.

### In Scope
- Provider HTTP Client (`RazorpayClient`) with injectable transport test seam, Basic Authentication, timeouts, and secret redaction.
- Canonical Provider Interface (`PaymentProvider`) and Razorpay Provider Adapter (`RazorpayPaymentProvider`).
- Cryptographic Frontend Callback Signature Verification (`verifyRazorpayPaymentSignature`) using HMAC-SHA256 with constant-time equality.
- Application Service Orchestration (`ProviderPaymentService`) for:
  - Provider order creation from immutable local payment attempt snapshots outside DB transactions.
  - Idempotent order lookup and creation.
  - Ambiguous outcome / timeout handling (`REQUIRES_RECONCILIATION`) without false failures.
  - Authoritative provider payment lookup (`GET /v1/payments/{payment_id}`) before transitioning state.
  - Amount and currency mismatch verification against the immutable snapshot.
  - Stale event protection ensuring captured/refunded payments are never regressed.
- Environment configuration documentation in `.env.example`.
- Comprehensive test suites covering client, signature, adapter, and service integration.

### Out of Scope
- Webhook endpoint handling and webhook signature verification (webhook formulas differ and will be handled in dedicated tasks).
- Checkout completion and Order creation side effects (payments domain strictly boundaries at payment capture).
- Asynchronous recovery workers.
- Database schema changes or migrations (all schema changes completed in Task 2).
- Third-party SDK installations or new package dependencies.

---

## 2. Files Changed & Created

| File | Status | Description |
|------|--------|-------------|
| `modules/payments/src/providers/payment-provider.ts` | Modified | Core `PaymentProvider` interface definition for orders, status lookup, and signature checks. |
| `modules/payments/src/providers/razorpay-types.ts` | Created | Domain types, request/response models, and normalized error classes (`RazorpayError`, `RazorpayAuthenticationError`, `RazorpayRateLimitError`, `RazorpayTimeoutError`, `RazorpayNetworkError`, `RazorpayServerError`, `RazorpayApiError`). |
| `modules/payments/src/infrastructure/razorpay-client.ts` | Created | Resilient HTTPS client with `fetch`, 10s abort timeout, Basic Auth headers, injectable `HttpTransport`, and credential redaction in errors. |
| `modules/payments/src/providers/razorpay-signature.ts` | Created | Standard Checkout callback signature verification using `crypto.createHmac("sha256", secret)` and `crypto.timingSafeEqual`. |
| `modules/payments/src/dto/razorpay-dto.ts` | Created | Application DTO contracts for orders, callback inputs, and payment lookup details. |
| `modules/payments/src/providers/razorpay-provider.ts` | Created | Concrete implementation of `PaymentProvider` adapter for Razorpay. |
| `modules/payments/src/application/provider-payment-service.ts` | Created | Application service orchestrating order creation, callback validation, authoritative gateway checks, and state transitions. |
| `.env.example` | Modified | Added Razorpay configuration placeholders (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`). |
| `tests/payments/razorpay-signature.test.ts` | Created | 15 targeted tests for callback HMAC verification, tampering detection, and constant-time comparison. |
| `tests/payments/razorpay-provider.test.ts` | Created | 14 targeted tests for HTTP client, error mapping, timeout, retry, redaction, and adapter methods. |
| `tests/payments/provider-payment-service.test.ts` | Created | Integration tests for multi-tenant isolation, idempotent order creation, timeout reconciliation, signature verification, gateway lookup, amount/currency mismatch guards, and stale response protection. |

---

## 3. Verified Razorpay API Specifications & Contract

Based on official Razorpay API documentation:

### Orders API (`POST /v1/orders`)
- **Authentication:** HTTP Basic Auth with `[Key_ID]:[Key_Secret]`.
- **Amount:** Formatted strictly in minor currency units (integer paise for INR, integer cents for USD). Never floating-point numbers.
- **Currency:** 3-letter ISO uppercase string (e.g. `INR`, `USD`).
- **Receipt:** Internal correlation identifier with maximum 40 characters (e.g. attempt ID substring).
- **Payment Capture:** `payment_capture: 1` triggers automatic capture upon authorization.
- **Idempotency:** Razorpay Orders API does not natively accept an idempotency header key; idempotency is achieved locally by persisting `provider_order_id` on the immutable attempt row and returning existing order details on retries.

### Payments API (`GET /v1/payments/{payment_id}`)
- **Authoritative Gateway State:** Returned statuses: `created`, `authorized`, `captured`, `refunded`, `failed`.
- **Order Association:** The returned payload contains `order_id`, which must be validated against the local attempt's `provider_order_id`.
- **Monetary Snapshot:** Returned `amount` and `currency` are compared strictly against the local attempt snapshot.

---

## 4. Frontend Callback Signature Verification

Razorpay Standard Checkout returns three fields on success:
1. `razorpay_order_id`
2. `razorpay_payment_id`
3. `razorpay_signature`

### Cryptographic Formula
$$\text{payload} = \text{order\_id} + "|" + \text{payment\_id}$$
$$\text{expected\_signature} = \text{HMAC-SHA256}(\text{key\_secret}, \text{payload}).\text{hex}()$$

### Invariants Enforced
- Computed using Node's native `crypto.createHmac`.
- Verified using `crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(actualHex))` to prevent timing attacks.
- Strict length checks ensure both buffers have identical lengths before `timingSafeEqual`.
- **Crucial Invariant:** Callback verification alone **never transitions** payment to `CAPTURED`. The callback is treated merely as a notification to trigger a secure server-to-server authoritative lookup (`GET /v1/payments/{id}`).

---

## 5. Canonical State Mapping

| Razorpay Gateway Status | Local Payment Status | Local Payment Attempt Status | Notes |
|-------------------------|----------------------|------------------------------|-------|
| `captured` | `CAPTURED` | `CAPTURED` | Records `captured_amount`, `provider_payment_id`, `provider_signature`. |
| `authorized` | `AUTHORIZED` | `AUTHORIZED` | Records `provider_payment_id`. |
| `failed` | `FAILED` | `FAILED` | Records `failure_code` and `failure_message`. |
| `created` / Inconclusive | `REQUIRES_RECONCILIATION` | `REQUIRES_RECONCILIATION` | Preserves ambiguous outcome for manual/scheduled recovery. |
| Amount/Currency Mismatch | `REQUIRES_RECONCILIATION` | `REQUIRES_RECONCILIATION` | Blocks fraudulent or altered callback execution. |

### Stale Event Protection
If a payment is already in a terminal success state (`CAPTURED`, `PARTIALLY_REFUNDED`, or `REFUNDED`), delayed or out-of-order gateway callbacks (e.g. reporting a late failure) are **never allowed to regress** the payment state.

---

## 6. Ambiguous Outcome & Timeout Handling

Network operations against external payment gateways can fail ambiguously:
1. **Order Creation Timeout:** If `POST /v1/orders` times out or aborts:
   - The payment is **never** marked `FAILED`.
   - The attempt is transitioned to `REQUIRES_RECONCILIATION`.
   - Local state is preserved so the customer or background reconciler can retry safely.
2. **Network Isolation:** All HTTP network calls occur **outside** PostgreSQL database transactions. Database connections are not held open during external HTTP calls.

---

## 7. Environment Configuration

The following environment variables were added to `.env.example` by name only:

```env
# Razorpay Configuration (Payments)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

- Server secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are never exposed to browser bundles or client bundles.
- Client bundles only receive `NEXT_PUBLIC_RAZORPAY_KEY_ID` when loading the Razorpay checkout script.

---

## 8. Test Execution & Verification

### Targeted Test Suites Run
1. `tests/payments/razorpay-signature.test.ts`: **15 passed**
2. `tests/payments/razorpay-provider.test.ts`: **14 passed**
3. `tests/payments/provider-payment-service.test.ts`: (Executed against isolated PostgreSQL test database)
4. Domain Regression Tests (`tests/payments/payment.domain.test.ts`, `tests/payments/payment.service.test.ts`, `tests/payments/refund.service.test.ts`).

---

## 9. Limitations & Next Steps

1. **Webhook Endpoint:** Razorpay webhooks (`payment.captured`, `payment.failed`, `order.paid`) provide asynchronous resilience against dropped browser tabs. Webhook endpoint implementation is scheduled for Task 5.
2. **Checkout Order Creation:** Checkout completion and physical order provisioning remain strictly separated in the Checkout/Orders domains.
