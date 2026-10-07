# Input Validation

## 1. Purpose

This document defines the input-validation strategy for the Shopify-like commerce platform.

Input validation ensures that data entering the system conforms to expected structure, type, format, range, and business constraints before it reaches application logic, persistence, or external integrations.

All external input must be treated as untrusted. Humans have demonstrated a remarkable ability to put `-999999999` into a quantity field and then act surprised when the database objects.

---

## 2. Core Principles

Input validation must:

- Be performed server-side.
- Occur at application boundaries.
- Reject invalid data early.
- Use explicit schemas.
- Distinguish structural validation from business rules.
- Normalize values consistently.
- Never rely solely on frontend validation.
- Prevent unsafe data from reaching sensitive operations.
- Produce stable API errors.
- Preserve tenant and authorization boundaries.

---

## 3. Validation Layers

Validation should occur at multiple appropriate layers:

```text id="q3m8x7"
External Input
      ↓
Transport/schema validation
      ↓
Normalization
      ↓
Authorization
      ↓
Application/business validation
      ↓
Domain invariants
      ↓
Database constraints
```

Each layer has a different responsibility.

---

## 4. Transport Validation

API handlers should validate incoming requests before invoking application services.

Validate:

- Required fields.
- Types.
- Formats.
- Lengths.
- Enumerations.
- Array sizes.
- Object structure.
- Identifier formats.

Invalid requests should be rejected without executing business operations.

---

## 5. Schema Validation

The project should use a consistent schema-validation approach.

Schemas should explicitly define:

```text id="4n7p2m"
Field
Type
Required/optional
Allowed values
Length/range
Normalization rules
```

Avoid accepting arbitrary objects and passing them directly into application services.

---

## 6. Unknown Fields

APIs should define how unexpected fields are handled.

For security-sensitive operations, silently accepting arbitrary fields should be avoided.

Example:

```json id="q9v3m6"
{
  "name": "Product",
  "price": 100,
  "role": "OWNER"
}
```

If `role` is not part of the endpoint contract, it must not accidentally influence the operation.

---

## 7. Type Validation

Validate expected data types explicitly.

Examples:

```text id="x4m8q2"
quantity → integer
price → exact monetary representation
email → string
active → boolean
status → allowed enum
date → valid date/time
```

Do not rely on JavaScript's implicit type coercion for business-critical input.

---

## 8. String Validation

String fields should define appropriate:

- Maximum length.
- Minimum length where meaningful.
- Empty-string behavior.
- Whitespace handling.
- Character restrictions where required.

Avoid imposing arbitrary character restrictions when they provide no security or product benefit.

Names and addresses may legitimately contain characters that developers did not anticipate.

---

## 9. String Normalization

Normalize values where the domain requires consistent comparison.

Examples:

- Email addresses.
- Store slugs.
- Discount codes.
- SKU values where the specification defines normalization.

Normalization must happen consistently before uniqueness checks and persistence.

---

## 10. Email Validation

Email input should be validated for:

- Required structure.
- Reasonable length.
- Normalization rules.
- Safe storage.

Do not attempt to implement the entire email standard with an enormous homemade regular expression.

Email validation should determine whether the application can reasonably process the address, not whether the developer has conquered RFC history.

---

## 11. Slug Validation

Store and product slugs should be:

- URL-safe.
- Normalized consistently.
- Bounded in length.
- Unique within the appropriate tenant scope.

Example:

```text id="b7m3q8"
store-a
summer-products
```

The final uniqueness constraint must be enforced by the database.

---

## 12. Identifier Validation

Resource identifiers should be validated before querying.

Invalid identifiers should fail safely rather than generating malformed database queries or ambiguous behavior.

Identifiers must not be interpreted as arbitrary SQL, filesystem paths, or commands.

---

## 13. Quantity Validation

Commerce quantities must be validated as:

- Integers where required.
- Positive.
- Within a reasonable maximum.
- Compatible with domain rules.

Example:

```text id="p8q2m4"
quantity = 0
→ rejected

quantity = -1
→ rejected

quantity = 1.5
→ rejected where fractional quantities are unsupported
```

Inventory and checkout must apply their own domain rules as well.

---

## 14. Money Validation

Money must never be represented internally as an imprecise floating-point value.

Input handling must define:

- Currency.
- Precision.
- Allowed representation.
- Minimum/maximum values.
- Rounding rules.

The authoritative price must always be determined server-side.

---

## 15. Currency Validation

Currency input must:

- Use supported currency codes.
- Follow the platform's configured currency rules.
- Not be trusted merely because it was sent by the client.

For checkout and payment operations, currency must match the authoritative store/checkout/payment context.

---

## 16. Percentage Validation

Percentage-based discounts must validate:

- Numeric representation.
- Allowed range.
- Precision.
- Maximum discount rules.

For example, a percentage cannot be negative or exceed the domain's configured maximum.

---

## 17. Date and Time Validation

Date/time input must be validated for:

- Valid representation.
- Time zone interpretation.
- Ordering where applicable.
- Allowed ranges.

Examples:

```text id="m6n3x9"
discount starts before expiration
checkout expiration is in the future
```

Business validation should occur after basic format validation.

---

## 18. Enumeration Validation

Status and type fields must accept only defined values.

Examples:

```text id="v8q4m2"
product.status
order.status
payment.status
discount.type
membership.role
```

Do not accept arbitrary strings and assume application logic will handle them correctly.

---

## 19. State Transition Validation

A valid enum value does not necessarily mean a valid operation.

For example:

```text id="q7m3x8"
Order = DELIVERED
Request = move to PENDING
```

The value may be syntactically valid but invalid according to the order state machine.

State transition rules belong to the domain/application layer.

---

## 20. Array Validation

Arrays should have:

- Maximum size.
- Valid element types.
- Valid element structure.
- Appropriate duplicate handling.

This is especially important for:

- Cart items.
- Checkout items.
- Bulk operations.
- Product variants.
- Media uploads.

Unbounded arrays can become a denial-of-service vector.

---

## 21. Nested Object Validation

Nested request objects must be validated recursively.

Example:

```json id="9z2m7v"
{
  "address": {
    "line1": "...",
    "city": "...",
    "postalCode": "..."
  }
}
```

Each field must have explicit validation rules.

Do not validate only the top-level object and assume nested values are safe.

---

## 22. Request Size Limits

The application should enforce reasonable limits for:

- HTTP request bodies.
- JSON payloads.
- File uploads.
- Query parameters.
- Header values where configurable.

Limits should reflect actual product requirements.

Large payloads must not be allowed merely because the framework permits them.

---

## 23. File Validation

If the platform accepts uploads, validate:

- File size.
- MIME type.
- Extension.
- File content where necessary.
- Filename.
- Object key.
- Upload destination.

Do not trust the file extension or client-provided MIME type alone.

---

## 24. File Name Handling

User-provided filenames must not become arbitrary filesystem paths.

Avoid using raw filenames directly for storage locations.

Prefer generated object keys such as:

```text id="y6m3q8"
stores/{storeId}/media/{generatedId}
```

This also improves tenant isolation and collision resistance.

---

## 25. HTML and Rich Text

If rich text is supported, it must be sanitized according to the allowed content model.

Never assume:

```text id="q8m2v4"
description
```

is safe merely because it came from a merchant.

Stored content may later be rendered to other users.

---

## 26. SQL Injection Protection

Input validation is not the primary SQL injection defense.

Database access must use:

- Parameterized queries.
- Safe query builders.
- ORM/database abstractions that correctly parameterize values.

Never construct SQL using direct string concatenation from user input.

---

## 27. Command Injection

User input must never be directly inserted into operating-system commands.

If system commands are unavoidable:

- Use fixed executable paths.
- Pass arguments safely.
- Avoid shell interpolation.
- Validate arguments.
- Restrict allowed operations.

Prefer library APIs over shell commands.

---

## 28. XSS Protection

Input validation should be combined with output encoding and sanitization.

Do not attempt to solve XSS solely by stripping suspicious characters during input.

The correct defense depends on the output context.

---

## 29. Authorization Is Not Validation

A valid input is not necessarily an authorized operation.

Example:

```text id="r4m8q2"
storeId = valid
```

does not mean:

```text id="p7x3n6"
user is authorized for that store
```

Validation and authorization must remain separate checks.

---

## 30. Business Validation

Business validation verifies rules such as:

- Product must belong to store.
- Inventory cannot become invalid.
- Discount must be active.
- Checkout must be open.
- Payment amount must match authoritative checkout amount.
- Order transition must be valid.

These rules belong in application/domain logic rather than only transport schemas.

---

## 31. Database Constraints

Database constraints provide the final integrity boundary.

Examples:

- Foreign keys.
- Unique constraints.
- Check constraints.
- Not-null constraints.
- Valid relationship constraints.

Application validation improves usability but must not be the only protection against invalid data.

---

## 32. Validation and Transactions

Validation that depends on current database state may need to occur inside the appropriate transaction.

Example:

```text id="h8q3m5"
Check inventory
→ reserve inventory
```

A separate non-transactional validation followed by a mutation can introduce race conditions.

Critical business validation must be designed together with transaction and concurrency control.

---

## 33. Checkout Validation

Checkout must revalidate authoritative values.

Never trust:

```text id="v7m2q8"
client total
client discount
client product price
client inventory status
client currency
```

The server must recalculate or retrieve authoritative values.

---

## 34. Payment Validation

Payment requests must verify:

- Checkout identity.
- Authorized context.
- Amount.
- Currency.
- Payment state.
- Idempotency key.
- Provider response.

A client must never be able to change the payment amount simply by modifying request JSON.

---

## 35. Discount Validation

Discount input must validate:

- Code structure.
- Store ownership.
- Active period.
- Eligibility.
- Usage limits.
- Minimum order requirements.
- Discount calculation.

Checkout must revalidate the discount rather than trusting earlier cart or frontend calculations.

---

## 36. Pagination Input

Pagination parameters must be bounded.

Examples:

```text id="m3x8q7"
limit = 25
```

with an enforced maximum such as:

```text id="q7n2v5"
limit <= 100
```

Clients must not be able to request unlimited records.

---

## 37. Sorting and Filtering

Sorting and filtering inputs must use explicit allowlists.

For example:

```text id="w8m4x2"
sort=createdAt
```

should be mapped to a known database field.

Never allow clients to provide arbitrary SQL fragments or column expressions.

---

## 38. Validation Error Contract

Validation failures should use the standard API error format.

A response should provide:

- Stable error code.
- Safe human-readable message.
- Request ID.
- Field-level details where appropriate.

Example:

```json id="b4q9m7"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "..."
  }
}
```

Do not expose stack traces or internal validation implementation details.

---

## 39. Validation Ordering

A typical protected request should follow:

```text id="n6m3x8"
Authenticate
  ↓
Resolve tenant
  ↓
Authorize
  ↓
Validate input
  ↓
Execute application service
  ↓
Apply domain invariants
  ↓
Persist
```

The exact ordering may differ where an operation requires validation before authorization for safe information-disclosure behavior.

Security-sensitive decisions must remain deliberate.

---

## 40. Validation Reuse

Validation schemas should be reusable where the same contract genuinely applies.

However, avoid creating a single enormous schema shared by unrelated operations.

For example:

```text id="x5q8m2"
CreateProductInput
UpdateProductInput
PublishProductInput
```

may intentionally have different requirements.

---

## 41. Input Normalization

Normalization should be explicit and predictable.

Examples:

```text id="j8m3q6"
trim supported text
normalize email
normalize discount code
normalize slug
```

Do not silently transform values in ways that change business meaning.

---

## 42. Validation Testing

Tests should cover:

```text id="q4n8x3"
[ ] Missing required fields
[ ] Wrong types
[ ] Invalid formats
[ ] Empty values
[ ] Excessive lengths
[ ] Invalid enum values
[ ] Negative quantities
[ ] Invalid money
[ ] Invalid dates
[ ] Invalid identifiers
[ ] Oversized arrays
[ ] Oversized requests
[ ] Malicious input
[ ] Unknown fields
[ ] Cross-tenant identifiers
[ ] Business-rule violations
```

---

## 43. Security Regression Tests

Discovered validation vulnerabilities should result in regression tests.

Examples:

```text id="v6m2q9"
SQL injection attempt
→ rejected/safely handled

Oversized request
→ rejected

Negative quantity
→ rejected

Unauthorized identifier
→ rejected

Malformed webhook
→ rejected
```

---

## 44. AI Development Requirements

AI-assisted implementation must:

- Read the actual `AGENTS.md`.
- Inspect existing validation patterns.
- Reuse established schemas where appropriate.
- Avoid duplicating validation logic unnecessarily.
- Never remove validation to make tests pass.
- Never trust frontend validation.
- Never introduce arbitrary permissive parsing.
- Add regression tests for discovered validation failures.

AI-generated schemas must be reviewed for missing boundary cases.

---

## 45. Performance Considerations

Validation should be efficient enough for normal API traffic.

Avoid:

- Excessive database queries during basic schema validation.
- Repeated expensive parsing.
- Unbounded recursive processing.
- Huge payload acceptance.

State-dependent validation should be performed at the correct application/transaction boundary rather than artificially packed into request parsing.

---

## 46. Definition of Done

Input validation is complete when:

```text id="p8m4x7"
[ ] All public inputs have explicit schemas
[ ] Server-side validation is enforced
[ ] Types are validated
[ ] String lengths are bounded
[ ] Quantities are constrained
[ ] Money is represented safely
[ ] Enums are validated
[ ] Arrays and payload sizes are bounded
[ ] Files are validated where applicable
[ ] Authorization remains separate
[ ] Business rules are enforced
[ ] Database constraints remain in place
[ ] Critical operations revalidate authoritative state
[ ] Validation errors use the standard API contract
[ ] Security regression tests exist
[ ] Relevant validation tests were actually executed
```