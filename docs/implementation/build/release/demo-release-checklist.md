# Demo Release Checklist

## 1. Purpose

This checklist is the final operational gate for releasing the Demo version of the commerce platform.

It combines the required implementation, verification, deployment, security, database, and business-flow checks into one release decision.

A release is approved only when all applicable blocking checks pass.

---

# 2. Release Information

Record:

```text
Release:
Git commit:
Release/tag:
Environment:
Deployment date:
Database migration version:
Deployed by:
```

---

# 3. Scope Verification

Confirm that the release contains only approved Demo functionality.

```text
[ ] Store management
[ ] Authentication
[ ] Tenant isolation
[ ] Products
[ ] Variants
[ ] Inventory
[ ] Customers
[ ] Carts
[ ] Discounts
[ ] Checkout
[ ] Payments
[ ] Orders
[ ] Storefront
[ ] Media
[ ] Notifications
[ ] Webhooks
[ ] Background jobs
```

Confirm that the release does not introduce unapproved infrastructure or scope.

```text
[ ] No unnecessary microservices
[ ] No unnecessary distributed broker
[ ] No unnecessary search engine
[ ] No unnecessary analytics warehouse
[ ] No premature V1 infrastructure
```

---

# 4. Repository Verification

```text
[ ] Working tree reviewed
[ ] Correct branch confirmed
[ ] Correct commit confirmed
[ ] No unintended files committed
[ ] No secrets committed
[ ] Lockfile committed and consistent
[ ] Documentation updated where required
```

---

# 5. AI Instruction Verification

Before implementation/release work:

```text
[ ] Actual root AGENTS.md was read
[ ] Relevant architecture documentation was read
[ ] Relevant implementation specifications were read
[ ] Release/deployment documentation was reviewed
[ ] AI-generated changes were reviewed by a human
```

AI must not be treated as the release authority.

---

# 6. Dependency Verification

```text
[ ] Dependency installation succeeds
[ ] Lockfile resolves successfully
[ ] No unintended dependency changes
[ ] No unnecessary packages added
[ ] Security-relevant dependency issues reviewed
[ ] Build dependencies available
```

---

# 7. TypeScript Verification

```text
[ ] Typecheck passes
[ ] Strict TypeScript remains enabled
[ ] No unjustified any
[ ] No unsafe type suppression
[ ] Public contracts are typed
[ ] Server/client boundaries remain valid
```

---

# 8. Code Quality Verification

```text
[ ] Lint passes
[ ] Format check passes
[ ] No debug code
[ ] No temporary bypasses
[ ] No dead critical code
[ ] No unresolved critical TODOs
[ ] No duplicated business logic introduced
[ ] Module boundaries preserved
[ ] Layer boundaries preserved
```

---

# 9. Build Verification

```text
[ ] Web production build succeeds
[ ] Worker build succeeds
[ ] Required assets generated
[ ] Build works from clean checkout
[ ] No developer-machine dependency
[ ] Build configuration validated
```

---

# 10. Configuration Verification

```text
[ ] Demo environment identified correctly
[ ] Required environment variables present
[ ] Configuration validation succeeds
[ ] Database URL correct
[ ] Authentication secrets configured
[ ] Storage configuration correct
[ ] Payment sandbox configured
[ ] Notification provider configured where required
[ ] Job configuration correct
[ ] Observability configuration correct
```

Verify that no secret is exposed to the client.

---

# 11. Security Verification

```text
[ ] HTTPS enabled
[ ] Secure cookies configured
[ ] Authentication enforced
[ ] Authorization enforced server-side
[ ] Tenant isolation verified
[ ] Input validation active
[ ] CSRF protections appropriate
[ ] CORS restricted appropriately
[ ] Rate limits configured where required
[ ] Webhook signatures verified
[ ] Replay protection active
[ ] Secrets absent from logs
[ ] Secrets absent from repository
```

---

# 12. Database Verification

```text
[ ] PostgreSQL reachable
[ ] Persistent storage verified
[ ] Latest migrations applied
[ ] Migration history consistent
[ ] No unexpected schema drift
[ ] Required indexes exist
[ ] Required constraints exist
[ ] Foreign keys valid
[ ] Unique constraints valid
[ ] Seed data verified where applicable
```

---

# 13. Database Backup Verification

Before a release containing meaningful schema changes:

```text
[ ] Backup exists
[ ] Backup timestamp verified
[ ] Backup location known
[ ] Restore procedure known
[ ] Database rollback implications reviewed
```

---

# 14. Authentication Verification

Test:

```text
[ ] Registration where supported
[ ] Login
[ ] Logout
[ ] Session persistence
[ ] Session expiration
[ ] Invalid credentials
[ ] Unauthorized access
[ ] Password reset where implemented
[ ] Email verification where implemented
```

Verify that authentication failures do not reveal unnecessary account information.

---

# 15. Authorization Verification

Test each supported role:

```text
[ ] Owner
[ ] Admin
[ ] Staff
[ ] Customer
```

Verify:

```text
[ ] Allowed actions succeed
[ ] Forbidden actions fail
[ ] Server-side authorization cannot be bypassed
[ ] Role boundaries remain enforced
```

---

# 16. Tenant Isolation Verification

Create at least two independent tenant contexts.

Verify:

```text
[ ] Store A cannot read Store B data
[ ] Store A cannot modify Store B data
[ ] Store A cannot access Store B products
[ ] Store A cannot access Store B inventory
[ ] Store A cannot access Store B customers
[ ] Store A cannot access Store B orders
[ ] Store A cannot access Store B discounts
[ ] Store A cannot access Store B media
[ ] Store A cannot access Store B jobs
```

This is a blocking release gate.

---

# 17. Store Verification

```text
[ ] Organization creation
[ ] Store creation
[ ] Owner membership
[ ] Store selection
[ ] Store configuration
[ ] Store lifecycle
[ ] Store slug uniqueness
[ ] Merchant access
[ ] Public store resolution
```

---

# 18. Product Verification

```text
[ ] Create Product
[ ] Update Product
[ ] Create Variant
[ ] Update Variant
[ ] Set price
[ ] Set SKU
[ ] Set status
[ ] Publish Product
[ ] Unpublish Product
[ ] Product listing
[ ] Product detail
```

Verify store-scoped identity for SKUs and slugs.

---

# 19. Media Verification

```text
[ ] Upload media
[ ] Validate file type
[ ] Validate file size
[ ] Store metadata
[ ] Associate media with Product
[ ] Display public media
[ ] Protect private media
[ ] Delete/cleanup behavior verified
```

Verify object storage and database metadata remain consistent.

---

# 20. Inventory Verification

```text
[ ] Initial stock
[ ] Stock adjustment
[ ] Inventory movement recorded
[ ] Available quantity calculated correctly
[ ] Reservation created
[ ] Reservation released
[ ] Reservation finalized
[ ] Reservation expiration works
```

Critical test:

```text
[ ] Concurrent checkout cannot oversell inventory
```

---

# 21. Customer Verification

```text
[ ] Create customer
[ ] Customer profile
[ ] Customer address
[ ] Default address
[ ] Update address
[ ] Customer access isolation
[ ] Guest customer behavior
```

Customer information must remain store-scoped.

---

# 22. Cart Verification

```text
[ ] Create guest cart
[ ] Create customer cart
[ ] Add item
[ ] Update quantity
[ ] Remove item
[ ] Recalculate display totals
[ ] Cart ownership enforced
[ ] Cart expiration works
```

Verify:

```text
[ ] Add-to-cart does not reserve inventory
```

---

# 23. Discount Verification

Test:

```text
[ ] Valid discount
[ ] Invalid code
[ ] Expired discount
[ ] Not-yet-active discount
[ ] Minimum-condition failure where supported
[ ] Percentage discount
[ ] Fixed amount discount
[ ] Usage limit
[ ] Duplicate usage protection
```

Verify exact money calculations.

---

# 24. Checkout Verification

```text
[ ] Cart converted to Checkout
[ ] Product data revalidated
[ ] Price revalidated
[ ] Discount revalidated
[ ] Inventory revalidated
[ ] Customer/address validated
[ ] Checkout totals calculated server-side
[ ] Inventory reservation created
[ ] Checkout state transitions correctly
```

Client-provided totals must never become authoritative.

---

# 25. Payment Verification

Using the approved sandbox/test provider:

```text
[ ] Payment initiated
[ ] Successful payment
[ ] Failed payment
[ ] Pending/uncertain payment where supported
[ ] Provider reference stored
[ ] Provider idempotency used
[ ] Duplicate request handled safely
[ ] Payment state normalized locally
```

Critical test:

```text
[ ] Payment retry cannot create duplicate successful payment
```

---

# 26. Webhook Verification

```text
[ ] Webhook endpoint reachable
[ ] Raw body available for signature verification
[ ] Signature verification succeeds
[ ] Invalid signature rejected
[ ] Replay rejected/deduplicated
[ ] Event persisted
[ ] Event processed asynchronously
[ ] Duplicate event safe
[ ] Out-of-order event safe
```

---

# 27. Order Verification

```text
[ ] Successful Checkout creates Order
[ ] Exactly one Order created
[ ] Order number generated correctly
[ ] Order Items persisted
[ ] Product snapshot persisted
[ ] Pricing snapshot persisted
[ ] Customer/address snapshot persisted
[ ] Discount information preserved
[ ] Order status initialized correctly
[ ] Status history recorded
```

---

# 28. Order Management Verification

Merchant:

```text
[ ] Order list
[ ] Order detail
[ ] Order status update
[ ] Order cancellation where supported
```

Customer:

```text
[ ] Customer can view own Order
[ ] Customer cannot view another customer's Order
```

---

# 29. Historical Data Verification

After modifying:

```text
Product
Price
Customer
Address
Discount
```

verify that completed Orders retain their historical values.

Orders must not unexpectedly change because current catalog/customer data changed.

---

# 30. Full Purchase Flow

Execute the complete Demo journey:

```text
Merchant
  ↓
Create Store
  ↓
Create Product
  ↓
Create Variant
  ↓
Set Inventory
  ↓
Publish Product
  ↓
Customer
  ↓
Open Storefront
  ↓
View Product
  ↓
Add to Cart
  ↓
Checkout
  ↓
Apply Discount
  ↓
Reserve Inventory
  ↓
Pay
  ↓
Receive/Process Webhook
  ↓
Create Order
  ↓
Customer sees Order
  ↓
Merchant sees Order
```

This is the primary Demo acceptance flow.

---

# 31. Idempotency Verification

Test repeated requests for:

```text
[ ] Checkout completion
[ ] Payment creation
[ ] Payment webhook
[ ] Refund where supported
[ ] Inventory adjustment
[ ] Inventory reservation
[ ] Order creation
[ ] Background jobs
```

Verify repeated requests do not create duplicate business effects.

---

# 32. Concurrency Verification

At minimum test:

```text
[ ] Concurrent inventory reservations
[ ] Concurrent checkout completion
[ ] Concurrent payment callbacks
[ ] Concurrent webhook delivery
[ ] Concurrent job workers
[ ] Concurrent cart updates where applicable
```

Expected behavior must be deterministic and data-safe.

---

# 33. Background Job Verification

```text
[ ] Job created
[ ] Job claimed
[ ] Job executed
[ ] Job succeeds
[ ] Retryable failure retries
[ ] Non-retryable failure becomes terminal
[ ] Stale job recovered
[ ] Duplicate execution is safe
[ ] Worker shutdown is graceful
```

---

# 34. Notification Verification

Where enabled:

```text
[ ] Notification created
[ ] Correct recipient
[ ] Correct template
[ ] Correct channel
[ ] Delivery job created
[ ] Delivery succeeds
[ ] Retry behavior works
[ ] Duplicate delivery prevented where required
```

---

# 35. Storefront Verification

Public users must be able to:

```text
[ ] Resolve Store
[ ] View published Products
[ ] View Product detail
[ ] Select Variant
[ ] Add to Cart
[ ] Enter Checkout
```

Verify unpublished products are not publicly exposed.

---

# 36. API Verification

```text
[ ] `/api/v1/*` conventions followed
[ ] Authentication enforced
[ ] Tenant context enforced
[ ] Authorization enforced
[ ] Request validation enforced
[ ] DTOs explicit
[ ] Error contract stable
[ ] Pagination correct
[ ] Idempotency supported where required
[ ] OpenAPI documentation updated where applicable
```

---

# 37. Frontend Verification

Test:

```text
[ ] Loading states
[ ] Error states
[ ] Empty states
[ ] Form validation
[ ] Successful submission
[ ] Failed submission
[ ] Refresh behavior
[ ] Browser back/forward behavior
[ ] Session expiration
```

Verify business rules are not enforced only in the browser.

---

# 38. Browser Verification

At minimum test the supported Demo browser environment.

Verify:

```text
[ ] No critical console errors
[ ] No failed required network requests
[ ] No broken navigation
[ ] No broken forms
[ ] No obvious layout failures
```

---

# 39. Responsive Verification

Check representative:

```text
[ ] Desktop
[ ] Tablet
[ ] Mobile
```

Critical commerce flows must remain usable across supported viewport sizes.

---

# 40. Performance Sanity Check

The Demo does not require enterprise-scale performance testing.

Verify:

```text
[ ] Pages load normally
[ ] API responses are reasonable
[ ] Database queries do not obviously degrade
[ ] No runaway polling
[ ] No memory leak observed during normal flow
[ ] Worker does not continuously consume excessive CPU
```

---

# 41. Infrastructure Verification

```text
[ ] VPS reachable
[ ] Firewall active
[ ] HTTPS active
[ ] Cloudflare configuration valid
[ ] Web running
[ ] Worker running
[ ] PostgreSQL running
[ ] Persistent volumes mounted
[ ] Object storage accessible
```

---

# 42. Restart Verification

Restart the Demo environment or relevant services.

Verify:

```text
[ ] PostgreSQL recovers
[ ] Web recovers
[ ] Worker recovers
[ ] Jobs remain recoverable
[ ] Persistent data remains intact
[ ] Storefront works
[ ] Authentication works
```

---

# 43. Observability Verification

```text
[ ] Structured logs available
[ ] Request correlation available
[ ] Worker/job correlation available
[ ] Errors reported
[ ] Sentry functioning where configured
[ ] Health endpoints work
[ ] Readiness checks work
```

No secrets or sensitive payment credentials should appear in logs.

---

# 44. Deployment Verification

```text
[ ] Correct Git revision deployed
[ ] Build completed successfully
[ ] Migration completed
[ ] Web restarted
[ ] Worker restarted
[ ] Health checks passed
[ ] Smoke tests passed
[ ] Logs reviewed
```

---

# 45. Rollback Verification

Before final approval:

```text
[ ] Previous known-good release identified
[ ] Database compatibility understood
[ ] Rollback procedure documented
[ ] Backup/recovery procedure verified
[ ] Critical external-state recovery understood
```

A rollback path that exists only in someone's memory is not a rollback path.

---

# 46. Security Blocking Conditions

Release must be rejected if any of the following remain unresolved:

```text
[ ] Cross-tenant data exposure
[ ] Authentication bypass
[ ] Authorization bypass
[ ] Secret exposure
[ ] Payment security defect
[ ] Webhook signature bypass
[ ] Replay vulnerability
[ ] SQL/data injection vulnerability
[ ] Unprotected sensitive endpoint
[ ] Critical dependency vulnerability
```

---

# 47. Data Integrity Blocking Conditions

Release must be rejected if:

```text
[ ] Negative inventory can occur
[ ] Overselling is possible
[ ] Duplicate Orders can be created
[ ] Duplicate payment effects can occur
[ ] Checkout can complete inconsistently
[ ] Historical Order data mutates incorrectly
[ ] Tenant-owned data can cross boundaries
[ ] Webhook replay causes duplicate effects
[ ] Durable jobs lose business-critical work
```

---

# 48. Release Decision

Choose exactly one:

```text
[ ] APPROVED
[ ] APPROVED WITH DOCUMENTED NON-BLOCKING ISSUES
[ ] BLOCKED
```

If blocked, record:

```text
Blocker:
Impact:
Evidence:
Owner:
Required correction:
```

---

# 49. Final Demo Acceptance

The Demo is accepted only when:

```text
[ ] Core merchant workflow works
[ ] Core customer workflow works
[ ] Full purchase flow works
[ ] Payment flow works
[ ] Webhook flow works
[ ] Order lifecycle works
[ ] Inventory remains correct
[ ] Tenant isolation works
[ ] Authorization works
[ ] Idempotency works
[ ] Concurrency protections work
[ ] Background jobs work
[ ] Deployment is reproducible
[ ] Rollback is understood
[ ] Monitoring works
[ ] No critical blocker remains
```

---

# 50. Final Sign-Off

```text
Technical verification:
Name:
Date:
Result:

Security verification:
Name:
Date:
Result:

Demo acceptance:
Name:
Date:
Result:
```

---

# 51. Definition of Done

The Demo release is complete when the checklist provides evidence that:

```text
Code
 ↓
Build
 ↓
Database
 ↓
Infrastructure
 ↓
Security
 ↓
Application
 ↓
Commerce workflow
 ↓
Observability
 ↓
Recovery
```

have all passed their required gates.

The Demo is not considered complete because the homepage loads.

It is complete when a real merchant can sell a real test product to a real test customer through the complete system without compromising data, money, inventory, or tenant boundaries.