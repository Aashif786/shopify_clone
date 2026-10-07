# Checkout Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Checkout domain in the Demo.

Checkout is the orchestration boundary that turns Cart intent into an attempted purchase.

It coordinates:

```text id="p7f3m2"
Cart
Products
Inventory
Discounts
Payments
Customers
Orders
```

Checkout must preserve correctness across these domains while remaining the authoritative coordinator for the purchase workflow.

---

# 2. Domain Ownership

The Checkout module owns:

- Checkout identity.
- Checkout lifecycle.
- Checkout state.
- Checkout items/snapshots required during the transaction.
- Checkout expiration.
- Final price calculation orchestration.
- Discount application orchestration.
- Inventory reservation orchestration.
- Payment orchestration.
- Order creation orchestration.
- Purchase completion.
- Purchase cancellation.
- Checkout idempotency.

It does not own:

- Product catalog.
- Inventory quantities.
- Customer profiles.
- Discount definitions.
- Payment-provider implementation.
- Order history outside the checkout-to-order workflow.

---

# 3. Module Location

Implementation belongs under:

```text id="m4r8q7"
modules/checkout/
```

Recommended structure:

```text id="v6m3r5"
modules/checkout/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

---

# 4. Checkout as Orchestrator

Checkout should coordinate domain capabilities rather than directly manipulating other modules' database tables.

Conceptually:

```text id="x7q4m8"
Checkout Application Service
        │
        ├── Cart
        ├── Products
        ├── Inventory
        ├── Discounts
        ├── Customers
        ├── Payments
        └── Orders
```

Each module retains ownership of its own rules and persistence.

---

# 5. Checkout Lifecycle

The Checkout state machine must follow the approved domain specification.

Typical states may include:

```text id="q5r8m4"
OPEN
PAYMENT_PENDING
COMPLETED
CANCELLED
EXPIRED
```

The exact approved state set is authoritative.

---

# 6. State Transitions

State changes must occur through explicit operations.

Examples:

```text id="v8m4r6"
createCheckout()
startPayment()
completeCheckout()
cancelCheckout()
expireCheckout()
```

Invalid transitions must be rejected.

---

# 7. Checkout Creation

The basic flow is:

```text id="m6q4r8"
Resolve Cart
    ↓
Verify Cart ownership
    ↓
Validate Cart state
    ↓
Load authoritative product information
    ↓
Create Checkout
    ↓
Snapshot required purchase information
    ↓
Commit
```

Checkout creation must not assume that Cart pricing remains valid indefinitely.

---

# 8. Checkout Snapshot

Checkout should capture the information required to consistently process the purchase.

Depending on the approved model, this may include:

```text id="x5r7m4"
Variant identity
Product title
SKU
Unit price
Currency
Quantity
Customer information required for purchase
Address information
Discount result
```

The exact snapshot fields must follow the database/domain specification.

---

# 9. Authoritative Pricing

Checkout must recalculate pricing from current authoritative data.

It must not trust:

```text id="q8m5r4"
Client-submitted price
Client-submitted subtotal
Client-submitted discount amount
Client-submitted total
```

---

# 10. Pricing Flow

Conceptually:

```text id="v4r7m8"
Cart
 ↓
Load current Variant prices
 ↓
Calculate subtotal
 ↓
Validate/apply discount
 ↓
Calculate final total
 ↓
Persist Checkout pricing
```

All monetary calculations must use exact money representation.

---

# 11. Cart Revalidation

Before purchase, Checkout must verify:

```text id="m7q4r5"
Cart exists
Cart belongs to correct Store
Cart is owned by the current customer/guest context
Cart is in a valid state
Cart contains valid items
Quantities are valid
Variants remain eligible
```

---

# 12. Empty Cart

Checkout must reject an empty Cart.

The operation should return a stable business error such as:

```text id="x6r8m4"
CART_EMPTY
```

No inventory or payment operation should begin.

---

# 13. Product Revalidation

Every Cart Item must be revalidated against current Product data.

For example:

```text id="q5m8r7"
Variant exists
Variant belongs to Store
Variant is purchasable
Product remains published/eligible
Price is available
```

---

# 14. Inventory Reservation

Checkout must coordinate Inventory reservation before final purchase completion.

Conceptually:

```text id="v7r4m8"
Validate checkout
    ↓
Reserve inventory
    ↓
Proceed with payment
```

The reservation must be transactional and idempotent according to Inventory's contract.

---

# 15. Multiple Inventory Items

When a checkout contains multiple variants, inventory operations must use deterministic ordering.

This reduces deadlock risk when concurrent checkouts contain overlapping inventory.

---

# 16. Reservation Failure

If inventory cannot be reserved:

```text id="m8q4r6"
Do not proceed to payment
Keep purchase incomplete
Return INVENTORY_UNAVAILABLE
```

Previously created reservations in the same workflow must be safely released if the operation fails.

---

# 17. Discount Application

Checkout calls Discounts to:

```text id="x5r7m8"
Validate discount code
Determine eligibility
Calculate discount
```

Discount logic must remain inside the Discounts domain.

---

# 18. Discount Revalidation

A discount that was valid when added to the Cart may no longer be valid during Checkout.

Therefore Checkout must revalidate it using current authoritative state.

---

# 19. Customer Resolution

Checkout must resolve the customer using trusted context.

For authenticated customers:

```text id="q7m4r5"
Session
 ↓
User
 ↓
Customer
 ↓
Checkout
```

For guest checkout, the approved guest identity mechanism must be used.

---

# 20. Address Handling

Checkout should validate the address required for the purchase.

The final Order must receive an immutable address snapshot.

Changing a Customer address after checkout must not change the Order.

---

# 21. Checkout Total

The final checkout amount must be derived from:

```text id="v8m5r4"
Line items
+
approved charges where supported
-
discount
=
final payable amount
```

The exact Demo pricing model must remain intentionally small.

---

# 22. Tax and Shipping

Advanced tax and shipping systems are outside Demo scope unless explicitly introduced.

Do not create placeholder tax engines or complex shipping abstractions merely to appear enterprise-ready.

If the Demo has no tax/shipping calculation, the checkout total should simply reflect the supported pricing components.

---

# 23. Payment Initialization

Once Checkout has established the authoritative payable amount, it may request payment initialization.

Conceptually:

```text id="m4r7q8"
Checkout
    ↓
Payment application interface
    ↓
Payment intent/attempt
    ↓
Provider
```

The provider implementation remains inside Payments.

---

# 24. Payment Amount Integrity

The amount sent to Payments must come from the authoritative Checkout calculation.

The client must never determine the payment amount.

---

# 25. Payment Pending State

A payment may be:

```text id="x6m8r4"
pending
successful
failed
cancelled
```

according to the Payments state model.

Checkout must respond to the payment state rather than guessing it.

---

# 26. Payment Success

Payment success alone is not enough to create a valid order unless the approved workflow establishes the required consistency.

The Checkout workflow must coordinate:

```text id="q5r8m6"
Payment success
Inventory finalization
Order creation
Checkout completion
```

---

# 27. Payment Failure

A payment failure should:

- Preserve the correct payment state.
- Keep the Checkout state consistent.
- Release reservations where appropriate.
- Avoid creating a completed Order.
- Allow retry where the checkout state permits it.

The exact retry flow follows the Payments specification.

---

# 28. Provider Timeout

A provider timeout must not automatically be interpreted as payment failure.

For example:

```text id="v7m4r8"
Request sent
    ↓
Provider timeout
    ↓
Payment state uncertain
```

The system may require webhook confirmation or reconciliation.

---

# 29. Webhook Completion

A payment provider webhook may provide the authoritative external confirmation.

The Webhooks and Payments domains handle:

```text id="m8q4r6"
signature verification
deduplication
event persistence
provider-state normalization
```

Checkout consumes the resulting trusted payment state.

---

# 30. Order Creation

When the purchase reaches the approved completion point, Checkout coordinates Order creation.

The Orders module owns the resulting durable Order.

Conceptually:

```text id="x4r7m5"
Checkout
   ↓
Orders.createFromCheckout(...)
   ↓
Order
```

---

# 31. Order Creation Atomicity

The system must prevent:

```text id="q7m5r8"
successful payment
+
no order
```

from becoming an unrecoverable state.

The exact strategy may involve transactional state transitions, idempotency, durable events, or reconciliation depending on the approved implementation.

---

# 32. Checkout Idempotency

Checkout completion is a critical idempotent operation.

Repeated requests must not create:

```text id="v5r8m4"
duplicate payment
duplicate order
duplicate inventory finalization
duplicate discount usage
```

The application-level idempotency mechanism must be used.

---

# 33. Idempotency Key

For API operations requiring idempotency:

```text id="m6q4r8"
Idempotency-Key
```

should be accepted according to the API contract.

The server must bind the key to the correct operation scope and request fingerprint.

---

# 34. Concurrent Checkout Completion

Two simultaneous completion requests for the same Checkout must produce one logical result.

The implementation must protect:

```text id="x8r5m4"
Checkout completion
Order creation
Payment operation
Inventory finalization
Discount usage
```

from duplicate execution.

---

# 35. Transaction Boundaries

Database transactions should protect state that must change atomically.

Do not keep a database transaction open while calling a payment provider.

A safe conceptual sequence is:

```text id="q4m7r8"
Prepare transaction-critical state
    ↓
Commit required local state
    ↓
External provider interaction
    ↓
Persist provider result
    ↓
Finalize local purchase state
```

The exact implementation must follow the approved payment/checkout architecture.

---

# 36. External Calls

Never perform:

```text id="v6r8m4"
BEGIN TRANSACTION
   ↓
Payment provider HTTP request
   ↓
Email request
   ↓
Object storage request
   ↓
COMMIT
```

External calls must not hold critical database locks unnecessarily.

---

# 37. Checkout Expiration

Checkouts should expire according to the approved policy.

Expiration must:

```text id="m5q8r4"
Transition Checkout state
Release active reservations
Prevent further purchase completion
```

Release must be idempotent.

---

# 38. Expiration Job

A background job may recover expired checkouts.

The job must safely handle:

```text id="x7r4m6"
Checkout already completed
Checkout already cancelled
Checkout already expired
Checkout still active
```

Only eligible checkouts should transition.

---

# 39. Cancellation

Cancellation should be explicit.

Depending on current state, cancellation may require:

```text id="q8m5r4"
Payment cancellation/refund handling
Inventory release
Checkout state transition
```

The Checkout domain coordinates the workflow but does not own provider-specific payment behavior.

---

# 40. Error Handling

Use centralized stable error codes.

Examples:

```text id="v4r8m6"
CHECKOUT_NOT_FOUND
CHECKOUT_EXPIRED
CHECKOUT_NOT_ACTIVE
CART_EMPTY
CHECKOUT_PRICE_CHANGED
INVENTORY_UNAVAILABLE
DISCOUNT_NOT_ELIGIBLE
PAYMENT_FAILED
PAYMENT_PENDING
CHECKOUT_ALREADY_COMPLETED
CHECKOUT_CONFLICT
```

Exact codes remain part of the shared error contract.

---

# 41. Price Change Handling

If Cart pricing differs from current authoritative pricing, Checkout should follow the approved Demo policy.

The implementation must not silently charge a stale Cart price.

Possible behavior:

```text id="m6q4r8"
Recalculate
    ↓
Detect change
    ↓
Return explicit price-change result
```

The exact UX contract should remain consistent.

---

# 42. Checkout DTOs

Use explicit DTOs.

Examples:

```text id="x5r7m4"
CheckoutDTO
CheckoutItemDTO
CheckoutTotalsDTO
CheckoutPaymentDTO
CheckoutStatusDTO
```

Never return raw domain/database objects.

---

# 43. API Integration

Checkout API handlers should remain thin:

```text id="q7m4r8"
Authenticate
    ↓
Resolve Store
    ↓
Resolve Cart/Checkout
    ↓
Validate request
    ↓
Authorize
    ↓
Checkout Application Service
    ↓
DTO/Error response
```

---

# 44. Authorization

Merchant users should not automatically gain the ability to complete customer checkouts.

Customer/guest checkout operations require the appropriate ownership context.

Merchant order-management permissions are handled by the Orders domain.

---

# 45. Tenant Isolation

Every Checkout must be associated with one Store.

The implementation must reject attempts to use:

```text id="v8m4r6"
Store A checkout
+
Store B cart
+
Store B discount
+
Store B inventory
```

as a mixed-tenant transaction.

---

# 46. Event Handling

Checkout may emit facts such as:

```text id="m4q8r5"
CheckoutCreated
CheckoutPaymentPending
CheckoutCompleted
CheckoutCancelled
CheckoutExpired
```

Events should be emitted only after the associated local state transition succeeds.

---

# 47. Background Jobs

Checkout-related jobs may include:

```text id="x6r5m8"
ExpireCheckout
RecoverIncompleteCheckout
ReconcilePendingCheckout
```

Jobs must be durable and idempotent.

Do not use background processing to hide synchronous correctness problems.

---

# 48. Testing Strategy

### Unit Tests

Test:

```text id="q5m8r7"
Checkout state machine
Price calculation
Discount integration decisions
Expiration rules
Cancellation rules
```

### Integration Tests

Test:

```text id="v7r4m6"
Cart revalidation
Inventory reservation
Discount application
Payment integration
Order creation
Transactions
Idempotency
```

### End-to-End Tests

Test the complete purchase path:

```text id="m8q4r5"
Storefront
→ Cart
→ Checkout
→ Payment
→ Order
```

---

# 49. Critical Concurrency Tests

Mandatory scenarios include:

```text id="x4r7m8"
Two completion requests
Two payment initialization requests
Checkout expiration vs completion
Payment webhook vs checkout completion
Inventory reservation vs another checkout
```

Each scenario must produce one valid final state.

---

# 50. Critical Failure Tests

Test:

```text id="q6m5r4"
Inventory unavailable
Payment declined
Payment timeout
Payment webhook delayed
Payment webhook duplicated
Order creation retry
Checkout expiration
Database transaction failure
```

No scenario should silently produce an impossible purchase state.

---

# 51. Security Tests

At minimum verify:

```text id="v8r4m6"
[ ] Customer cannot access another customer's checkout
[ ] Store A cannot access Store B checkout
[ ] Client cannot modify checkout total
[ ] Client cannot choose another Store's Variant
[ ] Client cannot bypass payment
[ ] Client cannot force Checkout to completed state
[ ] Idempotency cannot be bypassed through key reuse
```

---

# 52. Implementation Order

Implement Checkout in this order:

```text id="m7q4r8"
1. Database schema and state model
2. Checkout domain model
3. Checkout repository
4. Cart revalidation
5. Pricing calculation
6. Discount integration
7. Customer/address integration
8. Inventory reservation integration
9. Payment integration
10. Order creation integration
11. Idempotency
12. Expiration/cancellation
13. Events
14. Background jobs
15. API DTOs and handlers
16. Unit tests
17. Integration tests
18. Concurrency/idempotency tests
19. End-to-end purchase verification
```

---

# 53. AI Implementation Rules

AI agents implementing Checkout must:

1. Read the actual root `AGENTS.md`.
2. Read Checkout, Cart, Inventory, Discounts, Payments, Orders, Database, and API specifications.
3. Treat Checkout as an orchestrator, not an owner of other domains' internals.
4. Never trust client-submitted totals.
5. Never call payment providers inside long database transactions.
6. Preserve payment uncertainty semantics.
7. Preserve inventory reservation correctness.
8. Preserve discount usage correctness.
9. Implement completion idempotency.
10. Add concurrency and failure-path tests.
11. Avoid unrelated changes.
12. Review the complete purchase flow after implementation.

---

# 54. Definition of Done

Checkout implementation is complete when:

```text id="x5r8m4"
[ ] Checkout can be created from a valid Cart
[ ] Cart ownership is verified
[ ] Product/Variant data is revalidated
[ ] Prices are recalculated authoritatively
[ ] Discounts are revalidated
[ ] Inventory reservations work
[ ] Payment initialization works
[ ] Payment failures are handled safely
[ ] Payment uncertainty is preserved
[ ] Orders are created exactly once
[ ] Inventory finalization occurs correctly
[ ] Discount usage is correct
[ ] Checkout completion is idempotent
[ ] Expiration works
[ ] Cancellation works
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Stable errors are used
[ ] Events are correct
[ ] Jobs are durable and idempotent
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] End-to-end purchase tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 55. Final Principle

Checkout is the **orchestration boundary for turning intent into a purchase**.

Its most important responsibilities are not visual:

```text id="m8q4r6"
Correct price
Correct inventory
Correct discount
Correct payment state
Correct order
Correct retry behavior
```

A checkout that looks perfect but can create two orders from one payment is not a checkout system. It is a very polished bug generator.