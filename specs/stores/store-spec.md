# Store Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Stores domain of the Demo commerce platform.

The Stores domain is responsible for:

- Organizations
- Stores
- Store settings
- Merchant memberships
- Store lifecycle
- Store configuration
- Store-level authorization context

The Stores domain does not own products, inventory, carts, checkout, payments, or orders.

Those domains reference the Store as their tenant boundary.

---

# 2. Scope

The Demo Stores module must support:

- Organization creation
- Store creation
- Store configuration
- Store activation
- Store suspension
- Store archival
- Merchant membership
- Merchant roles
- Store access validation
- Store identity
- Store slug
- Store currency
- Store locale
- Store timezone
- Basic storefront configuration

The module must support the core merchant workflow:

```text
Create Organization
        ↓
Create Store
        ↓
Configure Store
        ↓
Add/Manage Members
        ↓
Activate Store
        ↓
Begin Commerce Operations
```

---

# 3. Out of Scope

The Demo Stores module does not include:

- Complex organization hierarchies
- Enterprise SSO
- SCIM provisioning
- Advanced team management
- Multiple billing accounts
- Subscription billing
- Franchise management
- Multi-region store infrastructure
- Advanced localization
- Advanced tax configuration
- Advanced shipping configuration
- Platform marketplace functionality

These may be introduced later if required.

---

# 4. Domain Ownership

The Stores module owns:

```text
Organization
OrganizationMembership
Store
StoreSettings
StoreMembership
```

It is the authoritative owner of:

- Store identity
- Organization/store relationship
- Store lifecycle
- Store membership
- Store roles
- Store configuration

Other modules may reference these concepts through public interfaces.

They must not modify Stores-owned data directly.

---

# 5. Organization

An Organization represents the merchant's top-level business entity.

Conceptually:

```text
Organization
├── id
├── name
├── status
├── created_at
└── updated_at
```

An organization may own multiple stores.

```text
Organization
   ├── Store A
   ├── Store B
   └── Store C
```

---

# 6. Organization Rules

An Organization:

- must have a unique identifier
- must have a valid name
- must have at least one authorized owner
- may contain multiple stores
- may contain multiple members
- must not be accessible by unauthorized users

The organization is not itself the commerce tenant for products and orders.

The Store is the primary commerce tenant.

---

# 7. Store

A Store represents a merchant's commerce environment.

Conceptually:

```text
Store
├── id
├── organization_id
├── name
├── slug
├── status
├── currency
├── locale
├── timezone
├── created_at
└── updated_at
```

Every Store belongs to exactly one Organization.

---

# 8. Store Invariants

The following invariants are mandatory:

1. Every store belongs to exactly one organization.
2. Store slug is unique within its intended scope.
3. Store configuration belongs to exactly one store.
4. Store-owned resources cannot cross store boundaries.
5. A suspended store cannot perform normal commerce operations.
6. An archived store cannot be reactivated through the normal merchant workflow.
7. A store must have an authorized owner.
8. Store settings must remain associated with the correct store.
9. Store identifiers must remain stable after creation.

---

# 9. Store Lifecycle

The Store lifecycle is:

```text
DRAFT
  ↓
ACTIVE
  ↓
SUSPENDED
  ↓
ACTIVE

DRAFT
  ↓
ARCHIVED

ACTIVE
  ↓
ARCHIVED

SUSPENDED
  ↓
ARCHIVED
```

The complete state machine is defined in:

```text
docs/domain/state-machines.md
```

---

# 10. Store Creation

## 10.1 Preconditions

The caller must be authenticated.

The caller must be allowed to create an organization/store.

For an initial merchant account, the creating user becomes the initial organization/store owner.

---

## 10.2 Required Input

Minimum store creation data:

```text
name
slug
currency
locale
timezone
```

The API may provide sensible defaults for locale, timezone, and currency where product requirements permit.

The server remains authoritative.

---

# 11. Store Creation Flow

```text
Authenticated User
        ↓
Validate Request
        ↓
Create Organization
        ↓
Create Organization Membership
        ↓
Create Store
        ↓
Create Store Settings
        ↓
Create Store Membership
        ↓
Commit Transaction
        ↓
Return Store
```

The creation process should be atomic.

If any required operation fails, the transaction should roll back.

---

# 12. Store Creation Idempotency

If the API supports an idempotency key for store creation, retrying the same request should not create multiple stores.

Where idempotency is not required at the public endpoint level, database uniqueness and application-level duplicate detection must still prevent accidental duplicate setup where practical.

---

# 13. Store Slug

The store slug is the human-readable store identifier.

Example:

```text
my-fashion-store
```

Slug requirements:

- normalized
- URL-safe
- non-empty
- bounded in length
- unique within its defined scope

The slug should not be used as the immutable internal identity.

The Store ID remains authoritative.

---

# 14. Store Name

The store name is merchant-facing.

It may be changed after creation.

Changing the store name must not change:

- Store ID
- organization relationship
- ownership
- existing orders
- product ownership

---

# 15. Store Configuration

Store settings may include:

```text
store name
currency
locale
timezone
storefront status
contact information
basic branding
```

Only configuration relevant to Demo should be implemented.

---

# 16. Currency

The store has a default currency.

Example:

```text
INR
EUR
USD
```

Currency must be represented using an explicit currency code.

Financial calculations must use exact money handling.

The API must not accept arbitrary currency values without validation.

---

# 17. Currency Immutability

Changing the store's default currency after transactions exist can create significant financial ambiguity.

Demo should therefore either:

1. restrict currency changes after commerce activity begins, or
2. require an explicit controlled operation.

Historical orders must retain their original currency regardless of later store configuration changes.

---

# 18. Locale

Locale determines default language/formatting behavior.

Example:

```text
en-IN
de-DE
en-US
```

Locale should not determine authorization or business rules.

---

# 19. Timezone

The store timezone is used for merchant-facing date/time interpretation and time-sensitive business rules where appropriate.

Example:

```text
Asia/Kolkata
Europe/Berlin
America/New_York
```

Timestamps should be stored in a consistent canonical representation.

The store timezone is applied when displaying or interpreting local business times.

---

# 20. Store Activation

A store may be activated once required configuration is complete.

Activation should verify:

- valid store identity
- valid configuration
- valid owner
- required settings
- any Demo-specific setup requirements

Successful activation transitions:

```text
DRAFT → ACTIVE
```

---

# 21. Store Suspension

A store may be suspended by an authorized merchant/platform operation.

Suspension should prevent normal commerce operations according to product policy.

Potentially blocked operations include:

- storefront purchasing
- checkout
- new orders
- merchant commerce mutations

Read-only administrative access may remain available.

---

# 22. Store Reactivation

A suspended store may return to:

```text
ACTIVE
```

when an authorized actor resolves the reason for suspension.

Reactivation must validate the current store state.

---

# 23. Store Archival

Archival represents permanent retirement from normal commerce operations.

After archival:

- storefront commerce must stop
- new orders must not be created
- merchant commerce mutations must be blocked
- historical data must remain accessible according to authorization and retention rules

Archived data must not be silently deleted.

---

# 24. Store Membership

A StoreMembership connects a user to a store.

Conceptually:

```text
StoreMembership
├── user_id
├── store_id
├── role
├── status
├── created_at
└── updated_at
```

A user may belong to multiple stores.

---

# 25. Store Roles

Demo supports:

```text
OWNER
ADMIN
STAFF
```

Roles are scoped to the store.

A user's role in Store A does not automatically grant the same role in Store B.

---

# 26. Owner

The Owner has the highest normal merchant-level permissions.

Typical capabilities:

- manage store
- manage settings
- manage members
- manage products
- manage inventory
- manage orders
- manage discounts
- manage payment configuration

There must always be a valid ownership model.

---

# 27. Admin

Admin has broad operational permissions.

Typical capabilities:

- manage products
- manage inventory
- manage orders
- manage customers
- manage discounts
- manage selected store settings

Admin permissions must not automatically include ownership transfer or equivalent high-risk operations unless explicitly defined.

---

# 28. Staff

Staff has limited operational permissions.

Typical capabilities may include:

- view products
- manage inventory
- manage orders
- view customers

Staff should not automatically receive:

- member management
- ownership management
- sensitive payment configuration
- high-risk store configuration

---

# 29. Membership Lifecycle

Membership states:

```text
INVITED
ACTIVE
SUSPENDED
REMOVED
```

The complete lifecycle is defined in the domain state-machine specification.

---

# 30. Membership Invitation

A merchant may invite a user to a store.

The invitation should include:

- target identity/contact
- store
- proposed role
- invitation status
- expiration information where applicable

The invitation must not grant store access until accepted/activated according to the authentication model.

---

# 31. Membership Acceptance

When an invitation is accepted:

```text
INVITED → ACTIVE
```

The user receives the permissions associated with the assigned role.

The server must verify that the invitation is valid and belongs to the intended identity.

---

# 32. Membership Suspension

A membership may be suspended.

A suspended member:

- remains associated with the store
- retains historical membership information
- cannot perform normal store operations

Reactivation returns the membership to `ACTIVE`.

---

# 33. Membership Removal

Removal transitions:

```text
ACTIVE/SUSPENDED → REMOVED
```

A removed membership must not grant access.

Historical audit information should remain available where required.

---

# 34. Owner Protection

The system must prevent accidental removal of the final valid store owner.

An operation that would leave a store without an owner must fail.

This rule must be enforced server-side and preferably reinforced with database constraints or transactional checks where practical.

---

# 35. Ownership Transfer

If ownership transfer is implemented in Demo, it must be an explicit operation.

It must not occur as a side effect of:

- deleting a user
- changing a role through generic PATCH
- removing a membership

A transfer should:

1. Validate current owner authority.
2. Validate target membership.
3. Update ownership/role state atomically.
4. Preserve audit information.

---

# 36. Store Access Resolution

For a merchant request:

```text
Request
  ↓
Authenticate User
  ↓
Resolve Organization/Store
  ↓
Load Membership
  ↓
Validate Membership Status
  ↓
Resolve Role
  ↓
Authorize Operation
```

No store operation should rely solely on:

```text
storeId from request
```

without validating membership.

---

# 37. Tenant Isolation

Every store-owned resource accessed through the Stores domain must be associated with the correct store.

Example:

```text
User
 ↓
Store A Membership
 ↓
Product in Store A
```

must succeed.

```text
User
 ↓
Store A Membership
 ↓
Product in Store B
```

must fail.

---

# 38. Cross-Store Access

The following must be rejected:

```text
Store A user
    ↓
Store B product
```

```text
Store A admin
    ↓
Store B order
```

```text
Store A customer
    ↓
Store B checkout
```

Tenant isolation is a mandatory platform invariant.

---

# 39. Storefront Store Resolution

For public storefront requests, the store may be resolved through:

- store slug
- configured storefront domain
- trusted route context

The resolved Store must be validated before returning store-owned data.

The storefront must never accept an arbitrary store ID as sufficient authorization for private data.

---

# 40. Store Settings Update

A settings update should follow:

```text
Authenticate
  ↓
Resolve Store
  ↓
Authorize
  ↓
Validate Input
  ↓
Load Settings
  ↓
Apply Allowed Changes
  ↓
Persist
  ↓
Return Updated Settings
```

Settings updates should not allow arbitrary database fields.

---

# 41. Store Settings and Other Domains

Other modules may consume settings such as:

```text
currency
locale
timezone
store status
```

They should use a public Store configuration interface.

They must not directly modify Store settings.

---

# 42. Store Status and Commerce Operations

Other domains must respect Store lifecycle state.

Examples:

```text
Products
    → cannot publish to inactive store

Checkout
    → cannot complete for suspended store

Orders
    → cannot create new order for archived store
```

The Stores domain remains the owner of store lifecycle state.

---

# 43. Store Deletion

Physical deletion of stores should not be the default Demo operation.

Because stores may own:

- products
- customers
- orders
- payments
- inventory
- historical records

destructive deletion can create integrity and audit problems.

Archival is preferred.

---

# 44. Data Retention

Historical commerce records should remain available according to the platform's retention requirements.

Archiving a store must not automatically delete:

- orders
- payment records
- historical order items
- financial records
- required audit history

---

# 45. Store Events

The Stores domain may publish events such as:

```text
OrganizationCreated
StoreCreated
StoreActivated
StoreSuspended
StoreReactivated
StoreArchived
StoreMembershipInvited
StoreMembershipActivated
StoreMembershipSuspended
StoreMembershipRemoved
```

Events represent facts that have already occurred.

---

# 46. Store Event Consumers

Other modules may react to store events.

Examples:

```text
StoreCreated
    ↓
initialize supporting resources

StoreActivated
    ↓
enable storefront

StoreArchived
    ↓
disable commerce operations
```

Consumers must remain idempotent.

---

# 47. Store Creation Transaction

The following should occur atomically when required:

```text
Organization
OrganizationMembership
Store
StoreSettings
StoreMembership
```

If any required component fails:

```text
ROLLBACK
```

No partially initialized store should be considered active.

---

# 48. Store Update Concurrency

Concurrent settings updates must not silently overwrite unrelated changes.

Where appropriate:

- use transactional updates
- use optimistic versioning
- use row-level locking for critical changes

For example:

```text
Request A updates timezone
Request B updates currency
```

should not unintentionally erase one another's changes.

---

# 49. API Operations

Conceptual API operations include:

### Organization

```text
POST /organizations
GET /organizations/{organizationId}
PATCH /organizations/{organizationId}
```

### Stores

```text
POST /organizations/{organizationId}/stores
GET /stores/{storeId}
PATCH /stores/{storeId}
POST /stores/{storeId}/activate
POST /stores/{storeId}/suspend
POST /stores/{storeId}/archive
```

### Memberships

```text
GET /stores/{storeId}/members
POST /stores/{storeId}/members/invitations
POST /stores/{storeId}/members/{membershipId}/activate
POST /stores/{storeId}/members/{membershipId}/suspend
POST /stores/{storeId}/members/{membershipId}/remove
```

These are conceptual contracts. Exact routing is finalized during API implementation.

---

# 50. API Request Validation

Store APIs must validate:

### Store name

- required
- non-empty
- maximum length
- normalized where appropriate

### Slug

- required
- URL-safe
- normalized
- unique

### Currency

- valid supported currency code

### Locale

- valid supported locale

### Timezone

- valid IANA timezone

### Membership role

- one of supported roles

---

# 51. API Authorization Matrix

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| View store | Yes | Yes | Yes |
| Update basic settings | Yes | Yes | Limited |
| Activate store | Yes | Yes | No |
| Suspend store | Yes | Yes | No |
| Archive store | Yes | Limited/Policy | No |
| Invite member | Yes | Yes | No |
| Change member role | Yes | Yes | No |
| Remove member | Yes | Yes | No |
| Transfer ownership | Yes | No | No |

Exact role permissions should remain centralized rather than duplicated across routes.

---

# 52. Error Conditions

The Stores module should expose meaningful errors such as:

```text
ORGANIZATION_NOT_FOUND
STORE_NOT_FOUND
STORE_ALREADY_EXISTS
STORE_SLUG_ALREADY_EXISTS
INVALID_STORE_STATUS
STORE_SUSPENDED
STORE_ARCHIVED
MEMBERSHIP_NOT_FOUND
MEMBERSHIP_ALREADY_ACTIVE
MEMBERSHIP_SUSPENDED
MEMBERSHIP_REMOVED
INSUFFICIENT_STORE_PERMISSION
CANNOT_REMOVE_LAST_OWNER
INVALID_ROLE
INVALID_TIMEZONE
INVALID_CURRENCY
INVALID_LOCALE
```

---

# 53. Testing Requirements

## Organization Tests

- organization creation
- duplicate handling
- ownership creation
- unauthorized access

## Store Tests

- creation
- activation
- suspension
- reactivation
- archival
- invalid transitions
- duplicate slug
- invalid configuration

## Membership Tests

- invitation
- activation
- suspension
- removal
- role changes
- owner protection
- cross-store access

## Tenant Isolation Tests

Test:

```text
Store A user → Store A resource = allowed
Store A user → Store B resource = denied
```

This must be tested across all relevant access paths.

---

# 54. Integration Tests

Integration tests should verify:

- store creation transaction
- membership persistence
- role authorization
- store lifecycle
- settings updates
- database constraints
- cross-store isolation
- concurrent membership changes
- concurrent settings changes

---

# 55. End-to-End Store Flow

At minimum, an E2E test should verify:

```text
Create account
    ↓
Create organization
    ↓
Create store
    ↓
Configure store
    ↓
Activate store
    ↓
Access merchant dashboard
    ↓
Create product
```

The test confirms that the Stores domain integrates correctly with authentication and Products.

---

# 56. Security Requirements

The Stores module must:

- validate authenticated identity
- enforce membership authorization
- enforce role permissions
- prevent cross-tenant access
- protect invitation flows
- avoid exposing sensitive membership data
- validate all identifiers
- avoid trusting client-provided organization/store ownership
- log important administrative operations without logging secrets

---

# 57. Audit Requirements

Important store operations should be auditable.

Examples:

```text
StoreCreated
StoreActivated
StoreSuspended
StoreArchived
MembershipInvited
MembershipRoleChanged
MembershipSuspended
MembershipRemoved
OwnershipTransferred
```

Audit information should identify:

```text
actor
store
organization
operation
timestamp
result
relevant metadata
```

---

# 58. Background Processing

The Stores domain should use background processing only for secondary effects.

Examples:

```text
StoreCreated
    ↓
initialize asynchronous supporting resources
```

Critical store creation state must remain transactional.

---

# 59. Performance Requirements

Demo should prioritize correctness over premature optimization.

Normal store operations should use:

- indexed organization/store lookups
- indexed membership lookups
- bounded list queries
- efficient authorization checks

Store management does not justify a dedicated service or cache in Demo.

---

# 60. Demo Implementation Boundary

The Demo implementation should use:

```text
modules/stores
packages/auth
packages/tenant
packages/db
packages/validation
```

The Stores module owns its business logic.

The web application owns HTTP routing.

The database package owns persistence infrastructure.

The tenant package provides normalized tenant context.

---

# 61. Module Boundary Example

Correct:

```text
apps/web
   ↓
stores application service
   ↓
stores domain
   ↓
stores repository
   ↓
PostgreSQL
```

Incorrect:

```text
apps/web
   ↓
UPDATE stores SET ...
```

Also incorrect:

```text
products module
   ↓
directly mutate stores tables
```

---

# 62. Domain Events and Jobs

Events should represent facts:

```text
StoreCreated
StoreActivated
StoreArchived
```

Jobs represent work:

```text
InitializeStoreResources
SendStoreWelcomeNotification
```

The distinction must remain explicit.

---

# 63. Demo-to-V1 Evolution

The Stores domain should remain stable if V1 later introduces:

- multiple storefronts per store
- custom domains
- advanced organization hierarchy
- enterprise memberships
- SSO
- organization-level billing
- advanced permissions

Those capabilities should extend the domain rather than force unrelated commerce modules to change.

---

# 64. Acceptance Criteria

The Stores module is complete for Demo when:

- An organization can be created.
- An owner is established.
- A store can be created.
- Store settings can be configured.
- Store slugs are unique.
- Store currency is validated.
- Store locale is validated.
- Store timezone is validated.
- Store lifecycle transitions are enforced.
- Store memberships can be managed.
- Roles are enforced server-side.
- The final owner cannot accidentally be removed.
- Suspended stores cannot perform prohibited commerce operations.
- Archived stores cannot accept new commerce operations.
- Cross-store access is rejected.
- Important store actions are auditable.
- Critical creation operations are transactional.
- API errors are consistent.
- Integration and E2E tests cover the primary workflows.