# ADR-009: Payment Refund and Capture Integrity

## Status

**Accepted**

## Date

2026-11-04

## Decision

Cancellation refunds, refund status changes, and post-capture order creation follow these rules:

1. A cancellation refund is `SUCCEEDED` only after the configured payment provider confirms the refund amount and currency. A missing provider leaves the refund `PENDING`. A timeout leaves it `REQUIRES_RECONCILIATION`. A rejected refund is `FAILED`. None of these paths invent a provider refund id.
2. `refunded_amount` increases only when a conditional update moves that refund into `SUCCEEDED`. A later `refund.failed` event cannot move `SUCCEEDED` to `FAILED`.
3. A captured-payment webhook is marked processed only after order creation finishes. If the checkout can never become an order, the payment stays `CAPTURED`, `payments.reconciliation_reason` records why, and the webhook stops retrying that workflow. The capture itself is not reversed.
4. Webhook event identity comes from the signed payload id, or from a hash of the exact raw body. The unsigned event-id header is not an identity.

---

## Context

Order cancellation could record a successful refund without calling the provider. Concurrent refund success and failure updates could apply or undo a refunded amount more than once. A captured webhook could be acknowledged after order creation failed, leaving a captured payment with no order and no further retry.
