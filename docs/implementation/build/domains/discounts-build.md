# Discounts Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Discounts domain in the Demo.

The Discounts domain determines whether a discount can be applied and calculates its effect according to approved business rules.

Discount calculation must remain deterministic, exact, Store-scoped, and safe under concurrent checkout attempts.

The Demo intentionally keeps discount functionality limited. It should provide reliable core behavior without introducing a complex promotion engine.

---

# 2. Domain Ownership

The Discounts module owns:

- Discount definitions.
- Discount codes.
- Discount types.
- Eligibility rules.
- Validity periods.
- Usage limits.
- Usage tracking.
- Discount calculation.
- Discount application decisions.

It does not own:

- Products.
- Inventory.
- Carts.
- Checkout orchestration.
- Payments.
- Orders.
- Customers.
- Store membership.

---

# 3. Module Location

Implementation belongs under:

```text id="k5r8m3"
modules/discounts/
```

Recommended structure:

```text id="v7m4q6"
modules/discounts/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure should follow established repository conventions.

---

# 4. Demo Discount Scope

The Demo should support the approved discount types.

The baseline implementation includes:

```text id="m8q4r7"
Percentage discount
Fixed-amount discount
Discount code
Validity period
Usage limits
Basic eligibility
```

Advanced promotion systems are out of scope.

---

# 5. Explicitly Out of Scope

Do not introduce:

```text id="x5r7m4"
Complex promotion rules engine
Buy-one-get-one engine
Tiered pricing engine
Customer segmentation engine
Advanced stacking engine
Campaign automation
Dynamic personalized promotions
External promotion service
```

unless requirements explicitly change.

---

# 6. Discount Definition

A Discount should contain approved information such as:

```text id="q6m8r5"
id
storeId
name
type
value
currency where applicable
status
startsAt
endsAt
usageLimit where applicable
perCustomerLimit where applicable
createdAt
updatedAt
```

The exact persistence model follows the database specification.

---

# 7. Discount Code

A discount code provides a customer-facing identifier for applying a Discount.

Conceptually:

```text id="v4r7m8"
Store
  ↓
Discount
  ↓
Discount Code
```

The code must belong to the same Store as the Discount.

---

# 8. Code Normalization

Codes should have deterministic normalization rules.

For example, the system may normalize:

```text id="m7q4r6"
leading/trailing whitespace
case representation
```

The exact normalization policy must be consistent across:

```text creation
lookup
validation
checkout
usage tracking
```

---

# 9. Code Uniqueness

Discount codes must be unique within their required Store scope.

The database must enforce the uniqueness constraint.

Application validation should provide a stable conflict error.

---

# 10. Discount Types

The domain should use an explicit enumeration.

Conceptually:

```text id="x8r5m4"
PERCENTAGE
FIXED_AMOUNT
```

Do not accept arbitrary discount type strings.

---

# 11. Percentage Discounts

Percentage discounts must use an exact representation.

Example:

```text id="q5m8r4"
10%
```

The implementation must define:

- Maximum allowed percentage.
- Precision.
- Rounding policy.
- Minimum/maximum discount where required.

These rules must be consistent throughout the system.

---

# 12. Fixed Amount Discounts

Fixed discounts must use exact monetary representation.

Example:

```text id="v7r4m8"
€10.00
```

The implementation must never calculate authoritative discount values using floating-point arithmetic.

---

# 13. Currency

Fixed-amount discounts must have an explicit currency where required.

The discount currency must be compatible with the Store/checkout currency rules.

Currency mismatches must produce a deterministic business error.

---

# 14. Discount Status

Discount lifecycle should use the approved state machine.

Typical states may include:

```text id="m4q8r6"
DRAFT
ACTIVE
INACTIVE
EXPIRED
```

The exact approved states remain authoritative.

---

# 15. Validity Period

A Discount may define:

```text id="x6r5m8"
startsAt
endsAt
```

Eligibility must evaluate the current authoritative time.

The client must not provide the time used for validity evaluation.

---

# 16. Boundary Semantics

The implementation must define whether:

```text id="q8m4r5"
startsAt
endsAt
```

are inclusive or exclusive.

The same rule must be used during:

```text discount validation
checkout
usage recording
tests
```

---

# 17. Time Handling

All discount validity checks must use the application's approved time abstraction.

Do not scatter direct system-clock calls throughout domain logic if doing so makes testing difficult.

---

# 18. Eligibility

Eligibility determines whether a Discount may apply to a specific checkout.

The Demo should keep eligibility rules deliberately simple.

Examples may include:

```text id="v5r7m4"
Active discount
Within validity period
Valid code
Minimum order value where supported
Eligible Store
```

---

# 19. Product Eligibility

If the Demo supports product-specific eligibility, it must be implemented explicitly.

Do not create generalized rule evaluation when a simple deterministic condition is sufficient.

---

# 20. Customer Eligibility

If customer-specific limits are supported, the system must identify the Customer through trusted server-side context.

Never trust a client-supplied customer identifier to determine eligibility.

---

# 21. Usage Limits

Discounts may have:

```text id="m8q4r6"
Global usage limit
Per-customer usage limit where supported
```

Usage limits must be enforced transactionally.

---

# 22. Usage Tracking

Usage records should preserve enough information to determine:

```text id="x4r7m5"
Discount
Code
Order/Checkout
Customer where applicable
Store
Timestamp
```

The exact schema follows the approved database model.

---

# 23. Usage Integrity

A successful discount application must not exceed the configured usage limit.

Application-level checks alone are insufficient.

The database transaction must protect the final usage count.

---

# 24. Concurrent Usage

Consider:

```text id="q6m8r4"
Usage limit = 1

Checkout A → applies code
Checkout B → applies same code
```

Only one checkout may consume the final available usage.

The implementation must prevent both transactions from successfully consuming the same final usage slot.

---

# 25. Discount Calculation

Discount calculation should be deterministic.

Conceptually:

```text id="v7r5m8"
Eligible checkout
    ↓
Determine discount type
    ↓
Calculate exact discount
    ↓
Apply rounding policy
    ↓
Cap at eligible subtotal
    ↓
Return calculation result
```

---

# 26. Discount Cannot Exceed Eligible Amount

A discount should not produce an invalid negative subtotal.

For example:

```text id="m5q8r4"
Subtotal = ₹100
Discount = ₹150
```

The final discount must be capped according to the approved pricing rules.

---

# 27. Rounding

Rounding must use one centralized policy.

The implementation should define:

```text id="x8r4m6"
precision
rounding direction
stage of rounding
currency-specific behavior where required
```

Do not allow individual API handlers to implement their own rounding.

---

# 28. Money Calculation

Authoritative calculations must use the approved exact money type/representation.

Avoid:

```text id="q4m7r8"
JavaScript Number
```

for financial calculations.

---

# 29. Discount Application Result

The domain should return a structured calculation result rather than modifying Checkout directly.

Conceptually:

```text id="v6r5m4"
DiscountResult
├── discountId
├── code
├── discountAmount
├── affectedAmount
└── metadata where required
```

---

# 30. Cart Integration

Cart may retain the customer's entered discount code for display if required.

The Cart must not become the authoritative source of discount eligibility.

Checkout must revalidate the code.

---

# 31. Checkout Integration

Checkout should call the Discounts application interface to:

```text id="m7q4r8"
Validate code
Check eligibility
Calculate discount
Reserve/consume usage where required
```

Discounts must not directly manipulate Checkout persistence.

---

# 32. Payment Integration

Discounts do not interact directly with payment providers.

Checkout calculates the final payable amount and passes the authoritative amount to Payments.

---

# 33. Order Integration

Orders should store the historical discount information necessary to explain the completed purchase.

Later changes to the Discount must not modify historical orders.

---

# 34. Discount Usage and Orders

Usage should only be considered successfully consumed according to the approved checkout/order transaction semantics.

A failed payment must not incorrectly consume a discount permanently unless the business rules explicitly require it.

---

# 35. Transaction Boundary

Discount usage updates must occur inside the appropriate transaction boundary established by Checkout.

Do not create a separate transaction that can commit usage independently from the purchase workflow when atomicity is required.

---

# 36. Idempotency

Discount usage must be safe under checkout retries.

The implementation should ensure that a retried checkout cannot consume the same discount usage multiple times for the same logical purchase.

---

# 37. Duplicate Usage Protection

Where appropriate, enforce uniqueness through a database constraint based on the approved business identity.

Possible uniqueness dimensions include:

```text id="x5r8m4"
checkout
order
discount usage event
```

The final constraint must follow the domain model.

---

# 38. Authorization

Merchant discount-management operations require appropriate Store permissions.

Examples:

```text id="q7m4r8"
Create discount
Update discount
Deactivate discount
Manage codes
View usage
```

Customer checkout operations use public/customer context and must not gain merchant privileges.

---

# 39. Tenant Isolation

Every Discount belongs to exactly one Store.

A discount code from Store A must never be usable against Store B checkout.

The implementation must validate Store context before discount lookup and application.

---

# 40. Cross-Tenant Protection

The following must fail safely:

```text id="v8m4r6"
Store A checkout
    ↓
Store B discount code
```

The system must not reveal unnecessary information about another Store's discounts.

---

# 41. Repository Design

Repositories should expose Store-aware operations.

Examples:

```text id="m6r5q8"
findDiscountById(storeId, discountId)
findCode(storeId, normalizedCode)
createDiscount(...)
updateDiscount(...)
recordUsage(...)
```

Exact interfaces should follow existing package conventions.

---

# 42. Application Services

Application services should coordinate:

```text id="x4r8m6"
Store context
Authorization
Validation
Discount lookup
Eligibility
Calculation
Transaction
Usage recording
Events
DTO mapping
```

---

# 43. Domain Logic

The domain owns:

```text id="q8m5r4"
Discount state transitions
Eligibility rules
Discount calculation
Usage semantics
```

API handlers must not reproduce these rules.

---

# 44. DTOs

Use explicit DTOs.

Examples:

```text id="v7r4m8"
DiscountDTO
DiscountCodeDTO
DiscountCalculationDTO
DiscountUsageDTO
```

Never return raw database models.

---

# 45. Error Handling

Use stable shared error codes.

Examples:

```text id="m5q8r6"
DISCOUNT_NOT_FOUND
DISCOUNT_CODE_NOT_FOUND
DISCOUNT_INACTIVE
DISCOUNT_EXPIRED
DISCOUNT_NOT_STARTED
DISCOUNT_NOT_ELIGIBLE
DISCOUNT_USAGE_LIMIT_REACHED
DISCOUNT_CURRENCY_MISMATCH
DISCOUNT_CONFLICT
```

Exact codes belong to the centralized error contract.

---

# 46. API Validation

Validate:

```text id="x6r4m8"
Discount ID
Discount code
Discount type
Discount value
Currency
Validity dates
Usage limits
Eligibility configuration
```

Business rules remain separate from structural validation.

---

# 47. Concurrency

Discount usage is concurrency-sensitive.

At minimum test:

```text id="q7m8r4"
Two checkouts consuming final usage
Two requests applying same code
Usage recording retry
Checkout retry
Discount deactivation during checkout
```

The resulting state must remain valid.

---

# 48. Database Constraints

The database should enforce:

```text id="v5r7m8"
Discount → Store foreign key
Code → Discount relationship
Code uniqueness
Valid required fields
Usage relationships
```

Additional constraints should protect the approved usage model.

---

# 49. Events

The Discounts module may emit facts such as:

```text id="m8q4r6"
DiscountCreated
DiscountUpdated
DiscountActivated
DiscountDeactivated
DiscountApplied
DiscountUsageRecorded
```

Events must be emitted only after the relevant state transition succeeds.

---

# 50. Jobs

Discounts should not require background processing unless a real asynchronous requirement exists.

If expired discounts require cleanup, the system may process them through the shared jobs infrastructure.

Expiration must not be dependent solely on a background job for correctness. Eligibility checks must still evaluate the current validity state.

---

# 51. Testing Strategy

### Unit Tests

Test:

```text id="x7r5m4"
Percentage calculation
Fixed amount calculation
Rounding
Eligibility
Validity windows
Usage rules
State transitions
```

### Integration Tests

Test:

```text id="q5m8r4"
Store isolation
Code uniqueness
Usage limits
Transactions
Database constraints
Concurrent usage
```

### API Tests

Test:

```text id="v8r4m6"
Authentication
Authorization
Validation
Pagination
DTOs
Error mapping
```

---

# 52. Security Tests

At minimum verify:

```text id="m4q7r8"
[ ] Store A cannot manage Store B discounts
[ ] Store A code cannot be applied to Store B checkout
[ ] Customer cannot modify discounts
[ ] Client cannot override Store context
[ ] Usage limits cannot be bypassed through concurrent requests
[ ] Internal discount configuration is not exposed publicly
```

---

# 53. Verification Scenario

The minimum successful discount flow is:

```text id="x6r5m8"
Merchant creates discount
      ↓
Creates discount code
      ↓
Activates discount
      ↓
Customer adds products to Cart
      ↓
Customer enters code during Checkout
      ↓
Discount is validated
      ↓
Discount is calculated exactly
      ↓
Usage is safely recorded
      ↓
Final checkout total reflects discount
      ↓
Order preserves historical discount information
```

---

# 54. Implementation Order

Implement Discounts in this order:

```text id="q8m4r7"
1. Database schema and constraints
2. Discount domain model
3. Discount type/value representation
4. Code normalization
5. Repository interfaces
6. Persistence implementation
7. Discount lifecycle
8. Eligibility logic
9. Calculation logic
10. Usage tracking
11. Concurrency/idempotency protection
12. Events
13. API DTOs and handlers
14. Unit tests
15. Integration tests
16. Security/concurrency tests
17. Checkout integration
18. Order-history verification
```

---

# 55. AI Implementation Rules

AI agents implementing Discounts must:

1. Read the actual root `AGENTS.md`.
2. Read Discount, Checkout, Order, Database, and Money specifications.
3. Preserve exact monetary calculations.
4. Never implement discount logic inside API handlers.
5. Never trust client-supplied Store or Customer identity.
6. Preserve transactional usage limits.
7. Test concurrent final-usage scenarios.
8. Preserve checkout idempotency.
9. Avoid introducing a generic promotion engine.
10. Avoid unrelated changes.
11. Review the final diff.

---

# 56. Definition of Done

Discount implementation is complete when:

```text id="v7r5m4"
[ ] Discount definitions work
[ ] Discount codes work
[ ] Codes are normalized consistently
[ ] Code uniqueness is enforced
[ ] Percentage discounts calculate correctly
[ ] Fixed discounts calculate correctly
[ ] Exact money handling is used
[ ] Rounding is deterministic
[ ] Validity windows work
[ ] Eligibility rules work
[ ] Usage limits are enforced transactionally
[ ] Concurrent usage is safe
[ ] Checkout integration works
[ ] Historical order discount information is preserved
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Stable error codes are used
[ ] Idempotency is preserved
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 57. Final Principle

The Discounts domain answers one question:

```text id="m6q4r8"
"Given this Store, checkout, customer context, and discount code, what discount is legitimately applicable right now?"
```

It must calculate that answer deterministically and transactionally.

It should not become a general-purpose promotion engine before the product actually needs one. The Demo needs reliable discounts, not a PhD thesis in coupon algebra.