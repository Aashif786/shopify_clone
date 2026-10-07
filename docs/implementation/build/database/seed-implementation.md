# Database Seed Implementation

## 1. Purpose

This document defines how deterministic development, test, and Demo seed data is created and maintained.

Seed data exists to make the platform easy to develop, test, demonstrate, and verify.

Seeds must **not** replace migrations and must not become a hidden source of business rules.

The implementation must provide:

- Deterministic data.
- Repeatable execution.
- Environment safety.
- Referential correctness.
- Useful Demo data.
- Test isolation.
- Safe reruns.

---

# 2. Seed Ownership

Seed infrastructure belongs to:

```text id="3m7qk1"
packages/db
```

Domain modules own the meaning of their records.

The seed system coordinates creation in dependency order.

---

# 3. Seed vs Migration

The distinction is mandatory.

```text id="q8v4m2"
Migration
→ Defines database structure

Seed
→ Creates development/test/demo data
```

Do not create schema changes inside seed scripts.

Do not put permanent application-required data into a seed merely because it is convenient.

---

# 4. Seed Environments

The implementation should support at least:

```text id="6c9n5x"
development
test
demo
```

Production seeding must be explicitly restricted.

---

# 5. Production Safety

Seed commands that create or reset data must not accidentally run against production.

Dangerous commands should verify:

```text id="r5k7p3"
environment
database identity
explicit safety conditions
```

A development seed command pointing at a production database must fail.

---

# 6. Seed Categories

Separate seed purposes conceptually:

```text id="m2x8q4"
Development seed
Test seed
Demo seed
```

### Development

Creates realistic local data.

### Test

Creates deterministic fixtures required by automated tests.

### Demo

Creates a polished but limited dataset suitable for demonstrating the platform.

---

# 7. Seed Data Principles

Seed data should be:

- Minimal.
- Representative.
- Deterministic.
- Internally consistent.
- Easy to understand.
- Safe to recreate.

Avoid generating thousands of meaningless records simply to make the application look busy.

---

# 8. Deterministic IDs

Where practical, seed records should use deterministic identifiers or deterministic lookup keys.

This makes repeated development workflows easier to reason about.

For example:

```text id="w4n6t9"
demo-organization
demo-store
demo-owner
```

The actual database identifiers may use the repository's standard ID strategy.

---

# 9. Deterministic Values

Seed scripts should avoid uncontrolled randomness.

Bad:

```text id="v8c2m5"
Math.random()
```

Better:

```text id="x6q4n1"
fixed values
seeded random generator
stable factories
```

Determinism is particularly important for tests.

---

# 10. Seed Ordering

Seed execution must follow dependency order.

Recommended order:

```text id="p7m3q8"
1. Organizations
2. Users
3. Memberships
4. Stores
5. Store configuration
6. Products
7. Variants
8. Inventory
9. Customers
10. Addresses
11. Discounts
12. Carts
13. Checkout-related data where needed
14. Orders
15. Supporting records
```

Not every environment requires every category.

---

# 11. Organization Seed

A Demo organization should represent the merchant/business tenant.

Example conceptual data:

```text id="q5r8m2"
Name: Demo Organization
Status: active
```

The organization should have stable relationships to its Demo users and Store.

---

# 12. User Seed

Development/Demo users should include the roles required to exercise the platform.

For example:

```text id="x7c4n9"
Owner
Admin
Staff
Customer
```

The seed must use secure development-only credentials.

Never use real credentials.

---

# 13. Demo Credentials

If the Demo provides known login credentials, they must be clearly marked as:

```text id="m4q8v1"
development/demo only
```

They must never be reused in production.

Documentation must not contain production secrets.

---

# 14. Membership Seed

Users must be associated with the appropriate organization/store through valid membership records.

The seed should exercise:

```text id="p6n3t8"
Owner permissions
Admin permissions
Staff permissions
```

where role-based verification is required.

---

# 15. Store Seed

The Demo should include at least one usable Store.

Example conceptual values:

```text id="c8m5q2"
Name
Slug
Status
Currency
Store configuration
```

The Store must be fully usable by the seeded Owner.

---

# 16. Product Seed

The Demo catalog should contain a small but representative product set.

Products should cover:

```text id="v7r4m9"
Published product
Draft product
Multiple variants
Different prices
Different SKUs
Product with media where available
```

This allows the Demo to exercise product lifecycle behavior.

---

# 17. Variant Seed

Variants should demonstrate:

- Different SKUs.
- Different prices where supported.
- Inventory-bearing products.
- Multiple variants on a product.

Every variant must reference a valid Product.

---

# 18. Inventory Seed

Inventory should include realistic quantities.

Example:

```text id="x3q8m6"
Available: 20
Reserved: 0
```

Seed data must not create invalid states such as:

```text id="n5p7c2"
available < 0
reserved < 0
```

---

# 19. Inventory History

Development/Demo data may include inventory adjustment history if the UI or workflow requires it.

The historical records must reconcile with the seeded current inventory state.

---

# 20. Customer Seed

Create representative customers for:

```text id="k8m4r5"
Customer lookup
Order history
Address management
Checkout
```

At least one customer should have a valid address where address-dependent workflows are demonstrated.

---

# 21. Customer Data Safety

Seed customer data must be fictional.

Do not use:

- Real names from employees.
- Real email addresses.
- Real phone numbers.
- Real home addresses.
- Real customer records.

---

# 22. Discount Seed

Demo discounts should exercise supported discount behavior.

Examples:

```text id="r3q7n8"
Percentage discount
Fixed-amount discount
Valid code
Expired/invalid code
```

Only supported Demo discount capabilities should be seeded.

---

# 23. Discount Usage

If usage limits are demonstrated, seed data may include existing usage records.

The records must be internally consistent with the configured usage limits.

---

# 24. Cart Seed

Carts may be seeded where useful for development.

Example:

```text id="m6v8p4"
Active customer cart
Several cart items
Valid quantities
```

Do not require seeded carts for the core Demo startup unless the product flow depends on them.

---

# 25. Checkout Seed

Checkout records should generally be created by actual checkout workflows rather than manually seeded.

If checkout seed data is required for a specific test or UI state, it must be clearly isolated from normal Demo seed data.

---

# 26. Payment Seed

Do not create fake successful payment records merely to make the system appear operational.

Payment seed data must be clearly marked as:

```text id="p9q3v6"
sandbox/test data
```

Where possible, payment lifecycle should be exercised through the actual payment test flow.

---

# 27. Order Seed

Orders may be seeded to demonstrate merchant order management.

Seeded orders should include:

```text id="x5m7r2"
Order
Order items
Historical product snapshots
Historical pricing
Customer relationship
Address snapshot
Order status/history
Payment relationship where required
```

The seeded order must be internally consistent.

---

# 28. Historical Snapshot Integrity

Seeded orders must not depend on current Product or Customer values for historical information.

For example:

```text id="c4n8q5"
Current Product title
≠
historical Order Item title
```

The order snapshot must represent the purchase-time state.

---

# 29. Job Seed Data

Jobs should generally be created by actual application events.

Manual job seed data is appropriate only when testing worker behavior.

If seeded:

```text id="m7q4v9"
job type
valid payload
pending status
available time
```

must all be valid.

---

# 30. Webhook Seed Data

Webhook events should normally originate from provider/test workflows.

Seed webhook records only when explicitly required for testing:

```text id="p8n3r6"
signature metadata
external event ID
payload
processing state
```

Fake webhook data must never bypass signature verification in production code.

---

# 31. Media Seed Data

Media seeds should reference valid object-storage test/demo objects.

If external object storage is unavailable locally, use an explicit development strategy rather than storing fake URLs that appear valid.

---

# 32. Notification Seed Data

Notifications may be seeded for UI development.

Example states:

```text id="x4m7q2"
pending
sent
failed
```

Seeded notifications must not accidentally trigger real external delivery.

---

# 33. Seed Factories

Where multiple related records are needed, reusable seed factories are preferred.

Examples:

```text id="r8q5m3"
createOrganization()
createStore()
createProduct()
createCustomer()
createOrder()
```

Factories should create valid domain data and avoid bypassing required constraints.

---

# 34. Seed Helpers

Shared helpers may handle:

```text id="v6n4p8"
ID generation
timestamps
password hashing
currency values
default configuration
relationships
```

Do not place domain business rules into generic seed helpers.

---

# 35. Password Hashing

Seeded users must use the same secure password hashing mechanism as the real authentication implementation.

Never store plaintext passwords in the database.

If a fixed Demo password is required, hash it through the normal authentication path.

---

# 36. Seed Transactions

A logically dependent seed group may run inside a transaction.

For example:

```text id="m3q7x8"
Organization
→ User
→ Membership
→ Store
```

If a seed fails partway through a tightly coupled group, the transaction should prevent a partially created fixture where practical.

---

# 37. Large Seeds

Demo and development seeds should remain small.

If large data volumes are needed for performance testing, use a separate dataset generation tool rather than bloating the normal seed.

---

# 38. Idempotent Seeds

Development/Demo seeds should be safe to rerun.

Possible approaches include:

```text id="q8m5r2"
stable IDs
unique lookup keys
upsert where appropriate
controlled reset
```

The strategy must not accidentally overwrite real data.

---

# 39. Test Fixtures

Automated tests should generally prefer isolated factories/fixtures over running the entire Demo seed.

Benefits:

- Faster tests.
- Less coupling.
- Clearer test intent.
- Better isolation.

The full seed remains useful for integration and manual development.

---

# 40. Test Isolation

Tests must not depend on another test's seed mutations.

Use appropriate database isolation such as:

```text id="v4p7m9"
transaction rollback
database reset
schema recreation
fixture cleanup
```

according to the test architecture.

---

# 41. Seed Validation

After seeding, verify important invariants.

Examples:

```text id="x6q3n8"
Store belongs to Organization
Products belong to Store
Variants belong to Products
Inventory belongs to Variants
Customers belong to Store
Orders belong to Store
Order snapshots are populated
```

---

# 42. Seed and Authorization

Seed data must allow authorization tests to exercise tenant and role boundaries.

For example:

```text id="n7m4q5"
Owner of Store A
Staff of Store A
User without access to Store A
User belonging to Store B
```

This is particularly valuable for detecting tenant-isolation regressions.

---

# 43. Cross-Tenant Seed Data

The Demo should include at least enough multi-tenant data in development/test environments to verify isolation.

For example:

```text id="r5v8m2"
Organization A
 └── Store A

Organization B
 └── Store B
```

Store A data must never be accidentally visible through Store B queries.

---

# 44. Seed Environment Guard

Seed execution should explicitly determine the current environment.

Conceptually:

```text id="p8q4n7"
if production:
    reject dangerous seed operation
```

Environment checks must be server-side and not rely on user interface warnings.

---

# 45. Seed Commands

The repository should provide clear commands such as:

```text id="m6x3r8"
db:seed
db:seed:demo
db:seed:test
db:reset
```

Exact command names should follow repository conventions.

---

# 46. Seed Output

Seed commands should provide concise structured output.

Useful information:

```text id="q7n5v4"
Environment
Created/updated records
Seed completion
```

Do not print sensitive credentials unless explicitly intended for local development output.

---

# 47. Seed Failure

If a seed fails:

```text id="x4m8p6"
Return non-zero exit code
Identify the failed operation
Preserve useful diagnostics
Avoid claiming success
```

Partial data should be avoided through transaction boundaries or safe rerun strategies.

---

# 48. Seed Verification

The following should be verified after a normal Demo seed:

```text id="r8q3m5"
[ ] Demo Organization exists
[ ] Demo Store exists
[ ] Owner can authenticate
[ ] Products exist
[ ] Variants exist
[ ] Inventory exists
[ ] Customers exist
[ ] Discounts exist
[ ] Merchant can view seeded resources
[ ] Storefront can display published products
[ ] Seeded orders, if present, are valid
[ ] Tenant isolation remains intact
```

---

# 49. AI-Assisted Seed Rules

AI-generated seed code must:

1. Inspect the current schema.
2. Inspect domain specifications.
3. Respect foreign keys and constraints.
4. Use valid domain states.
5. Avoid real personal data.
6. Avoid production credentials.
7. Avoid fake success records that misrepresent system behavior.
8. Preserve deterministic execution.
9. Verify rerun behavior.
10. Review the resulting database state.

---

# 50. Definition of Done

Seed implementation is complete when:

```text id="v7m4q2"
[ ] Development seed exists
[ ] Test fixtures/seed strategy exists
[ ] Demo seed exists where required
[ ] Seeds are deterministic
[ ] Seeds are safely rerunnable
[ ] Production execution is protected
[ ] Foreign-key relationships are valid
[ ] Seeded states are business-valid
[ ] Sensitive data is fictional
[ ] Passwords are securely hashed
[ ] Test isolation is maintained
[ ] Multi-tenant data can exercise isolation
[ ] Seed commands are documented
[ ] Seed verification passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 51. Final Principle

Seed data exists to **accelerate development and verification, not to manufacture the illusion of functionality**.

A seeded order should represent a valid order. A seeded payment should represent clearly identified test/sandbox data. A seeded user should use the real authentication path.

The best seed dataset is small enough to understand, rich enough to exercise the platform, deterministic enough to trust, and safe enough to run repeatedly without turning development into archaeological excavation.