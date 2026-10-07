# Discount Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Discounts domain of the Demo commerce platform.

The Discounts domain is responsible for:

- Discount definitions
- Discount codes
- Discount eligibility
- Discount validation
- Discount calculation
- Usage limits
- Usage tracking
- Store-scoped discount management
- Checkout discount application

The Discounts domain does not own:

- Products
- Inventory
- Customers
- Carts
- Checkout
- Payments
- Orders

Those domains interact with Discounts through defined interfaces.

---

# 2. Scope

The Demo Discounts module supports:

- Percentage discounts
- Fixed-amount discounts
- Discount codes
- Store-scoped discounts
- Start and expiration dates
- Minimum order requirements
- Usage limits
- Per-customer usage limits
- Basic product or variant eligibility
- Basic customer eligibility
- Discount validation
- Discount calculation
- Discount usage recording

---

# 3. Out of Scope

The Demo does not require:

- Complex promotion engines
- Buy-one-get-one campaigns
- Buy-X-get-Y campaigns
- Automatic personalized promotions
- Loyalty programs
- Referral systems
- Coupon marketplaces
- Advanced customer segmentation
- Complex promotion stacking
- Dynamic pricing
- AI-generated promotions
- Geographic promotion engines
- Multi-currency promotion optimization

These can be introduced later without changing the fundamental domain boundary.

---

# 4. Domain Ownership

The Discounts module owns:

```text
Discount
DiscountCode
DiscountUsage
```

It is authoritative for:

- discount rules
- discount eligibility
- discount validity
- usage limits
- discount calculation
- discount usage accounting

---

# 5. Discount Entity

Conceptually:

```text
Discount
├── id
├── store_id
├── name
├── description
├── type
├── value
├── minimum_order_amount
├── maximum_discount_amount
├── starts_at
├── expires_at
├── usage_limit
├── per_customer_limit
├── status
├── created_at
└── updated_at
```

The exact schema may evolve as promotion requirements expand.

---

# 6. Discount Types

Demo supports:

```text
PERCENTAGE
FIXED_AMOUNT
```

Examples:

```text
10% off
₹500 off
```

Discount type must be explicit.

---

# 7. Percentage Discounts

For a percentage discount:

```text
discount = eligible_amount × percentage
```

Example:

```text
Eligible amount = ₹2,000
Discount = 10%

Discount = ₹200
```

Percentage values must be validated against configured limits.

---

# 8. Fixed Amount Discounts

For a fixed discount:

```text
discount = configured fixed amount
```

The discount must never reduce an order below zero.

Example:

```text
Subtotal = ₹500
Discount = ₹700

Applied discount = ₹500
Final subtotal = ₹0
```

---

# 9. Money Representation

Discount amounts must use exact monetary representation.

Do not use floating-point arithmetic for financial values.

The implementation should follow the database and domain money strategy.

---

# 10. Discount Code

A discount may optionally have a customer-entered code.

Conceptually:

```text
DiscountCode
├── id
├── discount_id
├── store_id
├── code
├── status
├── created_at
└── updated_at
```

Codes must be unique within the Store.

---

# 11. Code Normalization

Codes should be normalized consistently before lookup.

For example:

```text
SAVE10
save10
Save10
```

should not unintentionally represent different codes unless the product requirements explicitly require case sensitivity.

A normalized representation should be used for uniqueness.

---

# 12. Discount Lifecycle

Demo uses:

```text
DRAFT
ACTIVE
PAUSED
EXPIRED
ARCHIVED
```

Typical lifecycle:

```text
DRAFT
  ↓
ACTIVE
  ↓
PAUSED
  ↓
ACTIVE
  ↓
EXPIRED / ARCHIVED
```

Expired discounts cannot be applied.

---

# 13. Discount Activation

A discount may become usable only when:

```text
status = ACTIVE
```

and:

```text
current_time >= starts_at
```

and, if defined:

```text
current_time < expires_at
```

The server must evaluate these conditions.

---

# 14. Discount Expiration

A discount with an expiration time must no longer be accepted after expiration.

Expiration must be evaluated using server time.

Clients must not provide the authoritative current time.

---

# 15. Store Isolation

Every Discount belongs to exactly one Store.

A discount created for Store A cannot be applied to a cart or checkout belonging to Store B.

This must be enforced server-side.

---

# 16. Minimum Order Amount

A discount may define:

```text
minimum_order_amount
```

Example:

```text
Minimum order = ₹1,000
Cart subtotal = ₹800
```

Result:

```text
Discount rejected
```

The amount used for eligibility must be clearly defined by the pricing rules.

---

# 17. Maximum Discount Amount

Percentage discounts may define:

```text
maximum_discount_amount
```

Example:

```text
20% off
Maximum discount = ₹500
```

For a ₹4,000 eligible amount:

```text
20% = ₹800
Applied discount = ₹500
```

---

# 18. Product Eligibility

Demo may support restricting discounts to:

- all products
- selected products
- selected variants

Eligibility rules must be owned by Discounts.

The Products domain remains authoritative for product identity.

---

# 19. Customer Eligibility

Demo may support:

- all customers
- specific customers

If customer-specific eligibility is enabled, the current customer identity must be validated server-side.

Guest customers must not be treated as authenticated customers.

---

# 20. Guest Discount Usage

Per-customer usage limits cannot reliably be enforced for anonymous guests without a stable identity.

Therefore, Demo should either:

- restrict per-customer discounts to authenticated customers, or
- use a clearly defined guest identity mechanism

The system must not pretend anonymous users have reliable identity merely because they possess a browser cookie.

---

# 21. Usage Limits

A discount may define a total usage limit.

Example:

```text
Usage limit = 1,000
Current usage = 999
```

One more successful usage may be accepted.

Once the limit is reached:

```text
Discount unavailable
```

---

# 22. Per-Customer Usage Limit

A discount may define:

```text
per_customer_limit
```

Example:

```text
Limit = 1
Customer has already used discount = 1
```

Result:

```text
Discount rejected
```

Usage must be associated with the appropriate customer or stable guest identity.

---

# 23. Usage Accounting

Conceptually:

```text
DiscountUsage
├── id
├── discount_id
├── discount_code_id
├── store_id
├── customer_id
├── order_id
├── amount
├── created_at
```

The exact fields may evolve.

Usage records should provide sufficient traceability to understand why a discount was counted.

---

# 24. Usage and Order State

A discount should normally become permanently consumed only when the corresponding purchase is successfully finalized.

Failed payment attempts must not permanently consume a usage slot.

The exact reservation/commit mechanism belongs to Checkout and Discounts integration.

---

# 25. Concurrency

Discount usage limits are concurrency-sensitive.

Example:

```text
Remaining uses = 1

Request A → applies discount
Request B → applies discount
```

The system must not accidentally allow both requests to consume the final usage slot.

Usage validation and commitment must use transactional concurrency control.

---

# 26. Atomic Usage Commitment

The final discount usage operation must be atomic.

Conceptually:

```text
Validate eligibility
      ↓
Check remaining usage
      ↓
Commit usage
      ↓
Create/finalize order
```

The implementation must prevent race conditions around the usage limit.

---

# 27. Discount Calculation

Discount calculation should receive explicit inputs.

Conceptually:

```text
calculateDiscount({
  discount,
  cartLines,
  customer,
  subtotal,
  currency
})
```

The calculation should return:

```text
discount amount
eligible items
reason
```

where appropriate.

---

# 28. Discount Calculation Authority

The client must never determine the final discount amount.

The server calculates:

```text
eligible amount
→ discount rule
→ discount amount
→ capped discount
→ final amount
```

---

# 29. Cart Integration

The Cart may display an applied discount.

However, applying a discount to a Cart does not guarantee that the discount remains valid until checkout.

The discount must be revalidated during checkout.

---

# 30. Checkout Integration

Checkout performs authoritative discount validation.

Conceptually:

```text
Cart
 ↓
Checkout
 ↓
Discount validation
 ↓
Final discount calculation
 ↓
Payment
 ↓
Order
```

Checkout must not blindly trust discount values stored in the Cart.

---

# 31. Discount Revalidation

A discount must be revalidated if:

- the cart changes
- quantities change
- product eligibility changes
- discount expires
- customer identity changes
- checkout resumes after a long period
- discount usage limits change

---

# 32. Multiple Discounts

Demo should use a conservative default:

```text
One discount code per checkout
```

This avoids complex stacking semantics.

Future versions may support multiple discounts with explicit precedence rules.

---

# 33. Automatic Discounts

Demo does not require complex automatic discount campaigns.

If automatic discounts are introduced, they should still pass through the same Discounts domain validation and calculation mechanisms.

---

# 34. Discount Priority

Because Demo supports only one discount code, complex discount priority is unnecessary.

If multiple promotion sources are introduced later, the domain must define:

- eligibility precedence
- stacking rules
- exclusion rules
- maximum discount
- deterministic application order

---

# 35. Discount API

Merchant operations may include:

```text
GET    /stores/{storeId}/discounts
POST   /stores/{storeId}/discounts
GET    /stores/{storeId}/discounts/{discountId}
PATCH  /stores/{storeId}/discounts/{discountId}
POST   /stores/{storeId}/discounts/{discountId}/activate
POST   /stores/{storeId}/discounts/{discountId}/pause
POST   /stores/{storeId}/discounts/{discountId}/archive
```

Customer-facing validation may use:

```text
POST /cart/discount
```

or an equivalent Checkout endpoint.

The final API surface must follow the API architecture specification.

---

# 36. Discount Creation

Creating a discount must validate:

- store access
- discount type
- monetary value
- percentage range
- date range
- usage limits
- minimum order amount
- maximum discount amount
- code uniqueness
- eligibility configuration

---

# 37. Discount Update

Discounts that have already been used require careful mutation rules.

Historical usage must never be rewritten.

For example, changing:

```text
10% → 20%
```

must affect future applications only.

Existing orders must retain their historical discount amounts.

---

# 38. Historical Order Data

Orders must store the final discount information needed to reproduce the historical transaction.

For example:

```text
discount code
discount type
discount value
discount amount
```

The Order must not depend on the current Discount record to determine what happened historically.

---

# 39. Discount Deletion

Hard deletion should generally be avoided once a discount has been used.

Prefer:

```text
ARCHIVED
```

or another inactive state.

Historical usage and order records must remain valid.

---

# 40. Authorization

Merchant discount management requires appropriate store-level permissions.

Suggested permissions:

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| View discounts | Yes | Yes | Yes |
| Create discount | Yes | Yes | Optional |
| Modify discount | Yes | Yes | Optional |
| Activate/pause | Yes | Yes | Optional |
| Archive | Yes | Yes | No |
| View usage | Yes | Yes | Optional |

The exact role mapping must follow the Stores authorization model.

---

# 41. Customer Authorization

Customers may:

- apply eligible discount codes
- view the resulting discount
- remove an applied discount

Customers may not:

- create discounts
- modify discount rules
- modify usage limits
- modify discount usage records
- access merchant discount administration

---

# 42. Error Conditions

The module should expose structured errors such as:

```text
DISCOUNT_NOT_FOUND
DISCOUNT_NOT_ACTIVE
DISCOUNT_EXPIRED
DISCOUNT_NOT_STARTED
DISCOUNT_CODE_INVALID
DISCOUNT_CODE_ALREADY_EXISTS
DISCOUNT_MINIMUM_NOT_MET
DISCOUNT_NOT_ELIGIBLE
DISCOUNT_USAGE_LIMIT_REACHED
DISCOUNT_CUSTOMER_LIMIT_REACHED
DISCOUNT_STORE_MISMATCH
DISCOUNT_CURRENCY_MISMATCH
DISCOUNT_ALREADY_ARCHIVED
```

---

# 43. Currency Validation

Fixed-amount discounts must be compatible with the checkout currency.

Demo should not silently convert fixed discount amounts between currencies.

If multi-currency support is introduced later, explicit conversion rules must be defined.

---

# 44. Rounding

Discount calculations must use the platform's defined money precision and rounding strategy.

Rounding must be deterministic.

The same inputs must produce the same result.

---

# 45. Transaction Strategy

Transactions are required for:

- creating discount + code where both must succeed together
- committing usage
- enforcing usage limits
- finalizing discount application during checkout

Read-only validation may use normal database reads.

---

# 46. Database Constraints

The database should enforce appropriate constraints such as:

```text
Discount.store_id → Store.id
DiscountCode.discount_id → Discount.id
DiscountUsage.discount_id → Discount.id
DiscountUsage.order_id → Order.id
```

Codes should have a store-scoped uniqueness constraint on normalized values.

---

# 47. Indexing

Expected indexes include:

```text
Discount(store_id, status)
Discount(store_id, starts_at, expires_at)
DiscountCode(store_id, normalized_code)
DiscountUsage(discount_id)
DiscountUsage(discount_id, customer_id)
DiscountUsage(order_id)
```

Indexes should be adjusted based on actual query patterns.

---

# 48. Idempotency

Discount application requests may be retried.

The system must avoid creating duplicate usage records for the same finalized transaction.

Order or checkout identifiers should participate in idempotency where appropriate.

---

# 49. Webhooks and External Integrations

Discounts do not directly require external payment integrations.

Payment webhooks are owned by Payments.

If external systems later trigger promotions, they must enter through defined application interfaces rather than modifying Discount tables directly.

---

# 50. Events

The Discounts domain may publish:

```text
DiscountCreated
DiscountActivated
DiscountPaused
DiscountArchived
DiscountApplied
DiscountUsageCommitted
DiscountExpired
```

Events represent completed domain facts.

Consumers must tolerate duplicate delivery.

---

# 51. Background Processing

Potential background jobs include:

- marking expired discounts
- cleaning temporary usage state
- generating usage reports

Expiration does not depend solely on a worker.

The application must validate the actual time window whenever a discount is applied.

---

# 52. Observability

Discount operations should include structured fields such as:

```text
discount_id
discount_code_id
store_id
customer_id
checkout_id
order_id
operation
result
error_code
```

Do not log sensitive customer information unnecessarily.

---

# 53. Security

The Discounts module must protect against:

- cross-store discount use
- unauthorized discount creation
- code enumeration
- usage-limit bypass
- client-controlled discount amounts
- duplicate usage
- replayed requests
- customer identity spoofing

Discount codes should not expose internal database identifiers.

---

# 54. Abuse Prevention

Demo should use basic protections such as:

- rate limiting on code validation where appropriate
- normalized codes
- server-side eligibility checks
- usage limits
- customer limits
- transaction-safe usage accounting

Advanced fraud detection is outside Demo scope.

---

# 55. Testing Requirements

Unit tests must cover:

- percentage calculation
- fixed amount calculation
- minimum order requirements
- maximum discount caps
- date validation
- eligibility
- currency validation
- usage limits
- per-customer limits
- rounding
- invalid discount states

---

# 56. Integration Tests

Integration tests must cover:

- store isolation
- code uniqueness
- usage accounting
- concurrent usage
- customer restrictions
- product restrictions
- checkout integration
- database constraints
- transaction rollback

---

# 57. Concurrency Tests

At minimum, test:

```text
Remaining usage = 1

Request A ─┐
           ├── concurrent application
Request B ─┘

Expected:
Exactly one successful usage
```

The test must verify that the database and application logic prevent over-consumption.

---

# 58. Checkout Failure Tests

Test:

```text
Discount valid
      ↓
Payment fails
      ↓
Order not finalized
      ↓
Discount usage not incorrectly committed
```

The exact reservation model must align with Checkout and Payment specifications.

---

# 59. End-to-End Flow

A complete E2E scenario:

```text
Merchant
  ↓
Create Discount
  ↓
Create Discount Code
  ↓
Activate Discount
  ↓
Customer opens Storefront
  ↓
Adds eligible product
  ↓
Enters code
  ↓
Discount validated
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ↓
Discount usage recorded
```

---

# 60. Anti-Patterns

Do not:

- calculate discounts in the browser
- trust client-provided discount amounts
- let Cart directly modify Discount records
- let Checkout bypass Discount validation
- hard-delete used discounts
- use floating-point money arithmetic
- allow cross-store codes
- consume usage on failed payments
- rely only on background jobs for expiration
- implement complex promotion stacking in Demo
- introduce a dedicated promotion microservice

---

# 61. Demo Implementation Boundary

The Demo implementation should use:

```text
modules/discounts
packages/db
packages/tenant
packages/auth
packages/validation
```

Interactions:

```text
Discounts
 ├── Stores → store ownership and authorization
 ├── Products → eligibility
 ├── Customers → customer eligibility
 ├── Carts → display/application context
 ├── Checkout → authoritative validation
 └── Orders → historical usage reference
```

Discounts must interact with other domains through public interfaces and application services.

---

# 62. Demo-to-V1 Evolution

The domain boundary should support future capabilities such as:

- promotion stacking
- automatic discounts
- customer segments
- product collections
- BOGO promotions
- scheduled campaigns
- loyalty points
- referral discounts
- advanced promotion rules

These should extend the Discounts domain rather than forcing discount logic into Carts or Checkout.

---

# 63. Acceptance Criteria

The Discounts module is complete for Demo when:

- Merchants can create discounts.
- Percentage discounts work.
- Fixed-amount discounts work.
- Discount codes are supported.
- Codes are unique within a Store.
- Discounts have activation and expiration rules.
- Minimum order requirements work.
- Maximum discount limits work.
- Basic product eligibility works where implemented.
- Basic customer eligibility works where implemented.
- Usage limits are enforced transactionally.
- Per-customer limits are enforced where applicable.
- Cross-store discount usage is rejected.
- Client-provided discount amounts are ignored.
- Discount calculations use exact monetary arithmetic.
- Discounts are revalidated during checkout.
- Failed purchases do not incorrectly consume usage.
- Historical order discount information remains stable.
- Used discounts are not destructively deleted.
- Concurrent usage cannot bypass limits.
- Authorization is enforced server-side.
- Integration and E2E tests cover the complete discount lifecycle.  