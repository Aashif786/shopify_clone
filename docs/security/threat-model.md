# Security Threat Model & Defense-in-Depth Strategy

This document outlines the threat modeling, trust boundaries, attack vectors, and security controls across Cal Cart.

---

## 1. System Trust Boundaries

```mermaid
flowchart TD
  subgraph Untrusted External Zone
    ClientBrowser[Client Browser / Guest Buyer]
    WebhookSource[External Payment Gateway - Razorpay]
  end

  subgraph System Boundary (TLS / Edge)
    ReverseProxy[Next.js App Router / Edge Middleware]
  end

  subgraph Trusted Internal Zone
    APILayer[Thin API Handlers & Resolvers]
    DomainModules[Domain Services & State Machines]
    PostgresDB[(PostgreSQL Source of Truth)]
    WorkerService[Background Recovery Worker]
  end

  ClientBrowser -->|Cookie / Auth Token / Guest Token| ReverseProxy
  WebhookSource -->|Raw Body + HMAC Signature| ReverseProxy
  ReverseProxy --> APILayer
  APILayer --> DomainModules
  DomainModules --> PostgresDB
  WorkerService --> PostgresDB
```

---

## 2. Threat Analysis by Category (STRIDE)

### 2.1 Spoofing Identity
- **Threat**: Attacker attempts to impersonate an organization owner, merchant staff, or another customer.
- **Mitigations**:
  - Secure `HttpOnly`, `SameSite=Lax`, `Secure` session cookies.
  - Password hashes computed using scrypt with cryptographically random salts.
  - Constant-time verification with dummy hash evaluation to resist user enumeration and timing attacks.
  - Password reset tokens expire after 60 minutes and are invalidated immediately upon use.

### 2.2 Tampering with Data
- **Threat**: Attacker alters order prices, inventory stock counts, or modifies another merchant's store data.
- **Mitigations**:
  - Client-submitted totals and prices are never trusted. All line item totals, discounts, and order amounts are calculated server-side from PostgreSQL records.
  - Razorpay payment callback signatures are verified using `HMAC_SHA256(order_id + "|" + payment_id, secret)`.
  - Database row locking (`SELECT ... FOR UPDATE`) prevents concurrent double-spend and duplicate deductions.

### 2.3 Repudiation
- **Threat**: User denies performing an action (e.g. order cancellation, refund, stock adjustment).
- **Mitigations**:
  - `order_status_history` logs previous status, next status, actor type (`MERCHANT`, `CUSTOMER`, `SYSTEM`), actor ID, and reason timestamp.
  - `inventory_adjustments` stores immutable records of quantity deltas, reasons, and user IDs.
  - `payment_attempts` logs gateway payment IDs and error responses.

### 2.4 Information Disclosure
- **Threat**: Cross-tenant data leaks, credentials in logs, or public inspection of unlinked checkouts.
- **Mitigations**:
  - Multi-tenant isolation: every query is scoped to `store_id`. Cross-store queries explicitly throw `CrossStoreOrderAccessError`, `CrossStorePaymentAccessError`, etc.
  - Guest checkout tokens are hashed with SHA-256 before database insertion; raw token is only held in client memory/cookie.
  - API errors sanitize internal stack traces in production responses.

### 2.5 Denial of Service
- **Threat**: Attacker spams public login or checkout verification routes.
- **Mitigations (Current & Recommended)**:
  - Query limits enforced (`LIMIT 100`).
  - Request body size limits enforced in Next.js route handlers.
  - **Identified Gap (GAP-02)**: Add sliding-window rate limiting to `/api/v1/auth/login` and payment verification routes.

### 2.6 Elevation of Privilege
- **Threat**: Staff member attempts to delete a store, or customer attempts to access merchant APIs.
- **Mitigations**:
  - Role hierarchy: `owner` (3) > `admin` (2) > `staff` (1).
  - Explicit authorization checks derived strictly from server-side session and store membership.
  - Customer storefront tokens cannot authenticate merchant administration endpoints.
