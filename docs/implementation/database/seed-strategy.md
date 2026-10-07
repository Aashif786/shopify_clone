# Database Seed Strategy

## 1. Purpose

This document defines how development, test, and Demo seed data should be created and managed.

Seeds exist to provide predictable data for development, testing, demonstrations, and local verification.

Seeds are **not** a substitute for migrations and must never become a hidden production initialization mechanism.

---

# 2. Seed Principles

Seed data must be:

- Deterministic.
- Repeatable.
- Environment-safe.
- Explicitly invoked.
- Compatible with the current schema.
- Representative of important application workflows.
- Safe to recreate in development.
- Clearly separated from production data.

---

# 3. Migration vs Seed

The distinction is mandatory.

```text
Migration
    ↓
Defines and evolves schema

Seed
    ↓
Creates representative data
```

Migrations answer:

> What structure does the database require?

Seeds answer:

> What data should exist for this environment?

---

# 4. Seed Ownership

Seed infrastructure should live alongside database tooling.

Recommended conceptual location:

```text
packages/db/
├── migrations/
├── seeds/
└── src/
```

Domain-specific seed builders may be organized separately when the seed set becomes large.

---

# 5. Seed Environments

The project should distinguish:

```text
development
test
demo
production
```

However, the Demo may initially use the development seed strategy for local demonstrations.

Production must not receive development seed data automatically.

---

# 6. Development Seeds

Development seeds should provide enough data to exercise the major product workflows.

At minimum:

```text
Organization
    ↓
Store
    ↓
Products
    ↓
Variants
    ↓
Inventory
    ↓
Customers
    ↓
Discounts
```

Additional checkout/order/payment data may be seeded when useful for UI and operational development.

---

# 7. Demo Seed Dataset

The Demo dataset should make the application immediately usable after setup.

A new developer should be able to:

```text
Run migrations
    ↓
Run seed
    ↓
Start application
    ↓
Log in
    ↓
Open a Store
    ↓
Browse products
    ↓
Add product to cart
    ↓
Complete checkout
```

The seed should support the primary end-to-end flow.

---

# 8. Seed Users

Development seeds may create predefined users for:

- Owner.
- Admin.
- Staff.
- Customer.

Passwords used by seeded users must be development-only values.

They must never be reused in production.

---

# 9. Seed Authentication Data

Authentication-related seed records must use the same production data model and hashing behavior as real accounts.

Do not bypass authentication implementation simply to make seeded users work.

For example, do not store plaintext passwords where production accounts use password hashes.

---

# 10. Seed Organization and Store

The seed should create at least one valid organization and store relationship.

Conceptually:

```text
Organization
    ↓
Membership
    ↓
User
    ↓
Store
```

This provides a realistic tenant context for development.

---

# 11. Multiple Stores

The initial seed may contain one primary Store.

Additional Stores may be included to verify tenant isolation.

For example:

```text
Organization A
    └── Store A

Organization B
    └── Store B
```

The second tenant is particularly useful for authorization and isolation testing.

---

# 12. Seed Products

Products should cover several realistic states.

Examples:

```text
Published product
Draft product
Product with multiple variants
Product with media
Product with limited inventory
Out-of-stock product
```

This allows the storefront and merchant interfaces to exercise meaningful behavior.

---

# 13. Seed Variants

Products with variants should demonstrate:

- Different SKUs.
- Different prices where supported.
- Independent inventory.
- Variant selection.
- Availability behavior.

Variant data must obey the same database constraints as real product data.

---

# 14. Seed Inventory

Inventory seeds should include several conditions:

```text
Available stock
Reserved stock
Low stock
Out of stock
```

The exact representation must follow the inventory domain model.

Seeded inventory must remain internally consistent.

---

# 15. Seed Customers

Development data should include customers with:

- Names.
- Contact information.
- Addresses where required.
- Different lifecycle states where supported.

Customer data must be clearly synthetic.

Never use real customer information as development seed data.

---

# 16. Seed Discounts

The seed may provide representative discount configurations.

Examples:

```text
Percentage discount
Fixed-amount discount
Valid discount code
Expired discount
Usage-limited discount
```

Seeded discount behavior should be useful for testing checkout calculations.

---

# 17. Seed Carts

Active carts may be seeded when useful for UI development.

However, carts should not be required for basic application startup.

A clean development database should still work without pre-existing carts.

---

# 18. Seed Orders

Orders may be seeded to support merchant dashboard development.

Examples:

```text
Pending order
Paid order
Processing order
Completed order
Cancelled order
```

Seeded orders must follow the same historical snapshot and state-transition rules as real orders.

---

# 19. Seed Payments

If payment records are seeded, they must represent sandbox/test payment states.

Examples:

```text
Pending
Succeeded
Failed
Refunded
```

No real payment credentials or production transaction identifiers may be used.

---

# 20. Seed Webhooks and Jobs

Seed data may include webhook or job records where required to demonstrate operational interfaces.

These records must not accidentally trigger real external operations.

A seeded job should either be:

- Completed safely.
- Explicitly disabled from processing.
- Designed for a deterministic development workflow.

---

# 21. Deterministic Data

Seeds should produce predictable identifiers and values where practical.

This makes it easier to:

- Reproduce bugs.
- Write integration tests.
- Verify screenshots.
- Demonstrate workflows.
- Debug development issues.

Random data generation should only be used when randomness provides actual value.

---

# 22. Stable Seed Identifiers

Where practical, use stable external identifiers or deterministic lookup keys.

For example:

```text
demo-store
demo-owner
demo-product
```

This makes seed operations easier to reason about.

Database primary keys should still follow the project's normal identifier strategy.

---

# 23. Idempotent Seeds

Development seeds should preferably be safe to run repeatedly.

Possible strategy:

```text
Seed
 ↓
Find known development record
 ↓
Create or update
 ↓
Continue
```

Avoid creating duplicate stores, users, products, and discount codes every time the seed command runs.

---

# 24. Seed Reset Strategy

The safest clean-development workflow is:

```text
Reset database
    ↓
Run migrations
    ↓
Run seed
```

This guarantees that seed assumptions match the current schema.

---

# 25. Seed Upserts

Upserts may be used for deterministic development records.

However, avoid blindly overwriting records that a developer may have intentionally modified.

Seed ownership should be clear.

For example, records explicitly marked as development fixtures may safely be recreated.

---

# 26. Production Protection

The seed system must actively protect against accidental production execution.

Possible protections include:

- Environment checks.
- Explicit confirmation flags.
- Separate production command policy.
- Refusal to execute destructive seed operations in production.

The safest default is:

```text
production → seed disabled
```

---

# 27. Production Data

Production data should be created through actual application workflows or controlled operational tooling.

Production must not depend on demo seed fixtures.

---

# 28. Test Seeds

Automated tests should generally prefer small fixture factories over loading the entire development dataset.

For example:

```text
Test
    ↓
Create only required Store
    ↓
Create required Product
    ↓
Run scenario
    ↓
Clean up
```

This keeps tests fast and deterministic.

---

# 29. Test Fixtures vs Seeds

Use:

### Seeds

For:

- Local development.
- Demo environments.
- Manual testing.

### Fixtures/factories

For:

- Unit tests.
- Integration tests.
- Focused E2E setup.

Do not make every automated test depend on the complete Demo seed dataset.

---

# 30. Sensitive Data

Seed data must never contain:

- Real passwords.
- Real payment credentials.
- Real API keys.
- Real customer information.
- Real employee information.
- Production access tokens.
- Production webhook secrets.

All development identities should be synthetic.

---

# 31. Media Seeds

If media functionality requires sample images or files, seed metadata and development-safe assets only.

Object storage references should point to:

- Local development storage.
- Dedicated Demo storage.
- Explicitly approved public test assets.

Never reference private production objects from development fixtures.

---

# 32. Seed Ordering

Seed operations should respect domain dependencies.

Conceptually:

```text
Users
  ↓
Organizations
  ↓
Memberships / Stores
  ↓
Products
  ↓
Variants
  ↓
Inventory
  ↓
Customers
  ↓
Discounts
  ↓
Carts
  ↓
Orders / Payments
```

The actual ordering should follow foreign-key requirements and application semantics.

---

# 33. Seed Transactions

Seed operations should use transactions where a logical fixture requires atomic creation.

For example:

```text
Create Store
    ↓
Create Membership
    ↓
Create Store Configuration
```

If the fixture cannot be valid without all three records, creation should fail atomically where practical.

---

# 34. Seed Failure

If a seed operation fails:

- Report the failing fixture.
- Roll back the relevant transaction where supported.
- Do not report success.
- Leave the developer with enough information to diagnose the issue.

---

# 35. Seed Logging

Seed output should provide useful progress information.

Example:

```text
Creating demo organization...
Creating demo store...
Creating demo products...
Creating demo inventory...
Seed completed.
```

Do not print passwords, secrets, tokens, or sensitive credentials.

---

# 36. Seed Commands

The repository should expose explicit commands for:

```text
db:seed
db:seed:test
db:reset
```

Exact command names may follow the final workspace conventions.

A destructive reset must be clearly distinguishable from a normal seed operation.

---

# 37. Seed Verification

After seeding, basic verification should confirm:

```text
[ ] Development user exists
[ ] Store exists
[ ] Published product exists
[ ] Product variant exists
[ ] Inventory exists
[ ] Customer exists
[ ] Discount exists
```

Additional checks should cover the primary Demo workflow.

---

# 38. Seed and Tenant Isolation

Seed data must preserve tenant boundaries.

If multiple organizations are seeded:

```text
Organization A
    ↓
Store A
    ↓
Products A

Organization B
    ↓
Store B
    ↓
Products B
```

Records must never accidentally cross tenant boundaries.

This makes seeded data useful for testing authorization.

---

# 39. Seed and Historical Data

Seeded orders must contain historical snapshots where the order model requires them.

Do not construct an order merely by referencing the current Product record if the real order implementation stores historical product information.

---

# 40. Seed and Business Rules

Seeds should create data through valid domain/application paths where practical.

However, seed infrastructure may use direct repositories or database operations when doing so is necessary and safe.

The important requirement is that resulting records satisfy the same invariants as production data.

---

# 41. Seed Maintenance

Whenever a schema or domain rule changes:

```text
Schema change
    ↓
Migration
    ↓
Update seed
    ↓
Update affected tests
    ↓
Verify Demo workflow
```

A stale seed is a broken development environment waiting to happen.

---

# 42. Seed Documentation

The README should document:

- How to reset the database.
- How to seed it.
- Which users exist.
- Which stores exist.
- How to access seeded accounts.
- Which data is intended for demonstration.

Credentials must be documented only when they are explicitly development-only.

---

# 43. Demo Seed Data Ownership

Seed data should have identifiable ownership.

For example:

```text
seed/
├── organization
├── users
├── stores
├── products
├── inventory
├── customers
├── discounts
└── orders
```

This makes updates easier when individual domain requirements change.

---

# 44. Definition of Done

Seed strategy is complete when:

```text
[ ] Development seed structure exists
[ ] Seed command exists
[ ] Development data is deterministic
[ ] Seeds can be recreated safely
[ ] Development users exist
[ ] Organization/store data exists
[ ] Product data exists
[ ] Inventory data exists
[ ] Customer data exists
[ ] Discount data exists
[ ] Representative order data exists
[ ] Tenant isolation is preserved
[ ] No real sensitive data is used
[ ] Production seed execution is protected
[ ] Test fixtures remain separate
[ ] Seed failures are observable
[ ] Seed output is useful and safe
[ ] README documents seed usage
[ ] Fresh database + migrations + seed works
```

---

# 45. Final Seed Principle

The seed system exists to make development and demonstration fast without compromising production correctness:

```text
Fresh Database
      ↓
Migrations
      ↓
Deterministic Seed
      ↓
Functional Demo Environment
```

Seeds should accelerate development, not become an undocumented dependency of the application itself.