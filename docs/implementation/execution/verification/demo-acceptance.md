# Demo Acceptance

## 1. Purpose

This document defines the final acceptance criteria for the Shopify-like Demo.

The Demo is considered complete only when the platform operates as a real functional commerce system across its critical business lifecycle.

The objective is not to demonstrate isolated screens. The objective is to prove that a merchant can configure a store, publish products, accept a customer purchase, process payment, create an order, and manage the resulting order safely.

---

# 2. Demo Acceptance Principle

The Demo must demonstrate:

```text
Real application behavior
Real persistence
Real authentication
Real tenant isolation
Real authorization
Real inventory handling
Real checkout
Real payment integration
Real order creation
Real background processing
Real error handling
```

Mocked external services are acceptable where explicitly defined, but core business behavior must execute through the actual application architecture.

---

# 3. Primary Demo Scenario

The primary acceptance scenario is:

```text
Merchant
  ↓
Create Store
  ↓
Configure Store
  ↓
Create Product
  ↓
Create Variant
  ↓
Set Inventory
  ↓
Publish Product
  ↓
Customer Visits Storefront
  ↓
Browse Product
  ↓
Add to Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order Created
  ↓
Merchant Views Order
  ↓
Merchant Updates Order
```

This scenario must complete successfully in the Demo environment.

---

# 4. Environment Readiness

Before acceptance testing:

```text
[ ] Web application is running
[ ] Worker is running
[ ] PostgreSQL is running
[ ] Database migrations are applied
[ ] Seed data is available where required
[ ] Required environment variables are configured
[ ] Object storage is available
[ ] Payment test provider is available
[ ] Email test provider/adapter is available
[ ] Application health check passes
[ ] Worker health check passes
```

---

# 5. Authentication Acceptance

Verify:

```text
[ ] Merchant can register/login
[ ] Merchant session is established
[ ] Merchant can logout
[ ] Customer can authenticate where required
[ ] Protected routes reject unauthenticated access
[ ] Invalid credentials are rejected
[ ] Session behavior is correct
```

---

# 6. Organization and Store Acceptance

Verify that a merchant can:

```text
[ ] Create or access an Organization
[ ] Create a Store
[ ] Configure Store information
[ ] View Store settings
[ ] Update Store settings
[ ] Access Store only with appropriate membership
```

Store ownership must be persisted correctly.

---

# 7. Role Acceptance

Verify the main roles:

```text
Owner
Admin
Staff
Customer
```

Test at least:

```text
[ ] Owner can perform permitted administrative operations
[ ] Admin can perform permitted management operations
[ ] Staff has restricted permissions
[ ] Customer cannot access merchant functionality
[ ] Unauthorized operations are rejected server-side
```

---

# 8. Product Acceptance

Merchant must be able to:

```text
[ ] Create Product
[ ] Add Variant
[ ] Set price
[ ] Set SKU where supported
[ ] Set product information
[ ] Associate media
[ ] Save Product
[ ] Publish Product
[ ] Unpublish Product
```

The Product must be persisted in PostgreSQL.

---

# 9. Inventory Acceptance

Merchant must be able to:

```text
[ ] Set initial stock
[ ] View available quantity
[ ] Adjust inventory
[ ] View inventory state
```

Verify that:

```text
available = total stock - reserved stock
```

according to the implemented inventory model.

Inventory must never become negative through normal concurrent operations.

---

# 10. Storefront Acceptance

A customer should be able to:

```text
[ ] Resolve Store
[ ] View published products
[ ] Open product detail
[ ] View variant information
[ ] View price
[ ] View availability information
[ ] Add product to Cart
```

Verify:

```text
Draft Product
→ Not publicly visible

Published Product
→ Publicly visible
```

---

# 11. Cart Acceptance

Verify:

```text
[ ] Cart can be created
[ ] Product Variant can be added
[ ] Quantity can be changed
[ ] Item can be removed
[ ] Cart total is calculated
[ ] Cart persists correctly
[ ] Cart belongs to the correct Store
```

Attempt to add a product belonging to another Store and verify rejection.

---

# 12. Discount Acceptance

Create a valid discount and verify:

```text
[ ] Discount code can be created
[ ] Code can be applied
[ ] Discount is calculated correctly
[ ] Checkout total reflects discount
[ ] Invalid code is rejected
[ ] Expired code is rejected
[ ] Usage limits are enforced
```

All monetary calculations must use exact representations.

---

# 13. Checkout Acceptance

Verify:

```text
Cart
 ↓
Checkout
 ↓
Current Product Pricing
 ↓
Discount Validation
 ↓
Inventory Validation
 ↓
Payment
```

Checkout must recalculate authoritative values rather than trusting client-provided totals.

---

# 14. Inventory Reservation Acceptance

During Checkout:

```text
Available Stock = 5
Requested Quantity = 2
```

Expected:

```text
Reserved = 2
Available = 3
```

After successful purchase:

```text
Reserved = 0
Stock finalized appropriately
```

After failed/cancelled Checkout:

```text
Reservation released
Available stock restored
```

---

# 15. Payment Acceptance

Using the configured test/sandbox provider:

```text
[ ] Payment can be initiated
[ ] Payment amount matches Checkout total
[ ] Successful payment reaches successful state
[ ] Failed payment reaches failed state
[ ] Payment reference is persisted
[ ] Provider response is handled safely
```

The client must not be able to mark a payment successful.

---

# 16. Payment Idempotency Acceptance

Submit the same payment operation multiple times.

Expected:

```text
One logical payment operation
No duplicate charge
No duplicate successful payment state
```

Repeat the request concurrently as well as sequentially.

---

# 17. Webhook Acceptance

Send a valid payment webhook.

Verify:

```text
[ ] Signature is validated
[ ] Event is persisted
[ ] Duplicate event is recognized
[ ] Payment state is updated
[ ] Business workflow continues correctly
```

Send an invalid webhook and verify:

```text
No payment state mutation
No order creation
```

---

# 18. Order Acceptance

A successful purchase must create exactly one Order.

Verify:

```text
[ ] Order is created
[ ] Order has correct Store
[ ] Order has correct Customer
[ ] Order contains correct items
[ ] Quantities are correct
[ ] Prices are correct
[ ] Discount is reflected correctly
[ ] Payment reference is correct
[ ] Historical item data is preserved
[ ] Order status is correct
```

---

# 19. Order Historical Integrity

After creating an Order, modify:

```text
Product name
Product price
Customer name
Customer address
```

Verify that the Order remains historically accurate.

Order snapshots must not silently change because current entities changed.

---

# 20. Merchant Order Management

Merchant must be able to:

```text
[ ] View Orders
[ ] Open Order detail
[ ] View customer information permitted by role
[ ] View payment status
[ ] View order status
[ ] Perform permitted status transitions
```

Invalid state transitions must be rejected.

---

# 21. Customer Order Visibility

Verify that Customer A cannot access Customer B's Order.

Also verify that:

```text
Customer
→ Cannot access merchant-only order APIs
```

even if the Customer knows the resource identifier.

---

# 22. Notification Acceptance

After an accepted Order:

```text
Order Created
 ↓
Notification Event
 ↓
Notification Job
 ↓
Worker
 ↓
Email Adapter
```

Verify the notification is generated and processed.

If delivery fails:

```text
Order remains successful
Notification retries
```

---

# 23. Background Job Acceptance

Verify the Worker processes at least the critical Demo jobs.

Test:

```text
[ ] Job creation
[ ] Job claiming
[ ] Job execution
[ ] Successful completion
[ ] Retry
[ ] Failure handling
[ ] Stale-job recovery
```

Stopping and restarting the Worker must not permanently lose durable jobs.

---

# 24. Media Acceptance

Verify:

```text
[ ] Product media can be uploaded
[ ] Media metadata is persisted
[ ] Media can be associated with Product
[ ] Product can display associated media
[ ] Unauthorized media access is blocked
[ ] Cross-store media association is blocked
```

---

# 25. Tenant Isolation Acceptance

This is a mandatory acceptance gate.

Create:

```text
Store A
Store B
```

Populate both stores with:

```text
Products
Inventory
Customers
Carts
Orders
Media
```

Attempt cross-store access and mutation.

Expected:

```text
All unauthorized cross-store operations fail.
```

No UI, API, repository, job, or background process may bypass tenant boundaries.

---

# 26. Authorization Acceptance

For every major merchant capability:

```text
[ ] Authentication checked
[ ] Store context checked
[ ] Membership checked
[ ] Role permission checked
[ ] Resource ownership checked
```

Verify authorization from direct API calls, not only through the UI.

---

# 27. Error Handling Acceptance

Verify common failures produce safe, predictable responses.

Examples:

```text
Invalid input
Unauthorized access
Resource not found
Insufficient inventory
Invalid discount
Payment failure
Duplicate request
Expired checkout
Invalid webhook
External provider failure
```

Responses must use the standard API error structure.

---

# 28. Concurrency Acceptance

At minimum test:

```text
Two customers buying the final inventory unit
Two identical checkout completion requests
Two identical payment requests
Duplicate webhook delivery
Concurrent inventory adjustments
```

Expected:

```text
No duplicate purchase
No negative inventory
No duplicate order
No duplicate financial effect
```

---

# 29. Idempotency Acceptance

Verify idempotency for:

```text
[ ] Checkout completion
[ ] Payment creation
[ ] Refund
[ ] Order creation
[ ] Inventory adjustment where applicable
[ ] Webhook processing
[ ] Critical jobs
```

Repeated requests must produce the defined single logical outcome.

---

# 30. Security Acceptance

The Demo must pass:

```text
[ ] Authentication verification
[ ] Authorization verification
[ ] Tenant isolation verification
[ ] Input validation verification
[ ] Webhook signature verification
[ ] Secret scanning
[ ] Sensitive logging review
[ ] Dependency security review
```

No known critical security issue may remain open.

---

# 31. API Acceptance

Verify:

```text
[ ] API versioning is consistent
[ ] Request validation works
[ ] Authentication works
[ ] Authorization works
[ ] Tenant context is enforced
[ ] Error responses are consistent
[ ] Pagination works where applicable
[ ] Idempotency works where required
[ ] OpenAPI documentation matches implementation
```

---

# 32. Database Acceptance

Verify:

```text
[ ] All migrations execute successfully
[ ] Database constraints work
[ ] Foreign keys work
[ ] Unique constraints work
[ ] Store-scoped uniqueness works
[ ] Transactions rollback correctly
[ ] Concurrency controls work
[ ] Seed process works
```

---

# 33. Observability Acceptance

Verify:

```text
[ ] Application logs are structured
[ ] Request correlation works
[ ] Worker/job correlation works
[ ] Errors are captured
[ ] Health endpoint works
[ ] Readiness endpoint works
[ ] Critical failures are observable
[ ] Sensitive values are not logged
```

---

# 34. CI Acceptance

The repository must be able to execute the required verification pipeline.

Minimum expected sequence:

```text
Install dependencies
      ↓
Type check
      ↓
Lint
      ↓
Unit tests
      ↓
Integration tests
      ↓
Build
      ↓
E2E tests
```

Security checks should run where configured.

---

# 35. Deployment Acceptance

Verify the Demo deployment on the target VPS environment.

Expected architecture:

```text
Internet
   ↓
Cloudflare
   ↓
VPS
   ├── Web
   ├── Worker
   └── PostgreSQL
          ↓
     Object Storage
```

Verify:

```text
[ ] Deployment succeeds
[ ] Web application starts
[ ] Worker starts
[ ] Database is reachable
[ ] Migrations execute
[ ] Health checks pass
[ ] HTTPS works
[ ] Domain routing works
[ ] Logs are available
```

---

# 36. Restart Acceptance

Restart:

```text
Web
Worker
```

Verify:

```text
[ ] Web recovers
[ ] Worker recovers
[ ] Existing database state remains intact
[ ] Durable jobs remain available
[ ] Sessions behave correctly
```

---

# 37. Failure Recovery Acceptance

Simulate:

```text
Database temporary failure
Payment provider failure
Email provider failure
Object storage failure
Worker restart
Web restart
```

The system must fail predictably without corrupting core business state.

---

# 38. Backup and Restore Acceptance

Verify the documented backup procedure.

At minimum:

```text
[ ] Database backup can be created
[ ] Backup is stored securely
[ ] Backup can be restored to a test environment
[ ] Restored data is usable
[ ] Critical commerce data is present
```

---

# 39. Demo Data Acceptance

The Demo environment should contain enough realistic data to demonstrate:

```text
Multiple Stores
Multiple Products
Multiple Variants
Inventory
Customers
Discounts
Orders
Media
```

Demo data must not use real customer or payment information.

---

# 40. Full End-to-End Acceptance Test

Execute the complete scenario without manually modifying the database.

```text
1. Login as Merchant
2. Create Store
3. Configure Store
4. Create Product
5. Create Variant
6. Set Price
7. Set Inventory
8. Upload Product Media
9. Publish Product
10. Open Storefront
11. Login/register as Customer
12. Browse Product
13. Add Product to Cart
14. Apply Discount
15. Start Checkout
16. Reserve Inventory
17. Complete Test Payment
18. Process Payment Webhook
19. Create Order
20. Process Notification Job
21. Merchant Opens Order
22. Merchant Updates Order
```

Every step must execute through the application.

---

# 41. Full Failure Scenario

Execute:

```text
1. Create Product
2. Set Inventory = 1
3. Customer A adds item
4. Customer B adds item
5. Customer A completes Checkout
6. Customer B attempts Checkout
```

Expected:

```text
Customer A
→ Successful purchase

Customer B
→ Insufficient inventory

Inventory
→ Never negative

Orders
→ Exactly one successful Order
```

---

# 42. Duplicate Purchase Scenario

Execute the same Checkout completion request twice.

Expected:

```text
Request 1
→ Successful completion

Request 2
→ Existing idempotent result

Orders
→ One Order

Payments
→ One logical payment

Inventory
→ One finalization
```

---

# 43. Cross-Tenant Attack Scenario

Execute:

```text
1. Login as Store A user
2. Obtain Store B resource identifier
3. Attempt direct API access
4. Attempt mutation
5. Attempt deletion
6. Attempt media access
7. Attempt order access
```

Expected:

```text
All unauthorized operations fail.
```

---

# 44. Demo Acceptance Gates

The Demo has four mandatory gates.

## Gate 1: Functional

```text
Core commerce lifecycle works.
```

## Gate 2: Data Integrity

```text
Transactions, constraints, inventory, payments,
orders, and idempotency behave correctly.
```

## Gate 3: Security

```text
Authentication, authorization, tenant isolation,
webhooks, secrets, and sensitive data protection pass.
```

## Gate 4: Operational

```text
Deployment, worker processing, health checks,
logging, recovery, and backups work.
```

All four gates must pass.

---

# 45. Blocking Defects

The Demo cannot be accepted with any unresolved issue involving:

```text
Cross-tenant data exposure
Authorization bypass
Payment duplication
Incorrect payment state
Negative inventory
Duplicate order creation
Checkout data corruption
Webhook replay vulnerability
Secret exposure
Authentication bypass
Data loss
Irrecoverable critical jobs
Broken database integrity
```

---

# 46. Non-Blocking Demo Limitations

The following may remain simplified if documented:

```text
Advanced search
Advanced analytics
Complex tax calculation
Advanced shipping
Multi-region infrastructure
High availability
Horizontal scaling
Dedicated search engine
Advanced fraud detection
Enterprise SSO
Advanced theme system
App marketplace
Advanced recommendation systems
```

These are intentionally outside the Demo scope.

---

# 47. Acceptance Evidence

For each major acceptance area, retain evidence such as:

```text
Test results
Screenshots where useful
API responses
Database verification
Application logs
Worker logs
CI results
Deployment results
Security test results
```

Evidence should be sufficient for another engineer to understand why the Demo was accepted.

---

# 48. Final Acceptance Checklist

```text
FUNCTIONAL
[ ] Authentication works
[ ] Store creation works
[ ] Store configuration works
[ ] Product creation works
[ ] Product publication works
[ ] Inventory works
[ ] Storefront works
[ ] Cart works
[ ] Discounts work
[ ] Checkout works
[ ] Payment works
[ ] Webhooks work
[ ] Orders work
[ ] Notifications work
[ ] Media works
[ ] Background jobs work

DATA INTEGRITY
[ ] Transactions verified
[ ] Constraints verified
[ ] Inventory concurrency verified
[ ] Payment idempotency verified
[ ] Checkout idempotency verified
[ ] Order idempotency verified
[ ] Historical snapshots verified

SECURITY
[ ] Authentication verified
[ ] Authorization verified
[ ] Tenant isolation verified
[ ] Object access verified
[ ] Webhook security verified
[ ] Secret handling verified
[ ] Sensitive logging verified

OPERATIONS
[ ] CI passes
[ ] Production build passes
[ ] VPS deployment passes
[ ] Health checks pass
[ ] Worker recovery passes
[ ] Database backup verified
[ ] Database restore verified
[ ] Logging verified

FINAL
[ ] No critical defects remain
[ ] Demo scope is satisfied
[ ] Known limitations are documented
[ ] Acceptance evidence is retained
```

---

# 49. Definition of Done

The Demo is accepted when:

```text
[ ] The complete merchant-to-customer purchase lifecycle works
[ ] Core domain boundaries are preserved
[ ] PostgreSQL remains the transactional source of truth
[ ] Tenant isolation is verified
[ ] Authorization is verified
[ ] Inventory correctness is verified
[ ] Payment correctness is verified
[ ] Order correctness is verified
[ ] Idempotency is verified
[ ] Webhooks are secure and reliable
[ ] Background jobs are durable
[ ] External integrations fail safely
[ ] Security verification passes
[ ] Integration verification passes
[ ] Automated tests pass
[ ] CI passes
[ ] Demo deployment passes
[ ] Backup and restore are verified
[ ] No critical blocking defect remains
```

---

# 50. Demo Completion Statement

Once all acceptance criteria and gates pass, the Demo can be considered a **functional, technically credible commerce platform** suitable for demonstration and continued evolution toward V1.

The next phase should improve scale, infrastructure resilience, operational maturity, and advanced capabilities without changing the established core domain contracts unnecessarily.