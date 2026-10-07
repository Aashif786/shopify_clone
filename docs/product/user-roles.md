# User Roles

## 1. Purpose

This document defines the users, roles, responsibilities, and access boundaries for the Demo.

It describes **what users are allowed to do**, not how those permissions are implemented.

Authentication and authorization implementation details are defined separately in the architecture and security documentation.

---

## 2. User Model

The platform distinguishes between:

```text id="2j5x8r"
Platform
   │
   └── Organization
          │
          └── Store
                 │
                 ├── Owner
                 ├── Admin
                 └── Staff
```

Customers are separate from merchant staff:

```text id="5c9m8f"
Store
  │
  ├── Merchant users
  │
  └── Customers
```

A merchant user operates a store.

A customer purchases products from a store.

---

## 3. Merchant Roles

The Demo defines three merchant roles:

| Role | Purpose |
|---|---|
| Owner | Full control of the store |
| Admin | Operational management |
| Staff | Limited day-to-day operations |

The role model should remain extensible for future V1 permissions.

---

# 4. Owner

The Owner has full control over the store.

### Store

The Owner can:

- view store settings
- update store settings
- manage store configuration
- manage store status

### Products

The Owner can:

- create products
- edit products
- publish products
- unpublish products
- archive products
- manage variants
- manage product media
- manage pricing

### Inventory

The Owner can:

- view inventory
- adjust inventory
- manage inventory availability
- manage inventory locations where supported

### Customers

The Owner can:

- view customers
- view customer information
- view customer order history

### Orders

The Owner can:

- view orders
- view order details
- update supported order states
- cancel orders where permitted
- manage fulfillment-related information supported by the Demo

### Discounts

The Owner can:

- create discounts
- edit discounts
- activate/deactivate discounts
- view discount usage

### Payments

The Owner can:

- view payment status
- view payment information associated with their store's orders
- view supported refund information

The Owner cannot directly manipulate payment-provider state outside supported platform workflows.

### Users

The Owner can:

- invite merchant users
- remove merchant users
- assign supported merchant roles
- modify merchant access

The Owner must not be able to access another organization's or store's data unless explicitly authorized through the platform's future administrative model.

---

# 5. Admin

The Admin manages day-to-day store operations.

### Admin can:

- manage products
- manage product variants
- manage product media
- manage inventory
- view customers
- view orders
- perform supported order operations
- manage supported discounts
- view payment status
- manage supported storefront configuration

### Admin cannot:

- transfer store ownership
- delete the organization
- perform platform-level administration
- manage permissions beyond the capabilities explicitly granted by the platform

The exact administrative permission boundaries may be expanded during V1.

---

# 6. Staff

Staff is intended for operational users who require limited access.

### Staff can:

- view products
- view inventory
- perform permitted inventory operations
- view customers
- view orders
- perform supported operational order actions

### Staff cannot:

- manage store ownership
- manage merchant users
- change security-sensitive settings
- perform platform administration
- access data belonging to another store
- perform actions outside their assigned permissions

The Demo should avoid creating excessive granular permissions unless an actual product requirement requires them.

---

# 7. Customer

Customers are not merchant users.

A customer can interact with a storefront and purchase products.

### Customer capabilities

Customers can:

- browse published products
- view product information
- select variants
- add products to a cart
- modify cart quantities
- remove cart items
- provide checkout information
- apply eligible discounts
- complete payment
- view their order information
- receive order-related notifications

Customers cannot:

- access merchant administration
- manage products
- modify inventory
- view other customers
- view merchant-only information
- access another customer's order information

---

# 8. Platform Administrator

A platform-level administrator is **not part of the normal Demo merchant workflow**.

The architecture should leave room for a future platform administration role, but the Demo does not require a complete platform administration interface.

If platform administration is required for internal operations, it must be explicitly separated from merchant permissions.

Platform-level privileges must never be granted through ordinary store roles.

---

# 9. Role Scope

Merchant roles are scoped to the store or organization in which the user has membership.

A user's access to one store must not automatically grant access to another store.

Example:

```text id="c4pxg4"
User A
 ├── Store A → Owner
 └── Store B → Staff
```

The system must evaluate the user's role within the relevant store context.

There must be no assumption that:

```text
User = Owner of every store they can access
```

---

# 10. Access Principles

Authorization follows these principles:

### Least Privilege

Users receive only the access required for their role.

### Server-Side Enforcement

Permissions are enforced on the server.

### Store Isolation

Users can only access stores for which they have valid authorization.

### Resource Ownership

Access to a resource must also consider whether the resource belongs to the authorized store.

### Explicit Permissions

Sensitive actions must require explicit authorization.

### No Client Trust

Client-provided role, permission, tenant, or store information must never be treated as authoritative.

---

# 11. Role Changes

Changing a user's merchant role affects their access immediately or according to the platform's defined session invalidation behavior.

Role changes must not modify historical ownership or transaction records.

For example, changing:

```text id="l5kqjp"
User A
Owner → Staff
```

must not alter:

- existing orders
- existing products
- inventory history
- payment records
- customer records

Role changes affect authorization, not historical business data.

---

# 12. Ownership

Every store must have an identifiable owner.

Ownership is distinct from ordinary administrative access.

The Owner role represents the highest normal merchant authority.

Ownership transfer is outside the Demo's required functionality unless explicitly added to the product scope.

---

# 13. Customer and Merchant Separation

Merchant users and customers represent different product concepts.

Do not assume that:

```text id="9p2v8k"
Merchant User = Customer
```

A merchant user may potentially purchase from a storefront, but this does not grant merchant privileges to the customer identity and vice versa.

The underlying identity architecture may support future account relationships without merging their authorization models.

---

# 14. Demo Permission Model

The Demo intentionally uses a small number of roles.

```text id="3y2f5x"
OWNER
  │
  ├── Full Store Management
  │
  ▼
ADMIN
  │
  ├── Operational Store Management
  │
  ▼
STAFF
  │
  └── Limited Operations
```

This is sufficient for the Demo.

Future V1 may introduce more granular permissions without changing the fundamental principle that access is evaluated within the correct organization/store context.

---

# 15. Authorization Requirement

Every protected operation must answer:

1. Who is making the request?
2. Which organization/store is being accessed?
3. Is the user a member of that organization/store?
4. What role or permission does the user have?
5. Does that role permit the requested action?
6. Does the requested resource belong to the authorized scope?

If any required authorization condition fails, the operation must be rejected.