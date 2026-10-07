# Discounts Implementation

## 1. Purpose

This document defines the concrete implementation of the Discount domain for the Demo.

The Discount domain determines whether a discount can be applied and calculates its effect on an eligible purchase.

It owns:

- Discount definitions.
- Discount codes.
- Discount types.
- Eligibility rules.
- Validity periods.
- Usage limits.
- Discount calculation.
- Usage tracking.
- Store-scoped discount administration.

It does not own:

- Product catalog data.
- Cart state.
- Checkout orchestration.
- Payment processing.
- Order lifecycle.

---

# 2. Domain Ownership

Discount implementation belongs to:

```text id="d7m4c8"
modules/discounts
```

The module may use:

```text id="q8c5m7"
packages/db
packages/tenant
packages/types
packages/validation
```

It may consume Product, Customer, Cart, and Checkout information through public interfaces or application-service inputs.

It must not directly access another domain's internal tables.

---

# 3. Demo Discount Scope

Demo should intentionally support a small but functional discount model.

Supported discount types should include:

```text id="v4m8c7"
Percentage
Fixed Amount
```

Advanced promotion systems such as:

- Buy-one-get-one.
- Complex product bundles.
- Customer segmentation.
- Stacking engines.
- Automatic campaign orchestration.

remain outside the initial implementation unless requirements explicitly expand.

---

# 4. Discount Model

A Discount may contain:

```text id="x7c4m8"
id
store_id
name
type
value
status
starts_at
ends_at
usage_limit
usage_count
created_at
updated_at
```

The exact schema follows the database specification.

---

# 5. Discount Code

A discount may have a customer-facing code.

Example:

```text id="m8c4x7"
SAVE10
```

Codes should be normalized consistently.

If codes are Store-scoped, the database should enforce:

```text id="q5m8c7"
UNIQUE (store_id, normalized_code)
```

---

# 6. Discount Ownership

Every Discount belongs to exactly one Store.

```text id="v8m3c7"
Store
  ↓
Discount
  ↓
Discount Code
```

A discount must never be applied across Stores.

---

# 7. Discount Status

Use explicit lifecycle states.

Example:

```text id="x4m8c7"
Draft
Active
Disabled
Expired
```

The exact states should follow the Discount specification.

---

# 8. Discount Lifecycle

Typical transitions:

```text id="m7c4x8"
Draft → Active
Active → Disabled
Active → Expired
Disabled → Active
```

Invalid transitions must be rejected.

Expired discounts must not become valid merely because an API request supplies an earlier timestamp.

---

# 9. Validity Period

Discount validity may be defined by:

```text id="q8m4c7"
starts_at
ends_at
```

Validation must establish:

```text id="v5m8c4"
starts_at < ends_at
```

where both are provided.

The application should evaluate validity against authoritative server time.

---

# 10. Percentage Discounts

For a percentage discount:

```text id="x7m3c8"
discount = eligible_amount × percentage
```

The implementation must use exact monetary arithmetic.

Do not use floating-point arithmetic for authoritative calculations.

---

# 11. Fixed Discounts

For a fixed discount:

```text id="m8c4x7"
discount = fixed_amount
```

The discount must never reduce the eligible amount below zero.

Conceptually:

```text id="q5c8m7"
final_amount = max(0, eligible_amount - discount)
```

---

# 12. Currency

Fixed-amount discounts must be associated with the correct Store currency.

Do not silently apply a fixed discount in one currency to an amount represented in another.

---

# 13. Eligibility

A discount may have eligibility rules such as:

```text id="v7m4c8"
Minimum purchase amount
Specific product/variant
Specific customer
Active validity period
Usage limit
```

Demo should implement only the eligibility rules explicitly required by the product specification.

---

# 14. Minimum Purchase

If a minimum purchase amount exists:

```text id="x8c4m7"
eligible amount >= minimum purchase
```

must be evaluated using authoritative checkout pricing.

Do not use a client-provided total.

---

# 15. Product Eligibility

If a discount is limited to specific Products or Variants, the Discount module should use a clear eligibility interface.

It should not query Product tables directly.

Conceptually:

```text id="m4c8x7"
Discount
 ↓
Eligibility Rule
 ↓
Product/Variant identifiers
```

---

# 16. Customer Eligibility

If a discount is restricted to specific customers, the application must verify the Customer against the current Store.

Customer eligibility must never bypass tenant isolation.

---

# 17. Usage Limits

Discounts may have:

```text id="q8m3c7"
Total usage limit
```

If supported, a per-customer limit may also be implemented.

Usage limits must be enforced transactionally.

---

# 18. Usage Count

A simple usage counter may be stored:

```text id="v5m8c4"
usage_count
```

However, concurrent redemption must not allow:

```text id="x7c4m8"
usage_count > usage_limit
```

The implementation must use a transaction-safe update or equivalent locking strategy.

---

# 19. Discount Usage Records

Where reliable auditability is required, store individual usage records.

A usage record may contain:

```text id="m8c4x7"
id
discount_id
store_id
customer_id nullable
order_id
created_at
```

This provides stronger protection than relying only on a mutable counter.

---

# 20. Usage Reservation vs Redemption

Discount validation during Checkout should not permanently consume usage before the purchase succeeds.

The implementation should distinguish:

```text id="q4m8c7"
Validation
    ↓
Purchase attempt
    ↓
Successful completion
    ↓
Usage recorded
```

If the Checkout workflow requires temporary reservation semantics, that behavior must be explicitly defined.

---

# 21. Single Discount Rule

For Demo, a checkout should support one discount code unless the product specification explicitly requires stacking.

This keeps the calculation model deterministic.

Do not build a generalized promotion-combination engine prematurely.

---

# 22. Discount Calculation

Discount calculation should be deterministic.

Input should include authoritative checkout information such as:

```text id="v8m3c7"
Store
Customer
Line items
Prices
Quantities
Discount code
Current time
```

Output should include:

```text id="x5c4m8"
Eligible amount
Discount amount
Final amount
Discount identifier
```

---

# 23. Checkout Recalculation

Discounts must be recalculated during Checkout.

The flow should be:

```text id="m7c4x8"
Cart
 ↓
Load authoritative Product prices
 ↓
Determine eligible items
 ↓
Validate Discount
 ↓
Calculate discount
 ↓
Calculate final Checkout total
```

Do not trust a discount amount submitted by the client.

---

# 24. Discount Validation

Validation should check:

```text id="q8m3c7"
Code exists
Store matches
Discount active
Current time within validity period
Usage limit available
Customer eligible
Minimum amount satisfied
Products eligible
Currency compatible
```

The exact checks depend on configured rules.

---

# 25. Invalid Discount Behavior

An invalid code should produce a stable business error.

Example:

```text id="v4m8c7"
INVALID_DISCOUNT
```

Do not expose unnecessary information such as internal discount IDs or usage counts.

---

# 26. Discount Repository

The repository should provide focused operations such as:

```text id="x7m4c8"
create
findById
findByCode
list
update
changeStatus
recordUsage
```

Queries must be Store-scoped.

---

# 27. Discount Application Services

Typical application services include:

```text id="m8c4x7"
createDiscount
getDiscount
listDiscounts
updateDiscount
activateDiscount
disableDiscount
validateDiscount
calculateDiscount
recordUsage
```

The Checkout domain may consume the calculation interface without taking ownership of discount rules.

---

# 28. Discount API

Typical merchant endpoints:

```text id="q5m8c4"
POST   /api/v1/discounts
GET    /api/v1/discounts
GET    /api/v1/discounts/:id
PATCH  /api/v1/discounts/:id
DELETE /api/v1/discounts/:id
```

The exact lifecycle actions should follow the API contract.

---

# 29. Discount Code Input

Customer-facing Checkout requests may include:

```text id="v8m3c7"
discountCode
```

The Checkout API passes it to the Discount application interface.

The client must not submit an authoritative discount amount.

---

# 30. Tenant Isolation

Every Discount operation must be Store-scoped.

This includes:

```text id="x4c8m7"
Create
Read
Update
Delete/Disable
Validate
Calculate
Record usage
```

A code from another Store must never be accepted.

---

# 31. Concurrency

Discount usage limits require concurrency protection.

Example:

```text id="m7c4x8"
Usage limit = 1

Request A → Redeem
Request B → Redeem
```

Only one successful redemption may consume the available usage.

Use appropriate transactional locking or atomic conditional updates.

---

# 32. Idempotency

Recording discount usage must be safe against repeated execution.

For example, the same successful Order should not consume a discount twice because a worker or webhook was retried.

Use a unique business reference where appropriate.

Example:

```text id="q8m3c7"
UNIQUE (discount_id, order_id)
```

if consistent with the domain model.

---

# 33. Discount and Cart Integration

Cart may display an estimated discount.

However, the Discount domain should not permanently consume usage merely because a code was entered into a Cart.

Final validation occurs during Checkout.

---

# 34. Discount and Checkout Integration

Checkout should call:

```text id="v5m8c4"
Discount.validateAndCalculate(...)
```

or an equivalent public interface.

Checkout owns orchestration.

Discounts own eligibility and calculation.

---

# 35. Discount and Order Integration

When an Order is successfully created, the Order should retain the applied discount information required for historical accuracy.

For example:

```text id="x7c4m8"
Discount code
Discount amount
```

The Order must not depend on the current Discount definition to display its historical total.

---

# 36. Discount Events

Potential events include:

```text id="m8c4x7"
DiscountCreated
DiscountActivated
DiscountDisabled
DiscountUsageRecorded
```

Events should contain identifiers and operational context without unnecessary customer information.

---

# 37. Database Constraints

The database should enforce:

```text id="q4m8c7"
store_id NOT NULL
valid discount type
valid status
non-negative discount value
valid dates
unique Store-scoped code
valid foreign keys
```

Usage-related constraints must support concurrency-safe redemption.

---

# 38. Discount Tests

Unit tests should cover:

```text id="v8m3c7"
[ ] Percentage calculation
[ ] Fixed amount calculation
[ ] Zero-floor behavior
[ ] Minimum purchase
[ ] Validity period
[ ] Status validation
[ ] Customer eligibility
[ ] Product eligibility
[ ] Usage limits
[ ] Invalid code
```

---

# 39. Concurrency Tests

Concurrency tests must verify:

```text id="x5c8m4"
[ ] Usage limit cannot be exceeded
[ ] Concurrent redemption is safe
[ ] Duplicate usage is prevented
[ ] Repeated Order processing does not double-consume usage
```

These tests should use PostgreSQL transactions rather than mocks alone.

---

# 40. Integration Tests

Verify:

```text id="m7c4x8"
[ ] Discount persistence
[ ] Code uniqueness
[ ] Store isolation
[ ] Usage persistence
[ ] Transaction behavior
[ ] Database constraints
```

---

# 41. Checkout Integration Tests

Verify:

```text id="q8m3c7"
Cart
 ↓
Checkout
 ↓
Discount validation
 ↓
Discount calculation
 ↓
Payment
 ↓
Order
 ↓
Discount usage
```

Test failure cases such as:

```text id="v4m8c7"
Expired code
Invalid code
Usage exhausted
Product not eligible
Customer not eligible
Minimum amount not met
```

---

# 42. API Tests

Test:

```text id="x8m4c7"
[ ] Create discount
[ ] List discounts
[ ] Get discount
[ ] Update discount
[ ] Activate discount
[ ] Disable discount
[ ] Invalid discount
[ ] Duplicate code
[ ] Unauthorized discount
[ ] Cross-tenant discount
```

---

# 43. Observability

Useful Discount operational events include:

```text id="m5c8x7"
Discount creation failure
Discount validation failure
Usage-limit conflict
Usage recording failure
```

Do not log customer purchase contents unnecessarily.

---

# 44. Discount Implementation Sequence

Implement in this order:

```text id="q7m4c8"
1. Define Discount schema
2. Define Discount Code representation
3. Define Usage schema
4. Create migrations
5. Implement Discount repository
6. Implement Usage repository
7. Implement Discount domain model
8. Implement lifecycle rules
9. Implement code normalization
10. Implement eligibility rules
11. Implement percentage calculation
12. Implement fixed-amount calculation
13. Implement usage-limit enforcement
14. Implement usage recording
15. Implement Discount application services
16. Implement Discount DTOs
17. Implement merchant APIs
18. Integrate Checkout
19. Integrate Order snapshots
20. Implement Discount events
21. Add unit tests
22. Add integration tests
23. Add concurrency tests
24. Add API tests
25. Verify tenant isolation
```

---

# 45. Definition of Done

Discount implementation is complete when:

```text id="v8m3c7"
[ ] Discount schema exists
[ ] Discount codes are Store-scoped
[ ] Percentage discounts work
[ ] Fixed discounts work
[ ] Exact monetary arithmetic is used
[ ] Validity periods work
[ ] Eligibility rules work
[ ] Usage limits are concurrency-safe
[ ] Duplicate usage is prevented
[ ] Checkout recalculates discounts authoritatively
[ ] Order snapshots preserve applied discount information
[ ] Discount APIs work
[ ] Tenant isolation works
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] API tests pass
```

The Discount domain should answer one question reliably: **given this Store, customer, cart contents, and current time, is this discount valid and exactly how much does it reduce the purchase by?** It should not quietly evolve into a full marketing automation platform because someone discovered conditional promotions on a Tuesday.