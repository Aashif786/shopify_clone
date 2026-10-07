# Discount Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Discounts** domain of the Shopify-like commerce platform.

The Discounts module owns discount definitions, discount codes, eligibility rules, validation, calculation, usage limits, and discount application state.

Discounts are part of pricing and checkout correctness. The implementation must prevent invalid discounts, unauthorized usage, incorrect calculations, and usage-limit races.

---

## 2. Scope

The Discounts module owns:

- Discount definitions.
- Discount codes.
- Discount types.
- Discount eligibility.
- Discount conditions.
- Discount validity periods.
- Usage limits.
- Customer/store eligibility rules.
- Discount calculation.
- Discount application validation.
- Discount usage tracking.

The module does not own:

- Products.
- Inventory.
- Carts.
- Checkout.
- Payments.
- Orders.
- Customers.

Those domains interact with Discounts through public interfaces.

---

## 3. Domain Position

The relationship is:

```text
Store
  ↓
Discount
  ├── Discount Code
  ├── Eligibility Rules
  └── Usage Records

Checkout
  ↓
Discount Validation
  ↓
Discount Calculation
```

Every Discount belongs to exactly one Store.

---

## 4. Module Location

Implementation belongs under:

```text id="m8q4x2"
modules/discounts/
```

Recommended structure:

```text id="v5n7c1"
modules/discounts/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication.
- Store resolution.
- Authorization.
- Input validation.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Discount use cases.
- Validation orchestration.
- Calculation orchestration.
- Usage tracking.
- Transaction boundaries.

### Domain

Responsible for:

- Discount rules.
- Discount lifecycle.
- Eligibility.
- Calculation.
- Usage constraints.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repository implementations.
- Discount queries.
- Usage persistence.

---

## 6. Discount Entity

Conceptually:

```text id="q7m3x9"
Discount
├── id
├── storeId
├── name
├── type
├── value
├── status
├── startsAt
├── endsAt
├── usageLimit
├── perCustomerLimit
├── createdAt
└── updatedAt
```

The exact schema may evolve.

---

## 7. Discount Types

The Demo should support a deliberately small set of discount types.

Recommended initial types:

```text id="n4c8p2"
PERCENTAGE
FIXED_AMOUNT
```

Additional discount types should only be introduced when required.

---

## 8. Percentage Discount

Example:

```text id="r6x2m7"
10% off
```

The calculation must use exact monetary arithmetic.

Floating-point arithmetic must not be used for financial calculations.

---

## 9. Fixed Amount Discount

Example:

```text id="k9p3v5"
₹500 off
```

The discount amount must use the same currency context as the applicable transaction unless multi-currency discounts are explicitly supported.

---

## 10. Money Representation

Discount values must use exact integer minor units or an equivalent exact representation.

Example:

```text id="x2m8q4"
₹500
→
50000 paise
```

The system must not use JavaScript floating-point numbers as the authoritative monetary representation.

---

## 11. Discount Status

A practical lifecycle is:

```text id="c5v7n3"
DRAFT
ACTIVE
DISABLED
EXPIRED
```

The exact states must match the product requirements.

---

## 12. Discount State Transitions

Typical transitions:

```text id="j8q2m6"
DRAFT → ACTIVE
ACTIVE → DISABLED
ACTIVE → EXPIRED
DISABLED → ACTIVE
```

The application must reject invalid transitions.

---

## 13. Discount Code

A Discount may have one or more customer-entered codes depending on the product model.

Conceptually:

```text id="f3m9x1"
Discount
   ↓
DiscountCode
```

A code should have a normalized representation for lookup.

---

## 14. Discount Code Normalization

Codes should be normalized consistently before lookup.

For example:

```text id="a7q4n8"
" summer10 "
       ↓
"SUMMER10"
```

The normalization rules must be deterministic.

---

## 15. Code Uniqueness

Discount codes should be unique within their Store according to the normalized representation.

Example:

```text id="p8m3x6"
Store A → SUMMER10
Store A → summer10
```

must not create two logically identical codes.

Different Stores may use the same code.

---

## 16. Discount Validity

A Discount is usable only when all required conditions are satisfied:

```text id="u5c9r2"
status = ACTIVE
AND
current time >= startsAt
AND
current time < endsAt
```

If no end time exists, the Discount may remain valid until explicitly disabled.

---

## 17. Time Handling

All persisted timestamps should use a consistent timezone strategy.

Business validation should compare instants rather than relying on server-local time.

The application must not depend on the VPS machine's local timezone.

---

## 18. Eligibility

A Discount may have eligibility requirements such as:

- Minimum order amount.
- Specific products.
- Specific variants.
- Customer eligibility.
- Usage limit.
- Per-customer usage limit.

The Demo should implement only the eligibility rules required by the product scope.

---

## 19. Minimum Order Amount

Example:

```text id="z4m8p2"
Minimum subtotal = ₹2,000
Discount = ₹200
```

The discount applies only when the qualifying subtotal satisfies the configured threshold.

The exact definition of "subtotal" must be explicit and consistent.

---

## 20. Product Eligibility

A Discount may apply to:

- Entire Store.
- Specific Products.
- Specific Variants.

The Discounts module should own the rule describing eligibility.

Product identity validation should use the Products module's public interface where necessary.

---

## 21. Customer Eligibility

A Discount may optionally be restricted to:

- All customers.
- Specific customers.

Customer ownership must remain Store-scoped.

The Discounts module must not directly access Customer internals.

---

## 22. Usage Limits

A Discount may have:

```text id="h7x3m9"
Total usage limit
Per-customer usage limit
```

Examples:

```text id="s2n8c4"
Total limit = 100 uses

Per-customer limit = 1 use
```

---

## 23. Usage Tracking

Usage should be persisted separately from the Discount definition.

Conceptually:

```text id="q5m7x2"
Discount
   ↓
DiscountUsage
   ├── discountId
   ├── customerId?
   ├── orderId?
   ├── checkoutId?
   └── createdAt
```

The exact references depend on the final checkout/order model.

---

## 24. Usage Counting

Usage limits must be enforced transactionally.

The system must not rely on:

```text id="v9c3k8"
SELECT count(*)
↓
if below limit
↓
INSERT usage
```

without concurrency protection.

Two concurrent requests could otherwise exceed the limit.

---

## 25. Usage Limit Concurrency

The implementation should use appropriate database mechanisms such as:

- Row locking.
- Atomic counters.
- Unique constraints.
- Transactional usage insertion.

The selected approach must prevent over-consumption.

---

## 26. Per-Customer Usage

If a Discount allows one use per Customer, the system should enforce the rule through an appropriate unique constraint or transactional mechanism.

Example:

```text id="m6p2x8"
unique(discount_id, customer_id)
```

when the business rule requires one usage record per customer.

---

## 27. Guest Usage

If guest checkout supports Discount usage limits, the system needs a deterministic guest identity/reference.

The Demo may simplify guest discount usage rules if required, but the behavior must be explicitly defined.

---

## 28. Discount Validation

Discount validation should return a structured result rather than a generic boolean.

Conceptually:

```text id="r8q4n5"
DiscountValidationResult
├── valid
├── discountId
├── code
├── reason?
└── calculation
```

This allows Checkout to provide useful user-facing errors without exposing internal details.

---

## 29. Validation Reasons

Potential stable reasons include:

```text id="x7m3c9"
DISCOUNT_NOT_FOUND
DISCOUNT_INACTIVE
DISCOUNT_EXPIRED
DISCOUNT_NOT_STARTED
INVALID_CODE
MINIMUM_AMOUNT_NOT_MET
PRODUCT_NOT_ELIGIBLE
CUSTOMER_NOT_ELIGIBLE
USAGE_LIMIT_REACHED
CUSTOMER_USAGE_LIMIT_REACHED
```

---

## 30. Discount Calculation

The calculation should receive a clearly defined pricing context.

Conceptually:

```text id="n2v8p4"
Pricing Context
├── currency
├── subtotal
├── eligible items
├── customer
└── discount
```

The calculation must produce a deterministic result.

---

## 31. Calculation Example

For a 10% discount:

```text id="q5x9m2"
Eligible subtotal = ₹1,000
Discount = 10%
Discount amount = ₹100
```

For a fixed discount:

```text id="c8r3v7"
Eligible subtotal = ₹1,000
Discount = ₹150
Discount amount = ₹150
```

The calculation must never reduce the applicable amount below zero.

---

## 32. Maximum Discount

If percentage discounts support a maximum discount amount, the rule must be explicit.

Example:

```text id="p4m8x1"
20% off
Maximum discount = ₹500
```

The calculated discount is capped at ₹500.

This capability should only be implemented if included in the product requirements.

---

## 33. Rounding

Discount calculations must define rounding behavior.

The implementation should use the platform's standard money rounding policy consistently.

Rounding must occur deterministically and must not depend on JavaScript floating-point behavior.

---

## 34. Discount Stacking

The Demo should explicitly define whether multiple Discounts may be applied.

Recommended initial behavior:

```text id="d7n2c5"
One discount code per checkout
```

This keeps pricing behavior deterministic.

Advanced discount stacking can be introduced later.

---

## 35. Discount Application

Applying a Discount to Checkout should not permanently modify the Discount definition.

The Checkout stores the applicable discount information required for the transaction.

---

## 36. Checkout Revalidation

A Discount applied earlier may become invalid before payment.

Therefore Checkout must revalidate:

- Status.
- Validity period.
- Eligibility.
- Usage limits.
- Pricing context.

before finalizing the transaction.

---

## 37. Order Snapshot

Once an Order is created, the discount information used for that Order should be preserved.

Historical order data must not depend on future Discount changes.

For example:

```text id="k6q3x9"
Order
├── discount code
├── discount type
├── discount value
└── applied discount amount
```

The exact schema belongs to Orders.

---

## 38. Cart Interaction

The Cart may allow a customer to enter a discount code.

The Cart may display an estimated discount.

However, Cart discount calculations must not become the final financial authority.

Checkout performs final validation.

---

## 39. Checkout Interaction

Checkout should call the Discounts public interface to:

1. Resolve the code.
2. Validate eligibility.
3. Calculate the discount.
4. Revalidate before completion.
5. Record usage after successful transaction completion.

---

## 40. Order Interaction

Orders consume finalized discount information.

The Orders module owns the historical order representation.

Discounts should not modify completed Orders.

---

## 41. Product Interaction

If discounts target specific Products or Variants, the Discounts module may request product information through a public interface.

It must not import Product module internals.

---

## 42. Customer Interaction

If discounts target Customers, the Discounts module should receive validated Store-scoped Customer context.

It must not independently bypass Customer authorization or directly query Customer internals.

---

## 43. Inventory Interaction

Discount eligibility should not modify Inventory.

Inventory remains responsible for stock state.

A discounted product still follows normal inventory reservation and finalization rules.

---

## 44. APIs

Potential merchant endpoints:

```text id="m8c4v2"
GET    /api/v1/discounts
POST   /api/v1/discounts
GET    /api/v1/discounts/{discountId}
PATCH  /api/v1/discounts/{discountId}
POST   /api/v1/discounts/{discountId}/activate
POST   /api/v1/discounts/{discountId}/disable
DELETE /api/v1/discounts/{discountId}
```

Potential code management:

```text id="x3q7n5"
POST   /api/v1/discounts/{discountId}/codes
DELETE /api/v1/discounts/{discountId}/codes/{codeId}
```

Customer-facing validation may use an appropriate Checkout/Cart endpoint rather than exposing internal discount validation APIs.

---

## 45. Authorization

Potential merchant permissions:

```text id="c9m2x6"
discounts.read
discounts.create
discounts.update
discounts.manage
```

Only authorized Store users may create or modify Discounts.

Customers may validate/apply Discounts through supported checkout operations but must not modify definitions.

---

## 46. Tenant Isolation

All Discount queries and mutations must be Store-scoped.

Example:

```text id="v5p8r3"
Store A
  ↓
Discount A

Store B
  ↓
Discount A
  ↓
DENIED
```

Discount codes must also be resolved within the current Store.

---

## 47. Database Constraints

Potential constraints include:

```text id="q8m4x2"
unique(store_id, normalized_code)
usage_count >= 0
usage_limit >= 0
per_customer_limit >= 0
```

Additional constraints should enforce valid relationships and statuses where practical.

---

## 48. Database Indexing

Likely indexes include:

```text id="j3n7c5"
store_id
store_id + status
store_id + normalized_code
starts_at
ends_at
discount_id + created_at
discount_id + customer_id
```

Indexes should follow actual query patterns.

---

## 49. Transactions

Transactions are required for operations where Discount state and usage must change atomically.

Especially:

```text id="r6x9m2"
Validate usage limit
+
Record usage
```

must not be separated into unsafe independent operations.

---

## 50. Idempotency

Discount usage recording must be safe against retries.

For example, if the same successful checkout is processed twice, the system must not count the Discount usage twice.

The implementation should use an appropriate unique business reference such as:

```text id="z4c7p8"
discountId + orderId
```

where appropriate.

---

## 51. Events

Potential events:

```text id="n8m3x6"
DiscountCreated
DiscountActivated
DiscountDisabled
DiscountExpired
DiscountUsed
```

Events represent completed facts.

They must not replace transactional enforcement of Discount rules.

---

## 52. Background Jobs

Potential Discount jobs:

- Expire discounts.
- Clean up temporary records where appropriate.
- Reconcile usage where required.

Expiration should not require a worker for correctness if validity can be calculated directly from timestamps.

The worker is therefore an operational convenience rather than the sole enforcement mechanism.

---

## 53. Error Handling

Potential stable API/application errors:

```text id="k2v7m4"
DISCOUNT_NOT_FOUND
DISCOUNT_CODE_NOT_FOUND
DISCOUNT_ALREADY_EXISTS
DISCOUNT_INACTIVE
DISCOUNT_EXPIRED
DISCOUNT_NOT_STARTED
DISCOUNT_USAGE_LIMIT_REACHED
DISCOUNT_CUSTOMER_LIMIT_REACHED
DISCOUNT_NOT_ELIGIBLE
DISCOUNT_MINIMUM_NOT_MET
INVALID_DISCOUNT_VALUE
DISCOUNT_ACCESS_DENIED
```

Internal implementation details must not leak through the public API.

---

## 54. Testing Strategy

### Unit Tests

Test:

- Percentage calculations.
- Fixed amount calculations.
- Rounding.
- Minimum order conditions.
- Product eligibility.
- Customer eligibility.
- Status transitions.
- Validity periods.

### Integration Tests

Test:

- Discount persistence.
- Code uniqueness.
- Usage limits.
- Per-customer limits.
- Concurrent usage.
- Tenant isolation.
- Transaction behavior.

### API Tests

Test:

- Discount CRUD.
- Authorization.
- Validation.
- Pagination.
- Error contracts.

### E2E Tests

Test:

- Create Discount.
- Activate Discount.
- Apply code at checkout.
- Invalid code.
- Expired Discount.
- Minimum amount failure.
- Usage limit.
- Successful Order with Discount.

---

## 55. Critical Concurrency Tests

```text id="u5p8n3"
[ ] Two customers attempt the final available Discount usage
[ ] Only the permitted number succeeds
[ ] Per-customer limit cannot be bypassed concurrently
[ ] Retried checkout does not double-count usage
[ ] Concurrent Discount updates preserve valid state
[ ] Discount code uniqueness is enforced
```

---

## 56. Critical Business Tests

```text id="w4m9x2"
[ ] Discount is Store-scoped
[ ] Code lookup is Store-scoped
[ ] Inactive Discount cannot be applied
[ ] Expired Discount cannot be applied
[ ] Future Discount cannot be applied
[ ] Minimum amount is enforced
[ ] Eligible products are correctly determined
[ ] Ineligible products receive no discount
[ ] Discount cannot produce a negative total
[ ] Money calculations are exact
[ ] Historical Order discount remains unchanged
```

---

## 57. Implementation Sequence

Recommended implementation order:

```text id="p7c3m8"
1. Define Discount domain model
2. Define Discount Code model
3. Define Discount types
4. Define lifecycle
5. Define eligibility rules
6. Define calculation rules
7. Define usage model
8. Define database schema
9. Create migrations
10. Implement repositories
11. Implement validation service
12. Implement calculation service
13. Implement usage service
14. Implement authorization
15. Implement APIs
16. Integrate with Checkout
17. Integrate with Orders
18. Add events where required
19. Add idempotency
20. Add unit tests
21. Add integration/concurrency tests
22. Add API tests
23. Add E2E tests
```

---

## 58. Demo Simplifications

The Demo intentionally does not require:

- Complex discount stacking.
- Buy-one-get-one promotions.
- Tiered pricing.
- Customer segmentation.
- Geographic promotions.
- Automatic promotion engines.
- Coupon generation at scale.
- Advanced campaign management.
- Loyalty points.
- Dynamic pricing.
- AI-generated promotions.

The Demo should provide a small but correct discount engine.

---

## 59. V1 Evolution

The Discounts module can later support:

- Multiple discount stacking.
- Buy-one-get-one rules.
- Product collections.
- Customer groups.
- Campaigns.
- Scheduled promotions.
- Automatic discounts.
- Advanced promotion conditions.
- Usage analytics.
- Distributed high-volume promotion processing.

The existing module boundary should remain stable as these capabilities are introduced.

---

## 60. Definition of Done

The Discounts implementation is complete when:

```text id="m9x4q7"
[ ] Discount entity exists
[ ] Store ownership is enforced
[ ] Discount lifecycle exists
[ ] Discount codes exist
[ ] Code normalization exists
[ ] Code uniqueness is enforced
[ ] Percentage discounts work
[ ] Fixed amount discounts work
[ ] Exact money representation is used
[ ] Validity periods are enforced
[ ] Minimum order rules work
[ ] Product eligibility works where supported
[ ] Customer eligibility works where supported
[ ] Usage limits exist
[ ] Per-customer limits exist where supported
[ ] Usage is transactionally enforced
[ ] Concurrent usage is safe
[ ] Discount calculations are deterministic
[ ] Rounding rules are defined
[ ] Checkout revalidates Discounts
[ ] Order discount snapshots are preserved
[ ] Idempotent usage recording exists
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] APIs are implemented
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Concurrency tests exist
[ ] API tests exist
[ ] E2E coverage exists
[ ] Documentation matches implementation
```