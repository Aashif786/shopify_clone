import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  NotificationOutboxRepository,
} from "@shopify-clone/db";
import {
  EmailService,
  resetEmailService,
  renderMerchantNewOrderEmail,
  renderMerchantLowStockEmail,
  renderMerchantWelcomeEmail,
  categorizeEmailError,
} from "@shopify-clone/email";
import {
  InventoryService,
} from "@shopify-clone/inventory";
import {
  PaymentOrderIntegration,
} from "@shopify-clone/payments";
import { NotificationDispatchJob } from "../../apps/worker/src/jobs/notifications/notification-dispatch-job.js";
import { GET as getNotifications } from "../../apps/web/app/api/v1/stores/[storeId]/notifications/route.js";
import { POST as retryNotification } from "../../apps/web/app/api/v1/stores/[storeId]/notifications/[notificationId]/retry/route.js";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { createIsolatedDatabase } from "../helpers/postgres.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Application-Wide Email Delivery System", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  let emailService: EmailService;
  let outboxRepo: NotificationOutboxRepository;
  let inventoryService: InventoryService;
  let paymentOrderIntegration: PaymentOrderIntegration;
  let dispatchJob: NotificationDispatchJob;
  const storeService = new StoreService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;

    emailService = new EmailService({
      mode: "test",
      appUrl: "https://demo.shopifyclone.com",
      fromEmail: "Shopify Clone <orders@shopifyclone.com>",
    });
    resetEmailService(emailService);

    outboxRepo = new NotificationOutboxRepository();
    inventoryService = new InventoryService();
    paymentOrderIntegration = new PaymentOrderIntegration();
    dispatchJob = new NotificationDispatchJob(emailService, outboxRepo);
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    resetEmailService();
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createAuthenticatedUser(email: string, role = "ACTIVE") {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Test User', 'scrypt:hash', $3)`,
      [userId, email, role],
    );

    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );

    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    return { userId, sessionId, cookie };
  }

  async function createStoreWithOwner(email = "owner@test.com", storeName = "Test Store") {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: storeName,
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  async function seedProductAndVariant(
    storeId: string,
    options?: { price?: number; available?: number; threshold?: number },
  ) {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();
    const price = options?.price ?? 4500;
    const available = options?.available ?? 20;

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Canvas Tote', $3, 'ACTIVE')`,
      [productId, storeId, `tote-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Natural Cotton', 'TOTE-NAT', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, 0)`,
      [inventoryItemId, storeId, variantId, available],
    );

    if (options?.threshold !== undefined) {
      await db.query(
        `UPDATE product_variants SET low_stock_threshold = $1 WHERE id = $2`,
        [options.threshold, variantId],
      );
    }

    return { productId, variantId, inventoryItemId };
  }

  // =========================================================================
  // 1. TEMPLATES & ERROR CATEGORIZATION
  // =========================================================================
  describe("1. Template Rendering & Error Classification", () => {
    it("renders merchant new order email with anti-XSS escaping and itemized summary", () => {
      const { html, text } = renderMerchantNewOrderEmail({
        to: "merchant@test.com",
        storeName: "Artisan Leather <script>alert('xss')</script>",
        storeSlug: "artisan-leather",
        orderId: "ord-123",
        orderNumber: "ORD-9999",
        customerName: "Alice <img src=x onerror=alert(1)>",
        customerEmail: "alice@example.com",
        items: [
          {
            name: "Classic Saddle Bag",
            variantTitle: "Brown / Tan",
            quantity: 2,
            unitPrice: 6000,
            lineTotal: 12000,
          },
        ],
        currency: "USD",
        subtotal: 12000,
        grandTotal: 12000,
        shippingAddress: {
          name: "Alice",
          addressLine1: "456 Oak Avenue",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "US",
        },
        dashboardOrderUrl: "https://demo.shopifyclone.com/merchant/orders/ord-123",
      });

      // Assert anti-XSS escaping
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x");

      // Assert content
      expect(html).toContain("ORD-9999");
      expect(html).toContain("Classic Saddle Bag");
      expect(html).toContain("$120.00");
      expect(html).toContain("https://demo.shopifyclone.com/merchant/orders/ord-123");
      expect(text).toContain("ORD-9999");
      expect(text).toContain("Classic Saddle Bag");
    });

    it("renders merchant low stock email distinguishing low stock vs out of stock", () => {
      const lowStockResult = renderMerchantLowStockEmail({
        to: "owner@test.com",
        storeName: "Pottery Studio",
        storeSlug: "pottery-studio",
        productTitle: "Clay Mug",
        variantTitle: "Terracotta",
        sku: "MUG-TERRA",
        availableQuantity: 3,
        lowStockThreshold: 5,
        isOutOfStock: false,
        dashboardInventoryUrl: "https://demo.shopifyclone.com/merchant/inventory",
      });

      expect(lowStockResult.html).toContain("LOW STOCK");
      expect(lowStockResult.html).toContain("3 units");
      expect(lowStockResult.html).toContain("5 units");
      expect(lowStockResult.text).toContain("LOW STOCK");

      const outOfStockResult = renderMerchantLowStockEmail({
        to: "owner@test.com",
        storeName: "Pottery Studio",
        storeSlug: "pottery-studio",
        productTitle: "Clay Mug",
        variantTitle: "Terracotta",
        sku: "MUG-TERRA",
        availableQuantity: 0,
        lowStockThreshold: 5,
        isOutOfStock: true,
        dashboardInventoryUrl: "https://demo.shopifyclone.com/merchant/inventory",
      });

      expect(outOfStockResult.html).toContain("OUT OF STOCK");
      expect(outOfStockResult.html).toContain("0 units");
      expect(outOfStockResult.text).toContain("OUT OF STOCK");
    });

    it("renders merchant welcome email with dashboard action link", () => {
      const result = renderMerchantWelcomeEmail({
        to: "marcus@test.com",
        recipientName: "Marcus",
        dashboardUrl: "https://demo.shopifyclone.com/merchant",
      });

      expect(result.html).toContain("Welcome to Shopify Clone");
      expect(result.html).toContain("Marcus");
      expect(result.html).toContain("https://demo.shopifyclone.com/merchant");
      expect(result.text).toContain("Welcome to Shopify Clone");
    });

    it("categorizes errors correctly as transient vs permanent", () => {
      const rateLimit = categorizeEmailError(new Error("429 Too Many Requests"));
      expect(rateLimit.category).toBe("RATE_LIMIT");
      expect(rateLimit.isTransient).toBe(true);

      const timeout = categorizeEmailError(new Error("Network timeout after 10000ms"));
      expect(timeout.category).toBe("TIMEOUT");
      expect(timeout.isTransient).toBe(true);

      const invalidEmail = categorizeEmailError(new Error("422 Validation error: invalid email address"));
      expect(invalidEmail.category).toBe("INVALID_ADDRESS");
      expect(invalidEmail.isTransient).toBe(false);

      const authErr = categorizeEmailError(new Error("401 Unauthorized API key"));
      expect(authErr.category).toBe("AUTHENTICATION_ERROR");
      expect(authErr.isTransient).toBe(false);

      const networkErr = categorizeEmailError(new Error("connect ECONNREFUSED 127.0.0.1:443"));
      expect(networkErr.category).toBe("NETWORK_ERROR");
      expect(networkErr.isTransient).toBe(true);

      const unknownErr = categorizeEmailError(new Error("Something completely random"));
      expect(unknownErr.category).toBe("UNKNOWN");
      expect(unknownErr.isTransient).toBe(true);
    });
  });

  // =========================================================================
  // 2. MERCHANT NEW ORDER QUEUEING & DISPATCH
  // =========================================================================
  describe("2. Merchant New Order Alert Queueing & Dispatch", () => {
    it("queues and delivers merchant order alert on payment capture with idempotency", async () => {
      const { store } = await createStoreWithOwner("merchant.owner@test.com", "Apparel Co");
      const { variantId } = await seedProductAndVariant(store.id, { price: 6000 });

      // Seed checkout and payment
      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
        cartId,
        store.id,
      ]);

      const checkoutId = generateUuidV7();
      const shippingAddress = JSON.stringify({
        firstName: "Buyer",
        lastName: "Smith",
        addressLine1: "100 Broadway",
        city: "New York",
        postalCode: "10001",
        country: "US",
      });

      await db.query(
        `INSERT INTO checkouts (
           id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
           status, payment_status, currency, email, shipping_address
         ) VALUES ($1, $2, $3, 6000, 6000, 0, 0, 0, 'PAYMENT_PENDING', 'PENDING', 'USD', $4, $5)`,
        [checkoutId, store.id, cartId, "buyer@customer.com", shippingAddress],
      );

      await db.query(
        `INSERT INTO checkout_items (
           id, checkout_id, store_id, variant_id, product_name_snapshot,
           variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, 'Canvas Tote', 'Natural Cotton', 'TOTE-NAT', 6000, 1, 6000)`,
        [generateUuidV7(), checkoutId, store.id, variantId],
      );

      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (
           id, store_id, checkout_id, amount, currency, status, provider, captured_amount, refunded_amount
         ) VALUES ($1, $2, $3, 6000, 'USD', 'CAPTURED', 'razorpay', 6000, 0)`,
        [paymentId, store.id, checkoutId],
      );

      // Execute purchase completion
      const res = await paymentOrderIntegration.completePurchaseWorkflow(db, {
        storeId: store.id,
        paymentId,
      });

      expect(res.orderCreated).toBe(true);

      // Verify outbox has MERCHANT_NEW_ORDER queued
      const merchantOutbox = await db.query<{
        id: string;
        store_id: string;
        notification_type: string;
        recipient_email: string;
        status: string;
        idempotency_key: string;
      }>(
        `SELECT id, store_id, notification_type, recipient_email, status, idempotency_key
         FROM notification_outbox
         WHERE store_id = $1 AND notification_type = 'MERCHANT_NEW_ORDER'`,
        [store.id],
      );

      expect(merchantOutbox.rows.length).toBe(1);
      expect(merchantOutbox.rows[0].recipient_email).toBe("merchant.owner@test.com");
      expect(merchantOutbox.rows[0].status).toBe("PENDING");
      expect(merchantOutbox.rows[0].idempotency_key).toBe(`merchant_order_alert:${res.order.id}`);

      // Run worker dispatch job
      const dispatchResult = await dispatchJob.run(db);
      expect(dispatchResult.totalProcessed).toBeGreaterThanOrEqual(2); // Customer + Merchant
      expect(dispatchResult.sentCount).toBeGreaterThanOrEqual(2);

      // Verify provider message ID was recorded and status is SENT
      const updatedOutbox = await db.query<{
        status: string;
        provider_message_id: string;
      }>(
        `SELECT status, provider_message_id FROM notification_outbox WHERE id = $1`,
        [merchantOutbox.rows[0].id],
      );
      expect(updatedOutbox.rows[0].status).toBe("SENT");
      expect(updatedOutbox.rows[0].provider_message_id).toBeDefined();

      // Check captured emails
      const captured = emailService.getCapturedEmails();
      const merchantEmail = captured.find((e) => e.to === "merchant.owner@test.com");
      expect(merchantEmail).toBeDefined();
      expect(merchantEmail?.subject).toContain("New Order");
      expect(merchantEmail?.html).toContain("Apparel Co");
    });
  });

  // =========================================================================
  // 3. INVENTORY LOW-STOCK THRESHOLD CROSSING & DEDUPLICATION
  // =========================================================================
  describe("3. Inventory Low-Stock Alert State Machine", () => {
    it("queues low stock alert on threshold crossing and suppresses redundant alerts", async () => {
      const { store } = await createStoreWithOwner("inventory.owner@test.com", "Supply Store");
      const { variantId } = await seedProductAndVariant(store.id, {
        available: 10,
        threshold: 5,
      });

      // 1. First stock decrease: 10 -> 4 (crosses threshold of 5)
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: -6,
        reason: "MANUAL_CORRECTION",
      });

      // Check outbox has LOW_STOCK_ALERT
      const initialAlerts = await db.query<{
        id: string;
        notification_type: string;
        status: string;
        payload: { availableQuantity: number; isOutOfStock: boolean };
      }>(
        `SELECT id, notification_type, status, payload
         FROM notification_outbox
         WHERE store_id = $1 AND notification_type = 'LOW_STOCK_ALERT'`,
        [store.id],
      );
      expect(initialAlerts.rows.length).toBe(1);
      expect(initialAlerts.rows[0].payload.availableQuantity).toBe(4);
      expect(initialAlerts.rows[0].payload.isOutOfStock).toBe(false);

      // 2. Second stock decrease: 4 -> 2 (already below threshold)
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: -2,
        reason: "MANUAL_CORRECTION",
      });

      // Assert NO second alert was queued (suppressed because it was already below threshold)
      const afterSecondAdjust = await db.query(
        `SELECT id FROM notification_outbox
         WHERE store_id = $1 AND notification_type = 'LOW_STOCK_ALERT'`,
        [store.id],
      );
      expect(afterSecondAdjust.rows.length).toBe(1);

      // 3. Restock above threshold: 2 -> 15 (re-arms trigger)
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 13,
        reason: "RESTOCK",
      });

      // 4. Stock decrease: 15 -> 0 (crosses threshold to out-of-stock)
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: -15,
        reason: "MANUAL_CORRECTION",
      });

      const afterOutOfStock = await db.query<{
        id: string;
        payload: { availableQuantity: number; isOutOfStock: boolean };
      }>(
        `SELECT id, payload FROM notification_outbox
         WHERE store_id = $1 AND notification_type = 'LOW_STOCK_ALERT'
         ORDER BY created_at ASC`,
        [store.id],
      );
      expect(afterOutOfStock.rows.length).toBe(2);
      expect(afterOutOfStock.rows[1].payload.availableQuantity).toBe(0);
      expect(afterOutOfStock.rows[1].payload.isOutOfStock).toBe(true);

      // Run worker dispatch job to deliver low stock emails
      await dispatchJob.run(db);

      const captured = emailService.getCapturedEmails();
      const lowStockEmails = captured.filter((e) => e.to === "inventory.owner@test.com");
      expect(lowStockEmails.length).toBe(2);
      expect(lowStockEmails[0].subject).toContain("[LOW STOCK]");
      expect(lowStockEmails[1].subject).toContain("[OUT OF STOCK]");
    });
  });

  // =========================================================================
  // 4. WORKER DISPATCH RETRY & BACKOFF
  // =========================================================================
  describe("4. Worker Dispatch Exponential Backoff & Categorization", () => {
    it("handles transient failure by recording error category and backoff retry", async () => {
      const { store } = await createStoreWithOwner("transient@test.com", "Transient Store");
      const orderId = generateUuidV7();

      // Enqueue notification directly
      const row = await outboxRepo.create(db, {
        storeId: store.id,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "customer@test.com",
        referenceType: "order",
        referenceId: orderId,
        idempotencyKey: `order_confirmation:${orderId}`,
        payload: {
          orderId,
          orderNumber: "ORD-FAIL-1",
          grandTotal: 5000,
          currency: "USD",
          storeName: "Transient Store",
          storeSlug: "transient-store",
        },
      });

      // Mock email service send to throw a rate limit error
      const originalSend = emailService.sendOrderConfirmation.bind(emailService);
      emailService.sendOrderConfirmation = async () => {
        return {
          success: false,
          error: "429 Too Many Requests - Resend rate limit hit",
          errorCategory: "RATE_LIMIT",
          isTransient: true,
        };
      };

      const result = await dispatchJob.run(db);
      expect(result.failedCount).toBe(1);

      const updated = await outboxRepo.findById(db, row.id);
      expect(updated?.status).toBe("PENDING");
      expect(updated?.attempts).toBe(1);
      expect(updated?.error_category).toBe("RATE_LIMIT");
      expect(updated?.error_message).toContain("429 Too Many Requests");
      expect(new Date(updated!.next_retry_at!).getTime()).toBeGreaterThan(Date.now());

      // Restore
      emailService.sendOrderConfirmation = originalSend;
    });

    it("terminates immediately with FAILED for permanent errors without burning 5 retries", async () => {
      const { store } = await createStoreWithOwner("permanent@test.com", "Permanent Store");
      const orderId = generateUuidV7();

      const row = await outboxRepo.create(db, {
        storeId: store.id,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "malformed-email-recipient",
        referenceType: "order",
        referenceId: orderId,
        idempotencyKey: `order_confirmation:${orderId}`,
        payload: {
          orderId,
          orderNumber: "ORD-FAIL-PERM",
          grandTotal: 5000,
          currency: "USD",
        },
      });

      const result = await dispatchJob.run(db);
      expect(result.failedCount).toBe(1);

      const updated = await outboxRepo.findById(db, row.id);
      expect(updated?.status).toBe("FAILED");
      expect(updated?.next_retry_at).toBeNull();
      expect(updated?.error_category).toBe("INVALID_ADDRESS");
    });
  });

  // =========================================================================
  // 5. MERCHANT NOTIFICATION OBSERVABILITY API & TENANT ISOLATION
  // =========================================================================
  describe("5. Merchant Observability API & Tenant Isolation", () => {
    it("allows store owner to list notifications with pagination, status filters, and masked recipient", async () => {
      const storeA = await createStoreWithOwner("ownerA@store.com", "Store Alpha");
      const storeB = await createStoreWithOwner("ownerB@store.com", "Store Beta");

      // Insert notifications for Store A
      await outboxRepo.create(db, {
        storeId: storeA.store.id,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "buyer1@domain.com",
        referenceType: "order",
        referenceId: generateUuidV7(),
        idempotencyKey: `ord_conf:${generateUuidV7()}`,
        payload: { orderNumber: "ORD-1" },
      });

      const failedNotification = await outboxRepo.create(db, {
        storeId: storeA.store.id,
        notificationType: "MERCHANT_NEW_ORDER",
        recipientEmail: "ownerA@store.com",
        referenceType: "order",
        referenceId: generateUuidV7(),
        idempotencyKey: `merch_ord:${generateUuidV7()}`,
        payload: { orderNumber: "ORD-2" },
      });

      await outboxRepo.recordAttemptFailure(
        db,
        failedNotification.id,
        "Provider timeout",
        null,
        true,
        "TIMEOUT",
      );
      // Mark as FAILED directly to simulate 5 failed retries
      await db.query(`UPDATE notification_outbox SET status = 'FAILED' WHERE id = $1`, [
        failedNotification.id,
      ]);

      // Insert notification for Store B
      await outboxRepo.create(db, {
        storeId: storeB.store.id,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "buyerB@domain.com",
        referenceType: "order",
        referenceId: generateUuidV7(),
        idempotencyKey: `ord_conf:${generateUuidV7()}`,
        payload: { orderNumber: "ORD-B" },
      });

      // 1. Store A owner lists all notifications
      const reqAll = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/notifications`,
        {
          headers: { Cookie: storeA.user.cookie },
        },
      );
      const resAll = await getNotifications(reqAll, {
        params: Promise.resolve({ storeId: storeA.store.id }),
      });
      expect(resAll.status).toBe(200);
      const bodyAll = await resAll.json();
      const dataAll = bodyAll.data;
      expect(dataAll.total).toBe(2);
      expect(dataAll.items.length).toBe(2);
      // Recipient masking check: should NOT leak full buyer1@domain.com
      expect(dataAll.items[0].recipientEmail).toMatch(/\*+/);

      // 2. Filter by status=FAILED
      const reqFailed = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/notifications?status=FAILED`,
        {
          headers: { Cookie: storeA.user.cookie },
        },
      );
      const resFailed = await getNotifications(reqFailed, {
        params: Promise.resolve({ storeId: storeA.store.id }),
      });
      const bodyFailed = await resFailed.json();
      const dataFailed = bodyFailed.data;
      expect(dataFailed.total).toBe(1);
      expect(dataFailed.items[0].id).toBe(failedNotification.id);
      expect(dataFailed.items[0].status).toBe("FAILED");

      // 3. Tenant cross-access check: Store A owner querying Store B endpoint
      const reqCross = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.store.id}/notifications`,
        {
          headers: { Cookie: storeA.user.cookie },
        },
      );
      const resCross = await getNotifications(reqCross, {
        params: Promise.resolve({ storeId: storeB.store.id }),
      });
      expect(resCross.status).toBe(404);
    });

    it("allows store owner to manually retry a failed notification and resets it to PENDING", async () => {
      const { user, store } = await createStoreWithOwner("retry.owner@test.com", "Retry Store");

      const failedNotification = await outboxRepo.create(db, {
        storeId: store.id,
        notificationType: "MERCHANT_NEW_ORDER",
        recipientEmail: "retry.owner@test.com",
        referenceType: "order",
        referenceId: generateUuidV7(),
        idempotencyKey: `merch_retry:${generateUuidV7()}`,
        payload: { orderNumber: "ORD-RETRY" },
      });

      await db.query(
        `UPDATE notification_outbox SET status = 'FAILED', error_message = 'Network down' WHERE id = $1`,
        [failedNotification.id],
      );

      // Retry request
      const reqRetry = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/notifications/${failedNotification.id}/retry`,
        {
          method: "POST",
          headers: { Cookie: user.cookie },
        },
      );

      const resRetry = await retryNotification(reqRetry, {
        params: Promise.resolve({
          storeId: store.id,
          notificationId: failedNotification.id,
        }),
      });

      expect(resRetry.status).toBe(200);
      const bodyRetry = await resRetry.json();
      const dataRetry = bodyRetry.data;
      expect(dataRetry.notification.status).toBe("PENDING");
      expect(dataRetry.notification.error_message).toBeNull();

      // Verify in DB
      const refreshed = await outboxRepo.findById(db, failedNotification.id);
      expect(refreshed?.status).toBe("PENDING");
      expect(refreshed?.error_message).toBeNull();
    });

    it("rejects retry attempt across tenant boundaries with 404", async () => {
      const storeA = await createStoreWithOwner("tenantA@test.com", "Tenant A");
      const storeB = await createStoreWithOwner("tenantB@test.com", "Tenant B");

      const notifB = await outboxRepo.create(db, {
        storeId: storeB.store.id,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "buyer@tenantb.com",
        referenceType: "order",
        referenceId: generateUuidV7(),
        idempotencyKey: `tenant_b_notif:${generateUuidV7()}`,
        payload: {},
      });

      // Tenant A owner tries to retry Tenant B notification through Tenant A storeId route
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/notifications/${notifB.id}/retry`,
        {
          method: "POST",
          headers: { Cookie: storeA.user.cookie },
        },
      );

      const res = await retryNotification(req, {
        params: Promise.resolve({
          storeId: storeA.store.id,
          notificationId: notifB.id,
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 6. MERCHANT WELCOME DIRECT DISPATCH
  // =========================================================================
  describe("6. Merchant Welcome Direct Dispatch", () => {
    it("dispatches welcome email directly without placing raw credentials in outbox", async () => {
      const sendResult = await emailService.sendMerchantWelcome({
        to: "new.merchant@example.com",
        name: "Elena Rostova",
        merchantName: "Elena Rostova",
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.messageId).toBeDefined();

      const captured = emailService.getCapturedEmails();
      const welcome = captured.find((e) => e.to === "new.merchant@example.com");
      expect(welcome).toBeDefined();
      expect(welcome?.subject).toContain("Welcome to Shopify Clone");
      expect(welcome?.html).toContain("Elena Rostova");

      // Verify that NO outbox row was written for direct in-memory auth dispatch
      const outboxEntries = await db.query(
        `SELECT id FROM notification_outbox WHERE recipient_email = 'new.merchant@example.com'`,
      );
      expect(outboxEntries.rows.length).toBe(0);
    });
  });
});
