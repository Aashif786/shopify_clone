# Integration Verification

## 1. Purpose

This document defines the verification process for cross-domain integration in the Demo.

The platform is a modular monolith, but its modules must behave as independently owned domains connected through explicit interfaces, application services, events, and jobs.

Integration verification ensures that individual modules work correctly **together** without bypassing their ownership boundaries.

---

# 2. Verification Goals

Integration verification must prove:

```text id="x8m4c7"
Modules communicate through approved interfaces
Cross-domain workflows complete correctly
Transactions preserve data integrity
Tenant isolation survives cross-domain operations
Idempotency works across boundaries
Events and jobs produce correct secondary effects
External integrations fail safely
No module bypasses another module's ownership
```

---

# 3. Integration Test Environment

Use a dedicated integration environment containing:

```text id="m5n8v4"
Next.js Web Application
Worker
PostgreSQL
Test Object Storage
Mock/Test Payment Provider
Mock/Test Email Provider
```

External production services must not be required for normal CI integration tests.

---

# 4. Integration Boundary Rule

An integration test should exercise the same public interface that production code uses.

For example:

```text id="q7c4m8"
Checkout
   ↓
Inventory Application Service
```

rather than:

```text id="v8m4x7"
Checkout
   ↓
Inventory Repository
```

The second approach bypasses the Inventory module's business rules.

---

# 5. Domain Integration Matrix

The primary integration relationships are:

| Source | Target | Main Purpose |
|---|---|---|
| Stores | Products | Store ownership |
| Products | Inventory | Variant stock |
| Stores | Customers | Store-scoped customer |
| Customers | Carts | Customer ownership |
| Carts | Checkout | Purchase initiation |
| Products | Checkout | Price revalidation |
| Discounts | Checkout | Discount calculation |
| Inventory | Checkout | Reservation |
| Checkout | Payments | Payment orchestration |
| Payments | Checkout | Payment result |
| Checkout | Orders | Purchase creation |
| Payments | Orders | Payment reference |
| Orders | Notifications | Customer communication |
| Payments | Webhooks | Provider reconciliation |
| Media | Products | Product media |
| Media | Stores | Store media |
| Webhooks | Payments | External payment events |
| Jobs | All async domains | Background work |

---

# 6. Integration Verification Order

Verify integrations in dependency order:

```text id="x4m8c7"
Stores
  ↓
Products
  ↓
Inventory
  ↓
Customers
  ↓
Carts
  ↓
Discounts
  ↓
Checkout
  ↓
Payments
  ↓
Orders
  ↓
Storefront
  ↓
Media
  ↓
Notifications
  ↓
Webhooks
  ↓
Jobs
```

This makes failures easier to localize.

---

# 7. Store Integration

Verify that Store creation provides the context required by downstream domains.

Test:

```text id="m8c4v7"
Create Organization
      ↓
Create Membership
      ↓
Create Store
      ↓
Create Store-owned resource
```

Verify all downstream resources carry the correct `store_id`.

---

# 8. Product Integration

Verify:

```text id="q5n8m4"
Store
 ↓
Product
 ↓
Variant
 ↓
Publication
```

Then confirm:

```text id="v7c4m8"
Published Product
→ Storefront visible

Draft Product
→ Storefront hidden
```

---

# 9. Product and Inventory

Verify that Inventory references valid Product Variants.

Test:

```text id="x8m4c7"
Create Variant
      ↓
Create Inventory
      ↓
Adjust Stock
      ↓
Read Available Quantity
```

Attempt cross-store association and verify rejection.

---

# 10. Customer and Cart

Verify:

```text id="m4n8c7"
Customer
   ↓
Create Cart
   ↓
Add Product Variant
   ↓
Update Quantity
```

Ensure the Cart belongs to the same Store as the Customer and Variant.

---

# 11. Guest Cart

Verify:

```text id="q8c5m4"
Guest
 ↓
Storefront
 ↓
Cart
 ↓
Add Item
 ↓
Checkout
```

The guest must not gain access to another customer's Cart.

---

# 12. Cart and Product Integration

When adding a Cart item:

```text id="v5m8x4"
Variant exists
Variant belongs to Store
Variant is eligible for sale
Quantity is valid
```

The Cart module remains authoritative for Cart mutation.

---

# 13. Cart and Checkout

Verify:

```text id="x7c4m8"
Cart
 ↓
Create Checkout
 ↓
Checkout Items
 ↓
Authoritative Totals
```

Change the Product price after Cart creation and verify that Checkout recalculates the current authoritative price.

---

# 14. Discount and Checkout

Verify:

```text id="m8n4c7"
Valid Discount
 ↓
Checkout
 ↓
Discount Applied
 ↓
Correct Total
```

Also test:

```text id="q4x8m5"
Expired Discount
Invalid Code
Minimum Not Met
Usage Limit Reached
```

---

# 15. Inventory and Checkout

Verify the complete reservation workflow:

```text id="v7c4m8"
Checkout
 ↓
Inventory Reservation
 ↓
Reservation Exists
 ↓
Payment Success
 ↓
Inventory Finalization
```

Failure path:

```text id="x5m8c4"
Checkout
 ↓
Inventory Reservation Fails
 ↓
Payment Not Treated as Successful
 ↓
No Order
```

---

# 16. Concurrent Inventory Integration

Set:

```text id="m4n8x7"
Available stock = 1
```

Run two Checkout attempts concurrently.

Expected:

```text id="q8c5m4"
Checkout A → reservation succeeds
Checkout B → reservation fails
```

Verify:

```text id="v7m4c8"
No negative stock
No duplicate reservation
No incorrect final inventory
```

---

# 17. Checkout and Payments

Verify:

```text id="x8c4m7"
Checkout
 ↓
Create Payment
 ↓
Payment Attempt
 ↓
Test Provider
 ↓
Payment Success
```

Verify that the payment amount equals the authoritative Checkout total.

---

# 18. Payment Failure Integration

Test:

```text id="m5n8c4"
Checkout
 ↓
Payment Attempt
 ↓
Provider Declines
 ↓
Payment Failed
 ↓
Checkout remains incomplete
 ↓
Inventory reservation released where applicable
```

No Order should be created.

---

# 19. Payment Timeout Integration

Simulate:

```text id="q7c4m8"
Provider Timeout
```

Verify that the system does not automatically assume:

```text id="v8m4x7"
Payment Failed
```

when the actual outcome is unknown.

The Payment should enter a recoverable state and be reconcilable.

---

# 20. Payment Webhook Integration

Verify:

```text id="x4n8c7"
Provider Webhook
 ↓
Signature Verification
 ↓
Webhook Persistence
 ↓
Worker
 ↓
Payment State Update
```

Then verify the downstream workflow.

---

# 21. Duplicate Webhook Integration

Send the same provider event twice.

Expected:

```text id="m8c5v4"
Webhook Event → stored once logically
Payment State → updated once
Order → created once
Inventory → finalized once
Notification → not duplicated unnecessarily
```

---

# 22. Out-of-Order Webhook Integration

Send:

```text id="q5n8c4"
PaymentSucceeded
PaymentPending
```

Verify that the later invalid downgrade does not corrupt the Payment state.

---

# 23. Checkout and Orders

Verify successful completion:

```text id="v7m4x8"
Checkout
 ↓
Payment Success
 ↓
Order Created
 ↓
Cart Converted
 ↓
Checkout Completed
```

Verify all records reference the correct Store.

---

# 24. Duplicate Checkout Completion

Execute completion twice concurrently.

Expected:

```text id="x8c4m7"
One Order
One successful purchase outcome
No duplicate payment
No duplicate inventory finalization
```

The second request should resolve according to the established idempotency behavior.

---

# 25. Order and Customer

Verify:

```text id="m4n8c7"
Customer
 ↓
Order
 ↓
Customer Order Listing
```

Customer A must not see Customer B's Orders.

---

# 26. Order Historical Data

Create an Order, then modify:

```text id="q7c5m4"
Product title
Product price
Customer address
Customer name
```

Verify Order snapshots remain unchanged.

---

# 27. Order Cancellation Integration

Verify:

```text id="v8m4c7"
Order
 ↓
Cancellation Request
 ↓
Order State Changed
 ↓
Payment Refund Request where applicable
 ↓
Inventory Restoration where applicable
 ↓
Notification Event
```

Each operation must remain owned by its respective domain.

---

# 28. Media Integration

Verify:

```text id="x5c8m4"
Upload Media
 ↓
Media Ready
 ↓
Associate with Product
 ↓
Publish Product
 ↓
Storefront Displays Media
```

Attempt to associate Store A Media with Store B Product and verify rejection.

---

# 29. Storefront Integration

Verify the complete public catalog flow:

```text id="m8n4c7"
Store Resolution
 ↓
Published Products
 ↓
Product Detail
 ↓
Variant Selection
 ↓
Add to Cart
 ↓
Checkout
```

Unpublished Products must not appear.

---

# 30. Storefront and Inventory

Verify that Storefront availability is informational.

For example:

```text id="q4x8m5"
Product displayed as available
 ↓
Another customer purchases final unit
 ↓
Current customer reaches Checkout
 ↓
Reservation fails
```

The Storefront must not claim inventory was reserved merely because a Product was displayed.

---

# 31. Notifications Integration

Verify:

```text id="v7m4c8"
OrderCreated
 ↓
Notification Created
 ↓
Notification Job
 ↓
Worker
 ↓
Email Adapter
 ↓
Delivery Recorded
```

If email delivery fails:

```text id="x8c5m4"
Order remains successful
Notification retries
```

---

# 32. Webhook and Notification Integration

Verify:

```text id="m5n8c7"
Payment Webhook
 ↓
Payment State Updated
 ↓
PaymentSucceeded Event
 ↓
Notification
```

The webhook processor should not directly send email.

---

# 33. Jobs Integration

Verify that asynchronous work survives application restarts.

Example:

```text id="q7c4m8"
Create Job
 ↓
Stop Worker
 ↓
Start Worker
 ↓
Job Claimed
 ↓
Job Completed
```

The Job must remain durable in PostgreSQL.

---

# 34. Stale Job Integration

Simulate:

```text id="v8m4c7"
Worker A
 ↓
Claims Job
 ↓
Worker crashes
```

Then verify:

```text id="x5n8c4"
Recovery threshold reached
 ↓
Worker B
 ↓
Claims Job
 ↓
Safe execution
```

---

# 35. Tenant Isolation Integration

This is mandatory across the entire system.

Create:

```text id="m8c4x7"
Organization A
Store A
User A

Organization B
Store B
User B
```

Attempt cross-store access across every major domain.

Expected:

```text id="q4n8m5"
No resource leakage
No unauthorized mutation
No cross-store associations
No cross-store payment/order access
No cross-store media access
```

---

# 36. Authorization Integration

Verify permissions across the actual request path.

Example:

```text id="v7m4c8"
HTTP Request
 ↓
Authentication
 ↓
Store Context
 ↓
Membership
 ↓
Authorization
 ↓
Domain Application Service
```

A UI-level restriction must never be the only protection.

---

# 37. API Integration

Verify that the API layer correctly connects:

```text id="x8c5m4"
HTTP
 ↓
Validation
 ↓
Authentication
 ↓
Tenant Context
 ↓
Authorization
 ↓
Application Service
 ↓
Domain
 ↓
Database
```

Failures at each boundary must map to the standard API error format.

---

# 38. Error Propagation

Verify that domain errors become appropriate API errors.

Example:

```text id="m4n8c7"
Inventory shortage
 ↓
INSUFFICIENT_INVENTORY
 ↓
HTTP 409
```

Do not expose raw database or provider exceptions.

---

# 39. Transaction Integration

Force failures at critical points and verify rollback.

Examples:

```text id="q7x4m8"
Checkout creation
Order creation
Inventory reservation
Discount usage
Webhook processing
Refund creation
```

No partial database state should remain where the operation requires atomicity.

---

# 40. Idempotency Integration

Test idempotency across actual module boundaries.

Required workflows:

```text id="v8c4m7"
Checkout completion
Payment creation
Refund
Inventory adjustment
Webhook processing
Notification creation
Job execution
Order creation
```

Repeated requests must produce one logical outcome.

---

# 41. External Service Isolation

Integration tests should use controlled adapters for:

```text id="x5m8c4"
Payment provider
Email provider
Object storage
```

Tests must be able to simulate:

```text id="m7n4c8"
Success
Timeout
5xx
Rate limiting
Malformed response
Unknown outcome
```

---

# 42. Integration Test Data

Use controlled factories.

Each integration test should create only the resources it needs.

Example:

```text id="q8x4m7"
createStore()
createMerchant()
createProduct()
createVariant()
createInventory()
createCustomer()
createCart()
```

Avoid large shared global fixtures.

---

# 43. Integration Test Cleanup

After each test or isolated test group:

```text id="v5c8m4"
Rollback / truncate / recreate test state
```

The strategy must guarantee test independence.

---

# 44. Integration Verification Checklist

Before moving to Demo acceptance, verify:

```text id="x7m4c8"
[ ] Store integration
[ ] Product integration
[ ] Inventory integration
[ ] Customer integration
[ ] Cart integration
[ ] Discount integration
[ ] Checkout integration
[ ] Payment integration
[ ] Order integration
[ ] Storefront integration
[ ] Media integration
[ ] Notification integration
[ ] Webhook integration
[ ] Job integration
[ ] Authentication integration
[ ] Authorization integration
[ ] Tenant isolation
[ ] Error propagation
[ ] Transaction behavior
[ ] Idempotency
[ ] Failure recovery
```

---

# 45. Definition of Done

Integration verification is complete when:

```text id="m8n4c7"
[ ] All required domain integrations have automated tests
[ ] Cross-domain boundaries are respected
[ ] Tenant isolation is verified across integrations
[ ] Authorization is verified across integrations
[ ] Critical workflows are tested end-to-end
[ ] Payment webhook flows are tested
[ ] Inventory concurrency is tested
[ ] Checkout idempotency is tested
[ ] Order creation idempotency is tested
[ ] Worker durability is tested
[ ] External provider failures are simulated
[ ] Transaction rollback is verified
[ ] Duplicate events are verified
[ ] Failure recovery is verified
[ ] Integration suite runs reliably in CI
[ ] No production credentials are required
```