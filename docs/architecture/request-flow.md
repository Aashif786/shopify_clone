# Request Flow Architecture

## 1. Purpose

This document defines how requests move through the Demo platform.

It establishes a consistent request-processing model for:

- Customer storefront requests
- Merchant requests
- API requests
- Authentication requests
- Webhooks
- Background operations

The goal is to ensure that authentication, tenant isolation, authorization, validation, business logic, persistence, and error handling occur in a predictable order.

---

# 2. Standard Request Pipeline

A normal authenticated application request follows:

```text
Client
  ↓
Request Entry
  ↓
Request Context
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Input Validation
  ↓
Application Service
  ↓
Domain Logic
  ↓
Persistence / Integration
  ↓
Transaction Completion
  ↓
Response Mapping
  ↓
Client
```

Not every request requires every step.

For example, a public storefront product request may not require an authenticated merchant identity.

However, protected operations MUST perform the required security and tenant checks.

---

# 3. Request Entry

Requests enter through the web application.

Conceptually:

```text
Browser / Client
       ↓
   apps/web
       ↓
Route / Handler
```

The request entry layer is responsible for:

- Receiving the request.
- Identifying the requested operation.
- Establishing basic request context.
- Passing control to the appropriate application operation.

It should not contain significant business logic.

---

# 4. Request Context

A request should establish contextual information needed during processing.

Conceptually:

```text
Request Context
├── Request ID
├── Actor
├── Organization
├── Store
├── Membership / Role
└── Other trusted metadata
```

The exact implementation may differ between request types.

The important requirement is that downstream operations receive trusted context rather than reconstructing security-sensitive information from untrusted client input.

---

# 5. Authentication

Authentication establishes the identity associated with the request.

```text
Request
  ↓
Authentication
  ↓
Authenticated Actor
```

For authenticated merchant requests, the result should identify the user.

For customer requests, the result may identify a customer.

For public requests, no authenticated identity may exist.

Authentication MUST occur before protected operations are executed.

---

# 6. Authentication Does Not Grant Authorization

A valid login does not automatically grant access to every resource.

The distinction is:

```text
Authentication
    ↓
Who are you?

Authorization
    ↓
What are you allowed to do?
```

For example:

```text
User authenticated
        ↓
Is the user a member of this store?
        ↓
What role does the user have?
        ↓
Does that role permit this operation?
```

---

# 7. Tenant Resolution

For store-specific operations, tenant context must be resolved.

Conceptually:

```text
Authenticated User
       ↓
Organization
       ↓
Store
       ↓
Membership
```

The source of store context may vary depending on the request.

Examples include:

- Store identifier in a controlled route.
- Store domain.
- Authenticated merchant context.
- Server-side session context.

Client-provided identifiers MUST NOT be treated as sufficient authorization.

---

# 8. Tenant Validation

After resolving the requested store, the system must verify that the actor is permitted to operate within that store.

For merchant requests:

```text
User
 ↓
Store
 ↓
Membership
 ↓
Role
 ↓
Permission
```

For customer requests:

```text
Customer
 ↓
Store
 ↓
Customer Relationship / Order Ownership
```

A request that fails tenant validation must be rejected.

---

# 9. Authorization

Authorization evaluates whether the actor may perform the requested operation.

Conceptually:

```text
Actor
+
Tenant Context
+
Role / Permission
+
Resource
+
Requested Action
        ↓
Authorization Decision
```

Examples:

```text
Owner → Update Store Settings       ✓
Admin → Update Store Settings       ✓
Staff → Update Store Settings       depends on permission
Customer → Update Store Settings    ✗
```

Authorization MUST be enforced on the server.

---

# 10. Resource Ownership

Authorization must also consider resource ownership.

For example:

```text
Store A
 └── Order 123

Store B
 └── Order 456
```

A user authorized for Store A must not access Order 456 merely because they know its identifier.

The system must verify the relationship:

```text
Actor
  ↓
Store A
  ↓
Order 123
```

before performing the operation.

---

# 11. Input Validation

After authentication and authorization requirements are satisfied, request input must be validated.

```text
Request
  ↓
Authentication
  ↓
Tenant / Authorization
  ↓
Validation
  ↓
Application Service
```

Validation should cover:

- Required fields
- Data types
- Length constraints
- Formats
- Allowed values
- Quantity limits
- Domain-specific input constraints where appropriate

Client-side validation may improve user experience but MUST NOT replace server-side validation.

---

# 12. Application Service Invocation

Once the request has passed the required checks:

```text
Route
  ↓
Application Service
```

The application service executes the requested use case.

Examples:

```text
CreateProduct
UpdateProduct
AdjustInventory
AddCartItem
StartCheckout
CompleteCheckout
CreateOrder
UpdateOrderStatus
```

The route should not independently orchestrate all domain behavior.

---

# 13. Domain Execution

The application service invokes the appropriate domain operations.

Example:

```text
Update Product
      ↓
Application Service
      ↓
Product Domain
      ↓
Validate Product Rules
      ↓
Change Product State
```

Domain rules must remain enforced regardless of whether the operation originated from:

- Web UI
- API
- Worker
- Internal application operation

---

# 14. Persistence

When domain state changes:

```text
Domain
  ↓
Application / Repository Boundary
  ↓
PostgreSQL
```

The database is the transactional source of truth.

Persistence must preserve:

- Referential integrity
- Constraints
- Tenant ownership
- Transactional consistency
- Historical correctness

---

# 15. Transaction Boundary

Operations that require atomicity should execute within an appropriate transaction.

Example:

```text
Checkout
   ↓
Validate Purchase
   ↓
Reserve / Consume Inventory
   ↓
Create Order
   ↓
Record Payment State
   ↓
Commit
```

The exact transaction boundary depends on the operation and integration behavior.

Not every external operation can participate in a PostgreSQL transaction.

External side effects must therefore be designed carefully around transactional state.

---

# 16. External Integrations

When an operation requires an external service:

```text
Application Service
       ↓
Integration Interface
       ↓
Provider Adapter
       ↓
External Service
```

The application should not allow provider-specific implementation details to spread through the business modules.

Examples:

- Payment provider
- Email provider
- Object storage
- Monitoring service

---

# 17. Payment Request Flow

A simplified payment flow is:

```text
Customer
   ↓
Checkout
   ↓
Validate Cart
   ↓
Validate Product
   ↓
Validate Inventory
   ↓
Validate Discount
   ↓
Create Payment Attempt
   ↓
Payment Provider
   ↓
Payment Result
   ↓
Payment State Update
   ↓
Order Completion
```

Payment state must be treated as authoritative business state rather than relying solely on a client-side success response.

---

# 18. Checkout Request Flow

The checkout flow requires stronger validation than ordinary CRUD operations.

```text
Checkout Request
       ↓
Authenticate / Identify Customer
       ↓
Resolve Store
       ↓
Load Cart
       ↓
Validate Cart
       ↓
Validate Products
       ↓
Validate Prices
       ↓
Validate Discounts
       ↓
Validate Inventory
       ↓
Calculate Final Total
       ↓
Initiate Payment
       ↓
Confirm Payment
       ↓
Create / Finalize Order
       ↓
Update Required State
       ↓
Return Result
```

The system must not assume that information calculated when the cart was created is still valid at checkout time.

---

# 19. Order Request Flow

A merchant viewing an order follows:

```text
Merchant Request
      ↓
Authentication
      ↓
Store Resolution
      ↓
Membership Check
      ↓
Permission Check
      ↓
Order Lookup
      ↓
Verify Store Ownership
      ↓
Return Order
```

The order lookup must remain tenant-aware.

---

# 20. Customer Order Request Flow

A customer viewing an order follows:

```text
Customer Request
      ↓
Authentication
      ↓
Customer Context
      ↓
Order Lookup
      ↓
Verify Customer Ownership
      ↓
Return Order
```

Customers must not be able to enumerate or access unrelated orders.

---

# 21. Public Storefront Request

A public storefront request may follow:

```text
Customer
   ↓
Storefront Request
   ↓
Resolve Store
   ↓
Validate Store Availability
   ↓
Load Published Products
   ↓
Return Storefront Data
```

Authentication is not necessarily required.

However, tenant/store isolation still applies.

Public does not mean “all stores are one giant database buffet.”

---

# 22. Webhook Request Flow

External webhooks require a separate trust model.

```text
External Provider
       ↓
Webhook Endpoint
       ↓
Verify Webhook Authenticity
       ↓
Identify Provider Event
       ↓
Resolve Store / Integration Context
       ↓
Check Event Idempotency
       ↓
Process Event
       ↓
Persist Result
       ↓
Trigger Secondary Effects
```

Webhook payloads MUST NOT be trusted before authenticity verification.

Repeated webhook delivery MUST be safe.

---

# 23. Webhook Idempotency

Providers may deliver the same event more than once.

Therefore:

```text
Webhook Event A
      ↓
Process
      ↓
Record Event

Webhook Event A
      ↓
Recognize Already Processed
      ↓
Do Not Duplicate Effect
```

The exact idempotency mechanism belongs in the payment/integration architecture.

The business requirement is that duplicate delivery does not produce duplicate business effects.

---

# 24. Background Job Flow

Background jobs follow:

```text
Job Queue / Event
       ↓
Worker
       ↓
Load Job
       ↓
Resolve Context
       ↓
Validate Job State
       ↓
Invoke Application Service
       ↓
Execute Domain Logic
       ↓
Persist Result
       ↓
Mark Job Complete
```

If the job fails and is retryable:

```text
Failure
  ↓
Retry Policy
  ↓
Worker Retry
  ↓
Idempotent Operation
```

---

# 25. Error Flow

Errors should move through controlled boundaries.

```text
Domain / Infrastructure Error
           ↓
Application Layer
           ↓
Error Classification
           ↓
Presentation Layer
           ↓
Safe Client Response
```

The client should receive an appropriate error category rather than internal implementation details.

Examples:

```text
Validation Error
Authorization Error
Not Found
Conflict
Business Rule Violation
External Service Failure
Internal Server Error
```

---

# 26. Error Handling by Category

## Validation Error

Example:

```text
Invalid quantity
```

The request should be rejected without changing business state.

## Authorization Error

Example:

```text
User lacks permission
```

The operation must not execute.

## Business Rule Error

Example:

```text
Insufficient inventory
```

The operation must not produce an invalid state.

## External Failure

Example:

```text
Payment provider unavailable
```

The system should preserve a recoverable state.

## Unexpected Failure

Unexpected failures must be logged appropriately and must not expose sensitive internals.

---

# 27. Retry Flow

Critical operations must be designed for safe retries.

```text
Request
   ↓
Operation
   ↓
Timeout / Connection Failure
   ↓
Client Retry
   ↓
Server Detects Existing Operation
   ↓
Return Existing Result
```

Where idempotency is required, an idempotency mechanism should identify the logical operation.

This is particularly important for:

- Checkout
- Payments
- Order creation
- Webhooks
- Inventory operations where applicable

---

# 28. Response Flow

After successful application execution:

```text
Domain Result
    ↓
Application Result
    ↓
Response Mapping
    ↓
HTTP Response
    ↓
Client
```

The response should expose only the data appropriate to the requesting actor.

Internal domain objects should not automatically become public API responses.

---

# 29. Response Consistency

Responses should use consistent representations for:

- Success
- Validation errors
- Authorization failures
- Missing resources
- Conflicts
- Internal failures

The API architecture document will define the exact response contract.

---

# 30. Request Correlation

Important requests should be traceable through the system.

A request may carry:

```text
Request ID
Correlation ID
Actor ID
Store ID
Operation
```

These identifiers should allow developers to connect:

```text
HTTP Request
    ↓
Application Operation
    ↓
Database Operation
    ↓
Background Job
    ↓
External Provider Call
```

Sensitive data must not be included merely for debugging convenience.

---

# 31. Request Flow for Critical Commerce Operations

Critical commerce operations require stricter processing.

### Inventory

```text
Request
 ↓
Auth
 ↓
Tenant
 ↓
Authorization
 ↓
Validation
 ↓
Inventory Operation
 ↓
Transaction
 ↓
Commit
```

### Checkout

```text
Request
 ↓
Auth
 ↓
Tenant
 ↓
Cart Validation
 ↓
Business Validation
 ↓
Payment
 ↓
Order
 ↓
Inventory
 ↓
Commit / Finalize
```

### Payment Webhook

```text
Webhook
 ↓
Verify Authenticity
 ↓
Identify Event
 ↓
Idempotency Check
 ↓
Payment State Update
 ↓
Trigger Required Effects
```

---

# 32. Request Flow Invariants

Every protected request must preserve:

1. Identity is established.
2. Tenant context is correct.
3. Authorization is verified.
4. Input is validated.
5. Business rules are enforced.
6. Critical state changes are transactional where required.
7. External integrations are isolated.
8. Errors do not expose sensitive internals.
9. Retry behavior does not create duplicate business effects.
10. Responses do not leak unauthorized data.

---

# 33. Request Flow Anti-Patterns

The following patterns are prohibited:

### Client-Controlled Authorization

```text
Client says:
"I am an admin."
```

The server must determine the actual role.

### ID-Only Authorization

```text
GET /orders/123
```

must not mean:

```text
"User knows 123, therefore user owns 123."
```

### Business Logic in UI

The frontend must not be the authoritative source for:

- Pricing
- Inventory
- Discounts
- Permissions
- Payment state

### Direct Database Access from Presentation

```text
Route → arbitrary database query
```

should not bypass module/application boundaries.

### Unverified Webhooks

Provider payloads must not be processed before authenticity checks.

### Non-Idempotent Payment Processing

Repeated payment events must not create repeated orders or duplicate financial effects.

---

# 34. Public vs Protected Operations

The platform should explicitly classify operations.

| Operation | Typical Access |
|---|---|
| View published storefront | Public |
| View published product | Public |
| Add to cart | Customer |
| Checkout | Customer |
| View own order | Customer |
| Create product | Merchant |
| Update product | Merchant |
| Adjust inventory | Authorized merchant |
| Manage orders | Authorized merchant |
| Manage store settings | Owner/Admin |
| Process platform administration | Restricted |

The exact authorization rules are defined by the role and security specifications.

---

# 35. Architectural Principle

The request pipeline should make security and business correctness unavoidable rather than optional.

The desired structure is:

```text
                Request
                   │
                   ▼
             Trusted Context
                   │
                   ▼
             Authorization
                   │
                   ▼
              Validation
                   │
                   ▼
          Application Service
                   │
                   ▼
              Domain Rules
                   │
                   ▼
          Transaction / State
                   │
                   ▼
              Safe Result
```

---

# 36. Definition of Done

The request architecture is correctly implemented when:

- Request entry points remain thin.
- Authentication is separated from authorization.
- Tenant context is resolved explicitly.
- Store ownership is verified.
- Input is validated server-side.
- Business operations execute through application services.
- Domain rules remain inside their owning modules.
- Critical operations use appropriate transactions.
- External integrations are isolated.
- Webhooks are authenticated and idempotent.
- Background jobs preserve tenant and business context.
- Errors are classified and safely exposed.
- Critical retries do not create duplicate effects.
- Responses do not expose unauthorized information.
- Important operations can be correlated for debugging.

---

# 37. Summary

The standard request architecture is:

```text
Client
  ↓
Request Entry
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Validation
  ↓
Application Service
  ↓
Domain Module
  ↓
Persistence / Integration
  ↓
Transaction
  ↓
Response Mapping
  ↓
Client
```

For background and webhook processing, the entry point changes, but the same principles remain:

> **Establish trusted context, enforce authorization and tenancy, validate the operation, execute business rules through the owning module, preserve transactional correctness, and make retries safe.**