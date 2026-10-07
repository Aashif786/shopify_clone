# Seeding Implementation

## 1. Purpose

This document defines the concrete implementation of database seeding for development, testing, and Demo environments.

Seeding must provide:

- Predictable local development data.
- Repeatable Demo data.
- Valid relational state.
- Tenant-isolated fixtures.
- Deterministic test data where appropriate.
- Safe environment separation.
- Protection against accidental production data creation.

Seeds must complement migrations, not replace them.

---

# 2. Seed Responsibilities

Seeding is responsible for creating controlled data such as:

```text id="m8c4x7"
Users
Organizations
Stores
Memberships
Products
Variants
Inventory
Customers
Addresses
Discounts
Demo orders where required
```

The exact dataset depends on the environment.

---

# 3. Migration vs Seed

Migrations define:

```text id="q7m3c8"
Database structure
Constraints
Indexes
Schema evolution
```

Seeds define:

```text id="v8m4c7"
Development data
Test fixtures
Demo data
```

A seed must never be required for the database schema to exist.

---

# 4. Seed Environments

The implementation must distinguish:

```text id="x5m8c4"
Development
Test
Demo
Production
```

Each environment has different requirements.

---

# 5. Development Seeds

Development seeds should provide enough data to exercise normal workflows.

Recommended data:

```text id="m7c4x8"
Admin / Owner user
Staff user
Organization
Store
Products
Variants
Inventory
Customer
Addresses
Discount codes
```

Development data should be easy to recreate.

---

# 6. Demo Seeds

Demo seeds should create a coherent end-to-end commerce environment.

A Demo Store should contain enough data to demonstrate:

```text id="q8m3c7"
Store Configuration
      ↓
Product Catalog
      ↓
Inventory
      ↓
Customer
      ↓
Cart
      ↓
Discount
      ↓
Checkout
      ↓
Payment
      ↓
Order
```

The dataset should support the actual Demo workflows rather than merely populate dashboard cards.

---

# 7. Test Seeds

Automated tests should generally prefer small purpose-built fixtures rather than loading the entire Demo dataset.

Test fixtures should create only the state required by the test.

Example:

```text id="v4m8c7"
Checkout Test
    ↓
Store
Product
Variant
Inventory
Cart
Customer
```

This keeps tests fast and deterministic.

---

# 8. Deterministic IDs

Development and Demo seeds should use deterministic identifiers where practical.

For example:

```text id="x7m4c8"
demo-org
demo-store
demo-owner
demo-product-001
```

The actual ID strategy must remain compatible with the application's primary-key design.

---

# 9. Deterministic Data

Seed values should be predictable.

Avoid generating random values on every seed execution when tests or Demo behavior depend on those values.

Prefer:

```text id="m8c4x7"
Known product names
Known SKUs
Known prices
Known customer records
Known discount codes
```

---

# 10. Repeatability

Running the same development seed repeatedly should produce a predictable result.

Possible strategies include:

- Upsert.
- Delete-and-recreate in development.
- Deterministic identifiers.
- Explicit reset followed by seed.

The selected strategy must be environment-specific.

---

# 11. Seed Idempotency

Development/Demo seeds should be safely repeatable.

Example:

```text id="q7m3c8"
pnpm db:seed
pnpm db:seed
```

should not create uncontrolled duplicate Stores, Products, or users.

---

# 12. Production Protection

Production must not accidentally run development or Demo seeds.

Seed commands should detect the environment.

Example behavior:

```text id="v8m4c7"
APP_ENV=production
      ↓
Development seed
      ↓
REJECT
```

Production data creation must require an explicit, separately designed operational procedure.

---

# 13. Production Seed Policy

The Demo does not require general-purpose production seeding.

If production bootstrap data is required later, it should use a dedicated administrative process with:

- Explicit authorization.
- Auditability.
- Environment checks.
- Restricted access.

Do not reuse the local Demo seed blindly.

---

# 14. Seed Organization

Seeds should be organized by responsibility.

Example:

```text id="x4m8c7"
packages/db/
└── seeds/
    ├── development/
    ├── demo/
    ├── test/
    └── index.ts
```

The exact location may vary with the migration tool.

---

# 15. Seed Dependencies

Seed creation must respect domain dependencies.

Recommended sequence:

```text id="m7c4x8"
Users
  ↓
Organizations
  ↓
Memberships
  ↓
Stores
  ↓
Products
  ↓
Variants
  ↓
Inventory
  ↓
Customers
  ↓
Addresses
  ↓
Discounts
  ↓
Optional transactional history
```

---

# 16. Tenant Isolation

Every Store-owned record created by a seed must belong to a valid Store.

For example:

```text id="q8m4c7"
Store A
 ├── Product A
 ├── Inventory A
 ├── Customer A
 └── Discount A

Store B
 ├── Product B
 ├── Inventory B
 ├── Customer B
 └── Discount B
```

Cross-tenant relationships must not be created accidentally.

---

# 17. Multi-Tenant Seed Verification

Seed verification should confirm:

```text id="v5m8c3"
[ ] Store A owns only Store A resources
[ ] Store B owns only Store B resources
[ ] Users have correct memberships
[ ] Store resources cannot cross-reference another Store
```

This is particularly important because seed code can accidentally bypass normal application boundaries.

---

# 18. Seed Business Invariants

Seed data must satisfy real business constraints.

Examples:

### Product

- Valid Store.
- Valid status.
- Valid pricing.
- Valid variant relationships.

### Inventory

- Valid product/variant.
- Non-negative quantities.
- Valid inventory state.

### Discount

- Valid code.
- Valid dates.
- Valid rules.
- Valid Store.

### Order

- Valid items.
- Valid historical snapshots.
- Valid monetary values.
- Valid status.

---

# 19. Passwords

Seeded users must use passwords through the same password hashing mechanism used by the application.

Never store plain-text passwords in the database.

If Demo credentials are documented for local use, the documented credentials must be clearly identified as development/demo-only.

---

# 20. Sensitive Seed Data

Never seed:

- Real customer data.
- Real payment credentials.
- Real production secrets.
- Real user passwords.
- Real provider tokens.
- Personal data copied from production.

Demo data should be synthetic.

---

# 21. Money in Seeds

Money values must follow the application's canonical representation.

For example, if the application uses minor units:

```text id="x7m4c8"
₹999.50 → 99950
```

Do not introduce floating-point values into seed data.

---

# 22. Historical Order Data

If Demo seeds include completed orders, those orders must contain historical snapshots.

For example:

```text id="m4c8x7"
Order Item
 ├── Product Name Snapshot
 ├── SKU Snapshot
 ├── Unit Price Snapshot
 └── Quantity
```

Later changes to the current Product must not alter the seeded historical order.

---

# 23. Demo Dataset Design

The Demo dataset should demonstrate the platform without becoming unnecessarily large.

Recommended categories:

```text id="q8m3c7"
2–3 Stores where useful
Several Products
Multiple Variants
Multiple Inventory states
Several Customers
Active and inactive Discounts
Open and completed Orders
```

Exact quantities should remain small enough for fast setup.

---

# 24. Seed Scenarios

The Demo dataset should include meaningful states.

For example:

```text id="v4m8c7"
Published Product
Draft Product
In-stock Variant
Low-stock Variant
Out-of-stock Variant
Active Discount
Expired Discount
Customer with Address
Customer without Address
Pending Order
Completed Order
```

Only states supported by the implemented domain state machines should be seeded.

---

# 25. Seed API

The seed system should expose a predictable entry point.

Conceptually:

```text id="x7m4c8"
seedDevelopment()
seedDemo()
seedTest()
```

The implementation should prevent accidental invocation of the wrong environment.

---

# 26. Seed Transactions

Seed operations should use transactions where appropriate.

For a tightly coupled dataset:

```text id="m8c4x7"
BEGIN
  Create Store
  Create Products
  Create Inventory
  Create Customers
COMMIT
```

A failed seed should not leave an obviously partial dataset when transactional execution is practical.

---

# 27. Large Seed Data

The Demo does not require massive datasets.

Avoid creating thousands or millions of records merely to make the database look populated.

Performance testing should use dedicated test data generation.

---

# 28. Seed and Application Services

Seeds may use repositories or dedicated seed helpers.

They should not bypass database constraints unnecessarily.

However, seeds do not need to simulate every HTTP request.

The goal is to establish valid state efficiently while respecting domain invariants.

---

# 29. Seed Verification

After seeding, verify:

```text id="q5m8c4"
[ ] Expected users exist
[ ] Expected Stores exist
[ ] Memberships are correct
[ ] Products are valid
[ ] Inventory is consistent
[ ] Customers are valid
[ ] Discounts are valid
[ ] Orders are internally consistent
[ ] Tenant isolation holds
[ ] No duplicate deterministic records exist
```

---

# 30. Seed Reset Workflow

Local reset should follow:

```text id="v8m4c7"
Reset Database
      ↓
Run Migrations
      ↓
Run Development / Demo Seed
      ↓
Run Verification
```

The reset workflow must never point at production.

---

# 31. CI Seed Verification

CI should be able to:

```text id="x4m8c7"
Create Empty Test Database
      ↓
Run Migrations
      ↓
Run Seed / Fixtures
      ↓
Run Tests
```

This verifies that migrations and seed data remain compatible.

---

# 32. Seed Failures

If a seed fails:

1. Stop execution.
2. Report the failing step.
3. Roll back transactional changes where applicable.
4. Inspect the underlying constraint/business failure.
5. Correct the seed or required schema.
6. Rerun from a clean state.

Do not silently ignore seed errors.

---

# 33. Seed Implementation Sequence

Implement in this order:

```text id="m7c4x8"
1. Define environment seed policy
2. Create seed directories
3. Implement seed entry point
4. Implement base identity data
5. Implement Organization / Store data
6. Implement Product data
7. Implement Inventory data
8. Implement Customer data
9. Implement Discount data
10. Implement optional Order history
11. Add deterministic identifiers
12. Add repeatability
13. Add environment protection
14. Add seed verification
15. Add CI verification
```

---

# 34. Definition of Done

The seeding implementation is complete when:

```text id="q8m4c7"
[ ] Development seed works
[ ] Demo seed works
[ ] Test fixtures work
[ ] Seeds are repeatable
[ ] Deterministic data is used where appropriate
[ ] Tenant isolation is preserved
[ ] Domain invariants are respected
[ ] Production execution is protected
[ ] Passwords are hashed
[ ] No real sensitive data is included
[ ] Seed verification exists
[ ] CI can recreate required data
```

The seed system should create a **useful, believable, reproducible commerce environment**, not a cemetery of random fake records whose only purpose is making a dashboard look busy.