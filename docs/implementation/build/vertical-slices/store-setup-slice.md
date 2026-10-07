# Store Setup Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the first complete vertical slice for Store creation and initial merchant setup.

The Store Setup slice validates that the platform foundation, authentication, tenant context, authorization, database, API, Store domain, configuration, and observability work together as one functional system.

This slice should be implemented as a real workflow, not as isolated UI screens.

---

# 2. Slice Objective

The completed slice must support:

```text
User
  ↓
Authentication
  ↓
Organization / Store setup
  ↓
Store creation
  ↓
Owner membership
  ↓
Store configuration
  ↓
Merchant access
  ↓
Store dashboard
```

A successful implementation proves that the platform has a functioning tenant-aware merchant foundation.

---

# 3. Dependencies

This slice depends on:

```text
Repository foundation
Package foundation
Web foundation
Configuration
Database
Migrations
Seeding
Authentication
Tenant context
Authorization
API infrastructure
Validation
Error handling
Observability
Stores domain
```

Do not begin this slice until those foundations satisfy their respective Definition of Done criteria.

---

# 4. Primary User

The primary actor is a merchant creating and configuring a Store.

The merchant must be authenticated before performing protected Store management operations.

---

# 5. Entry Flow

The expected flow is:

```text
Landing/Login
    ↓
Authenticated User
    ↓
Store Setup
    ↓
Create Store
    ↓
Store Created
    ↓
Owner Membership Created
    ↓
Store Context Established
    ↓
Store Dashboard
```

---

# 6. Authentication Requirement

The user must have a valid authenticated session.

The Store Setup workflow must not trust:

```text id="x5m7r4"
userId supplied by browser
```

as the source of identity.

The authenticated principal comes from the server-side authentication context.

---

# 7. Organization Context

The Store belongs to the approved tenancy hierarchy:

```text id="q8r4m6"
Organization
    ↓
Membership
    ↓
Store
```

The implementation must preserve this relationship.

If the Demo permits a simplified first-store setup, the required Organization creation may occur automatically as part of the approved workflow.

---

# 8. Store Creation Request

The client should submit only user-controlled Store information.

Example:

```text id="v6m5r8"
name
slug
description
currency
locale
```

The server determines:

```text id="m4q7r6"
organization
owner
Store ID
timestamps
lifecycle state
```

---

# 9. Input Validation

Validate all Store Setup input at the API boundary.

Validation should cover:

```text id="x7r4m5"
Required fields
String lengths
Slug format
Currency format
Locale format
Allowed values
```

The domain layer remains responsible for business rules.

---

# 10. Store Slug

The Store slug must satisfy the approved uniqueness and formatting rules.

If the requested slug is already used within the relevant scope, return a stable conflict error.

Do not silently modify the user's requested slug unless the product specification explicitly requires automatic slug generation.

---

# 11. Store Creation Transaction

Store creation should use an application-level transaction when multiple records must be created together.

For example:

```text id="q5m8r4"
Organization
+
Membership
+
Store
```

must not leave orphaned ownership records.

---

# 12. Owner Membership

The creator must receive the appropriate Owner membership as part of Store creation.

The Owner relationship must be established server-side.

A client must not be able to create a Store and assign another arbitrary user as Owner.

---

# 13. Initial Store State

A newly created Store must enter the approved initial lifecycle state.

For example:

```text id="v8r4m6"
DRAFT
```

or the state defined by the Stores domain.

Do not invent a separate Store Setup state merely for the UI.

---

# 14. Store Configuration

The initial Store configuration should be persisted through the Stores domain.

Typical configuration includes:

```text id="m6q4r8"
Store name
Description
Currency
Locale
Public identity
```

Only fields supported by Demo requirements should be included.

---

# 15. Public Store Identity

If the Store has a public storefront identifier, it should be established during setup.

The identifier must be unique within the appropriate scope.

Public identity and merchant authentication remain separate concerns.

---

# 16. Authorization

After creation, the authenticated user should be able to access the Store because of the newly created Owner membership.

Every subsequent merchant request must independently resolve:

```text id="x5r7m4"
Authenticated User
        ↓
Organization Membership
        ↓
Store Membership
        ↓
Permission
```

Do not rely solely on the fact that the user created the Store earlier.

---

# 17. Tenant Context

Once the Store is selected, the request context should contain the trusted Store identity.

The Store ID must come from the approved tenant-resolution mechanism.

Do not allow:

```text id="q7m4r6"
Store A membership
+
Store B ID from request
```

to bypass authorization.

---

# 18. Store Dashboard

The first merchant dashboard may display:

```text id="v6r5m8"
Store name
Store status
Store identifier
Basic configuration
Current user role
```

The dashboard should not fabricate future domain metrics.

If products/orders do not exist yet, display an empty state rather than fake numbers.

---

# 19. Store Configuration Update

The merchant should be able to modify fields explicitly supported by the Store specification.

The update flow is:

```text id="m8q4r5"
UI
 ↓
API
 ↓
Validation
 ↓
AuthZ
 ↓
Store Application Service
 ↓
Domain Rules
 ↓
Transaction
 ↓
Database
```

---

# 20. State Transition

If the Store can transition from initial setup into an active state, the transition must use the Store state machine.

For example:

```text id="x4r7m6"
DRAFT
  ↓
ACTIVE
```

Only permitted transitions may succeed.

---

# 21. Store Activation

Activation must not happen merely because the frontend displays a setup-complete screen.

The backend determines whether activation requirements are satisfied.

The exact requirements follow the Store specification.

---

# 22. API Endpoints

The slice should expose only the APIs required for the workflow.

Conceptually:

```text id="q5m8r4"
POST   /api/v1/stores
GET    /api/v1/stores/:storeId
PATCH  /api/v1/stores/:storeId
```

Additional endpoints should be added only when required by the approved product/API specification.

---

# 23. DTOs

Use explicit request and response DTOs.

Examples:

```text id="v7m4r8"
CreateStoreRequest
CreateStoreResponse
StoreDetailsResponse
UpdateStoreRequest
```

Do not expose database entities directly.

---

# 24. Error Handling

Use stable shared error codes.

Examples:

```text id="m6q4r5"
STORE_SLUG_ALREADY_EXISTS
STORE_NOT_FOUND
STORE_ACCESS_DENIED
INVALID_STORE_CONFIGURATION
INVALID_STORE_STATE
```

The exact codes must follow the shared error contract.

---

# 25. Idempotency

Store creation may be retry-sensitive.

If the API contract requires idempotency for creation, support `Idempotency-Key` according to the shared API/idempotency architecture.

A client retry caused by a network timeout must not unexpectedly create multiple Stores when the operation is defined as idempotent.

---

# 26. Database Integrity

The database must enforce:

```text id="x8r5m4"
Organization relationship
Membership relationship
Store relationship
Slug uniqueness
Required fields
Valid foreign keys
```

Application validation is not a replacement for database constraints.

---

# 27. Concurrency

Concurrent Store creation requests must respect database uniqueness constraints.

For example:

```text id="q7m4r6"
Request A → slug = demo-store
Request B → slug = demo-store
```

Only one should succeed if the slug scope requires uniqueness.

The second request must receive a controlled conflict response.

---

# 28. Observability

Store Setup operations should emit structured telemetry containing:

```text id="v5r8m4"
requestId
userId where safe
organizationId
storeId once available
operation
result
duration
```

Do not log sensitive authentication information.

---

# 29. Events

The Stores domain may emit:

```text id="m4q8r6"
OrganizationCreated
StoreCreated
StoreActivated
StoreConfigurationUpdated
```

Only events required by downstream functionality should be implemented.

---

# 30. Notifications

Store creation does not require complex notification infrastructure for Demo.

If an owner confirmation notification is required, it should be triggered through the Notifications integration rather than sending email directly from Stores.

---

# 31. Frontend State

The frontend should represent:

```text id="x6r5m8"
Loading
Validation error
Conflict
Authorization failure
Server failure
Success
```

The frontend must not assume that a successful button click means the Store exists.

The server response is authoritative.

---

# 32. Loading and Retry Behavior

If the request times out, the UI should avoid blindly submitting the same mutation repeatedly.

Where idempotency is supported, retries should reuse the same idempotency identity.

---

# 33. Security Requirements

Verify:

```text id="q8m4r5"
[ ] Unauthenticated users cannot create Stores
[ ] User cannot assign arbitrary Owner
[ ] Store access requires membership
[ ] Store IDs cannot bypass tenant isolation
[ ] Private Store configuration is not public
[ ] Input is validated server-side
[ ] Errors do not expose internal details
```

---

# 34. Integration Test

The core integration test should execute:

```text id="v7m4r6"
Create authenticated user
        ↓
Create Organization
        ↓
Create Store
        ↓
Create Owner membership
        ↓
Resolve Store context
        ↓
Read Store
        ↓
Update Store
        ↓
Verify persisted state
```

---

# 35. Cross-Tenant Test

Create:

```text id="m5q8r4"
Organization A
Store A

Organization B
Store B
```

Then verify a User authorized for Store A cannot:

```text id="x4r7m6"
Read Store B
Update Store B
Modify Store B configuration
```

---

# 36. Authorization Test

Create users with different Store roles.

Verify that permissions are enforced server-side.

Examples:

```text id="q6m5r8"
Owner → allowed
Admin → allowed where specified
Staff → only permitted operations
Unaffiliated user → denied
```

The exact permission matrix follows the User Roles specification.

---

# 37. End-to-End Test

The browser-level flow should verify:

```text id="v8r4m6"
Login
 ↓
Store Setup
 ↓
Create Store
 ↓
Redirect to Dashboard
 ↓
View Store
 ↓
Edit Store
 ↓
Save
 ↓
Refresh
 ↓
Updated configuration remains
```

---

# 38. Failure Testing

Verify behavior for:

```text id="m7q4r5"
Duplicate slug
Invalid input
Expired session
Unauthorized Store
Database failure
Request retry
Concurrent creation
```

Each failure must produce a controlled result.

---

# 39. Implementation Order

Implement this vertical slice in the following order:

```text id="x5m8r4"
1. Verify authentication foundation
2. Verify tenant context
3. Verify Store schema
4. Implement Store application services
5. Implement Store creation transaction
6. Implement Owner membership creation
7. Implement Store configuration
8. Implement Store APIs
9. Implement authorization checks
10. Implement merchant setup UI
11. Implement dashboard
12. Implement structured observability
13. Add integration tests
14. Add authorization/tenant tests
15. Add E2E test
16. Run complete slice verification
```

---

# 40. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Stores, Auth, Tenant, API, Database, Security, and Product requirements.
3. Reuse the existing foundation rather than creating parallel authentication or tenant systems.
4. Keep Store business logic inside the Stores module.
5. Keep authorization server-side.
6. Preserve Organization → Membership → Store relationships.
7. Use database constraints for uniqueness and integrity.
8. Avoid adding features outside the Store Setup scope.
9. Test both successful and unauthorized workflows.
10. Review the complete diff before declaring the slice complete.

---

# 41. Definition of Done

The Store Setup slice is complete when:

```text id="q7r4m6"
[ ] Authenticated user can create a Store
[ ] Organization relationship is correct
[ ] Owner membership is created
[ ] Store configuration is persisted
[ ] Store lifecycle state is correct
[ ] Store slug uniqueness works
[ ] Tenant context resolves correctly
[ ] Merchant dashboard works
[ ] Store updates work
[ ] Server-side authorization works
[ ] Cross-tenant access is blocked
[ ] API validation works
[ ] Stable errors are returned
[ ] Idempotency behavior is correct where required
[ ] Database constraints are enforced
[ ] Structured logs are generated
[ ] Integration tests pass
[ ] Security tests pass
[ ] E2E Store Setup flow passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 42. Slice Completion Gate

Before moving to the next vertical slice, verify that the Store Setup workflow works from a clean environment.

The minimum acceptance path is:

```text id="v6m4r8"
Fresh database
    ↓
Seed/bootstrap
    ↓
Register/Login
    ↓
Create Store
    ↓
Become Owner
    ↓
Open Dashboard
    ↓
Update Store
    ↓
Refresh
    ↓
Persisted configuration visible
```

The slice is not complete merely because the Store API returns `200`.

The complete user journey, persistence, tenant isolation, authorization, error handling, and verification must all work together.