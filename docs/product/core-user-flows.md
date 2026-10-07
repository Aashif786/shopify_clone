# Core User Flows

## 1. Purpose

This document defines the core user journeys that the Demo must support.

These flows describe **what users do and what the platform must accomplish**, not how the functionality is implemented. Technical implementation details belong in architecture, domain, API, database, and feature specification documents.

The Demo must support a coherent commerce lifecycle from store creation through order management.

---

## 2. Primary Commerce Lifecycle

The fundamental platform flow is:

```text
Merchant Creates Store
        ↓
Merchant Configures Store
        ↓
Merchant Creates Products
        ↓
Merchant Manages Inventory
        ↓
Merchant Publishes Products
        ↓
Customer Visits Storefront
        ↓
Customer Browses Products
        ↓
Customer Adds Products to Cart
        ↓
Customer Proceeds to Checkout
        ↓
Customer Enters Required Information
        ↓
Customer Completes Payment
        ↓
Order Is Created
        ↓
Merchant Manages Order
        ↓
Customer Receives Order Status
```

Every stage must maintain consistent state and must not create invalid business states.

---

# 3. Merchant Onboarding Flow

## 3.1 Goal

Allow a new merchant to establish a usable store.

## 3.2 Flow

```text
Merchant Registers
        ↓
Merchant Authenticates
        ↓
Merchant Creates Organization/Store
        ↓
Store Configuration
        ↓
Store Becomes Operational
```

## 3.3 Required Outcomes

The merchant must be able to:

- Create a store.
- Provide basic store information.
- Configure essential storefront settings.
- Access the merchant dashboard.
- Begin managing products and inventory.

The created store must belong to the correct organization and must not be accessible to unauthorized users.

---

# 4. Store Configuration Flow

## 4.1 Goal

Allow the merchant to configure the basic identity and behavior of the store.

## 4.2 Flow

```text
Merchant Opens Store Settings
        ↓
Updates Store Information
        ↓
Configures Basic Store Settings
        ↓
Saves Changes
        ↓
Updated Configuration Becomes Active
```

## 4.3 Required Outcomes

The platform must:

- Validate submitted configuration.
- Persist valid changes.
- Reject invalid input.
- Ensure configuration belongs to the correct store.
- Reflect saved configuration consistently across merchant and storefront experiences.

---

# 5. Product Management Flow

## 5.1 Goal

Allow merchants to create and manage products that can be sold through the storefront.

## 5.2 Create Product

```text
Merchant Opens Products
        ↓
Creates Product
        ↓
Enters Product Information
        ↓
Sets Pricing
        ↓
Configures Product Status
        ↓
Saves Product
```

## 5.3 Product Management

Merchants must be able to:

- Create products.
- View products.
- Update products.
- Manage product information.
- Manage pricing.
- Control product availability/publication status.
- Associate inventory with products.

Product information displayed to customers must represent the current valid product state.

---

# 6. Inventory Management Flow

## 6.1 Goal

Allow merchants to control product availability and maintain accurate stock levels.

## 6.2 Flow

```text
Merchant Selects Product
        ↓
Views Inventory
        ↓
Adjusts Stock
        ↓
System Validates Change
        ↓
Inventory Is Updated
        ↓
Storefront Reflects Availability
```

## 6.3 Required Outcomes

Inventory operations must:

- Maintain valid stock quantities.
- Prevent invalid inventory states.
- Correctly reflect available stock.
- Support safe concurrent changes.
- Integrate with checkout and order processing.

Inventory must not be treated as merely informational data. It is part of the transaction-critical commerce flow.

---

# 7. Product Publication Flow

## 7.1 Goal

Allow merchants to control when products become available to customers.

## 7.2 Flow

```text
Product Exists
        ↓
Merchant Configures Product
        ↓
Product Meets Publication Requirements
        ↓
Merchant Publishes Product
        ↓
Product Becomes Visible on Storefront
```

A product that is not published must not be unintentionally exposed through the customer storefront.

The storefront must only expose products that satisfy the platform's publication and availability rules.

---

# 8. Customer Storefront Flow

## 8.1 Goal

Allow customers to discover products and begin purchasing.

## 8.2 Flow

```text
Customer Opens Storefront
        ↓
Views Published Products
        ↓
Selects Product
        ↓
Views Product Details
        ↓
Chooses Available Quantity
        ↓
Adds Product to Cart
```

## 8.3 Required Outcomes

The customer must be able to:

- Browse available products.
- View product details.
- See current pricing.
- See relevant availability information.
- Add eligible products to a cart.
- Update or remove cart items.

The storefront must not expose merchant-only information or data belonging to other customers.

---

# 9. Cart Flow

## 9.1 Goal

Maintain the customer's intended purchase before checkout.

## 9.2 Flow

```text
Customer Adds Product
        ↓
Cart Is Created or Updated
        ↓
Cart Contains Product + Quantity
        ↓
Customer Updates Cart
        ↓
Cart Totals Are Recalculated
        ↓
Customer Proceeds to Checkout
```

## 9.3 Required Behaviors

The cart must:

- Associate items with the correct store.
- Maintain product quantities.
- Prevent invalid quantities.
- Calculate applicable totals correctly.
- Reflect applicable discounts when supported.
- Handle products that become unavailable or change state before checkout.

A cart is not an order. Creating a cart must not create an order or permanently reserve inventory unless explicitly defined by the checkout domain.

---

# 10. Checkout Flow

## 10.1 Goal

Convert a valid cart into a successful purchase.

## 10.2 Flow

```text
Customer Starts Checkout
        ↓
System Validates Cart
        ↓
Customer Provides Required Information
        ↓
System Revalidates Pricing & Availability
        ↓
Customer Selects Payment Method
        ↓
Payment Is Initiated
        ↓
Payment Result Is Confirmed
        ↓
Order Is Created
        ↓
Inventory Is Updated
        ↓
Checkout Completes
```

## 10.3 Required Outcomes

Checkout must ensure that:

- The cart belongs to the correct store/context.
- Products remain eligible for purchase.
- Prices are valid.
- Discounts are valid.
- Inventory is available.
- Required customer information is valid.
- Payment status is correctly handled.
- An order is created only when the required purchase conditions are satisfied.

Checkout operations must be safe against retries and duplicate requests.

---

# 11. Payment Flow

## 11.1 Goal

Process customer payment without creating inconsistent order or payment states.

## 11.2 Flow

```text
Checkout Requests Payment
        ↓
Payment Attempt Created
        ↓
Payment Provider Processes Request
        ↓
Payment Result Returned/Webhook Received
        ↓
Payment State Updated
        ↓
Checkout Continues or Fails
```

## 11.3 Required Behaviors

The system must:

- Track payment attempts.
- Handle successful payments.
- Handle failed payments.
- Handle provider callbacks/webhooks.
- Prevent duplicate processing.
- Maintain a consistent relationship between payment and order state.

The Demo may use a sandbox/test payment provider, but payment state handling must model real payment behavior rather than assuming every payment succeeds immediately.

---

# 12. Order Creation Flow

## 12.1 Goal

Create a durable record representing a completed purchase.

## 12.2 Flow

```text
Valid Checkout
        ↓
Payment Confirmed
        ↓
Order Created
        ↓
Order Items Recorded
        ↓
Totals Recorded
        ↓
Inventory Updated
        ↓
Customer Can View Order
        ↓
Merchant Can Manage Order
```

## 12.3 Required Outcomes

An order must preserve the relevant purchase information at the time of purchase, including:

- Customer association.
- Store association.
- Purchased products.
- Quantities.
- Applicable prices.
- Discounts where applicable.
- Order totals.
- Payment state.
- Order state.

Historical order information must remain reliable even if the underlying product later changes.

---

# 13. Merchant Order Management Flow

## 13.1 Goal

Allow merchants to operate orders after purchase.

## 13.2 Flow

```text
Merchant Opens Orders
        ↓
Views Order
        ↓
Reviews Customer & Order Information
        ↓
Updates Supported Order State
        ↓
System Persists State Change
        ↓
Customer Sees Updated Status
```

The merchant must only be able to access orders belonging to stores they are authorized to manage.

---

# 14. Customer Order Flow

## 14.1 Goal

Allow customers to understand the status of their purchases.

## 14.2 Flow

```text
Customer Completes Purchase
        ↓
Order Becomes Available
        ↓
Customer Views Order
        ↓
Customer Views Order Status
        ↓
Customer Receives Relevant Updates
```

Customers must only be able to access their own orders.

---

# 15. Discount Flow

## 15.1 Goal

Allow merchants to create limited promotional discounts and customers to apply eligible discounts during checkout.

## 15.2 Merchant Flow

```text
Merchant Creates Discount
        ↓
Defines Discount Rules
        ↓
Discount Becomes Active
        ↓
Customer Can Use Discount
```

## 15.3 Customer Flow

```text
Customer Enters Discount Code
        ↓
System Validates Discount
        ↓
Eligibility Checked
        ↓
Discount Applied
        ↓
Checkout Total Recalculated
```

Invalid, expired, ineligible, or otherwise unusable discounts must not reduce the order total.

---

# 16. Authentication and Authorization Flow

## 16.1 Merchant

```text
User Authenticates
        ↓
Identity Established
        ↓
Organization/Store Context Resolved
        ↓
Membership & Role Checked
        ↓
Authorized Resources Become Accessible
```

## 16.2 Customer

```text
Customer Authenticates or Continues Through Supported Guest Flow
        ↓
Customer Context Established
        ↓
Customer Access Is Restricted to Permitted Resources
```

Authentication establishes identity. Authorization determines what that identity is allowed to do.

The client must never be trusted to enforce access control.

---

# 17. Multi-Tenant Access Flow

Every protected operation must follow the tenant context.

```text
Request
  ↓
Identify User/System Actor
  ↓
Resolve Organization/Store Context
  ↓
Verify Membership or Ownership
  ↓
Verify Required Permission
  ↓
Access Store-Owned Resource
  ↓
Execute Operation
```

A user operating within Store A must not be able to access Store B resources unless explicitly authorized.

This applies to:

- Web requests.
- APIs.
- Background jobs.
- Webhooks.
- Internal application services.
- Administrative operations.

---

# 18. Background Processing Flow

Some operations may execute asynchronously.

```text
Application Operation
        ↓
Transaction Completes
        ↓
Background Job/Event Is Created
        ↓
Worker Processes Job
        ↓
Job Succeeds or Retries
        ↓
Final Result Is Recorded
```

Background processing must not bypass tenant isolation, authorization boundaries, or business invariants.

Jobs must be safe to retry where the operation can be retried.

---

# 19. Failure and Retry Flow

Commerce operations must assume that requests can fail, be repeated, or arrive more than once. Humanity has somehow built distributed systems and then acted surprised by this.

For critical operations:

```text
Request
  ↓
Operation Begins
  ↓
Failure / Timeout / Duplicate Request
  ↓
Safe Retry
  ↓
Existing State Detected or Operation Re-executed Safely
  ↓
Consistent Final State
```

The system must avoid:

- Duplicate orders.
- Duplicate payment processing.
- Incorrect inventory deductions.
- Duplicate webhook effects.
- Partial state transitions.

Exact idempotency and concurrency mechanisms are defined in the relevant technical and domain documentation.

---

# 20. Core State Transition Principle

The platform must treat important commerce entities as stateful business objects.

Examples include:

```text
Product
Draft → Published → Unpublished
```

```text
Payment
Pending → Succeeded
Pending → Failed
```

```text
Order
Created → Processing → Fulfilled
Created → Cancelled
```

Exact states and transitions must be defined by their respective domain specifications.

Invalid state transitions must be rejected rather than silently accepted.

---

# 21. Cross-Flow Consistency

The following relationships must remain consistent:

| Area | Required Relationship |
|---|---|
| Store | Owns its products, customers, orders, and other store resources |
| Product | Belongs to a store |
| Inventory | Belongs to the appropriate store/product context |
| Cart | Belongs to the appropriate store/customer context |
| Checkout | Operates on a valid cart |
| Payment | Belongs to a checkout/payment context |
| Order | Belongs to a store and customer |
| Order Items | Preserve the purchased product information |
| Discount | Applies only when eligibility rules are satisfied |
| Membership | Controls merchant access to store resources |

---

# 22. Demo Critical Path

The following path is the minimum end-to-end success path for the Demo:

```text
Merchant Registration
        ↓
Create Store
        ↓
Create Product
        ↓
Set Inventory
        ↓
Publish Product
        ↓
Customer Opens Storefront
        ↓
Add Product to Cart
        ↓
Checkout
        ↓
Test Payment
        ↓
Order Creation
        ↓
Inventory Update
        ↓
Merchant Views Order
        ↓
Customer Views Order
```

A Demo release should not be considered functionally complete if this lifecycle cannot be executed successfully from beginning to end.

---

# 23. Flow Design Principles

All core flows must follow these principles:

1. **Correctness first**  
   Business state must remain valid even when requests fail or are repeated.

2. **Explicit state transitions**  
   Important entities must not move between states implicitly or arbitrarily.

3. **Tenant isolation**  
   Every store's business data must remain isolated.

4. **Authorization at the server**  
   UI visibility is not authorization.

5. **Transactional integrity**  
   Related critical changes must be performed atomically where required.

6. **Retry safety**  
   Critical operations must tolerate duplicate requests and retries.

7. **Consistent user experience**  
   Merchant and customer interfaces must reflect the same underlying business state.

8. **Historical correctness**  
   Completed orders must preserve the information required to understand the original transaction.

9. **Progressive complexity**  
   The Demo supports the essential flows without implementing enterprise-scale complexity prematurely.

---

# 24. Definition of Complete Core Flow

A core flow is considered complete when:

- The expected user journey can be executed end-to-end.
- Valid input produces the expected business result.
- Invalid input is rejected appropriately.
- Authorization is enforced.
- Tenant isolation is preserved.
- Critical state transitions are valid.
- Failures do not leave unacceptable partial state.
- Relevant operations are retry-safe.
- The resulting state is visible consistently to the appropriate users.
- Automated tests cover the important success and failure paths.