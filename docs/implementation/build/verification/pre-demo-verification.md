# Pre-Demo Verification

## 1. Purpose

This document defines the final verification process that must be completed before presenting the Demo to stakeholders, reviewers, or users.

The Demo must demonstrate a real, functional commerce platform rather than a collection of disconnected screens.

The primary proof is:

```text id="7m4r8q"
Merchant
  ↓
Create Store
  ↓
Create Product
  ↓
Set Inventory
  ↓
Publish Product
  ↓
Customer
  ↓
Browse Storefront
  ↓
Add to Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ↓
Merchant manages Order
```

---

# 2. Demo Readiness Principle

The Demo must be:

- Functional.
- Repeatable.
- Stable.
- Safe.
- Demonstrable from a clean environment.
- Free of release-blocking defects.
- Representative of the approved architecture.

The Demo does not need every V1 feature.

It must correctly implement the features that are included.

---

# 3. Demo Scope Verification

Before testing, confirm that the build still matches the approved Demo scope.

Included capabilities:

```text id="x5r8m4"
Authentication
Organizations
Stores
Memberships
Products
Variants
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Storefront
Media
Notifications
Webhooks
Background Jobs
```

Do not add last-minute infrastructure merely because a feature would theoretically be easier with it.

---

# 4. Out-of-Scope Verification

Verify that no unfinished V1-only capability is presented as part of the Demo.

Examples:

```text id="q7m4r5"
Dedicated search engine
Analytics warehouse
App marketplace
Advanced themes
POS
Subscriptions
B2B
Multi-region infrastructure
Sharding
Kubernetes
Enterprise SSO
Advanced fraud platform
```

If a feature is not implemented, it must not appear to be fully functional.

---

# 5. Environment Verification

The Demo environment must have:

```text id="v6r8m4"
Web application
Worker
PostgreSQL
Object storage where required
Payment sandbox
Email/notification provider where required
Cloudflare/DNS configuration where applicable
Monitoring
```

All required environment variables must be configured through the approved configuration system.

---

# 6. Configuration Safety

Verify:

```text id="m8q4r5"
Production secrets are not committed
Demo secrets are not displayed
Debug authentication bypasses are disabled
Test payment configuration is explicit
Development-only flags are disabled unless intentionally required
```

---

# 7. Database Readiness

Verify:

```text id="x4r7m6"
PostgreSQL is reachable
Migrations are current
Required indexes exist
Required constraints exist
Seed/demo data is correct
Database backups are configured where required
```

---

# 8. Clean Deployment Test

The Demo should be deployed from a clean build process.

Verify:

```text id="q5m8r4"
Repository
 ↓
Install dependencies
 ↓
Build
 ↓
Deploy
 ↓
Migrate
 ↓
Start Web
 ↓
Start Worker
 ↓
Health check
```

Do not rely on files or configuration manually created on the VPS that are not represented in the deployment process.

---

# 9. Web Health

Verify the Web application:

```text id="v7r4m6"
Starts successfully
Responds to health checks
Connects to PostgreSQL
Loads configuration
Serves public Storefront
Serves merchant application
```

---

# 10. Worker Health

Verify the Worker:

```text id="m6q4r8"
Starts successfully
Connects to PostgreSQL
Claims jobs
Processes jobs
Retries failed jobs
Shuts down gracefully
Restarts successfully
```

---

# 11. Merchant Account Verification

Create or seed the Demo merchant account.

Verify:

```text id="x8r5m4"
Login
Logout
Session persistence
Store access
Role resolution
Unauthorized access handling
```

Never use shared production credentials during the demonstration.

---

# 12. Store Setup Verification

Complete:

```text id="q7m4r6"
Login
 ↓
Create Organization/Store
 ↓
Store configuration
 ↓
Store activation
 ↓
Store dashboard
```

Verify the Store is correctly associated with the merchant.

---

# 13. Store Configuration

Verify basic public configuration:

```text id="v5r8m4"
Store name
Store slug
Currency
Description
Logo/media where implemented
Public status
```

The public Storefront should reflect approved configuration.

---

# 14. Product Creation Verification

Create at least one representative Product.

Verify:

```text id="m4q7r5"
Product name
Description
Variant
SKU
Price
Media
Publication
```

Use realistic demo data rather than placeholder strings wherever possible.

---

# 15. Product Publication Verification

Verify:

```text id="x6r4m8"
Draft Product
   ↓
Publish
   ↓
Public Storefront
```

Confirm that unpublished Products are not visible publicly.

---

# 16. Inventory Verification

Assign inventory to the purchased Variant.

Verify:

```text id="q8m5r4"
On-hand quantity
Available quantity
Inventory adjustment
Movement/history
```

Use a quantity that makes the purchase flow easy to demonstrate.

---

# 17. Customer Verification

Create or use a Demo Customer.

Verify:

```text id="v7m4r6"
Customer identity
Profile
Store association
Address where required
```

The customer must not see another Store's customer data.

---

# 18. Storefront Verification

Open the public Storefront.

Verify:

```text id="m5q8r4"
Store identity
Navigation
Product listing
Product image/media
Product detail
Variant selection
Price
Availability
```

---

# 19. Product-to-Cart Verification

From the public Product page:

```text id="x4r8m6"
Select Variant
 ↓
Select quantity
 ↓
Add to Cart
```

Verify the Cart is created or retrieved correctly.

---

# 20. Cart Verification

Open the Cart.

Verify:

```text id="q7m5r4"
Correct Product
Correct Variant
Correct quantity
Correct display price
Correct subtotal
Remove item
Quantity update
```

Refresh the page and verify the Cart remains available according to the session model.

---

# 21. Inventory Reservation Verification

Before Checkout:

```text id="v8r4m5"
Add to Cart
```

Verify Inventory is **not** reserved merely by adding the item to Cart.

This confirms that Cart remains customer intent rather than inventory authority.

---

# 22. Checkout Verification

Proceed to Checkout.

Verify:

```text id="m6q4r8"
Cart contents
Current Product price
Current quantity
Customer information
Address where required
Subtotal
Discount
Total
```

The displayed total must originate from the server.

---

# 23. Discount Verification

If a Demo discount exists:

```text id="x5r7m4"
Enter discount code
 ↓
Apply
```

Verify:

```text id="q8m4r5"
Code accepted
Discount calculated correctly
Updated total displayed
```

Also test an invalid code.

---

# 24. Inventory Reservation Verification

When Checkout reaches the reservation stage, verify:

```text id="v6r8m4"
Inventory available
 ↓
Reservation created
 ↓
Available quantity reduced appropriately
```

The reservation must be associated with the Checkout/purchase context.

---

# 25. Payment Verification

Use the approved sandbox/test payment flow.

Verify:

```text id="m4q7r5"
Payment initialized
Correct amount
Provider interaction
Payment result
Local Payment state
```

The amount must match the authoritative Checkout total.

---

# 26. Payment Failure Test

Before the final demonstration, execute at least one failed-payment test.

Verify:

```text id="x7r4m6"
Payment fails
Checkout remains non-completed
Inventory reservation is handled correctly
No Order is falsely created
```

---

# 27. Payment Success Test

Execute a successful sandbox payment.

Verify:

```text id="q5m8r4"
Payment succeeds
Checkout completes
Order is created
Inventory is finalized
```

---

# 28. Duplicate Payment Protection

Repeat the completion request or simulate a retry.

Verify:

```text id="v8r4m6"
No duplicate charge
No duplicate Order
No duplicate Inventory finalization
```

This is a mandatory Demo readiness gate.

---

# 29. Webhook Verification

Trigger or simulate the provider webhook.

Verify:

```text id="m5q4r8"
Signature validation
Event persistence
Processing
Payment state update
Checkout/Order integration
```

Send the same event twice.

Verify no duplicate business effect occurs.

---

# 30. Order Verification

After successful purchase:

```text id="x6r8m4"
Open Order
```

Verify:

```text id="q7m4r5"
Order number
Items
Quantity
Historical prices
Discount
Total
Payment state
Order status
Customer information
Address snapshot where applicable
```

---

# 31. Historical Snapshot Verification

After creating the Order:

1. Change the Product name.
2. Change Product price.
3. Change Customer name.
4. Change Customer address.

Return to the Order.

Verify historical purchase information remains unchanged.

---

# 32. Merchant Order Management

Log in as the merchant.

Verify:

```text id="v5r8m4"
Order list
Order detail
Customer information
Items
Totals
Status
Status history
```

Change the Order status through an allowed transition.

Refresh the page.

Verify the state persists.

---

# 33. Customer Order Verification

Log in as the customer.

Verify:

```text id="m4q8r5"
Order history
Order detail
Order number
Purchased items
Total
Status
```

Verify the customer cannot access another customer's Order.

---

# 34. Tenant Isolation Demonstration

Create two Stores.

For example:

```text id="x7r4m6"
Store A
Store B
```

Create distinct Products.

Verify:

```text id="q6m5r8"
Store A cannot see Store B merchant data
Store A cannot access Store B Products through merchant APIs
Store A customer cannot access Store B Cart
Store A customer cannot access Store B Order
```

This should be demonstrated through automated tests, not only manually.

---

# 35. Authorization Demonstration

Verify each role according to the approved permission model:

```text id="v8m4r5"
Owner
Admin
Staff
Customer
Guest
```

Attempt at least one unauthorized action for each restricted role.

---

# 36. Cart Expiration Verification

Create an eligible inactive Cart.

Run the expiration mechanism.

Verify:

```text id="m5q7r4"
Job created
Job claimed
Cart expiration evaluated
Cart state updated
```

If the Cart has entered Checkout or another protected state, verify the job does not incorrectly expire it.

---

# 37. Background Job Verification

Verify at least:

```text id="x4r8m6"
One business notification job
One expiration/cleanup job
One retry scenario
```

Confirm the Worker processes jobs without manual database intervention.

---

# 38. Notification Verification

Trigger an approved transactional notification.

Verify:

```text id="q7m4r5"
Notification created
Correct recipient
Correct template
Delivery attempted
Failure is retried where appropriate
```

Notification failure must not invalidate the underlying Order.

---

# 39. Media Verification

Upload representative Product media.

Verify:

```text id="v6r4m8"
Upload
Validation
Metadata
Product association
Public display
```

Attempt an invalid file type or oversized file and verify rejection.

---

# 40. Error-State Verification

Before Demo presentation, deliberately test:

```text id="m8q4r5"
Invalid login
Invalid Product
Invalid Variant
Invalid quantity
Invalid discount
Out-of-stock Product
Expired Checkout
Failed payment
Unauthorized Order access
```

Verify the UI displays useful errors instead of stack traces or blank screens.

---

# 41. Network Failure Verification

Simulate a failed request during:

```text id="x5r7m4"
Cart mutation
Checkout creation
Payment
Order retrieval
```

Verify the UI recovers without creating duplicate business operations.

---

# 42. Browser Refresh Verification

Refresh during:

```text id="q8m4r6"
Cart
Checkout
Payment
Order confirmation
```

Verify the customer can recover the correct server state.

---

# 43. Multi-Tab Verification

Use two browser tabs against the same Store/customer context.

Test:

```text id="v7m4r5"
Tab A → Cart update
Tab B → Cart update
```

Verify the final state follows the defined concurrency behavior.

---

# 44. Responsive Verification

Verify the primary Demo flow on supported viewport sizes:

```text id="m6q4r8"
Desktop
Tablet
Mobile
```

Critical actions must remain usable:

```text id="x5r8m4"
Add to Cart
Checkout
Payment
Order confirmation
```

---

# 45. Browser Console Verification

Before demonstration, inspect the browser console.

There should be no unexplained:

```text id="q7m4r5"
Runtime errors
Unhandled promise rejections
Repeated failed API calls
Authentication failures
Missing asset errors
```

Expected development-only warnings should be understood and documented.

---

# 46. Server Log Verification

Inspect Web and Worker logs during the full purchase flow.

Verify:

```text id="v8r4m6"
Requests are correlated
Errors are classified
Jobs are visible
Payment events are visible
No secrets are logged
```

---

# 47. Database Verification

After the successful purchase, verify the expected records exist:

```text id="m5q4r8"
Cart
Checkout
Payment
Payment attempt
Inventory reservation/movement
Order
Order Items
Status history
Relevant webhook event
Notification/job where applicable
```

Verify their relationships and final states.

---

# 48. Build Verification

Before final presentation run:

```text id="x6r4m8"
Typecheck
Lint
Format check
Build
Unit tests
Integration tests
API tests
Security tests
E2E tests
```

No release-blocking failure may remain.

---

# 49. Deployment Verification

After deployment to the Demo VPS:

```text id="q8m5r4"
Web starts
Worker starts
Database connects
Health checks pass
Storefront loads
Merchant login works
Customer purchase works
```

Verify Cloudflare/routing behavior if applicable.

---

# 50. Restart Verification

Restart:

```text id="v7r4m6"
Web
Worker
```

Verify:

```text id="m4q8r5"
Application recovers
Database state remains intact
Jobs are not lost
Sessions behave according to policy
Storefront remains accessible
```

---

# 51. Backup/Recovery Verification

Where Demo backup infrastructure is configured, verify:

```text id="x5r7m4"
Backup exists
Backup completes
Backup retention works
Recovery procedure is documented
```

A backup that has never been tested is mostly a decorative file.

---

# 52. Rollback Verification

Verify that the deployment process has a known rollback path.

At minimum:

```text id="q6m8r4"
Previous application version identifiable
Deployment can be reverted
Database compatibility has been considered
```

Do not perform destructive schema changes immediately before the Demo without a recovery strategy.

---

# 53. Demo Data Verification

Demo data should be:

- Realistic.
- Understandable.
- Minimal.
- Consistent.
- Safe to reset.

Avoid:

```text id="v5r8m4"
Personal information
Real payment credentials
Real customer secrets
Production data
```

---

# 54. Demo Reset

The team should have a documented way to restore the Demo to a known state.

The reset process should be deterministic and safe for the Demo environment.

It must not be possible to accidentally execute a destructive reset against production.

---

# 55. Demo Script

The recommended presentation sequence is:

```text id="m7q4r5"
1. Merchant login
2. Store dashboard
3. Product creation/configuration
4. Inventory
5. Product publication
6. Open public Storefront
7. Browse Product
8. Add to Cart
9. Checkout
10. Discount
11. Payment
12. Order confirmation
13. Merchant Order management
14. Customer Order history
```

The script should follow the real system flow rather than bypassing functionality.

---

# 56. Backup Demo Path

Have a second known-good seeded scenario available for demonstration.

If the primary test data becomes unsuitable, use the reset process rather than manually editing production-like records during the presentation.

---

# 57. Demo Blockers

The following must block the Demo:

```text id="x4r8m6"
Cross-tenant data exposure
Authentication bypass
Authorization bypass
Duplicate payment
Incorrect payment total
Duplicate Order
Incorrect Inventory
Checkout corruption
Webhook security failure
Secret exposure
Data loss
Broken critical purchase flow
Unrecoverable Worker jobs
```

---

# 58. Non-Blocking Demo Issues

Potential non-blocking issues may include:

```text id="q7m5r4"
Minor visual inconsistency
Non-critical copy issue
Minor responsive spacing issue
Non-critical performance optimization
Missing optional Demo feature
```

Only defer an issue when it does not compromise correctness, security, or the demonstrated workflow.

---

# 59. Final Verification Checklist

Before presenting:

```text id="v8r4m5"
[ ] Demo scope confirmed
[ ] Environment configured
[ ] Database current
[ ] Migrations applied
[ ] Seed data valid
[ ] Merchant login works
[ ] Store setup works
[ ] Product creation works
[ ] Inventory works
[ ] Product publication works
[ ] Storefront works
[ ] Cart works
[ ] Checkout works
[ ] Discount works
[ ] Payment success works
[ ] Payment failure works
[ ] Webhook works
[ ] Duplicate webhook is safe
[ ] Order creation works
[ ] Order management works
[ ] Customer Order access works
[ ] Tenant isolation passes
[ ] Authorization passes
[ ] Jobs work
[ ] Notifications work
[ ] Media works
[ ] Error states work
[ ] Browser refresh is safe
[ ] Production build passes
[ ] E2E tests pass
[ ] Logs contain no sensitive data
[ ] No release blockers remain
```

---

# 60. Final Demo Gate

The Demo is ready only when the complete journey works from a clean environment:

```text id="m6q4r8"
Merchant
   ↓
Store
   ↓
Product
   ↓
Inventory
   ↓
Publication
   ↓
Customer
   ↓
Storefront
   ↓
Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order
   ↓
Merchant Management
   ↓
Customer Order History
```

The final demonstration must use the same business path that the production implementation uses.

No hidden database edits, fake payment success, hardcoded Order responses, or manual state manipulation may be required to make the Demo work.