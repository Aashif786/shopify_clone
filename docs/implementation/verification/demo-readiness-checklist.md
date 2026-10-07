# Demo Readiness Checklist

## 1. Purpose

This checklist defines the final readiness criteria for the Demo.

The Demo is considered ready only when it is a **real, functional commerce platform** capable of demonstrating the complete merchant-to-customer purchase lifecycle with correct security, persistence, business rules, and recovery behavior.

The objective is not to prove that every future V1 capability exists.

The objective is to prove that the implemented Demo is coherent, reliable, secure, and suitable for demonstration and controlled use.

---

# 2. Readiness Principles

The Demo must:

- Be functionally complete within its defined scope.
- Preserve tenant isolation.
- Enforce authorization server-side.
- Maintain database integrity.
- Correctly handle inventory.
- Correctly handle checkout.
- Correctly handle payments.
- Correctly create and manage orders.
- Support safe retries for critical operations.
- Handle expected failures.
- Have reproducible deployment.
- Have sufficient monitoring and recovery procedures.

---

# 3. Scope Verification

Confirm that the implementation matches:

```text
docs/product/demo-scope.md
docs/product/functional-requirements.md
```

Verify that:

- Required Demo functionality exists.
- Explicitly excluded V1 functionality has not become an accidental dependency.
- Unnecessary infrastructure has not been introduced.
- Architecture remains consistent with the documented Demo strategy.

---

# 4. Repository Readiness

```text
[ ] Repository builds successfully
[ ] Workspace configuration is valid
[ ] pnpm lockfile is committed
[ ] No unintended generated files are committed
[ ] No secrets are committed
[ ] .env.example is complete
[ ] AGENTS.md is present
[ ] CLAUDE.md is present
[ ] Cursor rules are present
[ ] README contains setup instructions
[ ] Repository scripts work
```

---

# 5. Code Quality

```text
[ ] TypeScript typecheck passes
[ ] Lint passes
[ ] Formatting passes
[ ] Production build succeeds
[ ] No unexplained TODOs remain in critical paths
[ ] No debug code remains
[ ] No console-based sensitive logging remains
[ ] No unnecessary dependencies remain
[ ] Public interfaces are explicit
[ ] Module boundaries are preserved
```

---

# 6. Architecture Verification

Confirm:

```text
[ ] Modular monolith remains intact
[ ] apps/web is the main application
[ ] apps/worker handles background jobs
[ ] Domain modules own their business logic
[ ] Modules expose controlled public interfaces
[ ] No module directly accesses another module's private tables
[ ] External providers use adapters
[ ] PostgreSQL remains the transactional source of truth
[ ] Infrastructure has not been prematurely distributed
```

---

# 7. Authentication Readiness

```text
[ ] User registration works where required
[ ] Login works
[ ] Logout works
[ ] Sessions work
[ ] Session expiration works
[ ] Session revocation works
[ ] Password hashing is secure
[ ] Password reset works where required
[ ] Verification flow works where required
[ ] Secure cookies are configured
[ ] Session fixation is addressed
[ ] Account enumeration protections exist
[ ] Authentication failures are handled safely
```

---

# 8. Authorization Readiness

Verify every protected role:

```text
[ ] Owner
[ ] Admin
[ ] Staff
[ ] Customer
```

Confirm:

```text
[ ] Permissions are enforced server-side
[ ] UI restrictions are not the only authorization layer
[ ] Unauthorized actions are rejected
[ ] Role boundaries are tested
[ ] Store membership is verified
[ ] Suspended/inactive access is handled
```

---

# 9. Tenant Isolation Readiness

This is a **release-blocking requirement**.

```text
[ ] Store A cannot access Store B products
[ ] Store A cannot access Store B inventory
[ ] Store A cannot access Store B customers
[ ] Store A cannot access Store B carts
[ ] Store A cannot access Store B discounts
[ ] Store A cannot access Store B checkout
[ ] Store A cannot access Store B payments
[ ] Store A cannot access Store B orders
[ ] Store A cannot access Store B media
[ ] Store A cannot access Store B jobs
[ ] Store A cannot access Store B webhook data
```

Also verify indirect access paths.

---

# 10. Store Readiness

```text
[ ] Store can be created
[ ] Store configuration can be updated
[ ] Store lifecycle works
[ ] Store ownership works
[ ] Memberships work
[ ] Store access is authorized
[ ] Store suspension behavior works
[ ] Store public identity works
```

---

# 11. Product Readiness

```text
[ ] Product creation works
[ ] Product update works
[ ] Variant creation works
[ ] SKU rules work
[ ] Pricing validation works
[ ] Product publication works
[ ] Product unpublication works
[ ] Product listing works
[ ] Product detail works
[ ] Store isolation works
```

---

# 12. Inventory Readiness

Inventory must pass stronger verification.

```text
[ ] Initial stock can be created
[ ] Stock adjustment works
[ ] Available quantity is correct
[ ] Reservation works
[ ] Reservation release works
[ ] Reservation finalization works
[ ] Insufficient stock is rejected
[ ] Concurrent reservations are safe
[ ] Duplicate requests are safe
[ ] Inventory history is recorded
[ ] Invalid inventory states are prevented
```

---

# 13. Customer Readiness

```text
[ ] Customer creation works
[ ] Customer lookup works
[ ] Customer profile works
[ ] Addresses work
[ ] Customer/store ownership is correct
[ ] Customer isolation is verified
[ ] Order/customer relationship works
[ ] Historical customer information is preserved where required
```

---

# 14. Cart Readiness

```text
[ ] Guest cart works
[ ] Customer cart works
[ ] Items can be added
[ ] Quantities can be updated
[ ] Items can be removed
[ ] Cart totals are calculated
[ ] Invalid items are rejected
[ ] Invalid quantities are rejected
[ ] Cart concurrency is handled
[ ] Cart expiration works
```

---

# 15. Discount Readiness

```text
[ ] Discount can be created
[ ] Discount code works
[ ] Validity dates work
[ ] Eligibility rules work
[ ] Percentage discounts work
[ ] Fixed discounts work
[ ] Minimum purchase rules work
[ ] Usage limits work
[ ] Concurrent redemption is safe
[ ] Historical discount information is preserved
```

---

# 16. Checkout Readiness

Checkout is a critical release gate.

```text
[ ] Valid cart can enter checkout
[ ] Checkout recalculates authoritative pricing
[ ] Product availability is revalidated
[ ] Inventory is reserved correctly
[ ] Discounts are recalculated
[ ] Customer information is handled correctly
[ ] Checkout expiration works
[ ] Checkout cancellation works
[ ] Duplicate checkout requests are safe
[ ] Failed checkout does not corrupt inventory
```

---

# 17. Payment Readiness

```text
[ ] Sandbox payment works
[ ] Payment state transitions work
[ ] Successful payment works
[ ] Failed payment works
[ ] Pending payment works
[ ] Provider timeout is handled
[ ] Provider errors are handled
[ ] Payment idempotency works
[ ] Duplicate payment requests are safe
[ ] Payment webhooks work
[ ] Webhook signatures are verified
[ ] Webhook replay is rejected
[ ] Refund flow works where implemented
```

---

# 18. Order Readiness

```text
[ ] Successful checkout creates an order
[ ] Order numbering works
[ ] Order items are correct
[ ] Historical prices are correct
[ ] Historical product information is correct
[ ] Customer information is preserved
[ ] Payment relationship is correct
[ ] Order status transitions work
[ ] Order history works
[ ] Merchant can view orders
[ ] Cancellation works where implemented
[ ] Refund state is reflected correctly
```

---

# 19. Historical Data Verification

After creating an order:

```text
[ ] Change product name
[ ] Change product price
[ ] Change product description
[ ] Change customer address
[ ] Change discount configuration
```

Verify that the completed order still represents the original transaction accurately.

---

# 20. Storefront Readiness

```text
[ ] Public Store resolves correctly
[ ] Published products are visible
[ ] Unpublished products are hidden
[ ] Product details work
[ ] Availability is displayed correctly
[ ] Add-to-cart works
[ ] Cart works from storefront
[ ] Checkout entry works
[ ] Private merchant data is not exposed
```

---

# 21. Media Readiness

```text
[ ] Media upload works
[ ] File validation works
[ ] Size limits work
[ ] Media belongs to correct Store
[ ] Product association works
[ ] Public media works
[ ] Private media is protected
[ ] Upload failure is recoverable
[ ] Deletion works
[ ] Cleanup works
[ ] Orphaned media can be detected
```

---

# 22. Notification Readiness

```text
[ ] Notification records are created
[ ] Templates work
[ ] Email jobs are created
[ ] Email delivery works in configured environment
[ ] Provider failures are handled
[ ] Retries work
[ ] Duplicate notifications are controlled
[ ] Notification failure does not corrupt business state
```

---

# 23. Webhook Readiness

```text
[ ] Webhook endpoint works
[ ] Raw event can be persisted
[ ] Signature validation works
[ ] Replay protection works
[ ] Duplicate events are deduplicated
[ ] Unknown events are handled safely
[ ] Malformed events are rejected
[ ] Out-of-order events are handled
[ ] Processing failures are retryable where appropriate
```

---

# 24. Background Job Readiness

```text
[ ] Jobs persist in PostgreSQL
[ ] Jobs can be claimed safely
[ ] Multiple workers do not duplicate execution
[ ] Handler registry works
[ ] Payload validation works
[ ] Retry policy works
[ ] Backoff works
[ ] Failed jobs are recorded
[ ] Stale jobs are recoverable
[ ] Worker shutdown is graceful
[ ] Job tenant context is preserved
[ ] Critical handlers are idempotent
```

---

# 25. API Readiness

```text
[ ] /api/v1 routes work
[ ] Request validation works
[ ] Authentication is enforced
[ ] Authorization is enforced
[ ] Tenant context is enforced
[ ] Response DTOs are stable
[ ] Error contract is consistent
[ ] Pagination works where required
[ ] Filtering works where required
[ ] Idempotency works where required
[ ] Request IDs are available
[ ] API documentation matches implementation
```

---

# 26. Error Handling Readiness

Verify:

```text
[ ] Validation errors are clear
[ ] Authentication errors are safe
[ ] Authorization errors are safe
[ ] Tenant mismatch is safe
[ ] Not-found behavior does not leak data
[ ] Business conflicts are handled
[ ] Concurrency conflicts are handled
[ ] Idempotency conflicts are handled
[ ] Provider failures are translated
[ ] Unexpected errors return safe responses
[ ] Internal stack traces are not exposed
```

---

# 27. Database Readiness

```text
[ ] PostgreSQL version is supported
[ ] Connection configuration is correct
[ ] Connection pooling works
[ ] Migrations work from empty database
[ ] Migrations work from existing database
[ ] Constraints are present
[ ] Foreign keys are present
[ ] Required indexes are present
[ ] Transaction boundaries are correct
[ ] Deadlock handling is appropriate
[ ] Backup exists
[ ] Restore procedure is tested
```

---

# 28. Migration Readiness

Before deployment:

```text
[ ] All migrations are committed
[ ] Migration order is correct
[ ] No migration has been silently modified
[ ] Destructive migrations are reviewed
[ ] Large backfills are understood
[ ] Production migration impact is understood
[ ] Application compatibility is verified
[ ] Migration failure recovery is documented
```

---

# 29. Configuration Readiness

```text
[ ] Required environment variables are documented
[ ] Production configuration is separate
[ ] Secrets are not committed
[ ] Public variables are explicitly identified
[ ] Server-only secrets remain server-side
[ ] Configuration validation runs at startup
[ ] Invalid configuration fails clearly
[ ] Secret rotation procedure exists
```

---

# 30. Infrastructure Readiness

Expected Demo architecture:

```text
Internet
   ↓
Cloudflare
   ↓
VPS
   ├── Web
   └── Worker
        ↓
   PostgreSQL

Object Storage
   ↑
Media

Sentry / Monitoring
```

Verify each required component is reachable and correctly configured.

---

# 31. Docker Readiness

```text
[ ] Docker images build
[ ] Containers start
[ ] Environment variables load correctly
[ ] Web container starts
[ ] Worker container starts
[ ] Database connectivity works
[ ] Health checks work
[ ] Containers restart correctly
[ ] Logs are accessible
[ ] Volumes/persistent storage are correct
```

---

# 32. CI/CD Readiness

```text
[ ] Pull requests run CI
[ ] Typecheck runs
[ ] Lint runs
[ ] Tests run
[ ] Build runs
[ ] Failed checks block unsafe deployment
[ ] Deployment workflow is documented
[ ] Environment secrets are protected
[ ] Deployment version is identifiable
[ ] Rollback process is documented
```

---

# 33. Deployment Readiness

Before Demo deployment:

```text
[ ] VPS is configured
[ ] Firewall is configured
[ ] SSH access is restricted
[ ] TLS is active
[ ] DNS is correct
[ ] Application environment is configured
[ ] Database is available
[ ] Object storage is available
[ ] Web process is running
[ ] Worker process is running
[ ] Health checks pass
[ ] Logs are available
```

---

# 34. Observability Readiness

```text
[ ] Structured logging works
[ ] Request IDs work
[ ] Job correlation works
[ ] Tenant context is handled safely
[ ] Error monitoring works
[ ] Application version is visible
[ ] Web health endpoint works
[ ] Web readiness endpoint works
[ ] Worker health is observable
[ ] Critical failures can be diagnosed
```

---

# 35. Security Readiness

Security verification must include:

```text
[ ] No secrets in Git
[ ] Secure cookies
[ ] Authentication protected
[ ] Authorization protected
[ ] Tenant isolation tested
[ ] Input validation enforced
[ ] SQL injection protections verified
[ ] XSS protections appropriate
[ ] CSRF protections appropriate
[ ] Rate limiting applied where required
[ ] Webhook signatures verified
[ ] Replay protection enabled
[ ] Upload security verified
[ ] Sensitive logs removed
```

---

# 36. Dependency Readiness

```text
[ ] Dependencies are necessary
[ ] Lockfile is committed
[ ] Known critical vulnerabilities are addressed
[ ] Provider SDKs are isolated
[ ] Duplicate libraries are minimized
[ ] No abandoned dependency was introduced without justification
```

---

# 37. Performance Readiness

Formal enterprise-scale load testing is outside Demo scope.

However:

```text
[ ] Main pages load correctly
[ ] API latency is reasonable
[ ] Database queries are reasonable
[ ] No obvious N+1 queries exist
[ ] Worker does not consume excessive resources
[ ] Memory usage is stable
[ ] Database connection usage is controlled
[ ] VPS resource usage is acceptable
```

---

# 38. End-to-End Demo Scenario

The following scenario must work from beginning to end:

```text
1. Merchant logs in
       ↓
2. Merchant creates Store
       ↓
3. Merchant configures Store
       ↓
4. Merchant creates Product
       ↓
5. Merchant creates Variant
       ↓
6. Merchant adds Inventory
       ↓
7. Merchant publishes Product
       ↓
8. Customer opens Storefront
       ↓
9. Customer views Product
       ↓
10. Customer adds Product to Cart
       ↓
11. Customer enters Checkout
       ↓
12. Discount is applied
       ↓
13. Inventory is reserved
       ↓
14. Sandbox Payment succeeds
       ↓
15. Order is created
       ↓
16. Merchant views Order
       ↓
17. Notification is generated
       ↓
18. Background Job completes
```

---

# 39. Failure Scenario

The Demo must also demonstrate controlled failure.

Example:

```text
Customer
   ↓
Checkout
   ↓
Payment Provider Failure
   ↓
Payment marked appropriately
   ↓
Order not incorrectly completed
   ↓
Inventory remains correct
   ↓
Retry / recovery remains possible
```

---

# 40. Idempotency Verification

Verify repeated requests for critical operations:

```text
[ ] Payment creation
[ ] Checkout completion
[ ] Order creation
[ ] Inventory reservation
[ ] Refund
[ ] Webhook processing
[ ] Notification delivery
[ ] Background jobs
```

Repeated execution must not produce unintended duplicate business state.

---

# 41. Concurrency Verification

Verify at minimum:

```text
[ ] Concurrent inventory reservation
[ ] Concurrent checkout completion
[ ] Concurrent payment request
[ ] Concurrent discount redemption
[ ] Concurrent webhook processing
[ ] Concurrent job claiming
```

The objective is correctness under realistic concurrent requests.

---

# 42. Data Integrity Verification

Verify that:

```text
[ ] Foreign keys prevent invalid references
[ ] Unique constraints prevent duplicate business identities
[ ] Required fields cannot become invalid
[ ] Monetary values remain exact
[ ] Historical snapshots remain stable
[ ] State transitions are valid
[ ] Transaction rollback works
```

---

# 43. Recovery Verification

Simulate:

```text
[ ] Web process restart
[ ] Worker restart
[ ] Database connection interruption
[ ] Payment provider timeout
[ ] Email provider failure
[ ] Object storage failure
[ ] Job failure
[ ] Failed deployment
```

The platform must recover without silently corrupting business state.

---

# 44. Documentation Readiness

Before Demo completion:

```text
[ ] Product documentation is current
[ ] Architecture documentation is current
[ ] Domain specifications are current
[ ] Implementation documentation is current
[ ] API documentation is current
[ ] Deployment documentation is current
[ ] Environment setup is documented
[ ] Recovery procedures are documented
[ ] Known limitations are documented
```

---

# 45. AI-Assisted Development Readiness

Before accepting AI-generated implementation:

```text
[ ] AGENTS.md was followed
[ ] Relevant specification was read
[ ] Existing implementation was inspected
[ ] Module boundaries were preserved
[ ] No unnecessary dependencies were introduced
[ ] No unrelated files were changed
[ ] Tests were executed
[ ] Diff was reviewed
[ ] No fake verification claims were accepted
```

AI output is implementation assistance, not verification evidence.

---

# 46. Demo Release Gate

The Demo must **not** be released if any critical item remains unresolved.

Critical blockers include:

```text
[ ] Cross-tenant data access
[ ] Authentication bypass
[ ] Authorization bypass
[ ] Incorrect inventory
[ ] Duplicate payment
[ ] Incorrect order creation
[ ] Broken checkout recovery
[ ] Unverified webhook processing
[ ] Data corruption
[ ] Exposed secrets
[ ] Unrecoverable migration issue
[ ] Critical production configuration failure
```

---

# 47. Final Readiness Scorecard

| Area | Status |
|---|---|
| Product Scope | ☐ |
| Repository | ☐ |
| Architecture | ☐ |
| Authentication | ☐ |
| Authorization | ☐ |
| Tenant Isolation | ☐ |
| Stores | ☐ |
| Products | ☐ |
| Inventory | ☐ |
| Customers | ☐ |
| Carts | ☐ |
| Discounts | ☐ |
| Checkout | ☐ |
| Payments | ☐ |
| Orders | ☐ |
| Storefront | ☐ |
| Media | ☐ |
| Notifications | ☐ |
| Webhooks | ☐ |
| Background Jobs | ☐ |
| API | ☐ |
| Database | ☐ |
| Security | ☐ |
| Testing | ☐ |
| CI/CD | ☐ |
| Deployment | ☐ |
| Observability | ☐ |
| Backup / Recovery | ☐ |
| Documentation | ☐ |

---

# 48. Final Demo Acceptance Criteria

The Demo may be declared ready when:

```text
[ ] All critical release blockers are resolved
[ ] Core merchant workflow works
[ ] Core customer workflow works
[ ] Complete purchase lifecycle works
[ ] Payment sandbox flow works
[ ] Order lifecycle works
[ ] Tenant isolation is verified
[ ] Authorization is verified
[ ] Critical concurrency is verified
[ ] Critical idempotency is verified
[ ] Failure recovery is verified
[ ] Database migrations are verified
[ ] CI passes
[ ] Deployment passes
[ ] Monitoring works
[ ] Backup/restore procedure is verified
[ ] Documentation is current
```

---

# 49. Demo Acceptance Flow

The final acceptance sequence should be:

```text
Build
  ↓
Static Checks
  ↓
Unit Tests
  ↓
Integration Tests
  ↓
Security Tests
  ↓
Concurrency / Idempotency Tests
  ↓
E2E Tests
  ↓
Production-like Deployment
  ↓
Smoke Test
  ↓
Failure / Recovery Verification
  ↓
Final Review
  ↓
Demo Ready
```

---

# 50. Final Principle

The Demo is not ready because it looks complete.

It is ready when the platform can reliably demonstrate:

```text
Merchant
   ↓
Store
   ↓
Product
   ↓
Inventory
   ↓
Customer
   ↓
Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order
   ↓
Notification
```

while maintaining:

```text
Security
+
Tenant Isolation
+
Data Integrity
+
Concurrency Safety
+
Idempotency
+
Recoverability
```

The Demo should be **small in scope but serious in correctness**.

That is the standard required before implementation moves from architecture and planning into actual feature delivery.