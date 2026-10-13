# Shopify Clone: Demo Execution & Verification Guide

This guide provides instructions for launching, operating, and verifying the Shopify Clone demo environment using local PostgreSQL and Next.js App Router.

---

## 1. Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 10.0.0` (Repository uses `pnpm@12.9.1`)
- **Docker**: For running PostgreSQL (`postgres:16-alpine`)
- **Environment**: `.env` file populated from `.env.example`

---

## 2. Quick Start: Launching the Demo

### Step 1: Start PostgreSQL Database
```bash
docker compose up -d postgres
```
Verify the container is healthy:
```bash
docker compose ps
```
The database listens on `localhost:5433` (mapped from container port `5432`).

### Step 2: Apply Database Migrations
```bash
pnpm db:migrate
```
To check migration status:
```bash
pnpm db:migrate:status
```
All 11 migrations through `0011_create_discounts_schema.sql` will be verified as `applied`.

### Step 3: Populate Demo Seed Data
```bash
pnpm db:seed
```
Seeds default merchant (`merchant@example.com` / `Password123!`), store (`artisan-store`), catalog products, inventory stock, and active discount codes (`WELCOME20`, `DEMO20`, `SAVE10`).

### Step 4: Launch Web Application
```bash
pnpm dev
```
The application will be accessible at `http://localhost:3000`.

### Step 5: (Optional) Launch Background Worker
To run background recovery jobs, webhook processing leases, and reconciliation:
```bash
pnpm --filter @shopify-clone/worker dev
```

---

## 3. Automated Verification Commands

Run the following test commands to verify system integrity:

```bash
# 1. Browser-Level Smoke Tests (Storefront, Merchant Admin, Resiliency)
pnpm vitest run tests/ui/browser-level-smoke.test.tsx

# 2. Payment & Checkout Failure-Path Integration Validation
pnpm vitest run tests/integration/demo/payment-failure-paths.test.ts

# 3. Core End-to-End Demo Purchase Workflow
pnpm vitest run tests/integration/demo/complete-purchase-workflow.test.ts

# 4. Merchant End-to-End Workflow & Store Switching
pnpm vitest run tests/integration/demo/end-to-end-merchant-workflow.test.ts

# 5. Full Integration Test Suite (Payments, Checkout, Orders, Discounts, Recovery)
pnpm vitest run tests/integration/

# 6. Focused Discount Suite (Domain + Merchant Admin + Storefront)
pnpm vitest run tests/discounts/ tests/ui/merchant-discounts.test.tsx

# 7. Monorepo Quality & Production Build Checks
pnpm typecheck
pnpm lint
pnpm build
```

---

## 4. Manual Demo Walkthrough Guide

Follow these steps to demonstrate the end-to-end commerce experience:

### Step 1: Merchant Administration & Login
1. Navigate to `http://localhost:3000/merchant/login` (or directly access `/merchant` if session active).
2. Authenticate using seeded demo credentials:
   - **Email**: `merchant@example.com`
   - **Password**: `Password123!`
3. Verify store switcher displays **Demo Artisan Store** (`artisan-store`).
4. **Product Management (`/merchant/products`)**:
   - Inspect existing seeded catalog items or create a new product.
   - Configure a variant with SKU `MUG-001` and price `$45.00`.
   - Publish the product (`ACTIVE` status).
5. **Inventory Management (`/merchant/inventory`)**:
   - Inspect available stock (e.g. 25 units for Teapot).
   - Test stock adjustment modal with reason `RESTOCK` or `MANUAL_CORRECTION`.
6. **Discount Administration (`/merchant/discounts`)**:
   - Verify seeded codes `WELCOME20` (20% off, min spend $30), `DEMO20` (20% off, min spend $50), and `SAVE10` ($10 off, min spend $40).
   - Active status reflects immediately in checkout.
7. **Team Management (`/merchant/team`)**:
   - Inspect store membership and role protections (owner account cannot be removed).

### Step 2: Customer Storefront Experience
1. Open the storefront at `http://localhost:3000/stores/artisan-store/products`.
2. Browse products, click the ceramic teapot or mug, and add it to the cart.
3. Open the cart drawer at `http://localhost:3000/stores/artisan-store/cart`.
4. Enter discount code `WELCOME20` and click **Apply**.
   - Verify server-authoritative discount reflects 20% savings.
5. Click **Proceed to Checkout**.

### Step 3: Checkout & Payment
1. Complete customer information and shipping address (`/stores/artisan-store/checkout`).
2. Select delivery method (Standard Store Delivery).
3. Initialize payment using Razorpay test mode.
4. For live testing, configure Razorpay test keys in `.env`:
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...`
5. On callback verification, the checkout transitions to `COMPLETED` and the order is created with status `PAID`.
6. The customer is redirected to `/stores/artisan-store/orders/[orderId]/confirmation`.
7. Confirm the order summary, line items, and discounted total match database records.

### Step 4: Webhook Forwarding (Optional External Testing)
When testing asynchronous webhook delivery from external Razorpay servers:
1. Use an HTTP tunnel such as `ngrok`:
   ```bash
   ngrok http 3000
   ```
2. Configure webhook URL in the Razorpay Dashboard:
   `https://<your-subdomain>.ngrok-free.app/api/v1/payments/razorpay/webhook`
3. Subscribe to `payment.captured` and `order.paid` events.
4. Set `RAZORPAY_WEBHOOK_SECRET` in `.env` matching your Razorpay Dashboard secret.
