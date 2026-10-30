# E2E Testing

## 1. Purpose

This document defines the End-to-End (E2E) testing strategy for the Cal Cart commerce platform.

E2E tests validate complete user workflows through the application from the user-facing interface to the underlying application services and database.

The purpose is to verify that the major business journeys work correctly as an integrated system.

---

## 2. Core Principles

E2E tests should:

- Validate complete user journeys.
- Exercise the real application boundary.
- Use realistic test data.
- Cover critical business workflows.
- Verify user-visible behavior.
- Remain deterministic.
- Avoid unnecessary duplication of lower-level tests.
- Focus on high-value scenarios rather than exhaustive UI coverage.

E2E tests complement unit and integration tests. They do not replace them.

---

## 3. Primary E2E Framework

The Demo should use **Playwright** for browser-based E2E testing.

Playwright provides:

- Browser automation.
- Multi-browser support.
- Network interception.
- Authentication state management.
- Screenshots and traces.
- CI integration.
- Reliable locator strategies.

The test suite should remain framework-independent at the business-rule level where practical.

---

## 4. E2E Test Scope

E2E tests should cover critical flows such as:

```text
Merchant onboarding
Store configuration
Product creation
Inventory management
Product publishing
Customer browsing
Cart creation
Checkout
Payment
Order creation
Order management
```

Not every UI component requires an E2E test.

---

## 5. Critical User Journeys

The highest-priority E2E journeys are:

### Merchant

```text
Sign in
→ Create store
→ Configure store
→ Create product
→ Add inventory
→ Publish product
```

### Customer

```text
Visit storefront
→ Browse product
→ View product
→ Add to cart
→ Checkout
→ Pay
→ Receive order confirmation
```

### Merchant Order Management

```text
Sign in
→ Open orders
→ View order
→ Update order status
```

---

## 6. Test Environment

E2E tests should run against a dedicated test environment.

The environment should contain:

- Test application.
- Test database.
- Test authentication configuration.
- Test payment provider.
- Test object storage configuration where required.

Production must never be used for automated E2E tests.

---

## 7. Database State

E2E tests should start from predictable data.

Options include:

- Seeded test database.
- Test fixtures.
- Dedicated test tenant/store.
- Per-test data creation.

Tests should avoid depending on data created by another test.

---

## 8. Authentication

Authentication should be tested through realistic user flows where authentication itself is part of the scenario.

For large suites, reusable authenticated browser states may be used to reduce runtime.

Example roles:

```text
Owner
Admin
Staff
Customer
Guest
```

Each role should have appropriate test coverage.

---

## 9. Merchant Onboarding

The onboarding E2E test should verify:

```text
Login
→ Store creation
→ Store settings
→ Merchant dashboard
```

Verify that:

- Store is created.
- User receives correct membership.
- Store context is correct.
- Dashboard displays the correct store.
- Another tenant's data is not visible.

---

## 10. Product Management

E2E tests should verify:

```text
Create product
→ Create variant
→ Set price
→ Set SKU
→ Add inventory
→ Publish
```

Verify that the published product appears on the storefront.

---

## 11. Product Editing

Test:

```text
Existing product
→ Edit product
→ Save
→ Refresh
→ Verify updated data
```

Important fields should be verified from the user-visible result.

---

## 12. Inventory Management

E2E tests should verify that merchant inventory changes are reflected correctly.

Example:

```text
Set inventory = 10
→ Storefront shows product available

Set inventory = 0
→ Storefront prevents purchase
```

The test should verify actual behavior rather than only displayed inventory values.

---

## 13. Storefront Browsing

Test:

- Store resolution.
- Product listing.
- Product detail page.
- Variant selection.
- Availability.
- Basic filtering/search where implemented.
- Responsive navigation where critical.

The storefront must use the correct store context.

---

## 14. Cart Flow

Test:

```text
Product page
→ Add to cart
→ Open cart
→ Change quantity
→ Verify total
```

Verify that:

- Correct product is present.
- Quantity is correct.
- Server-calculated pricing is reflected.
- Cart belongs to the correct store.

---

## 15. Checkout Flow

The primary checkout E2E test should cover:

```text
Cart
→ Checkout
→ Customer information
→ Address
→ Discount
→ Payment
→ Order confirmation
```

The test should verify the complete resulting order.

---

## 16. Payment Testing

E2E tests must use a sandbox/test payment provider.

They should cover at least:

- Successful payment.
- Failed payment.
- Retry after failure.
- Duplicate submission where relevant.

Production payment credentials must never be used.

---

## 17. Order Confirmation

After successful checkout, verify:

- Order confirmation is displayed.
- Order number exists.
- Correct total is shown.
- Correct customer information is shown.
- Correct order items are shown.
- Payment state is correct.
- Inventory state is correct.

---

## 18. Merchant Order View

After checkout:

```text
Customer creates order
→ Merchant opens dashboard
→ Merchant sees order
```

Verify that the merchant sees only orders belonging to the selected store.

---

## 19. Order Status

E2E tests should verify supported order transitions.

Example:

```text
CONFIRMED
→ PROCESSING
→ SHIPPED
→ DELIVERED
→ COMPLETED
```

Invalid transitions should be rejected.

---

## 20. Multi-Tenant E2E Testing

At least one E2E suite must explicitly validate tenant isolation.

Example:

```text
Store A
  Product A
  Order A

Store B
  Product B
  Order B
```

Verify:

```text
Store A user → sees A
Store A user → cannot access B
Store B user → sees B
Store B user → cannot access A
```

This is one of the highest-value security tests in the system.

---

## 21. Authorization E2E Testing

Test role-specific access.

Examples:

```text
Owner → administrative operations
Admin → permitted management operations
Staff → limited operations
Customer → customer operations
Guest → public storefront
```

Unauthorized actions should be rejected.

---

## 22. Negative E2E Tests

E2E coverage should include important failure paths.

Examples:

- Invalid login.
- Unauthorized dashboard access.
- Invalid product data.
- Out-of-stock checkout.
- Invalid discount.
- Failed payment.
- Expired checkout.
- Access to another tenant.
- Invalid order transition.

Negative tests should focus on business-critical failures rather than attempting to enumerate every possible malformed input.

---

## 23. Idempotency E2E Testing

Where user actions can trigger critical mutations, test repeated actions.

Example:

```text
Click Pay
→ request submitted
→ duplicate submission
```

Expected behavior:

```text
One payment
One order
No duplicate side effects
```

The test should verify the resulting persisted state.

---

## 24. Webhook-Dependent Flows

Where payment completion depends on webhooks, E2E tests should verify the resulting user-visible behavior.

The webhook itself should be tested more extensively at the integration level.

E2E tests should focus on:

```text
Payment
→ provider event
→ application processing
→ order becomes correct
→ user sees correct state
```

---

## 25. Browser Coverage

The Demo should initially prioritize:

- Chromium.
- A representative mobile viewport.

Additional browsers should be added when actual compatibility requirements justify the cost.

The goal is meaningful coverage, not a browser-testing museum.

---

## 26. Responsive Testing

Critical workflows should be tested at representative:

- Desktop viewport.
- Mobile viewport.

Prioritize:

- Storefront.
- Cart.
- Checkout.
- Order confirmation.
- Merchant dashboard.

---

## 27. Locator Strategy

Prefer stable locators such as:

- Accessible roles.
- Labels.
- Visible text where stable.
- Dedicated test IDs where necessary.

Avoid selectors based on:

- CSS implementation details.
- Generated class names.
- DOM position.
- Fragile XPath expressions.

---

## 28. Assertions

Assertions should verify meaningful user-visible or business-visible outcomes.

Prefer:

```text