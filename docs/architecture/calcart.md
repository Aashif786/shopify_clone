# CALCART Enterprise Knowledge Base & System Architecture Reference

> **Target Use:** High-Accuracy Retrieval-Augmented Generation (RAG) Document
> **Platform:** Cal Cart (Multi-Tenant Modular Commerce Engine)
> **Version:** 2.0 (Production Release)
> **Classification:** Full System Architecture, Domain Models, Workflows, APIs, and State Specifications

---

## Executive Summary & System Overview

**Cal Cart** is an enterprise-grade, multi-tenant modular commerce platform designed for modern digital retail. It bridges merchant self-service store administration with high-conversion, consumer-facing storefronts. Built as a clean modular monolith, Cal Cart orchestrates the entire digital commerce lifecycle—including store provisioning, multi-channel product catalog management with option-level variant publishing, concurrency-safe inventory allocation, promotional discount rules, dynamic zone- and weight-tiered shipping, statutory Indian GST compliance with legal invoice sequencing, cryptographic payment processing via Razorpay, double-entry stored-value ledgers (gift cards and store credit), reverse logistics (returns, inspections, and restocking), and asynchronous worker automation.

### Technology Stack

| Layer | Technologies / Frameworks |
| --- | --- |
| **Frontend & Storefront** | Next.js 15 (React 19, TypeScript, App Router, Tailwind CSS v4, Framer Motion, Radix UI Primitives, Lucide Icons, Atelier Design System) |
| **Backend & Domain Services** | Node.js 22+ / TypeScript Modular Monolith (`apps/web` API Route Handlers, 14 Domain Modules in `modules/`) |
| **Database & Persistence** | PostgreSQL 16+ (Strict Multi-Tenant Scoping, Composite Foreign Keys, Advisory Locks, 47 SQL Migrations, UUIDv7 Primary Keys) |
| **Data Access & Pooling** | Native `pg` Connection Pool with Transaction Wrappers (`runInTransaction`, `withExclusiveConnection`, Savepoints) |
| **Payments & Gateway** | Official Razorpay Server SDK, Client Checkout Integration, HMAC-SHA256 Cryptographic Signature Verification, Idempotent Webhook Engine |
| **Tax & Invoicing Engine** | Indian Statutory GST Engine (CGST, SGST, IGST), 4/6/8-digit HSN Resolution, FY-Sequenced Invoices (`INV-YYYY-XXXX`) |
| **Stored-Value Ledger** | Double-Entry Append-Only Financial Ledgers (`gift_card_ledger`, `store_credit_ledger`) |
| **Worker & Background Jobs** | Node.js Daemon (`apps/worker`), In-Process Domain Event Bus (`@calcart/event-bus`), Cyclic Payment & Cart Recovery Schedulers |
| **Security & Rate Limiting** | Dual-Factor Sliding Window Rate Limiter (IP + Account / Token), Strict CSP & Security Headers, PII Redaction, Fail-Closed Gateway Handling |

### User Roles & Access Control Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Cal Cart Role Hierarchy                                   │
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ Platform Admin     │ Organization Owner │ Store Admin        │ Storefront Customer     │
│ (Super Admin)      │ (Tenant Owner)     │ / Staff Member     │ / Guest Shopper         │
└────────────────────┴────────────────────┴────────────────────┴─────────────────────────┘
```

* **Platform Super Admin (`users.is_platform_admin`):** Cross-tenant governance, provisioning and suspending organizations and stores, monitoring global health metrics, reviewing system-wide audit logs, and configuring platform defaults. Platform admin checks enforce separate server-side assertions and never weaken tenant isolation.
* **Organization Owner (`owner`):** Complete authority over an organization and all its child stores—including billing, high-level analytics, inviting organization members, creating new stores, and setting organizational policies.
* **Store Admin / Staff Member (`admin` / `member`):** Scoped access to specific stores within an organization. Admins configure store settings, custom domains, shipping zones, tax parameters, and staff roles; members execute daily operations such as product catalog updates, inventory adjustments, order fulfillment, return approvals, and customer support.
* **Storefront Customer (`customer` / Guest Shopper):** Public storefront shoppers. Registered customers authenticate via isolated customer sessions, maintain address books, track order history, submit return requests, and hold store credit balances. Guest shoppers interact via cryptographically hashed guest tokens (`guestTokenHash`) and can seamlessly merge carts upon authentication.

---

## 1. Modules

Cal Cart is organized into 16 core functional modules, packages, and application engines:

### Module 1: Stores & Multi-Tenant Domain Engine

* **Endpoints:** `/api/v1/stores`, `/api/v1/stores/[storeId]`, `/api/v1/stores/[storeId]/domains`, `/api/v1/stores/[storeId]/members`, `/api/v1/stores/[storeId]/landing-page`
* **Services:** `StoreService`, `StoreDomainService`, `StoreMemberService`, `LandingPageService`
* **Functionalities:**
  * Creates, updates, archives, and configures stores scoped to parent organizations.
  * Governs multi-currency configurations (e.g., `USD`, `INR`, `EUR`, `GBP`), locale (`en-US`), timezone (`America/New_York`), and store statuses (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
  * Enforces multi-tenant routing via subdomain extraction (`[storeSlug].calcart.com`) or custom domains.
  * Implements two-phase custom domain verification: generates CNAME and TXT DNS challenge records, validates ownership via active DNS lookups, tracks verification status (`PENDING_DNS`, `VERIFIED`, `FAILED`), and provisions SSL certificates.
  * Manages store-level role-based access control (`OWNER`, `ADMIN`, `MEMBER`), preventing cross-store permission leakage.
  * Houses the visual landing page configuration engine (Hero banners, Announcement bars, Bento grids, Featured collections, Testimonials, Theme tokens) rendered natively by the storefront.

---

### Module 2: Customer Identity & Account Service

* **Endpoints:** `/api/v1/stores/[storeId]/customers`, `/api/v1/stores/[storeId]/customers/me`, `/api/v1/stores/[storeId]/customers/addresses`, `/api/v1/auth/customer/*`
* **Services:** `CustomerService`, `CustomerAddressService`, `GuestCustomerService`
* **Functionalities:**
  * Governs customer identity completely isolated per store tenant; an account registered in Store A cannot authenticate or access data in Store B.
  * Implements secure customer authentication: password hashing via Argon2/bcrypt, secure HTTP-only session cookies, and session invalidation.
  * Manages customer address books (shipping and billing) with ISO country code validation, postal code formatting, and default address designations.
  * Supports guest shopper identity tracking using SHA-256 hashed guest tokens (`guestTokenHash`) stored on checkouts and orders, enabling guest checkout without account creation.
  * Maintains aggregate customer analytics: total spend, order count, average order value, and date of last purchase.

---

### Module 3: Product Catalog, Variant Merchandising & Option-Level Publishing

* **Endpoints:** `/api/v1/stores/[storeId]/products`, `/api/v1/stores/[storeId]/products/[productId]`, `/api/v1/stores/[storeId]/products/[productId]/variants`, `/api/v1/stores/[storeId]/collections`, `/api/v1/products/search`
* **Services:** `ProductService`, `VariantService`, `OptionLevelStandaloneService`, `CollectionService`, `ProductSearchService`, `CsvProductService`
* **Functionalities:**
  * Manages catalog hierarchy: base products, options (e.g., Size, Color, Material), option values, and SKUs.
  * Supports single and multi-variant combinations, generating Cartesian product variant matrixes with SKU, price, compare-at price, and barcode overrides.
  * **Option-Level Standalone Publishing:** Allows merchants to publish specific variant options (such as distinct colorways) as independent, clickable items on storefront product grids while maintaining centralized inventory linkage.
  * Manages manual and automated product collections, assigning display sorting rules and promotional banners.
  * Implements high-performance faceted product discovery: full-text search across titles, descriptions, and tags; filtering by price range, collection, option values, and inventory availability; and sorting (Price Low/High, Newest, Title).
  * Executes bulk CSV product import and export with strict pre-validation, atomic rollbacks on syntax errors, and duplicate SKU detection.

---

### Module 4: Concurrency-Safe Inventory & Stock Reservation

* **Endpoints:** `/api/v1/stores/[storeId]/inventory/levels`, `/api/v1/stores/[storeId]/inventory/adjust`, `/api/v1/stores/[storeId]/inventory/reservations`
* **Services:** `InventoryService`, `StockReservationService`, `PurchaseLimitService`, `InventoryExpirationService`
* **Functionalities:**
  * Tracks physical and digital stock across multiple warehouse locations, maintaining explicit balances: Available, Reserved, and Committed.
  * **Pessimistic Concurrency Locking:** Executes stock reservations during checkout initialization using PostgreSQL `SELECT ... FOR UPDATE` row locks, eliminating overselling race conditions during high-volume sales.
  * Implements temporary stock reservations (`inventory_reservations`) with configurable TTL (default: 15–30 minutes) tied to active checkouts.
  * Enforces maximum purchase limits per order and per customer to combat inventory hoarding and scalping bots.
  * Executes atomic stock commitments upon payment capture and releases holds upon checkout cancellation or expiration.

---

### Module 5: Promotion & Dynamic Discount Engine

* **Endpoints:** `/api/v1/stores/[storeId]/discounts`, `/api/v1/stores/[storeId]/discounts/validate`, `/api/v1/stores/[storeId]/discounts/[discountId]`
* **Services:** `DiscountService`, `DiscountRuleEngine`, `DiscountAllocationService`, `DiscountRedemptionService`
* **Functionalities:**
  * Manages voucher codes and automated promotions: `PERCENTAGE` off, `FIXED_AMOUNT` off, and `FREE_SHIPPING`.
  * Enforces qualification rules: minimum basket subtotal, minimum line quantity, customer-specific eligibility, and date validity windows.
  * Enforces global usage caps and one-use-per-customer restrictions tracked via hashed customer identities.
  * **Pro-Rata Line Item Allocation:** Distributes order-level discounts proportionally across basket line items based on their gross value weight, ensuring accurate itemized refund calculations during returns.
  * Idempotently logs discount redemptions upon order placement (`discount_redemptions`), preventing double-dipping.

---

### Module 6: Shopping Cart Persistence & Session Migration

* **Endpoints:** `/api/v1/stores/[storeId]/carts`, `/api/v1/stores/[storeId]/carts/[cartId]`, `/api/v1/stores/[storeId]/carts/[cartId]/items`
* **Services:** `CartService`, `CartMergeService`, `CartLifecycleService`
* **Functionalities:**
  * Persists shopping carts for both anonymous guests (via secure cookies) and authenticated customers.
  * Manages cart items, real-time variant price snapshots, quantity adjustments, and promotional item flags.
  * **Cart Merging Engine:** Seamlessly transfers guest cart contents into a customer's persistent cart upon login, resolving SKU duplicates by summing quantities while checking stock limits.
  * Enforces lifecycle status tracking: `ACTIVE`, `ABANDONED`, `EXPIRED`, and `MERGED`.
  * Integrates with storefront UI via non-intrusive toast notifications, eliminating layout shifts in the cart drawer.

---

### Module 7: Multi-Step Checkout & Address Management

* **Endpoints:** `/api/v1/stores/[storeId]/checkouts`, `/api/v1/stores/[storeId]/checkouts/[checkoutId]`, `/api/v1/stores/[storeId]/checkouts/[checkoutId]/shipping-address`, `/api/v1/stores/[storeId]/checkouts/[checkoutId]/shipping-rate`, `/api/v1/stores/[storeId]/checkouts/[checkoutId]/complete`
* **Services:** `CheckoutService`, `CheckoutPricingEngine`, `CheckoutValidationService`
* **Functionalities:**
  * Manages checkout state transitions via an explicit FSM: `OPEN` -> `PAYMENT_PENDING` -> `COMPLETED`, `CANCELLED`, `EXPIRED`, or `FAILED`.
  * Transforms active cart items into immutable checkout items, triggering temporary stock reservation holds.
  * Captures and validates customer email, shipping address, and billing address.
  * Invokes the Shipping Engine to generate live rate quotes and freezes the chosen rate.
  * Invokes the Tax Engine to compute Indian GST / local taxes and persists an immutable tax snapshot.
  * Coordinates stored-value deductions (gift cards, store credit) and computes the net payable gateway total.
  * Enforces strict expiration timers (e.g., 30 minutes), automatically releasing expired checkout holds.

---

### Module 8: Multi-Tier Shipping Rate Engine & Carrier Routing (GAP-12 / M6a)

* **Endpoints:** `/api/v1/stores/[storeId]/shipping/zones`, `/api/v1/stores/[storeId]/shipping/rates`, `/api/v1/stores/[storeId]/shipping/calculate`
* **Services:** `ShippingService`, `ShippingCalculationEngine`, `CarrierProvider`, `ShippingTaxCoordinator`
* **Functionalities:**
  * Configures geographical shipping zones based on ISO country codes, state/province divisions, and postal code wildcards/ranges.
  * Supports multiple rate calculation models: Flat Rate, Weight-Tiered, Subtotal/Value-Tiered, and Conditional Free Shipping thresholds.
  * Automatically calculates total parcel weight by aggregating product variant unit weights (grams/kilograms).
  * Exposes an extensible carrier provider architecture, including a built-in `ManualCarrierProvider` and live carrier rate connectors.
  * Freezes shipping quotes upon selection on the checkout, re-calculating only if the shipping address or basket contents change.
  * Coordinates with the Tax Engine to treat shipping fees as taxable supply, applying GST at the highest rate among basket goods.

---

### Module 9: Indian Statutory GST Tax & Automated Invoice Engine (GAP-11)

* **Endpoints:** `/api/v1/stores/[storeId]/tax/settings`, `/api/v1/stores/[storeId]/tax/calculate`, `/api/v1/stores/[storeId]/tax/invoices/[orderId]`
* **Services:** `TaxService`, `GstEngine`, `TaxSnapshotService`, `InvoiceGenerationService`
* **Functionalities:**
  * Governs statutory tax settings: 15-character GSTIN validation (with format and checksum verification), legal business entity name, and origin state derivation.
  * Supports Tax-Inclusive and Tax-Exclusive catalog pricing models.
  * Resolves 4, 6, and 8-digit Harmonized System of Nomenclature (HSN) codes mapped to standard GST slabs (0%, 5%, 12%, 18%, 28%).
  * **Automated GST Splitting:** Automatically compares merchant origin state with customer shipping state to levy intra-state tax (split equally into 50% CGST + 50% SGST) or inter-state tax (100% IGST), with export/zero-rated transaction handling.
  * **Checkout Tax Snapshots:** Freezes an immutable tax snapshot on the checkout (`checkout_tax_snapshots`) prior to payment initialization, guaranteeing tax amounts cannot shift during payment.
  * **Sequential Legal Invoicing:** Automatically issues legally compliant tax invoices numbered sequentially per independent financial year (`INV-YYYY-XXXX`), storing immutable invoice line items and GST breakdowns in `tax_invoices`.

---

### Module 10: Payment Intent Orchestration & Razorpay Gateway Integration

* **Endpoints:** `/api/v1/stores/[storeId]/payments/initiate`, `/api/v1/stores/[storeId]/payments/verify`, `/api/v1/webhooks/payments/razorpay`, `/api/v1/stores/[storeId]/refunds`
* **Services:** `ProviderPaymentService`, `PaymentWebhookService`, `PaymentOrderIntegration`, `PaymentRecoveryService`, `MerchantRefundService`
* **Functionalities:**
  * Integrates with the official Razorpay payment gateway SDK, creating remote gateway orders mapped to internal payment intents.
  * Tracks every transaction attempt in `payment_attempts`, logging provider order IDs, payment IDs, and failure codes.
  * **Cryptographic HMAC-SHA256 Verification:** Verifies signatures for client callback redirects and asynchronous webhooks before executing any database mutations.
  * **Fail-Closed Processing:** Rejects requests with missing or mismatched signatures, logging security alerts and preventing phantom orders.
  * **Deduplicated Webhook Engine:** Uses `payment_webhook_events` with lease timeouts (60s) to prevent duplicate processing of re-delivered webhooks.
  * **Concurrent Race Self-Healing:** Seamlessly resolves races between simultaneous customer return callbacks and gateway webhooks via retry loops on unique constraint conflicts (`orders_store_checkout_idx`), ensuring exactly one order is created.
  * Executes gateway refunds (partial or full) and reconciles payment statuses (`CAPTURED`, `FAILED`, `REFUNDED`, `REQUIRES_RECONCILIATION`).

---

### Module 11: Order Lifecycle, Fulfillment & Audit History

* **Endpoints:** `/api/v1/stores/[storeId]/orders`, `/api/v1/stores/[storeId]/orders/[orderId]`, `/api/v1/stores/[storeId]/orders/[orderId]/fulfill`, `/api/v1/stores/[storeId]/orders/[orderId]/cancel`
* **Services:** `OrderService`, `OrderStatusService`, `OrderFulfillmentService`
* **Functionalities:**
  * Transforms completed checkouts into legal orders with sequential human-readable numbers (`ORD-TIMESTAMP-RANDOM`).
  * Creates immutable line item snapshots capturing product name, variant title, SKU, unit price, applied discount, and tax allocation at time of purchase.
  * Governs the order state machine: `PENDING` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED`, `CANCELLED`, or `REFUNDED`.
  * Logs an append-only status transition history (`order_status_history`) with timestamps, actor IDs, actor types (`SYSTEM`, `MERCHANT`, `CUSTOMER`), and transition reasons.
  * Manages partial and full item fulfillments, attaching carrier names, tracking numbers, and tracking URLs.
  * Orchestrates cancellation workflows: restoring reserved/committed stock and triggering refunds.

---

### Module 12: Stored-Value Instruments, Gift Cards & Customer Store Credit (GAP-14 / GAP-13)

* **Endpoints:** `/api/v1/stores/[storeId]/gift-cards`, `/api/v1/stores/[storeId]/gift-cards/lookup`, `/api/v1/stores/[storeId]/customers/[customerId]/store-credit`
* **Services:** `GiftCardService`, `StoreCreditService`, `CheckoutStoredValueIntegration`, `GiftCardAutoIssuer`
* **Functionalities:**
  * Issues digital gift cards with high-entropy alphanumeric codes (formatted and masked as `•••• •••• •••• 1234`), balance tracking, and status management (`ACTIVE`, `DEPLETED`, `DISABLED`, `EXPIRED`).
  * Maintains an append-only double-entry ledger (`gift_card_ledger`) tracking initial issuance, checkout redemptions, and refund additions.
  * Manages customer store credit accounts linked to verified customer identities, backed by an immutable `store_credit_ledger`.
  * **Checkout Stacking:** Enables shoppers to apply multiple gift cards alongside store credit on a single checkout, proportionally reducing the net payable gateway amount.
  * Supports Zero-Payment Orders: When stored value covers 100% of the checkout total, the platform bypasses the payment gateway, creates the order immediately, marks it `PAID`, and redeems balances atomically.
  * **Automated Digital Issuance:** Automatically generates and emails digital gift card codes to recipients when an order containing gift card products is marked paid.

---

### Module 13: Reverse Logistics, Returns & Customer Exchanges (GAP-13 / GAP-14)

* **Endpoints:** `/api/v1/stores/[storeId]/returns`, `/api/v1/stores/[storeId]/returns/[returnId]`, `/api/v1/stores/[storeId]/returns/[returnId]/approve`, `/api/v1/stores/[storeId]/returns/[returnId]/receive`, `/api/v1/stores/[storeId]/returns/[returnId]/refund`
* **Services:** `ReturnService`, `ReturnRefundCoordinator`, `ReturnPolicyService`
* **Functionalities:**
  * Manages the customer return lifecycle: `REQUESTED` -> `APPROVED` or `REJECTED` -> `RECEIVED` -> `CLOSED`.
  * Enforces policy constraints: returns are restricted to fulfilled orders within the store's return window (e.g., 14, 30 days) and prevent returning more units than were purchased.
  * Restricts open return requests to one active request per order at a time to prevent duplicate submissions.
  * Provides a merchant inspection queue for staff to inspect physical goods, note condition, and record restocking decisions.
  * **Flexible Refund Routing:** Directs refunds either back to the original gateway payment method or as an instant customer store credit balance.
  * Maintains an immutable audit trail of return lifecycle events in `return_request_events`.

---

### Module 14: Platform Administration & Multi-Tenant Governance

* **Endpoints:** `/api/v1/platform-admin/organizations`, `/api/v1/platform-admin/stores`, `/api/v1/platform-admin/metrics`, `/api/v1/platform-admin/audit-logs`
* **Services:** `PlatformAdminService`, `PlatformAuditService`
* **Functionalities:**
  * Provides a centralized control center for platform super-administrators.
  * Manages organization and store provisioning, operational suspensions, and reactivations.
  * Aggregates platform-wide metrics: cross-tenant Gross Merchandise Value (GMV), total active stores, payment gateway success rates, and active user counts.
  * Maintains system-wide audit logs tracking high-privilege administrative actions.

---

### Module 15: Storefront Product Reviews & Buyer Verification

* **Endpoints:** `/api/v1/stores/[storeId]/products/[productId]/reviews`, `/api/v1/stores/[storeId]/reviews/[reviewId]/moderate`
* **Services:** `ReviewService`
* **Functionalities:**
  * Enables customer review and star-rating submissions on product pages.
  * **Verified Buyer Verification:** Validates that the reviewing customer has a completed, delivered order containing the product before granting a `Verified Buyer` badge.
  * Provides a merchant moderation queue (`PENDING`, `APPROVED`, `REJECTED`) with profanity filtering.
  * Automatically recalculates and caches product aggregate rating metrics (average rating, total review count).

---

### Module 16: Asynchronous Worker Ecosystem & Scheduled Reconcilers (`apps/worker`)

* **Runtimes:** `apps/worker/src/index.ts`, `PaymentRecoveryScheduler`
* **Jobs:** `PaymentRecoveryJob`, `WebhookRecoveryJob`, `InventoryExpirationRecoveryJob`, `CartCleanupJob`
* **Functionalities:**
  * Runs a resilient background worker daemon executing cyclic maintenance and reconciliation jobs.
  * **Payment Recovery (`PaymentRecoveryJob`):** Scans for orphaned `CAPTURED` payments lacking order linkages (e.g., caused by network crashes after gateway charge) and finalizes the orders. Reconciles ambiguous `REQUIRES_RECONCILIATION` transactions directly with the Razorpay API.
  * **Webhook Recovery (`WebhookRecoveryJob`):** Identifies webhook events stuck in `PROCESSING` status beyond their lease timeout (60s) and safely resets or reclaims them for processing.
  * **Inventory Expiration Recovery (`InventoryExpirationRecoveryJob`):** Detects `ACTIVE` checkout reservations past their expiration timestamp, returning reserved stock back to available warehouse inventory.
  * **Cart Cleanup (`CartCleanupJob`):** Flags carts inactive past the abandonment threshold as `ABANDONED`, dispatches recovery notification emails, and purges ancient carts past retention limits.

---

## 2. Module Linkages

### Architectural & Data Interconnections

Cal Cart enforces strict multi-tenant boundaries and clean domain encapsulation. Cross-module interactions occur via public application service interfaces or asynchronous domain events dispatched through the in-process `@calcart/event-bus`. Modules never perform direct SQL joins or mutations against another module's internal tables.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   organizations                                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 1:N
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       stores                                           │
└───────┬──────────────┬─────────────┬──────────────┬─────────────┬──────────────┬───────┘
        │ 1:N          │ 1:N         │ 1:N          │ 1:N         │ 1:N          │ 1:N
        ▼              ▼             ▼              ▼             ▼              ▼
  ┌───────────┐  ┌───────────┐ ┌───────────┐  ┌───────────┐ ┌───────────┐  ┌───────────┐
  │ customers │  │ products  │ │ shipping  │  │    tax    │ │ discounts │  │gift_cards │
  └─────┬─────┘  └─────┬─────┘ └─────┬─────┘  └─────┬─────┘ └─────┬─────┘  └─────┬─────┘
        │              │             │              │             │              │
        │ 1:N          │ 1:N         │ 1:N          │ 1:N         │ 1:N          │ 1:N
        ▼              ▼             ▼              ▼             ▼              ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                                     checkouts                                      │
  │   (Items, Addresses, Frozen Shipping Quote, Frozen Tax Snapshot, Stored Value)     │
  └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                             │ 1:1
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                                     payments                                       │
  │                     (Payment Attempts, Gateway Orders, Webhooks)                   │
  └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                             │ 1:1
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                                      orders                                        │
  │            (Order Items, Invoices, Status History, Fulfillments, Redemptions)      │
  └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                             │ 1:N
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                                 return_requests                                    │
  │                      (Inspection Events, Store Credit / Gateway Refunds)           │
  └────────────────────────────────────────────────────────────────────────────────────┘
```

* **Stores (Module 1) → All Modules:** Every domain table carries a mandatory `store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT`. All queries must filter by `store_id`, guaranteeing multi-tenant isolation.
* **Products (Module 3) → Inventory (Module 4):** Each product variant references an `inventory_item_id`. Stock level adjustments, threshold evaluations, and reservation locks directly reference inventory items.
* **Carts (Module 6) → Checkout (Module 7):** Checkouts are initialized directly from cart contents. Line item snapshots, variant prices, and customer IDs copy into the checkout session, which immediately creates temporary stock holds in Module 4.
* **Shipping (Module 8) & Tax (Module 9) → Checkout (Module 7):** When the customer supplies a shipping destination, Checkout triggers Shipping to match geographic zones and compute rate options. Upon rate selection, Checkout triggers Tax to evaluate GST rules, compute CGST/SGST/IGST splits, and freeze an immutable `checkout_tax_snapshots` record.
* **Discounts (Module 5) & Stored Value (Module 12) → Checkout (Module 7):** Checkout applies discount rules, pro-rating basket reductions across items. Stored-value instruments (gift cards and store credit) are applied next, deducting from the balance and computing the final net payable gateway amount.
* **Checkout (Module 7) → Payments (Module 10) → Orders (Module 11):** Payment intents initialize against the net payable amount. When the gateway confirms payment capture (via callback or webhook), `PaymentOrderIntegration` completes the purchase: it creates the order in Module 11, commits stock holds in Module 4, marks gift card redemptions in Module 12, issues the legal tax invoice in Module 9, and sets the checkout status to `COMPLETED`.
* **Orders (Module 11) → Returns (Module 13) → Stored Value (Module 12) / Payments (Module 10):** Delivered orders can initiate return requests in Module 13. When merchant inspections approve the return, the refund coordinator routes funds either back to the Razorpay gateway via Module 10 or issues customer store credit via Module 12, while notifying Module 4 to restock inventory.
* **Worker (Module 16) → Payments, Checkout, Inventory, Carts:** The background worker runs cyclic maintenance routines across modules—recovering lost orders from captured payments, releasing expired inventory holds, reclaiming stuck webhook locks, and transitioning inactive carts to abandoned.

---

### End-to-End Operational Workflow & State Machine Governance

```
 [Shopper Adds Items to Cart]
              │
              ▼
 [Checkout Initialization] ──────────► (Checkout State: OPEN)
              │                         • Temporary Stock Reservation Hold Created
              ▼
 [Address & Shipping Method Selected]
              │                         • Shipping Zone Matched & Rate Quoted
              ▼                         • Statutory GST Calculated & Tax Snapshot Frozen
 [Stored Value & Discounts Applied]
              │                         • Promo Codes Evaluated & Pro-Rated
              ▼                         • Gift Cards & Store Credit Deducted
 [Payment Initialization] ────────────► (Checkout State: PAYMENT_PENDING)
              │                         • Razorpay Gateway Order Created
              ▼
 [Payment Authentication & Capture] ──► (Payment State: CAPTURED)
              │
              ▼
 [Atomic Purchase Finalization]
              ├──────────────────────► (Order State: PENDING, Payment Status: PAID)
              ├──────────────────────► (Checkout State: COMPLETED)
              ├──────────────────────► Stock Reservations Committed to Order
              ├──────────────────────► Stored Value Redemptions Deducted
              ├──────────────────────► Sequential Legal Tax Invoice Issued (INV-YYYY-XXXX)
              └──────────────────────► Digital Gift Cards Minted & Dispatched
              │
              ▼
 [Order Fulfillment & Delivery] ──────► (Order State: SHIPPED -> DELIVERED)
              │
              ▼
 [Post-Purchase Returns (Optional)]
              ├──► Return Request Submitted (Return State: REQUESTED)
              ├──► Merchant Inspection (Return State: APPROVED -> RECEIVED)
              └──► Refund Finalization (Return State: CLOSED)
                        ├──► Option A: Payment Gateway Refund Issued
                        └──► Option B: Instant Customer Store Credit Added
```

Every critical commerce entity transitions through an explicit Finite State Machine (FSM) governed by database transactions, row-level locks, and strict precondition checks:

#### 1. Checkout State Machine FSM (`checkouts.status`)

| Current State | Permitted Action | Target State | Trigger Type | Required Preconditions |
| --- | --- | --- | --- | --- |
| `OPEN` | `attach_payment` | `PAYMENT_PENDING` | Shopper / API | Addresses valid, shipping selected, tax snapshot frozen, inventory reserved. |
| `OPEN` | `expire` | `EXPIRED` | Worker Daemon | Checkout session exceeded TTL (30 mins). Stock reservations released. |
| `OPEN` | `cancel` | `CANCELLED` | Shopper / API | Explicit abandonment. Stock reservations released. |
| `PAYMENT_PENDING` | `complete` | `COMPLETED` | Payment Finalizer | Payment verified and marked `CAPTURED`. Order created. |
| `PAYMENT_PENDING` | `fail_payment` | `OPEN` | Gateway / Shopper | Payment attempt failed or cancelled by user. Allows retry. |
| `PAYMENT_PENDING` | `expire` | `EXPIRED` | Worker Daemon | Checkout expired during payment attempt. Holds released. |

#### 2. Payment State Machine FSM (`payments.status`)

| Current State | Permitted Action | Target State | Trigger Type | Required Preconditions |
| --- | --- | --- | --- | --- |
| `REQUIRES_PAYMENT_METHOD` | `authorize` | `AUTHORIZED` | Gateway Callback | Valid HMAC signature, payment authorized at gateway. |
| `REQUIRES_PAYMENT_METHOD` | `capture` | `CAPTURED` | Gateway Callback / Webhook | Valid HMAC signature, gateway reports successful capture. |
| `REQUIRES_PAYMENT_METHOD` | `fail` | `FAILED` | Gateway Webhook | Terminal payment failure reported by gateway. |
| `REQUIRES_PAYMENT_METHOD` | `reconcile` | `REQUIRES_RECONCILIATION` | Recovery Worker | Ambiguous gateway response requiring manual or automated lookup. |
| `AUTHORIZED` | `capture` | `CAPTURED` | Merchant / Webhook | Gateway capture transaction executed. |
| `CAPTURED` | `refund_partial` | `CAPTURED` | Merchant Refund | Refund amount < captured amount. `refunded_amount` updated. |
| `CAPTURED` | `refund_full` | `REFUNDED` | Merchant Refund | Total refunded amount equals captured amount. |

#### 3. Order State Machine FSM (`orders.status`)

| Current State | Permitted Action | Target State | Trigger Type | Required Preconditions |
| --- | --- | --- | --- | --- |
| `PENDING` | `process` | `PROCESSING` | Merchant Admin | Order acknowledged, queued for warehouse pick and pack. |
| `PENDING` | `cancel` | `CANCELLED` | Merchant / Customer | Unfulfilled order cancelled. Restores stock, triggers refund. |
| `PROCESSING` | `ship` | `SHIPPED` | Fulfillment Service | Tracking number and carrier assigned to order items. |
| `SHIPPED` | `deliver` | `DELIVERED` | Carrier / Webhook | Carrier confirms parcel delivery to customer address. |
| `DELIVERED` | `refund` | `REFUNDED` | Return Refund Finalizer | Approved return processed and fully refunded. |

#### 4. Return Request State Machine FSM (`return_requests.status`)

| Current State | Permitted Action | Target State | Trigger Type | Required Preconditions |
| --- | --- | --- | --- | --- |
| `REQUESTED` | `approve` | `APPROVED` | Merchant Admin | Request within policy window, returnable quantities verified. |
| `REQUESTED` | `reject` | `REJECTED` | Merchant Admin | Merchant inspection or policy rejection. Restores returnable units. |
| `APPROVED` | `receive` | `RECEIVED` | Warehouse Staff | Physical return parcel received at warehouse. |
| `RECEIVED` | `close_with_refund`| `CLOSED` | Return Refund Finalizer | Refund executed (Gateway refund or Store Credit issuance). |

---

## 3. Key Features

### Important Features & Unique Capabilities

* **Concurrency-Safe Inventory & Anti-Overselling Pipeline:** Protects catalog stock using pessimistic row locking (`SELECT ... FOR UPDATE`) in PostgreSQL transactions during checkout reservation. Employs a two-phase stock reservation lifecycle (*Available* -> *Reserved* -> *Committed*) backed by automated expiration recovery jobs (`InventoryExpirationRecoveryJob`), guaranteeing zero overselling during viral product drops.
* **Dual-Channel Cryptographic Payment Verification & Self-Healing Concurrency:** Verifies every client redirect callback and server-to-server webhook using HMAC-SHA256 signatures before modifying domain records. Implements fail-closed security for invalid signatures and handles concurrent races between callbacks and webhooks through automatic retry loops that resolve unique constraint collisions (`orders_store_checkout_idx`), ensuring exactly one order is created.
* **Statutory Indian GST Compliance Engine (GAP-11):** Provides an automated tax computation engine that validates 15-character GSTIN checksums, resolves HSN codes across 5 tax slabs, dynamically splits tax into CGST/SGST (intra-state) or IGST (inter-state), freezes tax snapshots on checkouts, and issues sequential legal tax invoices (`INV-YYYY-XXXX`) numbered independently per financial year.
* **Dynamic Shipping Calculation Engine (GAP-12 / M6a):** Features a flexible shipping calculation engine that groups geographic regions into zones, aggregates parcel weights from product variants, computes weight- and subtotal-tiered rates, handles free shipping thresholds, freezes quotes during checkout, and applies GST to shipping charges.
* **Double-Entry Stored-Value Ledger (GAP-14 / GAP-13):** Manages gift cards and customer store credits through append-only financial ledgers (`gift_card_ledger`, `store_credit_ledger`). Allows stacking multiple gift cards and store credits on a single checkout, supports zero-payment orders when balances cover the total, and automatically issues digital gift cards upon order completion.
* **Reverse Logistics & Flexible Return Routing (GAP-13 / GAP-14):** Provides an end-to-end customer return system with automated policy checks, merchant inspection queues, restocking controls, and flexible refund routing to either the original payment gateway or instant store credit.
* **Asynchronous Recovery Worker Ecosystem (GAP-15):** A background worker daemon executes cyclic maintenance jobs: recovering orphaned captured payments, resolving ambiguous gateway transactions, reclaiming expired webhook locks, releasing abandoned checkout stock holds, and sending abandoned cart notification emails.
* **Strict Multi-Tenant Isolation:** Enforces multi-tenancy at the database level where all entity tables carry foreign keys to `stores(id)`. Derives tenant ownership exclusively from authenticated server sessions and supports custom domains with CNAME/TXT DNS verification challenges.
* **Atelier Design System & Zero Layout-Shift UX:** Built on Next.js 15, Tailwind CSS v4, Lucide icons, and Framer Motion spring physics. Replaces intrusive inline cart update spinners with dynamic, non-intrusive toast notifications, keeping cart items stationary during background updates.

---

### Mathematical Formulas & Business Calculations

#### 1. Integer Minor-Unit Arithmetic
All monetary transactions, balances, line prices, taxes, discounts, and shipping fees are computed and stored as integer minor units (`BIGINT` in cents/paise) to prevent floating-point rounding errors:

$$\text{Amount}_{\text{minor}} = \operatorname{round}\left(\text{Amount}_{\text{major}} \times 10^{\text{decimals}}\right)$$

#### 2. Pro-Rata Basket Discount Allocation by Line Weight
To guarantee accurate itemized refunds during returns, basket-level discounts are pro-rated across line items based on their gross monetary weight:

$$D_i = \left\lfloor D_{\text{total}} \times \frac{G_i}{\sum_{j=1}^{N} G_j} \right\rfloor$$

$$\text{Remainder} = D_{\text{total}} - \sum_{i=1}^{N} D_i$$

*(The integer remainder is distributed cent-by-cent to the highest-value lines to ensure $\sum D_i = D_{\text{total}}$.)*

#### 3. Indian Statutory GST Tax Calculations
Tax calculations are performed using basis-point tax rates ($R$, where $18\% = 1800$ bps):

* **Tax-Exclusive Model (Tax added on top of base price):**
  $$\text{Tax} = \operatorname{round}\left( B \times \frac{R}{10000} \right), \quad P_{\text{gross}} = B + \text{Tax}$$

* **Tax-Inclusive Model (Tax extracted from catalog price):**
  $$B = \operatorname{round}\left( P_{\text{gross}} \times \frac{10000}{10000 + R} \right), \quad \text{Tax} = P_{\text{gross}} - B$$

* **Intra-State GST Split (Merchant State = Customer Shipping State):**
  $$\text{CGST} = \left\lfloor \frac{\text{Tax}}{2} \right\rfloor, \quad \text{SGST} = \text{Tax} - \text{CGST}$$

* **Inter-State GST (Merchant State $\neq$ Customer Shipping State):**
  $$\text{IGST} = \text{Tax}$$

#### 4. Shipping Parcel Weight Aggregation
Total parcel weight combines product variant weights and default packaging tare weight:

$$W_{\text{parcel}} = W_{\text{packaging}} + \sum_{k=1}^{M} \left( Q_k \times W_k \right)$$

#### 5. Net Payable Gateway Total with Stored-Value Stacking
Net payable amount charged to the payment gateway after applying all stored-value instruments:

$$P_{\text{payable}} = \max\left(0, \; P_{\text{checkout}} - \sum_{g=1}^{K} \text{GiftCard}_g - \text{StoreCredit} \right)$$

---

### Business Benefits

* **Unified End-to-End Commerce Platform:** Replaces fragmented third-party plugins with a cohesive modular engine covering catalog management, checkout, tax compliance, payments, shipping, stored value, returns, and worker recovery.
* **Zero Inventory Overselling:** Concurrency-safe pessimistic database row locking and two-phase reservations eliminate overselling and customer disputes during peak promotional spikes.
* **Full Regulatory & Tax Compliance:** Eliminates tax compliance risks with automated GSTIN verification, HSN-to-GST mapping, CGST/SGST/IGST splitting, and audit-proof financial-year invoice generation.
* **Capital Retention via Stored Value & Store Credit:** Retains revenue within the merchant's business ecosystem by enabling instant store credit refunds for returns and supporting branded digital gift cards.
* **Operational Self-Healing & Reduced Maintenance:** Automated worker background jobs recover orphaned captured transactions, reclaim stuck webhook leases, and restore expired stock holds without manual intervention.
* **Enterprise Multi-Tenancy & Zero-Trust Security:** Guarantees strict multi-tenant isolation, cryptographically verified gateway integrations, and role-based access controls across organizations and stores.
* **Optimized High-Conversion Shopper Experience:** Delivers fast page loads, responsive layouts, intuitive variant selectors, non-intrusive cart updates, and mobile-friendly multi-step checkout.
