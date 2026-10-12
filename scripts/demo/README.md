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

### Step 3: Launch Web Application
```bash
pnpm dev
```
The application will be accessible at `http://localhost:3000`.

### Step 4: (Optional) Launch Background Worker
To run background recovery jobs, webhook processing leases, and reconciliation:
```bash
pnpm --filter @shopify-clone/worker dev
```

---

## 3. Automated Verification Commands

Run the following test commands to verify system integrity:

```bash
# 1. Run Core End-to-End Demo Purchase Workflow
pnpm vitest run tests/integration/demo/complete-purchase-workflow.test.ts

# 2. Run Full Integration Test Suite (Payments, Checkout, Orders, Discounts, Recovery)
pnpm vitest run tests/integration/

# 3. Run Focused Discount Suite (Domain + Merchant Admin + Storefront)
pnpm vitest run tests/discounts/ tests/ui/merchant-discounts.test.tsx

# 4. Monorepo Quality & Production Build Checks
pnpm typecheck
pnpm lint
pnpm build
```

---

## 4. Manual Demo Walkthrough Guide

Follow these steps to demonstrate the end-to-end commerce experience:

### Step 1: Merchant Administration
1. Navigate to `http://localhost:3000/merchant`.
2. **Product Management (`/merchant/products`)**:
   - Create a new product (e.g. "Ceramic Artisan Mug").
   - Configure a variant with SKU `MUG-001` and price `$45.00`.
   - Publish the product (`ACTIVE` status).
3. **Discount Administration (`/merchant/discounts`)**:
   - Click **Create Discount**.
   - Create percentage promo code `WELCOME20` (20% off, minimum spend `$30.00`).
   - Save and ensure the status shows `ACTIVE`.

### Step 2: Customer Storefront Experience
1. Open the storefront at `http://localhost:3000/stores/artisan-store/products`.
2. Browse products, click the ceramic mug, and add it to the cart.
3. Navigate to the cart at `http://localhost:3000/stores/artisan-store/cart`.
4. Enter discount code `WELCOME20` and click **Apply**.
   - Verify server-authoritative discount reflects 20% savings.
5. Click **Proceed to Checkout**.

### Step 3: Checkout & Payment
1. Complete customer information and shipping address.
2. Initialize payment using Razorpay test mode.
3. Submit simulated test card payment.
4. On callback verification, the checkout transitions to `COMPLETED` and the order is created with status `PAID`.
5. The customer is redirected to `/stores/artisan-store/orders/[orderId]/confirmation`.
6. Confirm the order summary, line items, and discounted total match database records.
